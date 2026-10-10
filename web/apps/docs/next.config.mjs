import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";
import { legacyDocRedirects } from "./scripts/redirects.mjs";

const withMDX = createMDX();

// The monorepo has a single pnpm workspace at the repository root, so the
// standalone trace root is the repo root (not web/apps/docs).
const tracingRoot = path.join(import.meta.dirname, "../../..");

// Two build targets share this config:
//
//   NEXT_OUTPUT=standalone (default) -> web/Dockerfile.docs, runs the docs
//       server as a Node process behind the Notploy reverse proxy.
//
//   NEXT_OUTPUT=export              -> emits web/apps/docs/out for static hosting.
//
// `output: "export"` is mutually exclusive with standalone tracing and does not
// support `redirects`, so the two modes diverge here rather than in the CI file.
const isStaticExport = process.env.NEXT_OUTPUT === "export";

// Optional path prefix for static hosting under a subpath.
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
	// Directory indexes make deep links work on static hosts that do not perform
	// Next.js route resolution.
	...(isStaticExport ? { trailingSlash: true } : {}),
	// `redirects()` is unsupported under `output: "export"`, so static exports
	// omit these redirects.
	...(isStaticExport
		? {}
		: {
				async redirects() {
					return [
						// The docs entry point is the Core section. 307 (temporary) so the
						// landing target can move later without a stale permanent redirect.
						{
							source: "/",
							destination: "/docs/core",
							permanent: false,
						},
						// Preserve legacy public URLs from the pre-refactor documentation.
						...legacyDocRedirects,
					];
				},
			}),
};

export default withMDX(config);
