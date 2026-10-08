import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: ["https://notploy.com/sitemap.xml", "https://notploy.com/llms.txt"],
	};
}
