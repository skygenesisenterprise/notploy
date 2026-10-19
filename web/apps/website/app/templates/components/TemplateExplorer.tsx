"use client";

import { Container } from "@/components/Container";
import { PageHero } from "@/components/pages/PageHero";
import { Button } from "@/components/ui/button";
import type { Template } from "@/lib/templates";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SearchAndFilter } from "./SearchAndFilter";
import { TemplateCard } from "./TemplateCard";

export function TemplateExplorer({
	templates,
	topTags,
}: {
	templates: Template[];
	topTags: string[];
}) {
	const [filters, setFilters] = useState({ search: "", tag: "" });
	const { search, tag } = filters;

	const filteredTemplates = templates.filter((template) => {
		const matchesSearch =
			search === "" ||
			template.name.toLowerCase().includes(search.toLowerCase()) ||
			template.description.toLowerCase().includes(search.toLowerCase());

		const matchesTag = tag === "" || template.tags.includes(tag);

		return matchesSearch && matchesTag;
	});

	return (
		<div className="bg-background">
			<PageHero
				badge="Templates"
				badgeDetail={`${templates.length}+ ready to deploy`}
				title="Open source,"
				highlight="one click away"
				description={`${templates.length}+ pre-configured open source templates you can deploy on Notploy with a single click. Databases, CMS, analytics, AI tools and more — each one packaged as a working Docker Compose stack.`}
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="https://templates.notploy.com" target="_blank">
								Open the gallery
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link
								href="https://docs.notploy.com/docs/core/installation"
								target="_blank"
							>
								Install Notploy
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/self", label: "Explore Notploy Self" },
					{ href: "/platform", label: "Platform capabilities" },
					{ href: "/community", label: "Publish a template" },
				]}
			>
				<div className="mx-auto grid max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3">
					{[
						{ label: "Templates", value: `${templates.length}+` },
						{ label: "Categories", value: `${topTags.length}` },
						{ label: "Deployment", value: "One click" },
					].map((item) => (
						<div key={item.label} className="bg-card px-5 py-4">
							<p className="text-sm text-muted-foreground">{item.label}</p>
							<p className="mt-1 text-base font-semibold text-foreground">
								{item.value}
							</p>
						</div>
					))}
				</div>
			</PageHero>

			<Container className="pb-20 sm:pb-28">
				<div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6">
					<SearchAndFilter
						tags={topTags.map((topTag) => ({
							id: topTag,
							name: topTag,
							slug: topTag,
						}))}
						searchPlaceholder="Search templates..."
						allTagsText="All Tags"
						onFilterChange={setFilters}
					/>
					<p className="text-sm text-muted-foreground" aria-live="polite">
						{filteredTemplates.length} template
						{filteredTemplates.length === 1 ? "" : "s"}
						{search || tag ? " matching your filters" : " available"}
					</p>
				</div>

				{filteredTemplates.length === 0 ? (
					<div className="mt-6 flex min-h-[20vh] items-center justify-center rounded-2xl border border-border/50 bg-card p-8 text-center">
						<p className="text-xl text-muted-foreground">
							{search || tag
								? "No templates found matching your criteria"
								: "No templates available"}
						</p>
					</div>
				) : (
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{filteredTemplates.map((template) => (
							<TemplateCard key={template.id} template={template} />
						))}
					</div>
				)}
			</Container>
		</div>
	);
}
