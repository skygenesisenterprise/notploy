/**
 * Bundles the main process and the preload into `dist/`.
 *
 * `--watch` keeps both bundles rebuilding; `dev.mjs` uses that mode and restarts
 * Electron when an output changes.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import {
	logOutputs,
	mainBuildOptions,
	preloadBuildOptions,
} from "./esbuild-config.mjs";

const watch = process.argv.includes("--watch");
const production =
	process.env.NODE_ENV === "production" ||
	(!watch && process.env.NODE_ENV !== "development");

export async function buildMain({ watchMode = false, onEnd } = {}) {
	const options = [
		{ label: "main", config: mainBuildOptions({ production, onEnd }) },
		{ label: "preload", config: preloadBuildOptions({ production, onEnd }) },
	];

	if (watchMode) {
		const contexts = await Promise.all(
			options.map(async ({ config }) => await esbuild.context(config)),
		);
		await Promise.all(contexts.map(async (context) => await context.watch()));
		return { contexts };
	}

	const results = await Promise.all(
		options.map(async ({ label, config }) => ({
			label,
			result: await esbuild.build(config),
		})),
	);
	for (const { label, result } of results) logOutputs(result, label);
	return { contexts: [] };
}

// Only run when invoked directly, so `build.mjs` and `dev.mjs` can import the
// function without triggering a build of their own.
const invokedDirectly =
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
	await buildMain({ watchMode: watch });
}
