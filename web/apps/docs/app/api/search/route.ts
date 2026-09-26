import { source } from "@/lib/source";
import {
	createFromSource,
	initAdvancedSearch,
} from "fumadocs-core/search/server";
import type { InferPageType } from "fumadocs-core/source";

type Page = InferPageType<typeof source>;

// Configure tag filter based on the first slug (core, cli, api)
function buildIndex(page: Page) {
	const tag = page.slugs[0] || "all";
	return {
		id: page.url,
		title: page.data.title,
		description: page.data.description,
		url: page.url,
		structuredData: page.data.structuredData,
		tag,
	} as any;
}

// All data comes from the filesystem MDX source at build time.
// "force-static" is required by `output: "export"` (GitHub Pages) and is a
// no-op change for the standalone server.
export const dynamic = "force-static";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

// Under `output: "export"` there is no server to run a query against, so the
// Orama index is exported once at build time and the browser searches it
// locally. Paired with `useDocsSearch({ type: "static" })` in
// components/SearchDialog.tsx. The standalone server keeps the runtime handler,
// which only ships the query parameters instead of the whole index.
const staticSearch = initAdvancedSearch({
	// https://docs.orama.com/docs/orama-js/supported-languages
	language: "english",
	indexes: source.getPages().map(buildIndex),
});

const staticHandler = async () => Response.json(await staticSearch.export());

const { GET: runtimeHandler } = createFromSource(source, {
	// https://docs.orama.com/docs/orama-js/supported-languages
	language: "english",
	buildIndex,
});

export const GET: (request: Request) => Promise<Response> = isStaticExport
	? async () => staticHandler()
	: runtimeHandler;
