/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Turbopack (the default bundler for `next dev`) and webpack (used by
// `next build --webpack`) need the same module resolution: the monorepo packages
// are imported from source, and the linked design system carries its own React
// copy that must be pinned to this app's instance.
// Turbopack resolves aliases relative to the project root and rejects absolute
// paths (it turns `/usr/src/app/...` into `./usr/src/app/...`), so the dev
// bundler gets relative targets.
// `react` is a peer dependency of the design system, but pnpm auto-installs
// peers at the highest matching version (19.3.1) while this app pins 19.2.7.
// Without the alias Turbopack bundles both copies, and hooks called through the
// design system's React hit a null dispatcher (`Cannot read properties of null
// (reading 'useId')`).
const turbopackAliases = {
	"@notploy/status": "../../packages/status/src",
	"@notploy/server": "../../packages/server/src",
	react: "./node_modules/react",
	"react-dom": "./node_modules/react-dom",
};

// Webpack (production build) takes absolute paths and pins React explicitly.
const webpackAliases = {
	...turbopackAliases,
	"@notploy/status": path.resolve(__dirname, "../../packages/status/src"),
	"@notploy/server": path.resolve(__dirname, "../../packages/server/src"),
	react: path.resolve(__dirname, "node_modules/react"),
	"react-dom": path.resolve(__dirname, "node_modules/react-dom"),
};

// Next sets TURBOPACK when the dev server runs on Turbopack. A `webpack` key in
// the config is refused by that bundler, so it is only exported for the webpack
// build (`next build --webpack`, the production image).
const useTurbopack = Boolean(process.env.TURBOPACK);
const isDevelopment = process.env.NODE_ENV === "development";

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// The dev indicator floats over the bottom-right corner, where the panel
	// renders its global footer. It is a development affordance, not part of
	// the product UI, so it stays off.
	devIndicators: false,
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@notploy/server", "@notploy/status"],
	/**
	 * The client container only serves the frontend: every `/api/*` call is proxied
	 * to the API service (GROUP 4), which owns authentication, tRPC/OpenAPI, the
	 * WebSocket endpoints and the database. `beforeFiles` runs before route
	 * matching, so the API route files bundled in this image stay unreachable —
	 * and that container has no database or Redis credentials anyway.
	 *
	 * The destination is read when the server starts (`next dev`) and baked into
	 * the routes manifest at build time (`next build`), where the Compose service
	 * name is already the default.
	 */
	async rewrites() {
		// The API service uses this same Next config for its own route handlers.
		// Applying the client proxy there rewrites `/api/*` to `http://api:4000`
		// again, so every request loops back into the same server until the socket
		// is reset (and `/api/health` never answers).
		if (process.env.NOTPLOY_ROLE === "api") return [];

		const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://api:4000";
		return {
			beforeFiles: [
				{
					source: "/api/:path*",
					destination: `${apiInternalUrl}/api/:path*`,
				},
			],
			afterFiles: [],
			fallback: [],
		};
	},
	turbopack: {
		resolveAlias: turbopackAliases,
	},
	...(useTurbopack
		? {}
		: {
				webpack: (config) => {
					Object.assign(config.resolve.alias, webpackAliases);
					return config;
				},
			}),
	async headers() {
		return [
			{
				source: "/_next/static/:path*",
				headers: [
					{
						// Production chunks are content-hashed and safe to cache
						// forever. Development chunks are rebuilt on every edit:
						// caching them as immutable makes the browser serve a
						// stale chunk whose module factories no longer exist
						// ("module factory is not available" HMR error).
						key: "Cache-Control",
						value:
							process.env.NODE_ENV === "development"
								? "no-store, must-revalidate"
								: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				// Apply security headers to all routes
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors 'none'",
					},
					// Next 16 still serves the Turbopack dev middleware manifest
					// (`_clientMiddlewareManifest.js`) as `application/json` even
					// though the browser loads it through a <script> tag. `nosniff`
					// makes the browser reject it, so it is production-only until
					// the upstream fix ships (vercel/next.js#92180).
					...(!isDevelopment
						? [
								{
									key: "X-Content-Type-Options",
									value: "nosniff",
								},
							]
						: []),
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
				],
			},
		];
	},
};

export default nextConfig;