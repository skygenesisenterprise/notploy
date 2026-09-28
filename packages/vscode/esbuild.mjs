import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const production = !watch && process.env.NODE_ENV !== "development";

/** @type {import("esbuild").BuildOptions} */
const options = {
	entryPoints: [path.join(root, "src/extension.ts")],
	outfile: path.join(root, "dist/extension.js"),
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "node20",
	// The VS Code extension host provides `vscode` at runtime; it must never be
	// bundled. Everything else (including @notploy/sdk) is inlined so a packaged
	// .vsix only has to ship `dist/`.
	external: ["vscode"],
	// Bundlers resolve the SDK's ESM entry through the `import` condition.
	conditions: ["import"],
	sourcemap: true,
	minify: production,
	keepNames: true,
	logLevel: "info",
	metafile: true,
};

if (watch) {
	const context = await esbuild.context(options);
	await context.watch();
} else {
	const result = await esbuild.build(options);
	const outputs = Object.entries(result.metafile.outputs);
	for (const [file, meta] of outputs) {
		console.log(
			`${path.relative(root, file)} ${(meta.bytes / 1024).toFixed(1)} kB`,
		);
	}
}
