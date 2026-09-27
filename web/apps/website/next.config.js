// Internationalization removed

// Two build targets share this config:
//
//   (default)          -> web/Dockerfile.website, runs the marketing site as a
//                         Node process behind the Notploy reverse proxy.
//
//   NEXT_OUTPUT=export -> static export for environments that serve the
//                         website without a Node.js runtime.
//
// The static target cannot run app/api routes or read request cookies, so
// server-backed features need build-time alternatives:
//   * /api/github-stars, /api/github-contributors and /api/docker-stats become
//     build-time snapshots refreshed on every export
//   * /api/og serves one static card instead of a per-slug rendered PNG
//   * the contact form posts to NEXT_PUBLIC_CONTACT_ENDPOINT, or falls back to
//     mailto: when that is unset
const isStaticExport = process.env.NEXT_OUTPUT === "export";

// Optional path prefix for static hosting under a subpath.
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath,
	// Directory indexes make deep links work on static hosts that do not perform
	// Next.js route resolution.
	trailingSlash: true,
	...(isStaticExport ? { output: "export" } : {}),
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		// The image optimizer is a server runtime feature; a static export has to
		// ship the unoptimized <img> output instead.
		...(isStaticExport ? { unoptimized: true } : {}),
		remotePatterns: [
			{
				hostname: "static.ghost.org",
			},
			{
				hostname: "testing-ghost-8423be-31-220-108-27.traefik.me",
			},
			{
				hostname: "images.unsplash.com",
			},
			{
				hostname: "www.gravatar.com",
			},
			{
				hostname: "cms.notploy.com",
			},
		],
		// domains: [
		// 	"static.ghost.org",
		// 	"testing-ghost-8423be-31-220-108-27.traefik.me",
		// 	"images.unsplash.com",
		// 	"www.gravatar.com",
		// 	"cms.notploy.com",
		// ],
	},
};

module.exports = nextConfig;
