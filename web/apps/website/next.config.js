// Internationalization removed

// Static export target for GitHub Pages. The Docker image keeps the default
// server output, so API routes (contact, OG image, GitHub stats) stay available
// there while the Pages build is plain HTML.
const isStaticExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	output: isStaticExport ? "export" : undefined,
	basePath,
	trailingSlash: isStaticExport,
	...(isStaticExport
		? {}
		: {
				async redirects() {
					return [
						{
							source: "/dokploy-vs-:slug",
							destination: "/notploy-vs-:slug",
							permanent: true,
						},
					];
				},
			}),
	images: {
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
