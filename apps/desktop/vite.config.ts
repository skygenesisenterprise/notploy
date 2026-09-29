import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Development needs a looser policy than the one `index.html` ships.
 *
 * The production policy (`default-src 'none'`, `script-src 'self'`) is what
 * protects a packaged app whose renderer has no legitimate network access at
 * all. Vite's dev server does not work under it: HMR opens a WebSocket, the
 * react-refresh preamble is injected inline, and the client polls module URLs.
 *
 * Rather than weakening the shipped policy, the production meta tag is replaced
 * in the dev transform only — so a change here can never soften a packaged app.
 * The session-level request blocking in the main process is unaffected and still
 * applies in development.
 */
const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/;

const DEV_CSP_META = `<meta
			http-equiv="Content-Security-Policy"
			content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"
		/>`;

function developmentContentPolicy(): Plugin {
	return {
		name: "notploy-development-csp",
		transformIndexHtml: {
			order: "pre",
			handler(html, context) {
				// `context.server` is set only while the dev server is serving.
				if (!context.server) return html;
				return html.replace(CSP_META, DEV_CSP_META);
			},
		},
	};
}

/**
 * Renderer-only build.
 *
 * The main process and the preload are bundled separately by esbuild (see
 * `scripts/build-main.mjs`), so Vite deals with the browser bundle alone and
 * never has to know about Electron.
 *
 * `base: "./"` is required: a packaged app loads `index.html` from
 * `file://`, where absolute `/assets/...` URLs would resolve to the filesystem
 * root instead of the app directory.
 */
export default defineConfig({
	root,
	base: "./",
	plugins: [react(), tailwindcss(), developmentContentPolicy()],
	resolve: {
		alias: {
			"@": path.join(root, "src"),
			// The brand mark lives beside the generated icon, outside `src`, so the
			// renderer and the icon generator share one source of truth.
			"@assets": path.join(root, "assets"),
		},
	},
	build: {
		outDir: path.join(root, "dist/renderer"),
		emptyOutDir: true,
		// Electron ships a single, known Chromium build, so there is no reason
		// to down-level the output for older browsers.
		target: "chrome130",
		sourcemap: true,
	},
	server: {
		port: 5273,
		strictPort: true,
	},
});
