/**
 * Electron main entry point.
 *
 * Composition only: this file builds the object graph (logging → secure storage
 * → connection store → manager → services → IPC → window → menu → tray) and
 * owns the application lifecycle. No business logic lives here, so everything
 * below it can be unit-tested without Electron.
 *
 * Startup order matters in two places:
 *
 * - The security policy is installed on the session *before* the window is
 *   created, so the renderer's very first request is already subject to it.
 * - The `open-url` listener is registered *before* `whenReady`, because macOS
 *   can deliver a deep link before the app is ready. Links received that early
 *   are queued in {@link pendingDeepLinks} and replayed once the router exists.
 */

import path from "node:path";
import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	session,
} from "electron";
import type { ConnectionSummary } from "@/shared/domain";
import { type AppInfo, IPC_EVENTS, type MenuCommand } from "@/shared/ipc";
import { createInsecureFetch } from "./client/insecure-fetch";
import { ConnectionManager } from "./connection/connection-manager";
import { ConnectionStore } from "./connection/connection-store";
import {
	DeepLinkRouter,
	deepLinkFromArgv,
	registerProtocolClient,
} from "./deep-links";
import { DeploymentWatcher } from "./deployment-watcher";
import { forwardRendererDiagnostics } from "./dev-diagnostics";
import { registerIpcHandlers } from "./ipc";
import { createFileLogger, logDirectoryFor } from "./logging";
import { installApplicationMenu, openExternalUrl } from "./menu";
import { NotificationService } from "./notifications";
import { PreferencesService } from "./preferences";
import {
	allowedOriginsFor,
	applyContentPolicy,
} from "./security/content-policy";
import { resolveSecureStorage } from "./security/safe-storage";
import { DatabaseService } from "./services/database-service";
import { DeploymentService } from "./services/deployment-service";
import { InfrastructureService } from "./services/infrastructure-service";
import { MonitoringService } from "./services/monitoring-service";
import { OperationsService } from "./services/operations-service";
import { OverviewService } from "./services/overview-service";
import { ProjectService } from "./services/project-service";
import { TrayService, trayIconFor } from "./tray";
import { appIconFor, createMainWindow, rendererEntryFor } from "./window";

/** Set by `scripts/dev.mjs`; absent in a packaged app. */
const devServerUrl = process.env.NOTPLOY_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);

// The user-data directory is named after the app, and it holds the connection
// list and the encrypted credentials. `productName` in package.json is what
// Electron reads, but setting it explicitly here keeps a dev run and a packaged
// run pointing at `~/.config/Notploy` rather than at `~/.config/@notploy/desktop`.
app.setName("Notploy");

/**
 * Deep links that arrived before the router was built.
 *
 * On macOS `open-url` fires on a running app; on Windows and Linux the URL is an
 * argument of a second process, which the single-instance lock reports back. Both
 * can happen before `bootstrap` has finished, and dropping the link that launched
 * the app would be the worst possible behaviour.
 */
const pendingDeepLinks: string[] = [];
let deliverDeepLink: ((url: string) => void) | undefined;

function receiveDeepLink(url: string | undefined): void {
	if (!url) return;
	if (deliverDeepLink) {
		deliverDeepLink(url);
		return;
	}
	pendingDeepLinks.push(url);
}

function preloadPath(): string {
	// The preload is bundled next to the main entry, so it is a sibling lookup
	// rather than a path relative to the app bundle.
	return path.join(__dirname, "preload.cjs");
}

function secureStorageSummary(info: AppInfo["secureStorage"]): string {
	return info.available
		? `OS keychain (${info.backend})`
		: `session-only memory storage (${info.backend})`;
}

