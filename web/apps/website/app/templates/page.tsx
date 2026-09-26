import { getTemplates, getTopTags } from "@/lib/templates";
import type { Metadata } from "next";
import { SearchAndFilter } from "../blog/components/SearchAndFilter";
import { TemplateCard } from "./components/TemplateCard";
import { FilterableList } from "../filterable-list";

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

export default async function TemplatesPage() {
	// No `searchParams` here: awaiting it makes the page dynamic, which
	// `output: "export"` rejects. The full set is rendered and FilterableList
	// narrows it on the client from the same `?search=` / `?tag=` parameters.
	const templates = await getTemplates();
	const topTags = getTopTags(templates);

	const items = templates.map((template) => ({
		key: template.id,
		search: `${template.name} ${template.description}`,
		tags: template.tags,
	}));

	return (
		<div className="container mx-auto max-w-7xl px-4 py-12 mt-14">
			<div className="mb-8">
				<p className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">
					TEMPLATES
				</p>
				<h1 className="text-4xl font-bold">Open Source Templates</h1>
				<p className="mt-3 max-w-2xl text-lg text-muted-foreground">
					{templates.length}+ pre-configured open source templates you can
					deploy on Notploy with a single click.
				</p>
			</div>

			<SearchAndFilter
				tags={topTags.map((tag) => ({ id: tag, name: tag, slug: tag }))}
				initialSearch=""
				initialTag=""
				searchPlaceholder="Search templates..."
				allTagsText="All Tags"
			/>

			<FilterableList
				items={items}
				searchPlaceholder="templates"
				emptyMessage="No templates available"
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
			>
				{templates.map((template) => (
					<TemplateCard key={template.id} template={template} />
				))}
			</FilterableList>
		</div>
	);
}
