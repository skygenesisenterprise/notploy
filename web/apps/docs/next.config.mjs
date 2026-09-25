import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	output: "standalone",
	outputFileTracingIncludes: {
		"/**": ["../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**"],
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "templates.notploy.com",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/docs/templates",
				destination: "https://notploy.com/templates",
				permanent: true,
			},
			{
				source: "/docs/templates/:id*",
				destination: "https://notploy.com/templates/:id*",
				permanent: true,
			},
		];
	},
};

export default withMDX(config);
