"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Tag {
	id: string;
	name: string;
	slug: string;
}

interface SearchAndFilterProps {
	tags: Tag[];
	searchPlaceholder: string;
	allTagsText: string;
	onFilterChange: (filters: { search: string; tag: string }) => void;
}

const ALL_TAGS_VALUE = "all";

export function SearchAndFilter({
	tags,
	searchPlaceholder,
	allTagsText,
	onFilterChange,
}: SearchAndFilterProps) {
	const [searchValue, setSearchValue] = useState("");
	const [tagValue, setTagValue] = useState(ALL_TAGS_VALUE);

	const apply = useCallback(
		(search: string, tag: string) => {
			const params = new URLSearchParams(window.location.search);
			if (search) {
				params.set("search", search);
			} else {
				params.delete("search");
			}
			if (tag) {
				params.set("tag", tag);
			} else {
				params.delete("tag");
			}
			const query = params.toString();
			window.history.replaceState(
				null,
				"",
				query ? `?${query}` : window.location.pathname,
			);
			onFilterChange({ search, tag });
		},
		[onFilterChange],
	);

	// Seed from the URL after hydration: a static export cannot read
	// searchParams on the server, so shared ?search=/?tag= links are applied
	// on the client.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const search = params.get("search") ?? "";
		const tag = params.get("tag") ?? "";
		setSearchValue(search);
		setTagValue(tag || ALL_TAGS_VALUE);
		onFilterChange({ search, tag });
	}, [onFilterChange]);

	const handleTagChange = (value: string) => {
		const tag = value === ALL_TAGS_VALUE ? "" : value;
		setTagValue(value);
		apply(searchValue, tag);
	};

	const debouncedCallback = useDebounce((value: string) => {
		apply(value, tagValue === ALL_TAGS_VALUE ? "" : tagValue);
	}, 300);

	const handleSearch = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setSearchValue(e.target.value);
			debouncedCallback(e.target.value);
		},
		[debouncedCallback],
	);

	return (
		<div className="mb-5 flex flex-col gap-3 md:flex-row">
			<div className="relative flex-1">
				<div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
					<Search className="h-5 w-5 text-muted-foreground" />
				</div>
				<input
					type="text"
					value={searchValue}
					onChange={handleSearch}
					placeholder={searchPlaceholder}
					className="h-11 w-full rounded-xl border border-border/60 bg-background pl-10 pr-4 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>
			<div className="w-full md:w-64">
				<Select value={tagValue} onValueChange={handleTagChange}>
					<SelectTrigger>
						<SelectValue placeholder={allTagsText} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_TAGS_VALUE}>{allTagsText}</SelectItem>
						{tags.map((tag) => (
							<SelectItem key={tag.id} value={tag.slug}>
								{tag.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
