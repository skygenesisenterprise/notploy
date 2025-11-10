/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: false, // Temporarily disable to help with build issues
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@dokploy/server"],
	experimental: {
		// Try to optimize the build process
		optimizeCss: true,
		optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
	},
	webpack: (config, { isServer }) => {
		// Try to resolve circular dependencies
		if (isServer) {
			config.externals = config.externals || [];
			config.externals.push({
				"@trpc/react-query/server": "commonjs @trpc/react-query/server",
			});
		}
		return config;
	},
	/**
	 * If you are using `appDir` then you must comment the below `i18n` config out.
	 *
	 * @see https://github.com/vercel/next.js/issues/41980
	 */
	i18n: {
		locales: ["en"],
		defaultLocale: "en",
	},
};

export default nextConfig;
