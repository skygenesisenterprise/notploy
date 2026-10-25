import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const production = !watch && process.env.NODE_ENV !== "development";

const shared = {
	bundle: true,
	platform: "browser",
	format: "esm",
	target: "chrome114",
	conditions: ["import", "browser"],
	sourcemap: true,
	minify: production,
	logLevel: "info",
	define: {
		"process.env.NODE_ENV": JSON.stringify(
			production ? "production" : "development",
		),
	},
};

/** @type {import("esbuild").BuildOptions[]} */
const entries = [
	{
		...shared,
		entryPoints: [path.join(root, "src/background/index.ts")],
		outfile: path.join(root, "dist/background.js"),
	},
	{
		...shared,
		entryPoints: [path.join(root, "src/popup/main.ts")],
		outfile: path.join(root, "dist/popup.js"),
	},
	{
		...shared,
		entryPoints: [path.join(root, "src/options/main.ts")],
		outfile: path.join(root, "dist/options.js"),
	},
];

function copyStatic() {
	const files = [
		["manifest.json", "dist/manifest.json"],
		["src/popup/popup.html", "dist/popup.html"],
		["src/popup/popup.css", "dist/popup.css"],
		["src/options/options.html", "dist/options.html"],
		["src/options/options.css", "dist/options.css"],
	];
	for (const [from, to] of files) {
		const src = path.join(root, from);
		const dest = path.join(root, to);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		if (fs.existsSync(src)) fs.copyFileSync(src, dest);
	}
	const iconsDir = path.join(root, "public/icons");
	const destIcons = path.join(root, "dist/icons");
	if (fs.existsSync(iconsDir)) {
		fs.mkdirSync(destIcons, { recursive: true });
		for (const file of fs.readdirSync(iconsDir)) {
			fs.copyFileSync(path.join(iconsDir, file), path.join(destIcons, file));
		}
	}
}

if (watch) {
	const contexts = await Promise.all(
		entries.map((options) => esbuild.context(options)),
	);
	await Promise.all(contexts.map((ctx) => ctx.watch()));
	copyStatic();
	console.log("watching packages/browser…");
} else {
	for (const options of entries) {
		const result = await esbuild.build({ ...options, metafile: true });
		const outputs = Object.entries(result.metafile?.outputs ?? {});
		for (const [file, meta] of outputs) {
			console.log(
				`${path.relative(root, file)} ${(meta.bytes / 1024).toFixed(1)} kB`,
			);
		}
	}
	copyStatic();
}
