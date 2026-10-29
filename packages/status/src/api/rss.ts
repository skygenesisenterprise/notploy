/**
 * RSS 2.0 feed per status page — a notification channel that needs no
 * provider and no credential: readers subscribe directly. Only published,
 * public incidents appear, with the same projection as the API.
 */
import type { StatusContext } from "../services/context";
import {
	isPubliclyVisibleIncident,
	publicIncidentDto,
} from "../services/public";

const escapeXml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

export const buildRssFeed = (
	ctx: StatusContext,
	slug: string,
): string | null => {
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		return null;
	}
	const incidents = ctx.repos.incidents
		.listByPage(page.id)
		.filter((row) => isPubliclyVisibleIncident(row))
		.slice(0, 50);

	const items = incidents.map((row) => {
		const incident = publicIncidentDto(ctx, row, { includeUpdates: true });
		const link = `${ctx.config.publicUrl}/p/${page.slug}/incidents/${incident.id}`;
		const latest = incident.updates[incident.updates.length - 1];
		const description = latest?.message ?? incident.summary ?? incident.title;
		return `    <item>
      <title>${escapeXml(`[${incident.severity}] ${incident.title}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(incident.startedAt).toUTCString()}</pubDate>
      <category>${escapeXml(incident.state)}</category>
      <description>${escapeXml(`${incident.state}: ${description}`)}</description>
    </item>`;
	});

	const updatedAt = incidents[0]?.updated_at ?? page.updated_at;
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${page.name} — status`)}</title>
    <link>${escapeXml(`${ctx.config.publicUrl}/p/${page.slug}`)}</link>
    <description>${escapeXml(page.description || `${page.name} service status`)}</description>
    <lastBuildDate>${new Date(updatedAt).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${ctx.config.publicUrl}/api/v1/pages/${page.slug}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
};