async function bootstrap(): Promise<void> {
	const userDataPath = app.getPath("userData");
	const appPath = app.getAppPath();
	const logger = createFileLogger({
		directory: logDirectoryFor(userDataPath),
		level: isDev ? "debug" : "info",
		mirrorToConsole: isDev,
	});

	const secureStorage = resolveSecureStorage(userDataPath);
	const connectionStore = new ConnectionStore(
		userDataPath,
		secureStorage,
		logger,
	);
	const preferences = new PreferencesService(userDataPath);

	const manager = new ConnectionManager({
		store: connectionStore,
		logger,
		defaultTimeout: () => preferences.get().requestTimeout,
		// Only connections that opted into skipping TLS verification get this,
		// and each one gets its own Chromium session.
		insecureFetchFactory: (connectionId) => createInsecureFetch(connectionId),
	});

	const overviewService = new OverviewService(manager);
	const projectService = new ProjectService(manager);
	const deploymentService = new DeploymentService(manager);
	const infrastructureService = new InfrastructureService(manager);
	const monitoringService = new MonitoringService(manager);
	const operationsService = new OperationsService(manager);
	const databaseService = new DatabaseService(manager);
	const notifications = new NotificationService(logger);

	const appInfo = (): AppInfo => ({
		name: "Notploy",
		version: app.getVersion(),
		electron: process.versions.electron ?? "unknown",
		chrome: process.versions.chrome ?? "unknown",
		node: process.versions.node,
		platform: process.platform,
		arch: process.arch,
		secureStorage: secureStorage.info,
	});

	logger.info(
		`Notploy desktop ${app.getVersion()} starting on ${process.platform}/${process.arch} with ${secureStorageSummary(secureStorage.info)}`,
	);

	let window: BrowserWindow | null = null;
	/** Set once a real quit starts, so close-to-tray stops intercepting. */
	let quitting = false;

	const sendToWindow = (channel: string, payload: unknown): void => {
		if (window && !window.isDestroyed()) {
			window.webContents.send(channel, payload);
		}
	};

	const createWindow = (): void => {
		window = createMainWindow({
			preloadPath: preloadPath(),
			indexHtmlPath: rendererEntryFor(appPath),
			iconPath: appIconFor(appPath),
			devServerUrl,
			onClosed: () => {
				window = null;
			},
		});

		// Close-to-tray is opt-in, and only when a tray icon actually exists —
		// otherwise the window would close into nothing.
		window.on("close", (event) => {
			if (quitting || !trayAvailable || !preferences.get().closeToTray) return;
			event.preventDefault();
			window?.hide();
		});

		if (devServerUrl) {
			// Development only: this is how a broken renderer becomes visible in the
			// terminal that started `pnpm dev` instead of only in DevTools.
			forwardRendererDiagnostics(window, logger);
		}

		window.webContents.once("did-finish-load", () => {
			// Real statuses, without the user having to press anything. The
			// first check of a session never notifies (see NotificationService).
			void manager.checkAll().catch((error) => {
				logger.warn("The initial connection check failed", error);
			});
		});
	};

	const showWindow = (): void => {
		if (!window || window.isDestroyed()) {
			createWindow();
			return;
		}
		if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
	};

	const sendCommand = (command: MenuCommand): void => {
		sendToWindow(IPC_EVENTS.menuCommand, command);
		showWindow();
	};

	// ---------------------------------------------------------------------
	// Deep links
	// ---------------------------------------------------------------------

	registerProtocolClient({ app, isDev, appPath, logger });

	const deepLinks = new DeepLinkRouter(logger);
	deepLinks.attach((target) => {
		// A link always lands in the window, and never silently: the app may have
		// been launched by the link itself.
		showWindow();
		sendToWindow(IPC_EVENTS.deepLink, target);
	});
	deliverDeepLink = (url) => deepLinks.handle(url);
	// Replay anything the OS delivered before this point, oldest first.
	for (const url of pendingDeepLinks.splice(0)) deepLinks.handle(url);

	// ---------------------------------------------------------------------
	// Tray and deployment notifications
	// ---------------------------------------------------------------------

	const tray = new TrayService({
		iconPath: trayIconFor(appPath),
		logger,
		sendCommand,
		showWindow,
		checkAllConnections: () => {
			void manager.checkAll().catch((error) => {
				logger.warn("Checking all connections failed", error);
			});
		},
		selectConnection: (id) => {
			void manager.setActive(id).catch((error) => {
				logger.warn("Selecting a connection from the tray failed", error);
			});
		},
		quit: () => {
			quitting = true;
			app.quit();
		},
	});
	const trayAvailable = tray.create();
	if (!trayAvailable) {
		logger.info("Running without a system tray on this desktop session");
	}

	const deploymentWatcher = new DeploymentWatcher({
		manager,
		logger,
		notify: (title, body) => {
			if (!preferences.get().notifyDeploymentOutcomes) return;
			notifications.notify(title, body);
		},
		intervalSeconds: () => preferences.get().deploymentWatchSeconds,
	});

	/** Re-reads the interval; called on startup and after every preference write. */
	const syncDeploymentWatcher = (): void => deploymentWatcher.apply();

	// Security before content: the policy is on the session by the time the
	// renderer issues its first request.
	applyContentPolicy({
		session: session.defaultSession,
		allowedOrigins: allowedOriginsFor(devServerUrl),
		onBlocked: (url) => logger.warn(`Blocked a renderer request to ${url}`),
	});

	registerIpcHandlers({
		ipcMain,
		logger,
		getAppInfo: appInfo,
		preferences,
		manager,
		overview: overviewService,
		projects: projectService,
		deployments: deploymentService,
		infrastructure: infrastructureService,
		monitoring: monitoringService,
		operations: operationsService,
		databases: databaseService,
		openExternal: openExternalUrl,
		copyText: (text) => clipboard.writeText(text),
		onPreferencesChanged: syncDeploymentWatcher,
		isTrustedSender: (event) => {
			if (!window || window.isDestroyed()) return false;
			return event.sender.id === window.webContents.id;
		},
	});

	// One source of truth for connection state: the renderer and the tray are
	// told, they do not poll, and the notification service watches only
	// transitions.
	let previousSummaries: ConnectionSummary[] = [];
	manager.onChanged((summaries) => {
		notifications.notifyLosingConnections(previousSummaries, summaries);
		previousSummaries = summaries;
		tray.update(summaries);
		sendToWindow(IPC_EVENTS.connectionsChanged, summaries);
	});

	installApplicationMenu({
		sendCommand,
		openActiveDashboard: () => {
			const active = manager.active();
			if (active) void openExternalUrl(`${active.url}/dashboard`);
		},
		checkAllConnections: () => {
			void manager.checkAll().catch((error) => {
				logger.warn("Checking all connections failed", error);
			});
		},
		openExternal: (url) => {
			void openExternalUrl(url);
		},
		getWindow: () => window,
		isDev,
	});

	createWindow();
	syncDeploymentWatcher();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});

	app.on("before-quit", () => {
		quitting = true;
		tray.destroy();
		deploymentWatcher.stop();
	});

	app.on("window-all-closed", () => {
		// macOS keeps the process alive with no window; every other platform
		// follows the standard "closing the window quits the app" — unless the
		// user asked for the window to live in the tray.
		if (trayAvailable && preferences.get().closeToTray) return;
		if (process.platform !== "darwin") app.quit();
	});

	app.on("web-contents-created", (_event, contents) => {
		// Belt and braces with `will-navigate`: a webview or a popup created
		// anywhere in the app is deferred to the system browser.
		contents.setWindowOpenHandler(({ url }) => {
			void openExternalUrl(url);
			return { action: "deny" };
		});
	});
}

