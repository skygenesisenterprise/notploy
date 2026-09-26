"use client";

import { useDocsSearch } from "fumadocs-core/search/client";
import {
	SearchDialog,
	SearchDialogClose,
	SearchDialogContent,
	SearchDialogFooter,
	SearchDialogHeader,
	SearchDialogIcon,
	SearchDialogInput,
	SearchDialogList,
	SearchDialogOverlay,
	type SharedProps,
	TagsList,
	TagsListItem,
} from "fumadocs-ui/components/dialog/search";
import { useState } from "react";

export default function CustomSearchDialog(props: SharedProps) {
	const [tag, setTag] = useState<string | undefined>("all");
	// When tag is "all", don't filter by tag (pass undefined)
	const tagFilter = tag === "all" ? undefined : tag;
	// `NEXT_PUBLIC_*` because this is a client component: the flag is inlined at
	// build time. Under `output: "export"` (GitHub Pages) there is no server to
	// query, so the prebuilt index at /api/search is downloaded and searched in
	// the browser. See app/api/search/route.ts for the matching route handler.
	const { search, setSearch, query } = useDocsSearch(
		process.env.NEXT_PUBLIC_NOTPLOY_OUTPUT === "export"
			? {
					type: "static",
					tag: tagFilter,
					from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`,
				}
			: { type: "fetch", tag: tagFilter },
	);

	return (
		<SearchDialog
			search={search}
			onSearchChange={setSearch}
			isLoading={query.isLoading}
			{...props}
		>
			<SearchDialogOverlay />
			<SearchDialogContent>
				<SearchDialogHeader>
					<SearchDialogIcon />
					<SearchDialogInput />
					<SearchDialogClose />
				</SearchDialogHeader>
				<SearchDialogList items={query.data !== "empty" ? query.data : null} />
				<SearchDialogFooter>
					<TagsList tag={tag} onTagChange={setTag}>
						<TagsListItem value="all">All</TagsListItem>
						<TagsListItem value="core">Core</TagsListItem>
						<TagsListItem value="cli">CLI</TagsListItem>
						<TagsListItem value="api">API</TagsListItem>
						<TagsListItem value="templates">Templates</TagsListItem>
					</TagsList>
				</SearchDialogFooter>
			</SearchDialogContent>
		</SearchDialog>
	);
}
