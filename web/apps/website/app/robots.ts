import type { MetadataRoute } from "next";

// Baked into out/robots.txt during the Pages build.
export const dynamic = "force-static";

// static rule set, no request state

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: ["https://notploy.com/sitemap.xml", "https://notploy.com/llms.txt"],
	};
}
