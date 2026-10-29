/**
 * Build script: bundles the package entry points to `dist/` for consumers
 * that do not transpile workspace sources. The status application imports
 * the TypeScript sources directly (transpilePackages), like `@notploy/server`
 * in the console app.
 */
import esbuild from "esbuild";

const shared: esbuild.BuildOptions = {
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	packages: "external",
	sourcemap: true,
	logLevel: "info",
};

try {
	await esbuild.build({
		...shared,
		entryPoints: {
			index: "src/index.ts",
			api: "src/api/index.ts",
			client: "src/integration/client.ts",
			server: "src/platform.ts",
			// Bundled so the production status image can seed its catalog without
			// shipping the monorepo or a TypeScript runner:
			//   docker compose --profile status exec status node engine-dist/seed.js
			seed: "src/cli/seed.ts",
		},
		outdir: "dist",
	});
	process.stdout.write("build ok\n");
} catch (error) {
	process.stderr.write(`build failed: ${String(error)}\n`);
	process.exit(1);
}
