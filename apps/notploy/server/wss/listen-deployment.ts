import { spawn } from "node:child_process";
import type http from "node:http";
import {
	findServerById,
	isManagedCloud,
	validateRequest,
} from "@notploy/server";
import { encodeBase64 } from "@notploy/server/utils/docker/utils";
import {
	createRedactingLineBuffer,
	safeErrorMessage,
} from "@notploy/server/utils/security/redact";
import { readValidDirectory } from "@notploy/server/wss/utils";
import { Client, type ClientChannel } from "ssh2";
import { WebSocketServer } from "ws";
import { createCleanup } from "./cleanup";

export const setupDeploymentLogsWebSocketServer = (
	server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/listen-deployment",
	});

	server.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/_next/webpack-hmr") {
			return;
		}
		if (pathname === "/listen-deployment") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const logPath = url.searchParams.get("logPath");
		const serverId = url.searchParams.get("serverId");
		const { user, session } = await validateRequest(req);

		// Generate unique connection ID for tracking
		const connectionId = `deployment-logs-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		if (!logPath) {
			console.log(`[${connectionId}] logPath no provided`);
			ws.close(4000, "logPath no provided");
			return;
		}

		if (!readValidDirectory(logPath, serverId)) {
			ws.close(4000, "Invalid log path");
			return;
		}

		if (!user || !session) {
			ws.close();
			return;
		}

		let tailProcess: ReturnType<typeof spawn> | null = null;
		let sshClient: Client | null = null;
		let sshStream: ClientChannel | null = null;
		let killTimer: NodeJS.Timeout | null = null;

		// Every resource acquired for this socket funnels through this function.
		// It is idempotent: close, error and server shutdown can all race.
		const cleanup = createCleanup(
			() => {
				if (killTimer) {
					clearTimeout(killTimer);
					killTimer = null;
				}
			},
			() => {
				if (tailProcess && !tailProcess.killed) {
					tailProcess.kill("SIGTERM");
					killTimer = setTimeout(() => {
						if (tailProcess && !tailProcess.killed) {
							tailProcess.kill("SIGKILL");
						}
					}, 1000);
					killTimer.unref?.();
				}
			},
			() => sshStream?.close(),
			() => sshClient?.end(),
		);

		ws.on("close", cleanup);
		ws.on("error", cleanup);

		const sendLog = (
			redactor: ReturnType<typeof createRedactingLineBuffer>,
			text: string,
		) => {
			const redacted = redactor.push(text);
			if (redacted && ws.readyState === ws.OPEN) {
				ws.send(redacted);
			}
		};

		const streamLog = (
			redactor: ReturnType<typeof createRedactingLineBuffer>,
		) => {
			return (data: Buffer | string) => {
				sendLog(redactor, data.toString());
			};
		};

		try {
			if (serverId) {
				const server = await findServerById(serverId);

				if (server.organizationId !== session.activeOrganizationId) {
					ws.close();
					cleanup();
					return;
				}

				if (!server.sshKeyId) {
					ws.close();
					cleanup();
					return;
				}

				const redactor = createRedactingLineBuffer();
				sshClient = new Client();
				sshClient
					.on("ready", () => {
						const encodedPath = encodeBase64(logPath);
						const command = `tail -n +1 -f "$(echo '${encodedPath}' | base64 -d)"`;

						sshClient!.exec(command, (err, stream) => {
							if (err) {
								cleanup();
								ws.close();
								return;
							}
							sshStream = stream;
							stream
								.on("close", () => {
									sshStream = null;
									const remaining = redactor.flush();
									if (remaining && ws.readyState === ws.OPEN) {
										ws.send(remaining);
									}
									cleanup();
									ws.close();
								})
								.on("data", streamLog(redactor))
								.stderr.on("data", streamLog(redactor));
						});
					})
					.on("error", (err) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(`SSH error: ${safeErrorMessage(err)}`);
							ws.close();
						}
						cleanup();
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
					ws.close();
					cleanup();
					return;
				}
				const redactor = createRedactingLineBuffer();
				tailProcess = spawn("tail", ["-n", "+1", "-f", logPath]);

				tailProcess.stdout?.on("data", streamLog(redactor));

				tailProcess.stderr?.on("data", (data) => {
					const message = safeErrorMessage(`tail error: ${data.toString()}`);
					if (ws.readyState === ws.OPEN) {
						ws.send(message);
					}
				});

				tailProcess.on("close", () => {
					tailProcess = null;
					const remaining = redactor.flush();
					if (remaining && ws.readyState === ws.OPEN) {
						ws.send(remaining);
					}
					cleanup();
					ws.close();
				});

				tailProcess.on("error", () => {
					tailProcess = null;
					cleanup();
					ws.close();
				});
			}
		} catch (error) {
			cleanup();
			if (ws.readyState === ws.OPEN) {
				ws.send(safeErrorMessage(error) || "An error occurred");
				ws.close();
			}
		}
	});
};
