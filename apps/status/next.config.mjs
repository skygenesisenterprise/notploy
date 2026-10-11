/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Self-contained server output for the container image: `.next/standalone`
	// carries the traced Node dependencies, so the runtime image does not need
	// the whole pnpm store. Ignored by `next dev`.
	output: "standalone",
	// The status engine is consumed as workspace TypeScript sources, exactly
	// like `@notploy/server` in the console app.
	transpilePackages: ["@notploy/status"],
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors 'none'",
					},
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Cache-Control",
						value: "public, max-age=30, must-revalidate",
					},
				],
			},
		];
	},
};

export default nextConfig;
