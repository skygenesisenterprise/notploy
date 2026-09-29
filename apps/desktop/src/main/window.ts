/**
 * The application window.
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
 * - `webSecurity: true` — the same-origin policy applies to the app's own
 *   bundle; `allowRunningInsecureContent` stays off.
 *
 * Navigation and window opening are also locked down: a link in the UI that
 * points at a Notploy dashboard opens in the system browser, and the app window
 * itself can never be navigated away from its bundle.
 */

import path from "node:path";
import { BrowserWindow, shell } from "electron";
import { isAllowedRendererUrl } from "./security/content-policy";

export interface CreateWindowOptions {
	/** Absolute path of the bundled preload script. */
	preloadPath: string;
	/** Absolute path of the renderer's `index.html` (production). */
	indexHtmlPath: string;
	/** Vite dev server origin, when running in development. */
	devServerUrl?: string;
	/**
	 * Absolute path of the 1024x1024 app icon, used for the window and the taskbar.
	 * Ignored on macOS, where the icon comes from the bundle itself.
	 */
	iconPath?: string;
	/** Notified when the window closes, so the caller can drop its reference. */
	onClosed: () => void;
}

// The page background, so the window does not flash a different colour between
// `show: false` and the renderer's first paint. Kept in step with
// `--color-canvas` in `src/renderer/styles.css`, which in turn is measured from
// the reference Notploy App capture.
const BACKGROUND_COLOR = "#0a0a0a";

export function createMainWindow(options: CreateWindowOptions): BrowserWindow {
	const { preloadPath, indexHtmlPath, devServerUrl } = options;

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
			devTools: Boolean(devServerUrl),
			// No remote content is ever loaded, so there is nothing to preload
			// beyond the bridge.
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

	// Same rule for a navigation the page initiates itself.
	window.webContents.on("will-navigate", (event, url) => {
		const allowed = devServerUrl
			? isAllowedRendererUrl(url, [devServerUrl])
			: url.startsWith("file://");
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

	if (devServerUrl) {
		void window.loadURL(devServerUrl);
	} else {
		void window.loadFile(indexHtmlPath);
	}

	return window;
}

/** Where the bundled renderer entry point lives. */
export function rendererEntryFor(appPath: string): string {
	// `app.getAppPath()` is the directory holding package.json; both the
	// packaged and the unpackaged layout put the bundle under `dist/`.
	return path.join(appPath, "dist", "renderer", "index.html");
}

/**
 * Where the app icon lives.
 *
 * It sits outside `dist/` because electron-builder also uses it as a build
 * resource, so it is listed explicitly in `electron-builder.yml`'s `files`.
 */
export function appIconFor(appPath: string): string {
	return path.join(appPath, "assets", "icon.png");
}
