import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { validateInternalLinks } from "../lib/links.mjs";
import {
	kebabCase,
	renderApiNamespaces,
	renderCoreFeatures,
	renderDocsMap,
} from "../lib/regions.mjs";
import { collectRoutes } from "../lib/links.mjs";

const root = mkdtempSync(join(tmpdir(), "docs-regions-"));
after(() => rmSync(root, { recursive: true, force: true }));

function write(relative, content = "page") {
	const path = join(root, relative);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, content);
}

test("kebabCase handles camelCase and separators", () => {
	assert.equal(kebabCase("dockerDiskUsage"), "docker-disk-usage");
	assert.equal(kebabCase("gitProvider"), "git-provider");
	assert.equal(kebabCase("already-kebab"), "already-kebab");
});

test("documentation map counts hand-written pages and skips generated reference", () => {
	write("core/index.mdx");
	write("core/features.mdx");
	write("api/index.mdx");
	write("api/reference/admin.mdx");
	const map = renderDocsMap(
		[
			{ id: "core", title: "Core", dir: "core", description: "Core docs." },
			{ id: "api", title: "API", dir: "api", description: "API docs." },
		],
		root,
	);
	assert.match(map, /\| \[Core\]\(\/docs\/core\) \| 2 \|/);
	assert.match(map, /\| \[API\]\(\/docs\/api\) \| 1 \|/);
});

test("core implementation map links public routes and real CLI groups", () => {
	const table = renderCoreFeatures({
		core: [
			{
				id: "docker-compose",
				sources: ["a.ts"],
				docs: ["docker-compose/index", "docker-compose/domains"],
			},
			{ id: "sso", sources: ["b.ts"], docs: ["sso/index"] },
			{ id: "cicd", sources: ["c.ts"], docs: ["github-actions"] },
		],
		namespacesByFeature: {
			"docker-compose": ["compose"],
			sso: ["sso"],
			cicd: ["cicd"],
		},
		cliGroups: ["compose", "sso"],
	});
	assert.match(table, /\| Docker Compose \| `compose` \| `notploy compose` \| \[Docker Compose\]\(\/docs\/core\/docker-compose\) \(\+1\) \|/);
	assert.match(table, /\| SSO \| `sso` \|/);
	assert.match(table, /\| Cicd \| `cicd` \| — \|/);
});

test("API namespace table links generated pages and existing guides", () => {
	write("api/admin.mdx");
	write("api/sshrouter.mdx");
	const table = renderApiNamespaces({
		tags: ["admin", "sshKey"],
		operations: [
			{ operation: { tags: ["admin"] } },
			{ operation: { tags: ["admin"] } },
			{ operation: { tags: ["sshKey"] } },
		],
		apiDir: join(root, "api"),
		namespaceDocs: { sshKey: "sshrouter" },
	});
	assert.match(table, /\| `admin` \| 2 \| \[admin\]\(\/docs\/api\/reference\/admin\) \| \[admin guide\]\(\/docs\/api\/admin\) \|/);
	assert.match(table, /\[sshKey guide\]\(\/docs\/api\/sshrouter\)/);
});

test("broken internal links are errors; redirects and routes are accepted", () => {
	write(
		"core/index.mdx",
		[
			"[ok](/docs/core)",
			"[redirected](/docs/core/old-page)",
			"[broken](/docs/core/missing)",
		].join("\n"),
	);
	const routes = collectRoutes(root);
	const issues = validateInternalLinks({
		contentRoot: root,
		routes,
		redirects: new Set(["/docs/core/old-page"]),
	});
	assert.equal(issues.length, 1);
	assert.equal(issues[0].code, "docs.broken-link");
	assert.match(issues[0].message, /missing/);
});
