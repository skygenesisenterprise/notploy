import { parse as parseYaml } from "yaml";

// MDX has no HTML comments; `{/* ... */}` is the comment form the docs
// framework accepts inside a page.
const BEGIN_RE = /^\s*\{\/\*\s*BEGIN GENERATED:\s*([A-Za-z0-9_-]+)\s*\*\/\}\s*$/;
const END_RE = /^\s*\{\/\*\s*END GENERATED:\s*([A-Za-z0-9_-]+)\s*\*\/\}\s*$/;
const FENCE_RE = /^\s*(?:```|~~~)/;

/**
 * Extracts the YAML frontmatter of an MDX page.
 * Returns `{ data, error }`; a page without frontmatter returns `{ data: {} }`.
 */
export function parseFrontmatter(source) {
	if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
		return { data: {} };
	}
	const lines = source.split("\n");
	const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (end === -1) {
		return { data: {}, error: "frontmatter is not closed with ---" };
	}
	try {
		const data = parseYaml(lines.slice(1, end).join("\n")) ?? {};
		return { data, endLine: end + 1 };
	} catch (error) {
		return { data: {}, error: `invalid frontmatter: ${error.message}` };
	}
}

/**
 * Finds `<!-- BEGIN GENERATED: id -->` regions. Markers inside fenced code
 * blocks are ignored, so a page may show the syntax without being parsed.
 *
 * Returns every region plus explicit errors for missing ends, nested markers,
 * duplicated ids and mismatched ids.
 */
export function parseGeneratedRegions(source) {
	const lines = source.split("\n");
	const regions = new Map();
	const errors = [];
	let fenced = false;
	let open = null;

	for (const [index, line] of lines.entries()) {
		if (FENCE_RE.test(line)) {
			fenced = !fenced;
			continue;
		}
		if (fenced) continue;

		const begin = line.match(BEGIN_RE);
		const end = line.match(END_RE);

		if (begin) {
			const id = begin[1];
			if (open) {
				errors.push({
					code: "mdx.nested-region",
					line: index + 1,
					message: `BEGIN GENERATED "${id}" appears inside "${open.id}", which was never closed`,
				});
				continue;
			}
			if (regions.has(id)) {
				errors.push({
					code: "mdx.duplicate-region",
					line: index + 1,
					message: `generated region "${id}" is declared more than once`,
				});
				continue;
			}
			open = { id, startLine: index, endLine: null, content: [] };
			continue;
		}

		if (end) {
			const id = end[1];
			if (!open) {
				errors.push({
					code: "mdx.unexpected-end",
					line: index + 1,
					message: `END GENERATED "${id}" has no matching BEGIN GENERATED marker`,
				});
				continue;
			}
			if (open.id !== id) {
				errors.push({
					code: "mdx.mismatched-region",
					line: index + 1,
					message: `END GENERATED "${id}" does not match BEGIN GENERATED "${open.id}"`,
				});
				continue;
			}
			regions.set(id, {
				id,
				startLine: open.startLine,
				endLine: index,
				content: open.content.join("\n"),
			});
			open = null;
			continue;
		}

		if (open) open.content.push(line);
	}

	if (open) {
		errors.push({
			code: "mdx.unclosed-region",
			line: open.startLine + 1,
			message: `generated region "${open.id}" has no END GENERATED marker`,
		});
	}

	return { regions, errors };
}

export function renderGeneratedRegion(id, content) {
	const body = content.replace(/^\n+|\n+$/g, "");
	return [
		`{/* BEGIN GENERATED: ${id} */}`,
		body,
		`{/* END GENERATED: ${id} */}`,
	].join("\n");
}

/**
 * Replaces exactly one managed region. Human-authored content around it is
 * preserved byte for byte; a missing or ambiguous region is an error instead
 * of an insertion.
 */
export function applyGeneratedRegion(source, id, content) {
	const { regions, errors } = parseGeneratedRegions(source);
	if (errors.length > 0) {
		return { error: errors[0].message };
	}
	const region = regions.get(id);
	if (!region) {
		return {
			error: `generated region "${id}" is missing; add the BEGIN/END markers before generating`,
		};
	}
	const lines = source.split("\n");
	lines.splice(
		region.startLine,
		region.endLine - region.startLine + 1,
		...renderGeneratedRegion(id, content).split("\n"),
	);
	return { source: lines.join("\n") };
}

function blankFencedBlocks(source) {
	let fenced = false;
	return source
		.split("\n")
		.map((line) => {
			if (FENCE_RE.test(line)) {
				fenced = !fenced;
				return "";
			}
			return fenced ? "" : line;
		})
		.join("\n");
}

/**
 * Internal documentation links in a page, with the line they appear on.
 * Fenced code blocks are skipped so example URLs are not treated as links.
 */
export function extractInternalLinks(source) {
	const links = [];
	const lines = blankFencedBlocks(source).split("\n");
	const markdown = /\[[^\]]*\]\((\/docs[^)\s]*)\)/g;
	const html = /href=["'](\/docs[^"']*)["']/g;

	for (const [index, line] of lines.entries()) {
		for (const pattern of [markdown, html]) {
			pattern.lastIndex = 0;
			for (const match of line.matchAll(pattern)) {
				const target = match[1].split("#")[0].split("?")[0];
				if (target) links.push({ target, line: index + 1 });
			}
		}
	}
	return links;
}

/**
 * Maps a content file to the routes it serves. Parenthesised directories are
 * both kept verbatim and stripped, because sidebars reference them while
 * Next.js route groups do not appear in the URL.
 */
export function pageRoutes(relativePath) {
	const withoutExtension = relativePath.replace(/\.mdx$/, "");
	const segments = withoutExtension.split("/");
	if (segments[segments.length - 1] === "index") segments.pop();
	const route = `/docs${segments.length ? `/${segments.join("/")}` : ""}`;
	const normalized = `/docs${segments
		.map((segment) => segment.replace(/^\(.*\)$/, ""))
		.filter(Boolean)
		.map((segment) => `/${segment}`)
		.join("")}`;
	return normalized === route ? [route] : [route, normalized];
}