// A second launch focuses the running window instead of starting a second
// process, which would fight over the same secrets file. On Windows and Linux a
// `notploy://` link arrives as an argument of that second process.
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", (_event, argv) => {
		receiveDeepLink(deepLinkFromArgv(argv));
		const [existing] = BrowserWindow.getAllWindows();
		if (!existing) return;
		if (existing.isMinimized()) existing.restore();
		existing.focus();
	});

	// macOS: the OS hands the URL to the running app, possibly before `ready`.
	app.on("open-url", (event, url) => {
		event.preventDefault();
		receiveDeepLink(url);
	});

	// Windows groups notifications and taskbar entries by app user model id.
	if (process.platform === "win32") {
		app.setAppUserModelId("com.notploy.desktop");
	}

	app
		.whenReady()
		.then(async () => {
			// A cold start from a link carries the URL on this process's argv.
			receiveDeepLink(deepLinkFromArgv(process.argv));
			await bootstrap();
		})
		.catch((error) => {
			// Nothing else can be reported reliably at this point: the window may
			// not exist and the log directory may be the thing that failed.
			console.error("Notploy failed to start", error);
			dialog.showErrorBox(
				"Notploy could not start",
				error instanceof Error ? error.message : String(error),
			);
			app.quit();
		});
}

// The renderer can never trigger this, but a failure in the main process should
// not vanish silently.
process.on("uncaughtException", (error) => {
	dialog.showErrorBox("Notploy encountered an error", error.message);
	app.quit();
});

process.on("unhandledRejection", (reason) => {
	console.error("Unhandled rejection in the main process", reason);
});
