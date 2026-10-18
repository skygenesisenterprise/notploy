import { relative, sep } from "node:path";
import { listFiles } from "./util.mjs";

export function kebabCase(value) {
	return String(value)
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[^A-Za-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
}

function repoRelative(root, path) {
	return relative(root, path).split(sep).join("/");
}

/**
 * Counts hand-written MDX pages in a section. The generated endpoint
 * reference lives under `api/reference` and is not counted as a guide.
 */
export function countSectionPages(contentRoot, section) {
	const dir = `${contentRoot}/${section.dir}`;
	return listFiles(dir, { extensions: [".mdx"] }).filter((file) => {
		const path = repoRelative(contentRoot, file);
		const remainder = path.replace(new RegExp(`^${section.dir}/?`), "");
		return !remainder.startsWith("reference/");
	}).length;
}

export function renderDocsMap(sections, contentRoot) {
	const rows = sections
		.map((section) => {
			const pages = countSectionPages(contentRoot, section);
			return `| [${section.title}](/docs/${section.id}) | ${pages} | ${section.description} |`;
		})
		.join("\n");
	return [
		"| Section | Pages | What it covers |",
		"| --- | --- | --- |",
		rows,
	].join("\n");
}

const FEATURE_TITLES = {
	"audit-logs": "Audit logs",
	"custom-roles": "Custom roles",
	"docker-compose": "Docker Compose",
	"domains-and-tls": "Domains & TLS",
	"git-sources": "Git sources",
	"organizations": "Organizations",
};
const ACRONYMS = new Set(["ai", "api", "cli", "dns", "scim", "sso", "tls"]);

function humanize(value) {
	if (FEATURE_TITLES[value]) return FEATURE_TITLES[value];
	const words = String(value).replace(/[_-]+/g, " ").trim().split(/\s+/);
	return words
		.map((word) =>
			ACRONYMS.has(word.toLowerCase())
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
}

/** Public route for a content file: no `index`, no parenthesised route groups. */
function docHref(section, doc) {
	const path = doc
		.split("/")
		.filter((segment) => !/^\(.*\)$/.test(segment))
		.join("/")
		.replace(/\/index$/, "");
	return `/docs/${section}/${path}`;
}

/**
 * Feature inventory for the Core capabilities page. The rows come from the
 * explicit core mapping plus the real router registrations and CLI groups, so
 * a feature without an API namespace or CLI surface is visible as such.
 */
export function renderCoreFeatures({ core, namespacesByFeature, cliGroups }) {
	const groups = new Set(cliGroups);
	const rows = core.map((feature) => {
		const namespaces = namespacesByFeature[feature.id] ?? [];
		const api = namespaces.length
			? namespaces.map((name) => `\`${name}\``).join(", ")
			: "—";
		const cli = namespaces
			.map((name) => kebabCase(name))
			.filter((name) => groups.has(name))
			.map((name) => `\`notploy ${name}\``)
			.join(", ");
		const docs = feature.docs ?? [];
		const guide = docs.length
			? `[${humanize(feature.id)}](${docHref("core", docs[0])})${
					docs.length > 1 ? ` (+${docs.length - 1})` : ""
				}`
			: "—";
		return `| ${humanize(feature.id)} | ${api} | ${cli || "—"} | ${guide} |`;
	});
	return [
		"| Area | API namespaces | CLI | Guide |",
		"| --- | --- | --- | --- |",
		...rows,
	].join("\n");
}

export function renderApiNamespaces({ tags, operations, apiDir, namespaceDocs }) {
	const counts = new Map();
	for (const { operation } of operations) {
		for (const tag of operation.tags ?? []) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	const rows = [];
	for (const tag of [...tags].sort((a, b) => a.localeCompare(b))) {
		const slug = tag.toLowerCase();
		const guideSlug = namespaceDocs[tag] ?? kebabCase(tag);
		const guideExists = guideSlug
			? listFiles(apiDir, { extensions: [".mdx"] }).some(
					(file) =>
						repoRelative(apiDir, file) === `${guideSlug}.mdx` &&
						!repoRelative(apiDir, file).startsWith("reference/"),
				)
			: false;
		const guide = guideExists
			? `[${tag} guide](/docs/api/${guideSlug})`
			: "—";
		rows.push(
			`| \`${tag}\` | ${counts.get(tag) ?? 0} | [${slug}](/docs/api/reference/${slug}) | ${guide} |`,
		);
	}
	return [
		"| Namespace | Endpoints | Generated reference | Guide |",
		"| --- | --- | --- | --- |",
		...rows,
	].join("\n");
}
