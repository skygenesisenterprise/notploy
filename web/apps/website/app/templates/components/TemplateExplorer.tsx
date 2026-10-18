"use client";

import type { Template } from "@/lib/templates";
import Link from "next/link";
import { useState } from "react";
import { SearchAndFilter } from "../../blog/components/SearchAndFilter";
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
		<div className="container mx-auto max-w-7xl px-4 py-12 mt-14">
			<div className="mb-8">
				<p className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">
					TEMPLATES
				</p>
				<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
					Open Source Templates
				</h1>
				<p className="mt-4 max-w-2xl text-lg tracking-tight text-muted-foreground">
					{templates.length}+ pre-configured open source templates you can
					deploy on Notploy with a single click.
				</p>
			</div>

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

			{filteredTemplates.length === 0 ? (
				<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
					<p className="text-xl text-muted-foreground">
						{search || tag
							? "No templates found matching your criteria"
							: "No templates available"}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredTemplates.map((template) => (
						<TemplateCard key={template.id} template={template} />
					))}
				</div>
			)}
		</div>
	);
}
