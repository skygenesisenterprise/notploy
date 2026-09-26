import { getPosts, getTags } from "@/lib/ghost";
import type { Post } from "@/lib/ghost";
import { RssIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostCard } from "./components/BlogPostCard";
import { SearchAndFilter } from "./components/SearchAndFilter";
import { FilterableList } from "../filterable-list";

interface Tag {
	id: string;
	name: string;
	slug: string;
}

export const metadata: Metadata = {
	title: "Blog",
	description: "Latest news, updates, and articles from Notploy",
};

export default async function BlogPage() {
	// No `searchParams` here: awaiting it makes the page dynamic, which
	// `output: "export"` rejects. The full set is rendered and FilterableList
	// narrows it on the client from the same `?search=` / `?tag=` parameters.
	const posts = await getPosts();
	const tags = (await getTags()) as Tag[];

	const items = posts.map((post: Post) => ({
		key: post.id,
		search: `${post.title} ${post.excerpt}`,
		tags: (post.tags ?? []).map((tag) => tag.slug),
	}));

	return (
		<div className="container mx-auto max-w-5xl px-4 py-12">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<p className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">
						BLOG
					</p>
					<h1 className="text-4xl font-bold">Notploy Latest News & Updates</h1>
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
				initialSearch=""
				initialTag=""
				searchPlaceholder="Search posts..."
				allTagsText="All Tags"
			/>

			<FilterableList
				items={items}
				searchPlaceholder="posts"
				emptyMessage="No posts available"
				className="space-y-8"
			>
				{posts.map((post: Post) => (
					<BlogPostCard key={post.id} post={post} />
				))}
			</FilterableList>
		</div>
	);
}
