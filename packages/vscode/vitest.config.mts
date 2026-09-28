import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			// The extension host provides `vscode`; unit tests use a stub with the
			// same surface. Nothing here ever talks to a real Notploy instance.
			vscode: path.resolve(root, "tests/helpers/vscode-mock.ts"),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: true,
		reporters: ["default"],
	},
});
