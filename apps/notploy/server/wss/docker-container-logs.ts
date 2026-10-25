import type http from "node:http";
import {
	findServerById,
	isManagedCloud,
	validateRequest,
} from "@notploy/server";
import {
	createRedactingLineBuffer,
	safeErrorMessage,
} from "@notploy/server/utils/security/redact";
import { spawn } from "node-pty";
import { Client, type ClientChannel } from "ssh2";
import { WebSocketServer } from "ws";
import { canAccessDockerOverWss } from "./authorize";
import { createCleanup } from "./cleanup";
import {
	getShell,
	isValidContainerId,
	isValidSearch,
	isValidSince,
	isValidTail,
} from "./utils";

export const setupDockerContainerLogsWebSocketServer = (
	server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/docker-container-logs",
	});

	server.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/_next/webpack-hmr") {
			return;
		}
		if (pathname === "/docker-container-logs") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const containerId = url.searchParams.get("containerId");
		const tail = url.searchParams.get("tail") ?? "100";
		const search = url.searchParams.get("search") ?? "";
		const since = url.searchParams.get("since") ?? "all";
		const serverId = url.searchParams.get("serverId");
		const runType = url.searchParams.get("runType");
		const serviceId = url.searchParams.get("serviceId");
		const { user, session } = await validateRequest(req);

		if (!containerId) {
			ws.close(4000, "containerId no provided");
			return;
		}

		// Security: Validate containerId to prevent command injection
		if (!isValidContainerId(containerId)) {
			ws.close(4000, "Invalid container ID format");
			return;
		}

		if (!isValidTail(tail)) {
			ws.close(4000, "Invalid tail parameter");
			return;
		}

		if (!isValidSince(since)) {
			ws.close(4000, "Invalid since parameter");
			return;
		}

		if (search !== "" && !isValidSearch(search)) {
			ws.close(4000, "Invalid search parameter");
			return;
		}

		if (!user || !session) {
			ws.close();
			return;
		}

		if (!(await canAccessDockerOverWss(user, session, serverId, serviceId))) {
			ws.close(4003, "Not authorized");
			return;
		}

		let sshClient: Client | null = null;
		let sshStream: ClientChannel | null = null;
		let ptyProcess: ReturnType<typeof spawn> | null = null;

		// Set up keep-alive ping mechanism to prevent timeout
		// Send ping every 45 seconds to keep connection alive
		const pingInterval = setInterval(() => {
			if (ws.readyState === ws.OPEN) {
				ws.ping();
			}
		}, 45000);

		const cleanup = createCleanup(
			() => clearInterval(pingInterval),
			() => sshStream?.close(),
			() => sshClient?.end(),
			() => ptyProcess?.kill(),
		);

		ws.on("close", cleanup);
		ws.on("error", cleanup);

		const redactor = createRedactingLineBuffer();
		const sendLog = (data: Buffer | string) => {
			const redacted = redactor.push(data.toString());
			if (redacted && ws.readyState === ws.OPEN) {
				ws.send(redacted);
			}
		};
		const flushLogs = () => {
			const remaining = redactor.flush();
			if (remaining && ws.readyState === ws.OPEN) {
				ws.send(remaining);
			}
		};

		try {
			if (serverId) {
				const server = await findServerById(serverId);

				if (server.organizationId !== session.activeOrganizationId) {
					cleanup();
					ws.close();
					return;
				}

				if (!server.sshKeyId) {
					cleanup();
					ws.close();
					return;
				}

				sshClient = new Client();
				sshClient
					.once("ready", () => {
						const baseCommand = `docker ${runType === "swarm" ? "service" : "container"} logs --timestamps ${
							runType === "swarm" ? "--raw" : ""
						} --tail ${tail} ${
							since === "all" ? "" : `--since ${since}`
						} --follow ${containerId}`;
						const escapedSearch = search ? search.replace(/'/g, "'\\''") : "";
						const command = search
							? `${baseCommand} 2>&1 | grep --line-buffered -iF "${escapedSearch}"`
							: baseCommand;
						// Use pty: true to ensure the remote process receives SIGHUP when SSH connection closes
						// This is crucial for terminating docker logs processes when the connection is closed
						sshClient!.exec(command, { pty: true }, (err, stream) => {
							if (err) {
								console.error("Execution error:", safeErrorMessage(err));
								cleanup();
								ws.close();
								return;
							}
							sshStream = stream;
							stream
								.on("close", () => {
									flushLogs();
									cleanup();
									ws.close();
								})
								.on("data", sendLog)
								.stderr.on("data", sendLog);
						});
					})
					.on("error", (err) => {
						console.error("SSH connection error:", safeErrorMessage(err));
						if (ws.readyState === ws.OPEN) {
							ws.send(`SSH error: ${safeErrorMessage(err)}`);
						}
						cleanup();
						ws.close();
					})
					.connect({
						host: server.ipAddress,
						port: server.port,
						username: server.username,
						privateKey: server.sshKey?.privateKey,
					});
			} else {
				if (isManagedCloud()) {
					ws.send("This feature is not available in the cloud version.");
					cleanup();
					ws.close();
					return;
				}
				const shell = getShell();
				const baseCommand = `docker ${runType === "swarm" ? "service" : "container"} logs --timestamps ${
					runType === "swarm" ? "--raw" : ""
				} --tail ${tail} ${
					since === "all" ? "" : `--since ${since}`
				} --follow ${containerId}`;
				const command = search
					? `${baseCommand} 2>&1 | grep -iF '${search}'`
					: baseCommand;
				ptyProcess = spawn(shell, ["-c", command], {
					name: "xterm-256color",
					cwd: process.env.HOME,
					env: process.env,
					encoding: "utf8",
					cols: 80,
					rows: 30,
				});

				ptyProcess.onData(sendLog);
				ptyProcess.onExit(() => {
					ptyProcess = null;
					flushLogs();
					cleanup();
					ws.close();
				});
				ws.on("message", (message) => {
					try {
						let command: string | Buffer[] | Buffer | ArrayBuffer;
						if (Buffer.isBuffer(message)) {
							command = message.toString("utf8");
						} else {
							command = message;
						}
						ptyProcess?.write(command.toString());
					} catch (error) {
						if (ws.readyState === ws.OPEN) {
							ws.send(safeErrorMessage(error));
						}
					}
				});
			}
		} catch (error) {
			cleanup();
			if (ws.readyState === ws.OPEN) {
				ws.send(safeErrorMessage(error));
			}
		}
	});
};
