import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

const baseUrl = "https://docs.notploy.com";

export default function sitemap(): MetadataRoute.Sitemap {
	const pages = source.getPages().map((page) => ({
		url: `${baseUrl}${page.url}`,
		lastModified: new Date(),
		changeFrequency: "weekly" as const,
		priority: 0.7,
	}));

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 1,
		},
		...pages,
	];
}

// Required by `output: "export"` (GitHub Pages) so the route is emitted
// as a static file instead of being skipped.
export const dynamic = "force-static";
