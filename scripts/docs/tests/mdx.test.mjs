import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyGeneratedRegion,
	extractInternalLinks,
	pageRoutes,
	parseGeneratedRegions,
	parseFrontmatter,
} from "../lib/mdx.mjs";

const page = [
	"---",
	"title: Example",
	"---",
	"",
	"Human intro.",
	"",
	"{/* BEGIN GENERATED: sample */}",
	"old content",
	"{/* END GENERATED: sample */}",
	"",
	"Human outro.",
].join("\n");

test("parses a generated region and its content", () => {
	const { regions, errors } = parseGeneratedRegions(page);
	assert.deepEqual(errors, []);
	assert.equal(regions.size, 1);
	assert.equal(regions.get("sample").content, "old content");
});

test("replacing a region preserves human content byte for byte", () => {
	const result = applyGeneratedRegion(page, "sample", "new content");
	assert.equal(result.error, undefined);
	assert.equal(
		result.source,
		page.replace("old content", "new content"),
	);
	assert.ok(result.source.startsWith("---\ntitle: Example\n---\n\nHuman intro."));
	assert.ok(result.source.endsWith("Human outro."));
});

test("a missing region is an error instead of an insertion", () => {
	const result = applyGeneratedRegion(page, "absent", "content");
	assert.match(result.error, /missing/);
	assert.equal(result.source, undefined);
});

test("reports duplicate, mismatched and unclosed regions", () => {
	const duplicate = parseGeneratedRegions(
		[
			"{/* BEGIN GENERATED: a */}",
			"x",
			"{/* END GENERATED: a */}",
			"{/* BEGIN GENERATED: a */}",
			"y",
			"{/* END GENERATED: a */}",
		].join("\n"),
	);
	assert.equal(duplicate.errors[0].code, "mdx.duplicate-region");

	const mismatched = parseGeneratedRegions(
		[
			"{/* BEGIN GENERATED: a */}",
			"x",
			"{/* END GENERATED: b */}",
		].join("\n"),
	);
	assert.equal(mismatched.errors[0].code, "mdx.mismatched-region");

	const unclosed = parseGeneratedRegions(
		["{/* BEGIN GENERATED: a */}", "x"].join("\n"),
	);
	assert.equal(unclosed.errors[0].code, "mdx.unclosed-region");
});

test("markers inside fenced code blocks are documentation, not regions", () => {
	const source = [
		"```md",
		"{/* BEGIN GENERATED: example */}",
		"{/* END GENERATED: example */}",
		"```",
	].join("\n");
	const { regions, errors } = parseGeneratedRegions(source);
	assert.equal(regions.size, 0);
	assert.deepEqual(errors, []);
});

test("extracts internal links and ignores fenced examples", () => {
	const source = [
		"See [Core](/docs/core) and <a href=\"/docs/api#x\">API</a>.",
		"```",
		"[fake](/docs/not-a-page)",
		"```",
	].join("\n");
	const links = extractInternalLinks(source);
	assert.deepEqual(
		links.map((link) => link.target),
		["/docs/core", "/docs/api"],
	);
	assert.equal(links[0].line, 1);
});

test("maps files to routes, including route-group aliases", () => {
	assert.deepEqual(pageRoutes("core/index.mdx"), ["/docs/core"]);
	assert.deepEqual(pageRoutes("index.mdx"), ["/docs"]);
	assert.deepEqual(pageRoutes("core/(Users)/permissions.mdx"), [
		"/docs/core/(Users)/permissions",
		"/docs/core/permissions",
	]);
});

test("frontmatter errors are reported rather than swallowed", () => {
	assert.deepEqual(parseFrontmatter("no frontmatter").data, {});
	const broken = parseFrontmatter("---\ntitle: [\n---\n");
	assert.match(broken.error, /frontmatter/);
});
