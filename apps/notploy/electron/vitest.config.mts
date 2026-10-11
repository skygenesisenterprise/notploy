import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unit tests for the main process's pure modules.
 *
 * Nothing here talks to Electron or to a real Notploy instance: `safeStorage`
 * and the SDK client are injected, and the tests supply fakes (see
 * `tests/helpers`). That is the reason `secure-storage.ts`, `fetch.ts`,
 * `logging.ts` and the connection layer have no Electron import.
 */
export default defineConfig({
	root,
	resolve: {
		// Same alias policy as `vite.config.ts`, longest prefix first.
		alias: [
			{ find: /^@\/lib\//, replacement: `${path.resolve(root, "..", "lib")}/` },
			{ find: "@app/", replacement: `${path.resolve(root, "..")}/` },
			{ find: "@/", replacement: `${path.join(root, "src")}/` },
		],
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: true,
		reporters: ["default"],
	},
});
