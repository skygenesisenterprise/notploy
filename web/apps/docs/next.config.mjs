import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";

const withMDX = createMDX();

// The monorepo has a single pnpm workspace at the repository root, so the
// standalone trace root is the repo root (not web/apps/docs).
const tracingRoot = path.join(import.meta.dirname, "../../..");

// Two build targets share this config:
//
//   NEXT_OUTPUT=standalone (default) -> web/Dockerfile.docs, runs the docs
//       server as a Node process behind the Notploy reverse proxy.
//
//   NEXT_OUTPUT=export              -> .github/workflows/pages-docs.yml, emits
//       web/apps/docs/out for GitHub Pages.
//
// `output: "export"` is mutually exclusive with standalone tracing and does not
// support `redirects`, so the two modes diverge here rather than in the CI file.
const isStaticExport = process.env.NEXT_OUTPUT === "export";

// Set by actions/configure-pages. Empty when Pages is served from a domain root
// (docs.notploy.com); "/<repo>" when it is served from <org>.github.io/<repo>/.
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	output: isStaticExport ? "export" : "standalone",
	basePath,
	...(isStaticExport
		? {}
		: {
				outputFileTracingRoot: tracingRoot,
				outputFileTracingIncludes: {
					"/**": [
						path.join(
							tracingRoot,
							"node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**",
						),
					],
				},
			}),
	images: {
		// The image optimizer is a server runtime feature; a static export has to
		// ship the unoptimized <img> output instead.
		...(isStaticExport ? { unoptimized: true } : {}),
		remotePatterns: [
			{
				protocol: "https",
				hostname: "templates.notploy.com",
			},
		],
	},
	// `next export` writes <route>.html; GitHub Pages only resolves
	// extensionless URLs to <route>/index.html, so without this every deep link
	// into /docs/... would 404.
	...(isStaticExport ? { trailingSlash: true } : {}),
	// `redirects()` is unsupported under `output: "export"`. The template
	// gallery moved to the marketing site, so on Pages the links are rewritten
	// in source instead of relying on a server redirect.
	...(isStaticExport
		? {}
		: {
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
			}),
};

export default withMDX(config);
