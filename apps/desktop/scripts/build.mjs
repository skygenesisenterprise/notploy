/**
 * Full build: main process and preload (esbuild) then the renderer (Vite).
 *
 * Both outputs land in `dist/`, which is exactly what `electron-builder.yml`
 * packages.
 */

import fs from "node:fs";
import path from "node:path";
import { build as viteBuild } from "vite";
import { buildMain } from "./build-main.mjs";
import { root } from "./esbuild-config.mjs";

async function build() {
	// `dist/` is wiped first so a file whose output path changed can never linger
	// as a stale artifact — a leftover preload at the old path is exactly the kind
	// of thing that ships and produces a window with no bridge.
	fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });

	await buildMain();

	await viteBuild({
		configFile: path.join(root, "vite.config.ts"),
		// The renderer is a production artifact even when NODE_ENV is not set.
		mode: "production",
	});

	console.log("Renderer built into dist/renderer");
}

await build();
