"use client";

import type { Post } from "@/lib/ghost";
import { RssIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BlogPostCard } from "./BlogPostCard";
import { SearchAndFilter } from "./SearchAndFilter";

interface Tag {
	id: string;
	name: string;
	slug: string;
}

export function BlogExplorer({ posts, tags }: { posts: Post[]; tags: Tag[] }) {
	const [filters, setFilters] = useState({ search: "", tag: "" });
	const { search, tag } = filters;

	const filteredPosts = posts.filter((post) => {
		const matchesSearch =
			search === "" ||
			post.title.toLowerCase().includes(search.toLowerCase()) ||
			post.excerpt.toLowerCase().includes(search.toLowerCase());

		const matchesTag =
			tag === "" || post.tags?.some((postTag) => postTag.slug === tag);

		return matchesSearch && matchesTag;
	});

	return (
		<div className="container mx-auto max-w-5xl px-4 py-12">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<p className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">
						BLOG
					</p>
					<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
						Notploy Latest News & Updates
					</h1>
				</div>
				<Link
					href="/rss.xml"
					className="text-muted-foreground hover:text-foreground"
				>
					<RssIcon className="h-5 w-5" />
				</Link>
			</div>

			<SearchAndFilter
				tags={tags}
				searchPlaceholder="Search posts..."
				allTagsText="All Tags"
				onFilterChange={setFilters}
			/>

			{filteredPosts.length === 0 ? (
				<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
					<p className="text-xl text-muted-foreground">
						{search || tag
							? "No posts found matching your criteria"
							: "No posts available"}
					</p>
				</div>
			) : (
				<div className="space-y-8">
					{filteredPosts.map((post: Post) => (
						<BlogPostCard key={post.id} post={post} />
					))}
				</div>
			)}
		</div>
	);
}
