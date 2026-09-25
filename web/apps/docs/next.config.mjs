import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";

const withMDX = createMDX();

// The monorepo has a single pnpm workspace at the repository root, so the
// standalone trace root is the repo root (not web/apps/docs).
const tracingRoot = path.join(import.meta.dirname, "../../..");

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	output: "standalone",
	outputFileTracingRoot: tracingRoot,
	outputFileTracingIncludes: {
		"/**": [
			path.join(
				tracingRoot,
				"node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**",
			),
		],
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
