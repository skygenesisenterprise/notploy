import { Twitter } from "lucide-react";
import type { Post } from "@/lib/ghost";

interface BlogPostCardProps {
	post: Post;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
	const formattedDate = new Date(post.published_at).toLocaleDateString("en", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<a
			href={post.url}
			target="_blank"
			rel="noopener noreferrer"
			className="group block rounded-lg border border-border p-4 transition-colors hover:bg-muted"
		>
			<article className="flex items-center gap-6 max-sm:flex-col">
				<div className="relative mx-auto flex shrink-0 items-center justify-center">
					{/* biome-ignore lint/performance/noImgElement: remote Ghost media */}
					<img
						src={post.feature_image || "/og.png"}
						alt={post.feature_image ? post.title : "Default Image"}
						className="mx-auto h-32 w-64 self-center rounded-lg object-cover object-center sm:h-24 sm:w-32"
					/>
				</div>
				<div className="flex w-full flex-wrap">
					<h2 className="mb-2 text-xl font-semibold group-hover:text-primary">
						{post.title}
					</h2>
					<p className="mb-4 line-clamp-2 text-muted-foreground">
						{post.custom_excerpt || post.excerpt}
					</p>
					<div className="flex flex-wrap items-center text-sm text-muted-foreground">
						<div className="flex items-center">
							{post.primary_author?.profile_image && (
								<div className="relative mr-2 h-6 w-6 overflow-hidden rounded-full">
									{/* biome-ignore lint/performance/noImgElement: remote Ghost media */}
									<img
										src={post.primary_author.profile_image}
										alt={post.primary_author.name}
										className="object-cover"
									/>
								</div>
							)}
							<span>{post.primary_author?.name || "Unknown Author"}</span>
							{post.primary_author?.twitter && (
								<Twitter className="ml-2 size-3.5" aria-hidden="true" />
							)}
						</div>
						<span className="mx-2">in</span>
						<span>{post.primary_tag?.name || "General"}</span>
						<span className="mx-2">•</span>
						<span>{post.reading_time} min read</span>
						<span className="mx-2">•</span>
						<span>{formattedDate}</span>
					</div>
				</div>
			</article>
		</a>
	);
}
