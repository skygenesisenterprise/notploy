import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	// Generated code is confined to `src/generated`: everything else under `src`
	// is hand-written and must survive `pnpm generate`.
	input: "./openapi.json",
	output: {
		path: "./src/generated",
		postProcess: ["biome:format"],
	},
	plugins: ["@hey-api/client-fetch", "@hey-api/sdk", "@hey-api/typescript"],
});
