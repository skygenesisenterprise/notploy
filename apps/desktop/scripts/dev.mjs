/**
 * Development runner.
 *
 * Extra arguments are forwarded to Electron, which is how a Linux session gets
 * an escape hatch from a Chromium/Ozone problem without editing this file:
 *
 *   pnpm dev -- --ozone-platform=x11
 *
 * Three processes, one command:
 *
 * 1. the Vite dev server hosts the renderer with HMR;
 * 2. esbuild watches the main process and the preload;
 * 3. Electron runs the app, pointed at the dev server.
 *
 * Unlike a plain `electron .`, a change to the main process restarts Electron
 * instead of silently requiring attention: the reload is invisible to the
 * renderer, so a stale main would keep serving the previous code.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { createServer } from "vite";
import { buildMain } from "./build-main.mjs";
import { root } from "./esbuild-config.mjs";

const PORT = 5273;

const server = await createServer({
	configFile: path.join(root, "vite.config.ts"),
	mode: "development",
	server: { port: PORT, strictPort: true },
});
await server.listen();

const devServerUrl =
	server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`;
console.log(`Renderer dev server on ${devServerUrl}`);

const electronModule = await import("electron");
/** The `electron` package exports the path to its binary. */
const electronBinary = electronModule.default ?? electronModule;

// Anything after the script name goes to Electron: `pnpm dev -- --flag`.
const electronArgs = process.argv.slice(2);
if (electronArgs.length > 0) {
	console.log(`Forwarding to Electron: ${electronArgs.join(" ")}`);
}

let child;
let restarting = false;

function startElectron() {
	child = spawn(electronBinary, [".", ...electronArgs], {
		cwd: root,
		stdio: "inherit",
		env: { ...process.env, NOTPLOY_DEV_SERVER_URL: devServerUrl },
	});
	child.on("exit", (code) => {
		if (restarting) return;
		// Closing the window ends the dev session, the same as `electron .`.
		void server.close().then(() => process.exit(code ?? 0));
	});
}

async function restartElectron() {
	if (!child || child.exitCode !== null) {
		startElectron();
		return;
	}
	restarting = true;
	child.kill();
	child.once("exit", () => {
		restarting = false;
		startElectron();
	});
}

/** The main bundle and the preload bundle. */
const EXPECTED_BUNDLES = 2;

// The app starts only after *both* bundles have been written: Electron loads the
// preload at window creation, so starting on the first `onEnd` could race a
// preload that does not exist yet — which shows up as a missing bridge, not as a
// build error. Later rebuilds restart the app, debounced, because main and
// preload change together and must not restart it twice.
let finishedFirstBuilds = 0;
let started = false;
let restartTimer;

const onBuildEnd = (result) => {
	if (result.errors.length > 0) {
		console.error("esbuild reported errors; Electron was not (re)started.");
		return;
	}

	if (!started) {
		finishedFirstBuilds += 1;
		if (finishedFirstBuilds < EXPECTED_BUNDLES) return;
		started = true;
		startElectron();
		return;
	}

	clearTimeout(restartTimer);
	restartTimer = setTimeout(() => {
		void restartElectron();
	}, 150);
};

await buildMain({ watchMode: true, onEnd: onBuildEnd });
