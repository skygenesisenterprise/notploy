import http from "node:http";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	IS_CLOUD,
	initCancelDeployments,
	initCronJobs,
	isExternalJobsEnabled,
	initializeNetwork,
	initSchedules,
	initializeSwarm,
	initVolumeBackupsCronJobs,
	sendNotployRestartNotifications,
	setupDirectories,
	startCommunitySync,
	startInternalDnsServer,
	startTrafficCollector,
	validateInstallation,
} from "@notploy/server";
import { config } from "dotenv";
import next from "next";
import packageInfo from "../package.json";
import { setupDockerContainerLogsWebSocketServer } from "./wss/docker-container-logs";
import { setupDockerContainerTerminalWebSocketServer } from "./wss/docker-container-terminal";
import { setupDockerStatsMonitoringSocketServer } from "./wss/docker-stats";
import { setupDrawerLogsWebSocketServer } from "./wss/drawer-logs";
import { setupDeploymentLogsWebSocketServer } from "./wss/listen-deployment";
import { setupTerminalWebSocketServer } from "./wss/terminal";

config({ path: ".env" });
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

// Initialize critical directories and Traefik config BEFORE Next.js starts.
// This prevents race conditions with the install script and, in development,
// makes sure the Compose-managed Traefik service has a config file to read from
// the shared config path (NOTPLOY_CONFIG_PATH).
if (!IS_CLOUD) {
	setupDirectories();
	createDefaultTraefikConfig();
	createDefaultServerTraefikConfig();
	createDefaultMiddlewares();
	console.log("✅ initialization complete");
}

/**
 * Deployments attach their services (and Traefik) to the shared
 * `notploy-network`, so it must exist before the first deploy. Production calls
 * this from the bootstrap block below; development needs it too because the
 * Compose dev stack starts the app without running `pnpm setup`.
 */
const ensureNotployNetwork = async () => {
	try {
		await initializeSwarm();
		await initializeNetwork();
	} catch (error) {
		console.error("Failed to initialize notploy-network", error);
	}
};

// Surface the instance identity state at startup: a missing, expired or
// unauthorized identity must produce a clear diagnostic rather than a silent
// boot (issue #75 §6). Self-hosted installs bootstrap it locally (install.sh or
// the container entrypoint); cloud/console need a signed entitlement.
const installation = validateInstallation();
for (const diagnostic of installation.diagnostics) {
	const line = `[identity] ${diagnostic.code}: ${diagnostic.message}`;
	if (diagnostic.severity === "error") {
		console.error(line);
	} else if (diagnostic.severity === "warning") {
		console.warn(line);
	} else {
		console.log(line);
	}
}
if (!installation.healthy) {
	console.error(
		"[identity] this installation is not fully authorized; see the diagnostics above",
	);
}

const app = next({ dev, turbopack: process.env.TURBOPACK === "1" });
const handle = app.getRequestHandler();
void app.prepare().then(async () => {
	try {
		console.log("Running NotployVersion: ", packageInfo.version);
		const server = http.createServer((req, res) => {
			if (dev && req.url?.includes("_clientMiddlewareManifest.js")) {
				const originalSetHeader = res.setHeader.bind(res);
				res.setHeader = (
					name: string,
					value: number | string | readonly string[],
				) => {
					if (name.toLowerCase() === "content-type") {
						return originalSetHeader(
							"Content-Type",
							"application/javascript; charset=utf-8",
						);
					}
					return originalSetHeader(name, value);
				};
				const originalWriteHead = res.writeHead.bind(res);
				(res as any).writeHead = (
					statusCode: number,
					...args: any[]
				) => {
					for (const arg of args) {
						if (arg && typeof arg === "object" && "content-type" in Object.fromEntries(
							Object.entries(arg).map(([k, v]) => [k.toLowerCase(), v]),
						)) {
							(arg as Record<string, string>)["content-type"] =
								"application/javascript; charset=utf-8";
							(arg as Record<string, string>)["Content-Type"] =
								"application/javascript; charset=utf-8";
						}
					}
					return originalWriteHead(statusCode, ...args);
				};
			}
			handle(req, res);
		});

		// WEBSOCKET
		setupDrawerLogsWebSocketServer(server);
		setupDeploymentLogsWebSocketServer(server);
		setupDockerContainerLogsWebSocketServer(server);
		setupDockerContainerTerminalWebSocketServer(server);
		setupTerminalWebSocketServer(server);
		if (!IS_CLOUD) {
			setupDockerStatsMonitoringSocketServer(server);
		}

		server.listen(PORT, HOST);
		console.log(`Server Started on: http://${HOST}:${PORT}`);

		// Serves the Notploy Internal DNS zones to the local network and forwards
		// everything else upstream. Disabled with NOTPLOY_DNS_SERVER=false.
		startInternalDnsServer();
		// Community Console: refresh the cached GitHub activity of the followed
		// repositories. Registered in every environment so the console is never
		// showing data the scheduler forgot to update; it is a no-op when no
		// source is configured.
		await startCommunitySync();
		if (!IS_CLOUD) {
			await ensureNotployNetwork();
		}
		if (process.env.NODE_ENV === "production" && !IS_CLOUD) {
			createDefaultMiddlewares();
			await initCronJobs();
			await initSchedules();
			await initCancelDeployments();
			await initVolumeBackupsCronJobs();
			// Traffic Manager: incremental Traefik access-log collection plus the
			// retention job of the traffic aggregates.
			await startTrafficCollector();
			await sendNotployRestartNotifications();
		}

		if (!IS_CLOUD) {
			console.log("Starting Deployment Worker");
			const { startDeploymentWorker } = await import("./queues/queueSetup");
			await startDeploymentWorker();
		}
	} catch (e) {
		console.error("Main Server Error", e);
	}
});
