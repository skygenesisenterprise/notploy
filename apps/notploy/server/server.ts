import http from "node:http";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	IS_CLOUD,
	initCancelDeployments,
	initCronJobs,
	initializeNetwork,
	initSchedules,
	initializeSwarm,
	initVolumeBackupsCronJobs,
	sendNotployRestartNotifications,
	setupDirectories,
	startInternalDnsServer,
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
		if (!IS_CLOUD) {
			await ensureNotployNetwork();
		}
		if (process.env.NODE_ENV === "production" && !IS_CLOUD) {
			createDefaultMiddlewares();
			await initCronJobs();
			await initSchedules();
			await initCancelDeployments();
			await initVolumeBackupsCronJobs();
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
