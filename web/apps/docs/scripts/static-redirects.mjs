/**
 * Materialises the legacy URL redirects as static HTML stubs for the static
 * export (`NEXT_OUTPUT=export`). `redirects()` in next.config.mjs only runs on
 * the Node server, so `output: "export"` loses them and GitHub Pages answers
 * 404 for every pre-refactor bookmark. Each redirect becomes a tiny
 * `index.html` with a meta refresh; any path the export already occupies is
 * skipped so a live page always wins.
 *
 * Wired as the last step of `pnpm docs:build`. No-op unless NEXT_OUTPUT=export
 * and the out/ directory exists (Docker builds run standalone mode).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APP_ROOT = resolve(import.meta.dirname, "..");
const OUT_ROOT = join(APP_ROOT, "out");
const REDIRECTS_PATH = join(import.meta.dirname, "redirects.mjs");

if (process.env.NEXT_OUTPUT !== "export" || !existsSync(OUT_ROOT)) {
	process.exit(0);
}

const { legacyDocRedirects } = await import(pathToFileURL(REDIRECTS_PATH).href);

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function stub(destination) {
	const url = `${destination.replace(/\/$/, "")}/`;
	const escaped = escapeHtml(url);
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="robots" content="noindex" />
		<meta http-equiv="refresh" content="0;url=${escaped}" />
		<link rel="canonical" href="${escaped}" />
		<title>Redirecting…</title>
	</head>
	<body>
		<p>This page moved to <a href="${escaped}">${escaped}</a>.</p>
	</body>
</html>
`;
}

let written = 0;
let skipped = 0;
for (const { source, destination } of legacyDocRedirects) {
	const target = join(
		OUT_ROOT,
		...source.split("/").filter(Boolean),
		"index.html",
	);
	if (existsSync(target)) {
		skipped += 1;
		continue;
	}
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, stub(destination));
	written += 1;
}

console.log(
	`static-redirects: ${written} stub(s) written to out/, ${skipped} skipped because a real page already exists there.`,
);
