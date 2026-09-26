import { getPosts } from "@/lib/ghost";
import { NextResponse } from "next/server";

/**
 * Feeds only read the CMS, so it is written to out/rss.xml at build time.
 * Without this the route is dynamic and `output: "export"` rejects it.
 */
export const dynamic = "force-static";

// generated from the Ghost content API during the build

function escapeXml(unsafe: string): string {
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return c;
		}
	});
}

export async function GET() {
	const posts = await getPosts();

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<channel>
		<title>Notploy Blog</title>
		<link>https://notploy.com/blog</link>
		<description>${escapeXml("Notploy Latest News & Updates")}</description>
		<language>en</language>
		<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
		${posts
			.map(
				(post) => `
		<item>
			<title><![CDATA[${post.title}]]></title>
			<link>https://notploy.com/blog/${escapeXml(post.slug)}</link>
			<guid>https://notploy.com/blog/${escapeXml(post.slug)}</guid>
			<description><![CDATA[${post.excerpt}]]></description>
			<content:encoded><![CDATA[${post.html}]]></content:encoded>
			<pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
			${
				post.feature_image
					? `<enclosure url="${escapeXml(post.feature_image)}" type="image/jpeg" />`
					: ""
			}
			${
				post.primary_author
					? `<dc:creator><![CDATA[${post.primary_author.name}]]></dc:creator>`
					: ""
			}
		</item>`,
			)
			.join("\n")}
	</channel>
</rss>`;

	return new NextResponse(rss, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "s-maxage=3600, stale-while-revalidate",
		},
	});
}
