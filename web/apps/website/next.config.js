// Internationalization removed

/** @type {import('next').NextConfig} */
const nextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
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
