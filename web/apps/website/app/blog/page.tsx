import { getPosts, getTags } from "@/lib/ghost";
import type { Post } from "@/lib/ghost";
import type { Metadata } from "next";
import { BlogExplorer } from "./components/BlogExplorer";

interface Tag {
	id: string;
	name: string;
	slug: string;
}

export const metadata: Metadata = {
	title: "Blog",
	description: "Latest news, updates, and articles from Notploy",
};

// No `searchParams` here: a static export (GitHub Pages) cannot re-render on
// query strings. BlogExplorer filters client-side and keeps the URL in sync,
// so ?search=/?tag= links keep working on both hosting targets.
export default async function BlogPage() {
	const posts = await getPosts();
	const tags = (await getTags()) as Tag[];

	return <BlogExplorer posts={posts} tags={tags} />;
}
