import { getTopTags } from "@/lib/templates";
import { getTemplates } from "@/lib/templates.server";
import type { Metadata } from "next";
import { TemplateExplorer } from "./components/TemplateExplorer";

export const metadata: Metadata = {
	title: "Open Source Templates - One-Click Self-Hosted Deployments",
	description:
		"Browse 500+ open source templates ready to deploy on Notploy with one click. Self-host databases, CMS, analytics, AI tools, and more with Docker Compose.",
	alternates: {
		canonical: "https://notploy.com/templates",
	},
	openGraph: {
		title: "Notploy Open Source Templates",
		description:
			"Browse 500+ open source templates ready to deploy on Notploy with one click.",
		type: "website",
		url: "https://notploy.com/templates",
	},
};

// No `searchParams` here: a static export (GitHub Pages) cannot re-render on
// query strings. TemplateExplorer filters client-side and keeps the URL in
// sync, so ?search=/?tag= links keep working on both hosting targets.
export default async function TemplatesPage() {
	const templates = await getTemplates();
	const topTags = getTopTags(templates);

	return <TemplateExplorer templates={templates} topTags={topTags} />;
}
