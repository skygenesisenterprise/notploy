"use client";

import { useEffect, useMemo, useState } from "react";

export interface FilterableItem {
	key: string;
	/** Lowercased haystack the free-text search runs against. */
	search: string;
	/** Slugs an item is tagged with; matches the `?tag=` query parameter. */
	tags: string[];
}

interface FilterableListProps {
	items: FilterableItem[];
	searchPlaceholder: string;
	emptyMessage: string;
	/** Applied to the wrapper around the children, e.g. a grid layout. */
	className?: string;
	children: React.ReactNode[];
}

function readQuery(): { search: string; tag: string } {
	if (typeof window === "undefined") {
		return { search: "", tag: "" };
	}

	const params = new URLSearchParams(window.location.search);
	return {
		search: params.get("search") ?? "",
		tag: params.get("tag") ?? "",
	};
}

/**
 * Client-side replacement for the `?search=` / `?tag=` filtering these list
 * pages used to do in the server component.
 *
 * `app/blog/page.tsx` and `app/templates/page.tsx` cannot read `searchParams`
 * when the site is built with `output: "export"` — a page that awaits
 * `searchParams` is dynamic, and a static export rejects dynamic pages. The
 * pages now render the full collection and this component narrows it in the
 * browser, reading the same query parameters that `SearchAndFilter` writes, so
 * shared URLs keep working unchanged.
 */
export function FilterableList({
	items,
	searchPlaceholder,
	emptyMessage,
	className,
	children,
}: FilterableListProps) {
	const [query, setQuery] = useState({ search: "", tag: "" });

	// Read the URL after hydration: the page is static, so the server-rendered
	// markup cannot know the query string.
	useEffect(() => {
		setQuery(readQuery());
	}, []);

	const visible = useMemo(() => {
		const search = query.search.trim().toLowerCase();
		const tag = query.tag;

		return items
			.map((item, index) => ({ item, index }))
			.filter(({ item }) => {
				const matchesSearch =
					search === "" || item.search.toLowerCase().includes(search);
				const matchesTag = tag === "" || item.tags.includes(tag);
				return matchesSearch && matchesTag;
			})
			.map(({ index }) => index);
	}, [items, query]);

	const visibleSet = useMemo(() => new Set(visible), [visible]);

	return (
		<div className={className}>
			{children.map((child, index) => {
				const visible = visibleSet.has(index);
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: children order is stable, the source data carries the real id
					// `contents` keeps each card a direct grid/flex child so hiding one
					// with `hidden` does not disturb the parent's layout.
					<div
						key={items[index]?.key ?? index}
						className={visible ? "contents" : "hidden"}
					>
						{child}
					</div>
				);
			})}
			{visible.length === 0 ? (
				<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
					<p className="text-xl text-muted-foreground">
						{query.search || query.tag
							? `No ${searchPlaceholder} found matching your criteria`
							: emptyMessage}
					</p>
				</div>
			) : null}
		</div>
	);
}
