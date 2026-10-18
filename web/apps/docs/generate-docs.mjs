/**
 * Generates the API endpoint reference under content/docs/api/reference from
 * public/openapi.json, the spec produced by
 * apps/notploy/scripts/generate-openapi.ts from the tRPC router.
 *
 * Usage:
 *   node generate-docs.mjs            # write content/docs/api/reference
 *   node generate-docs.mjs --check    # fail if the checked-in pages are stale
 *
 * The generated pages are committed so a change to an endpoint is visible in
 * review. --check regenerates into a temporary directory and compares, so a
 * check never modifies tracked files.
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const DOCS_ROOT = import.meta.dirname;
const SPEC_PATH = join(DOCS_ROOT, "public", "openapi.json");
const OUT_DIR = resolve(DOCS_ROOT, "content/docs/api/reference");
const CHECK = process.argv.includes("--check");
const TMP_DIR = resolve(DOCS_ROOT, ".docs-tmp/api-reference");

function generatedFiles(dir) {
	if (!existsSync(dir)) return new Map();
	return new Map(
		readdirSync(dir)
			.filter((name) => name.endsWith(".mdx") || name === "meta.json")
			.sort()
			.map((name) => [name, readFileSync(join(dir, name), "utf8")]),
	);
}

async function main() {
	const output = CHECK ? TMP_DIR : OUT_DIR;
	if (CHECK) rmSync(TMP_DIR, { recursive: true, force: true });
	mkdirSync(output, { recursive: true });

	const openapi = createOpenAPI({
		input: ["./public/openapi.json"],
	});
	await generateFiles({
		input: openapi,
		output,
		per: "tag",
		includeDescription: true,
	});

	// One footer page links every generated endpoint page. The list is derived
	// from the files fumadocs wrote, so it cannot drift from the generation.
	const pages = readdirSync(output)
		.filter((name) => name.endsWith(".mdx"))
		.map((name) => name.replace(/\.mdx$/, ""))
		.sort();
	writeFileSync(
		join(output, "meta.json"),
		`${JSON.stringify({ title: "Endpoint reference", pages }, null, "\t")}\n`,
	);

	if (!CHECK) {
		console.log(
			`✓ Generated ${pages.length} API reference pages from public/openapi.json`,
		);
		return;
	}

	const expected = generatedFiles(output);
	const actual = generatedFiles(OUT_DIR);
	const problems = [];
	for (const [name, content] of expected) {
		if (!actual.has(name)) problems.push(`missing: ${name}`);
		else if (actual.get(name) !== content) problems.push(`stale: ${name}`);
	}
	for (const name of actual.keys()) {
		if (!expected.has(name)) problems.push(`orphaned: ${name}`);
	}
	rmSync(TMP_DIR, { recursive: true, force: true });

	if (problems.length > 0) {
		console.error(`API reference is out of date (${problems.length} file(s)):`);
		for (const problem of problems) console.error(`  ${problem}`);
		console.error(
			"Run 'pnpm --filter @notploy/docs run generate:api' and commit the result.",
		);
		process.exitCode = 1;
		return;
	}
	console.log(`API reference is up to date (${actual.size - 1} pages).`);
}

try {
	// Fail before generation when the spec itself is missing or malformed: the
	// generator would otherwise emit partial output.
	JSON.parse(readFileSync(SPEC_PATH, "utf8"));
	await main();
} catch (error) {
	console.error(`API reference generation failed: ${error.message}`);
	process.exitCode = 1;
}
