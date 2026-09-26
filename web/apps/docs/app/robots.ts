import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: "https://docs.notploy.com/sitemap.xml",
	};
}

// Required by `output: "export"` (GitHub Pages) so the route is emitted
// as a static file instead of being skipped.
export const dynamic = "force-static";
