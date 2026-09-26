import { source } from "@/lib/source";

// All data comes from the filesystem MDX source at build time.
// "force-static" is required by `output: "export"` (GitHub Pages) and is a
// no-op change for the standalone server.
export const dynamic = "force-static";

const baseUrl = "https://docs.notploy.com";

export function GET() {
	const pages = source.getPages();
	const docsPages = pages.filter(
		(page) => !page.url.startsWith("/docs/api/"),
	);

	const lines = [
		"# Notploy Documentation",
		"",
		"> Notploy is an open-source, self-hostable Platform as a Service (PaaS) that simplifies the deployment and management of applications, databases, and services.",
		"",
		"## Docs",
		"",
		...docsPages.map(
			(page) =>
				`- [${page.data.title}](${baseUrl}${page.url})${page.data.description ? `: ${page.data.description}` : ""}`,
		),
		"",
		"## API Reference",
		"",
		`- [OpenAPI Specification](${baseUrl}/openapi.json): Complete API reference in OpenAPI format`,
		"",
		"## Full Documentation",
		"",
		`- [llms-full.txt](${baseUrl}/llms-full.txt): All documentation pages as plain text`,
	];

	return new Response(lines.join("\n"));
}
