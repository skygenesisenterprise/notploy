// Internationalization removed

// Two build targets share this config:
//
//   (default)          -> web/Dockerfile.website, runs the marketing site as a
//                         Node process behind the Notploy reverse proxy.
//
//   NEXT_OUTPUT=export -> .github/workflows/pages-website.yml, emits
//                         web/apps/website/out for GitHub Pages.
//
// The static target cannot run the app/api routes or read request cookies, so
// everything they served is baked at build time instead:
//   * blog + template detail pages come from generateStaticParams
//   * /api/github-stars, /api/github-contributors and /api/docker-stats become
//     build-time snapshots refreshed on every deploy
//   * /api/og serves one static card instead of a per-slug rendered PNG
//   * the contact form posts to NEXT_PUBLIC_CONTACT_ENDPOINT, or falls back to
//     mailto: when that is unset
const isStaticExport = process.env.NEXT_OUTPUT === "export";

// Set by actions/configure-pages. Empty when Pages is served from a domain root
// (notploy.com); "/<repo>" when it is served from <org>.github.io/<repo>/.
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath,
	// `next export` writes <route>.html; GitHub Pages only resolves
	// extensionless URLs to <route>/index.html, so without this every deep link
	// would 404. Harmless for the Node server, which 301s to the same place.
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
