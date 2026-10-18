import type { MetadataRoute } from "next";

// Required for `output: "export"` (GitHub Pages).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: ["https://notploy.com/sitemap.xml", "https://notploy.com/llms.txt"],
	};
}
