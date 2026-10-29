/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@notploy/server", "@notploy/status"],
	webpack: (config) => {
		// Resolve monorepo packages for transpilation
		config.resolve.alias["@notploy/status"] = path.resolve(
			__dirname,
			"../../packages/status/src"
		);
		config.resolve.alias["@notploy/server"] = path.resolve(
			__dirname,
			"../../packages/server/src"
		);
		return config;
	},
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
				source: "/_next/static/development/:path*",
				headers: [
					{
						key: "Content-Type",
						value: "application/javascript; charset=utf-8",
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
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
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
