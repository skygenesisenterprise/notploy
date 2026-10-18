import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { relative, sep } from "node:path";
import { extractInternalLinks, pageRoutes } from "./mdx.mjs";
import { listFiles } from "./util.mjs";

/** Routes served by content files, including parenthesised route groups. */
export function collectRoutes(contentRoot) {
	const routes = new Map();
	for (const file of listFiles(contentRoot, { extensions: [".mdx"] })) {
		const path = relative(contentRoot, file).split(sep).join("/");
		for (const route of pageRoutes(path)) {
			routes.set(route, path);
		}
	}
	return routes;
}

/**
 * Sources of the legacy URL redirects. They are served by next.config.mjs, so
 * a link to one is not broken.
 */
export async function collectRedirectSources(redirectsPath) {
	try {
		const module = await import(pathToFileURL(redirectsPath).href);
		return new Set(
			(module.legacyDocRedirects ?? []).map((redirect) => redirect.source),
		);
	} catch {
		return new Set();
	}
}

export function validateInternalLinks({ contentRoot, routes, redirects }) {
	const issues = [];
	for (const file of listFiles(contentRoot, { extensions: [".mdx"] })) {
		const path = relative(contentRoot, file).split(sep).join("/");
		const source = readFileSync(file, "utf8");
		for (const link of extractInternalLinks(source)) {
			const target = link.target.replace(/\/$/, "") || "/docs";
			if (routes.has(target) || redirects.has(target)) continue;
			issues.push({
				severity: "error",
				code: "docs.broken-link",
				file: `web/apps/docs/content/docs/${path}`,
				line: link.line,
				message: `link "${link.target}" does not resolve to a documentation page`,
				hint: "Link to an MDX page, or add a redirect in web/apps/docs/scripts/redirects.mjs for a legacy URL.",
			});
		}
	}
	return issues;
}
