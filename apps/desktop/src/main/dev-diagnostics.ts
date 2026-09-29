/**
 * Development-only visibility into the renderer.
 *
 * A hot-reloading window is only useful if its failures are visible. When the
 * main process owns the window, everything the renderer reports — console
 * output, a failed load, a crashed renderer process — goes to a surface no one
 * is looking at (the DevTools console of a window that just went blank).
 * Mirroring it into the main log puts it in the terminal that started `pnpm dev`.
 *
 * This module is attached only when a dev server URL is present: in a packaged
 * app the renderer's console is its own business, and forwarding it would put
 * page data in a log file.
 */

import type { BrowserWindow } from "electron";
import type { Logger } from "./logging";

/**
 * Parses the `console-message` payload.
 *
 * Electron changed this listener from positional arguments
 * (`level, message, line, sourceId`) to a single details object, and both shapes
 * are still seen in the wild across versions. Accepting either keeps the
 * forwarding working without pinning the app to one Electron minor.
 */
function describeConsoleMessage(args: unknown[]): {
	level: string;
	message: string;
	source: string;
} {
	const [first, ...rest] = args;
	if (first && typeof first === "object") {
		const details = first as {
			level?: string | number;
			message?: string;
			lineNumber?: number;
			sourceId?: string;
		};
		return {
			level: String(details.level ?? "log"),
			message: details.message ?? "",
			source: details.sourceId
				? `${details.sourceId}:${details.lineNumber ?? 0}`
				: "",
		};
	}
	// Positional form: (level, message, line, sourceId).
	const [level, message, line, sourceId] = rest;
	return {
		level: String(level ?? "log"),
		message: String(message ?? ""),
		source: sourceId ? `${String(sourceId)}:${String(line ?? 0)}` : "",
	};
}

/**
 * Reports whether the renderer actually rendered.
 *
 * A blank window is the one failure the console cannot explain: nothing threw,
 * nothing was logged, the page simply never mounted. Asking the DOM directly
 * turns that into a line in the terminal — no root children, or no bridge —
 * instead of a mystery the developer has to open DevTools to solve.
 */
async function probeRenderer(window: BrowserWindow, logger: Logger): Promise<void> {
	try {
		const report = (await window.webContents.executeJavaScript(
			`(() => ({
				rootChildren: document.getElementById("root")?.childElementCount ?? -1,
				bridge: typeof window.notploy === "object" && window.notploy !== null,
			}))()`,
		)) as { rootChildren: number; bridge: boolean };

		if (report.rootChildren <= 0) {
			logger.error(
				"The renderer loaded but mounted nothing (empty #root). The page threw before rendering — see the renderer lines above.",
			);
			return;
		}

		logger.info(
			`Renderer mounted (${report.rootChildren} root children, bridge ${report.bridge ? "available" : "MISSING"})`,
		);
	} catch (error) {
		logger.warn("Could not inspect the renderer after load", error);
	}
}

/** Reports the renderer's problems to the main-process log. */
export function forwardRendererDiagnostics(
	window: BrowserWindow,
	logger: Logger,
): void {
	window.webContents.on("console-message", (...args: unknown[]) => {
		const { level, message, source } = describeConsoleMessage(args.slice(1));
		if (!message) return;
		const suffix = source ? ` (${source})` : "";
		if (level === "error" || level === "3") {
			logger.error(`[renderer] ${message}${suffix}`);
			return;
		}
		if (level === "warning" || level === "2") {
			logger.warn(`[renderer] ${message}${suffix}`);
			return;
		}
		logger.info(`[renderer] ${message}${suffix}`);
	});

	window.webContents.on(
		"did-fail-load",
		(_event, errorCode, errorDescription, validatedUrl) => {
			logger.error(
				`The renderer could not load ${validatedUrl || "(no url)"}: ${errorDescription} (${errorCode})`,
			);
		},
	);

	window.webContents.on("render-process-gone", (_event, details) => {
		logger.error(
			`The renderer process exited: ${details.reason} (exit code ${details.exitCode})`,
		);
	});

	window.webContents.on("preload-error", (_event, preloadPath, error) => {
		// A broken preload means no bridge at all, which otherwise shows up only as
		// "the desktop bridge is unavailable" in the UI.
		logger.error(`The preload script failed (${preloadPath})`, error);
	});

	window.webContents.once("did-finish-load", () => {
		void probeRenderer(window, logger);
	});
}
