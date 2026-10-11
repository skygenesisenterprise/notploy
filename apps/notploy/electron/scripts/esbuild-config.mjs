import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

/**
 * The main process and the preload are bundled separately from the renderer.
 *
 * They run in Node (or, for the preload, in a sandboxed renderer), so Vite
 * cannot build them; esbuild does, with the same tool the VS Code extension
 * package already uses in this repository.
 *
 * Two decisions worth stating:
 *
 * - `format: "cjs"` with a `.cjs` extension. The package is ESM (`"type":
 *   "module"`), so an ESM main would work on current Electron, but a
 *   sandboxed preload must be CommonJS — and having both sides be CJS keeps
 *   `__dirname` and `require("electron")` available without shims.
 * - `electron` is the only external. `@notploy/sdk` is inlined so a packaged
 *   app ships `dist/` and a manifest, and never a `node_modules` tree.
 */
function sharedOptions({ entryPoints, outfile, production, onEnd }) {
	return {
		entryPoints,
		outfile,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node22",
		external: ["electron"],
		// Bundlers resolve the SDK's ESM entry through the `import` condition.
		conditions: ["import"],
		alias: {
			"@": path.join(root, "src"),
		},
		sourcemap: true,
		minify: production,
		keepNames: true,
		logLevel: "info",
		metafile: true,
		// Only added when a caller actually passes a handler, so a plain build does
		// not carry an inert plugin.
		...(onEnd ? { plugins: [onEndPlugin(onEnd)] } : {}),
	};
}

export function mainBuildOptions({ production = false, onEnd } = {}) {
	return sharedOptions({
		entryPoints: [path.join(root, "src/main/index.ts")],
		outfile: path.join(root, "dist/main/index.cjs"),
		production,
		onEnd,
	});
}

/**
 * The preload is emitted next to the main entry, not in its own directory.
 *
 * The main process resolves it as `path.join(__dirname, "preload.cjs")`, so the
 * two must stay siblings: splitting them is what silently produces a window with
 * no bridge at all (and therefore a blank page), because the missing file is
 * only reported to the DevTools console of the window that failed to render.
 */
export function preloadBuildOptions({ production = false, onEnd } = {}) {
	return sharedOptions({
		entryPoints: [path.join(root, "src/preload/index.ts")],
		outfile: path.join(root, "dist/main/preload.cjs"),
		production,
		onEnd,
	});
}

/**
 * Runs `handler` after each build, including every rebuild in watch mode.
 *
 * `onEnd` is a plugin-API hook in current esbuild: as a top-level build option it
 * is rejected outright (`Invalid option in context() call: "onEnd"`). The plugin
 * form is the stable way to observe a build finishing.
 */
function onEndPlugin(handler) {
	return {
		name: "notploy-on-end",
		setup(build) {
			build.onEnd(handler);
		},
	};
}

export function logOutputs(result, label) {
	for (const [file, meta] of Object.entries(result.metafile?.outputs ?? {})) {
		console.log(
			`${label} ${path.relative(root, file)} ${(meta.bytes / 1024).toFixed(1)} kB`,
		);
	}
}
