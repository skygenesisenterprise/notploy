import { Loader2, Newspaper } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Post, Tag } from "@/lib/ghost";
import { useDebounce } from "@/utils/hooks/use-debounce";
import { BlogPostCard } from "./blog-post-card";
import { HandleBlog } from "./handle-blog";
import { SearchAndFilter } from "./search-and-filter";

interface ShowBlogProps {
	posts: Post[];
	tags: Tag[];
	isPending?: boolean;
}

export const ShowBlog = ({ posts, tags, isPending }: ShowBlogProps) => {
	const router = useRouter();
	const routerRef = useRef(router);
	routerRef.current = router;

	const [search, setSearch] = useState(
		typeof router.query.search === "string" ? router.query.search : "",
	);
	const [selectedTag, setSelectedTag] = useState(
		typeof router.query.tag === "string" ? router.query.tag : "",
	);

	const debouncedSearch = useDebounce(search, 300);

	// Reflect the filters in the URL. Deliberately keyed on the filter values
	// only: `router` changes identity mid-navigation, and reacting to that here
	// would fire a shallow replace that cancels the route change.
	useEffect(() => {
		const activeRouter = routerRef.current;
		if (!activeRouter.isReady) return;
		const currentSearch =
			typeof activeRouter.query.search === "string"
				? activeRouter.query.search
				: "";
		const currentTag =
			typeof activeRouter.query.tag === "string" ? activeRouter.query.tag : "";
		if (currentSearch === debouncedSearch && currentTag === selectedTag) return;

		const query = { ...activeRouter.query };
		if (debouncedSearch) {
			query.search = debouncedSearch;
		} else {
			delete query.search;
		}
		if (selectedTag) {
			query.tag = selectedTag;
		} else {
			delete query.tag;
		}
		activeRouter.replace({ query }, undefined, { shallow: true });
	}, [debouncedSearch, selectedTag]);

	const filteredPosts = useMemo(() => {
		const query = debouncedSearch.trim().toLowerCase();
		return posts.filter((post) => {
			const matchesSearch =
				query === "" ||
				post.title.toLowerCase().includes(query) ||
				(post.custom_excerpt || post.excerpt || "")
					.toLowerCase()
					.includes(query);
			const matchesTag =
				selectedTag === "" ||
				post.tags?.some((tag) => tag.slug === selectedTag);
			return matchesSearch && matchesTag;
		});
	}, [posts, debouncedSearch, selectedTag]);

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl w-full min-h-[45vh]">
				<div className="rounded-xl bg-background shadow-md h-full">
					<CardHeader>
						<CardTitle className="text-xl flex flex-row gap-2">
							<Newspaper className="size-6 text-muted-foreground self-center" />
							Blog
						</CardTitle>
						<CardDescription>
							Latest news, updates and articles published on the Notploy website
						</CardDescription>
						<CardAction>
							<HandleBlog />
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-2 py-8 border-t">
						{isPending ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<SearchAndFilter
									tags={tags}
									search={search}
									selectedTag={selectedTag}
									onSearchChange={setSearch}
									onTagChange={setSelectedTag}
								/>
								{filteredPosts.length === 0 ? (
									<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
										<p className="text-xl text-muted-foreground">
											{search || selectedTag
												? "No posts found matching your criteria"
												: "No posts available"}
										</p>
									</div>
								) : (
									<div className="space-y-8">
										{filteredPosts.map((post) => (
											<BlogPostCard key={post.id} post={post} />
										))}
									</div>
								)}
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
