/**
 * The application window.
 *
 * The window is a **shell around the real Notploy application**: it loads the
 * active instance's dashboard (or the bundled connection gate while none is
 * configured), never a desktop-specific copy of the interface. That is why
 * there is no renderer bundle in this app any more — the pages, components,
 * navigation and business logic all belong to `apps/notploy` and are served
 * by the instance itself.
 *
 * The `webPreferences` below are the security boundary, and each one is
 * load-bearing:
 *
 * - `contextIsolation: true` — the preload's globals are not shared with the
 *   page, so page code cannot reach into the bridge's closure.
 * - `nodeIntegration: false` — there is no `require`, no `process`, no `fs` in
 *   the renderer.
 * - `sandbox: true` — the renderer runs in Chromium's sandbox; the preload gets
 *   only the Electron IPC primitives, which is all it uses.
 * - `webSecurity: true` — the same-origin policy applies to the loaded
 *   instance; `allowRunningInsecureContent` stays off.
 *
 * Navigation and window opening are locked down: a link in the UI that points
 * outside the configured origins opens in the system browser, and the window
 * itself can never be navigated away from the gate or a configured instance.
 */

import path from "node:path";
import { BrowserWindow, shell } from "electron";
import {
	gateUrlPrefixFor,
	isAllowedRendererUrl,
} from "./security/content-policy";

export interface CreateWindowOptions {
	/** Absolute path of the bundled preload script. */
	preloadPath: string;
	/** Absolute path of the bundled connection gate page (`file://`). */
	gatePagePath: string;
	/** Vite/Next dev server origin, when running in development. */
	devServerUrl?: string;
	/**
	 * The origins the window may load, read fresh on every navigation so a
	 * connection added at runtime is immediately navigable.
	 */
	allowedOrigins: () => readonly string[];
	/**
	 * Absolute path of the 1024x1024 app icon, used for the window and the taskbar.
	 * Ignored on macOS, where the icon comes from the bundle itself.
	 */
	iconPath?: string;
	/** Notified when the window closes, so the caller can drop its reference. */
	onClosed: () => void;
}

/**
 * The page background, so the window does not flash a different colour between
 * `show: false` and the first paint. Kept in step with Notploy's light-theme
 * `--background`; a dark instance repaints immediately after load.
 */
const BACKGROUND_COLOR = "#f5efe0";

export function createMainWindow(options: CreateWindowOptions): BrowserWindow {
	const { preloadPath, gatePagePath, devServerUrl, allowedOrigins } = options;

	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 940,
		minHeight: 600,
		show: false,
		backgroundColor: BACKGROUND_COLOR,
		title: "Notploy",
		// The same identity as the packaged app: the mark the extension, the
		// website and the installers all use.
		icon: process.platform === "darwin" ? undefined : options.iconPath,
		// Frameless decorations are not used: the native frame keeps platform
		// behaviours (snapping, traffic lights, window menus) intact.
		autoHideMenuBar: process.platform === "linux",
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			nodeIntegrationInWorker: false,
			nodeIntegrationInSubFrames: false,
			sandbox: true,
			webSecurity: true,
			allowRunningInsecureContent: false,
			spellcheck: false,
			// DevTools are a development affordance; a packaged app never opens them.
			devTools: Boolean(devServerUrl),
			// No extra arguments are handed to the preload.
			additionalArguments: [],
		},
	});

	window.once("ready-to-show", () => {
		window.show();
		if (devServerUrl) {
			// An unpackaged, hot-reloading build should look like one: the inspector
			// makes the mode obvious instead of leaving a developer wondering
			// whether they are looking at the built app.
			window.webContents.openDevTools({ mode: "detach" });
		}
	});

	// A link in the UI must never replace the app; it goes to the OS browser.
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			void shell.openExternal(url);
		}
		return { action: "deny" };
	});

	// Same rule for a navigation the page initiates itself: only the gate and
	// the configured instance origins may occupy the window.
	window.webContents.on("will-navigate", (event, url) => {
		const allowed = isAllowedRendererUrl(
			url,
			allowedOrigins(),
			gatePagePath ? gateUrlPrefixFor(gatePagePath) : undefined,
		);
		if (allowed) return;
		event.preventDefault();
		if (url.startsWith("http://") || url.startsWith("https://")) {
			void shell.openExternal(url);
		}
	});

	// The app never needs a webview or a plugin; anything trying to open one is
	// a bug or an attack.
	window.webContents.on("will-attach-webview", (event) => {
		event.preventDefault();
	});

	window.on("closed", options.onClosed);

	return window;
}

/**
 * Loads the gate page (no configured instance) or the instance URL in a window.
 *
 * Kept here rather than inlined at each call site so the startup path, the
 * "add connection" command and a deep link all resolve through one function.
 */
export function loadInitialTarget(
	window: BrowserWindow,
	target: { kind: "gate" } | { kind: "url"; url: string },
	gatePagePath: string,
): void {
	if (target.kind === "gate") {
		void window.loadFile(gatePagePath);
		return;
	}
	void window.loadURL(target.url);
}

/** Where the bundled connection gate lives. */
export function gatePageFor(appPath: string): string {
	// `app.getAppPath()` is the directory holding the workspace package.json,
	// so the gate sits under `electron/` — in the unpackaged layout and in the
	// asar alike, whose paths mirror the source tree.
	return path.join(appPath, "electron", "assets", "gate", "index.html");
}

/**
 * Where the app icon lives.
 *
 * It sits outside `electron/dist/` because electron-builder also uses it as a
 * build resource, so it is listed explicitly in `electron-builder.yml`'s
 * `files`.
 */
export function appIconFor(appPath: string): string {
	return path.join(appPath, "electron", "assets", "icon.png");
}
