import { getLLMText, source } from "@/lib/source";

// All data comes from the filesystem MDX source at build time.
// "force-static" is required by `output: "export"` (GitHub Pages) and is a
// no-op change for the standalone server.
export const dynamic = "force-static";

const baseUrl = "https://docs.notploy.com";

export async function GET() {
	const pages = source
		.getPages()
		.filter((page) => !page.url.startsWith("/docs/api/"));

	const scan = pages.map(getLLMText);
	const scanned = await Promise.all(scan);

	const content = [
		...scanned,
		"# API Reference",
		"",
		`For the complete API reference, see the OpenAPI specification: ${baseUrl}/openapi.json`,
	];

	return new Response(content.join("\n\n"));
}
