import assert from "node:assert/strict";
import { test } from "node:test";
import { groupsForChangedFiles } from "../lib/change-detection.mjs";
import {
	apiGuideSlug,
	namespacesForSources,
	readRouterNamespaces,
	readRouterRegistrations,
} from "../lib/mapping.mjs";

test("shared tooling changes force full validation", () => {
	assert.equal(groupsForChangedFiles(["scripts/docs/cli.mjs"]), null);
	assert.equal(groupsForChangedFiles(["web/apps/docs/package.json"]), null);
	assert.equal(groupsForChangedFiles(["pnpm-lock.yaml"]), null);
});

test("a CLI change only runs CLI and config checks", () => {
	const groups = groupsForChangedFiles(["packages/cli/src/generated/commands.ts"]);
	assert.ok(groups.has("cli"));
	assert.ok(!groups.has("templates"));
});

test("spec changes run API, reference, region and mapping checks", () => {
	const groups = groupsForChangedFiles(["openapi.json"]);
	for (const group of ["spec", "api-reference", "regions", "mapping"]) {
		assert.ok(groups.has(group), `expected ${group}`);
	}
});

test("core page edits run link, region and mapping checks", () => {
	const groups = groupsForChangedFiles([
		"web/apps/docs/content/docs/core/features.mdx",
	]);
	assert.ok(groups.has("links"));
	assert.ok(groups.has("regions"));
	assert.ok(groups.has("mapping"));
});

test("router namespaces come from the appRouter registration", () => {
	const source = `
export const appRouter = createTRPCRouter({
	project: projectRouter,
	application: applicationRouter,
	// comment
	gitProvider: gitProviderRouter,
});
`;
	assert.deepEqual(readRouterNamespaces(source), [
		"application",
		"gitProvider",
		"project",
	]);
});

test("maps a core source file to its registered namespace", () => {
	const registrations = readRouterRegistrations(
		`
import { applicationRouter } from "./routers/application";
import { ssoRouter } from "./routers/proprietary/sso";
export const appRouter = createTRPCRouter({
	application: applicationRouter,
	sso: ssoRouter,
});
`,
		"/repo/server/api",
	);
	const namespaces = namespacesForSources(registrations, [
		"/repo/server/api/routers/application.ts",
		"/repo/server/api/routers/proprietary/sso.ts",
		"/repo/server/api/routers/unregistered.ts",
	]);
	assert.deepEqual(namespaces, ["application", "sso"]);
});

test("API guide slugs use explicit overrides before kebab-case", () => {
	const config = { api: { namespaceDocs: { sshKey: "sshrouter" } } };
	assert.equal(apiGuideSlug(config, "sshKey"), "sshrouter");
	assert.equal(apiGuideSlug(config, "dockerDiskUsage"), "docker-disk-usage");
});
