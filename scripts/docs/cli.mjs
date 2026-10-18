#!/usr/bin/env node

/**
 * Documentation synchronization for Notploy.
 *
 *   node scripts/docs/cli.mjs check [--only <groups>] [--changed] [--base <ref>] [--json]
 *   node scripts/docs/cli.mjs generate [--only <groups>] [--json]
 *   node scripts/docs/cli.mjs coverage [--strict] [--json]
 *
 * MDX stays the official documentation. This tool discovers the implementation,
 * validates human-written pages against it, and rewrites only explicitly
 * managed regions plus fully generated reference pages.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { diffSpecs, loadSpecFile, validateSpec } from "./lib/api.mjs";
import { groupsForChangedFiles } from "./lib/change-detection.mjs";
import { Diagnostics } from "./lib/diagnostics.mjs";
import { collectRedirectSources, collectRoutes, validateInternalLinks } from "./lib/links.mjs";
import { applyGeneratedRegion, parseGeneratedRegions } from "./lib/mdx.mjs";
import { CONFIG_PATH, CONTENT_ROOT, DOCS_ROOT, REPO_ROOT, fromRepo, repoPath } from "./lib/paths.mjs";
import {
	apiGuideSlug,
	namespacesForSources,
	readRouterNamespaces,
	readRouterRegistrations,
} from "./lib/mapping.mjs";
import {
	renderApiNamespaces,
	renderCoreFeatures,
	renderDocsMap,
} from "./lib/regions.mjs";
import {
	extractTemplateHelpers,
	renderTemplateCatalog,
	validateBlueprints,
} from "./lib/templates.mjs";
import { listFiles, readJsonFile, readTextFile } from "./lib/util.mjs";
import { parseCommandsFile } from "../../web/apps/docs/scripts/lib/cli-commands.mjs";

const ALL_GROUPS = [
	"config",
	"spec",
	"api-reference",
	"cli",
	"templates",
	"regions",
	"links",
	"mapping",
];

function parseArgs(argv) {
	const command = argv[0] && !argv[0].startsWith("--") ? argv[0] : "check";
	const args = argv[0] && !argv[0].startsWith("--") ? argv.slice(1) : argv;
	const options = {
		command,
		only: null,
		changed: false,
		base: process.env.DOCS_BASE_REF || null,
		json: false,
		strict: false,
		verbose: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--json") options.json = true;
		else if (argument === "--changed") options.changed = true;
		else if (argument === "--strict") options.strict = true;
		else if (argument === "--verbose") options.verbose = true;
		else if (argument === "--base") options.base = args[++index];
		else if (argument.startsWith("--base=")) options.base = argument.slice(7);
		else if (argument === "--only") options.only = args[++index];
		else if (argument.startsWith("--only=")) options.only = argument.slice(7);
		else if (argument === "--help" || argument === "-h") options.command = "help";
		else {
			throw new UsageError(`unknown argument "${argument}"`);
		}
	}
	if (options.only) {
		options.only = options.only
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
		for (const group of options.only) {
			if (!ALL_GROUPS.includes(group)) {
				throw new UsageError(
					`unknown check group "${group}" (expected one of ${ALL_GROUPS.join(", ")})`,
				);
			}
		}
	}
	return options;
}

class UsageError extends Error {}

function git(args) {
	return execFileSync("git", args, {
		cwd: REPO_ROOT,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

function resolveBaseRef(requested) {
	if (requested) return requested;
	for (const candidate of ["origin/master", "master", "HEAD~1"]) {
		try {
			return git(["merge-base", candidate, "HEAD"]);
		} catch {
			// try the next candidate
		}
	}
	return null;
}

function changedFiles(base) {
	try {
		const tracked = git(["diff", "--name-only", base, "--"]).split("\n");
		const untracked = git(["ls-files", "--others", "--exclude-standard"]).split(
			"\n",
		);
		return [...new Set([...tracked, ...untracked])].filter(Boolean).sort();
	} catch {
		return null;
	}
}

function shouldRun(options, groups, group) {
	if (options.only) return options.only.includes(group);
	if (groups) return groups.has(group);
	return true;
}

function loadConfig(diagnostics) {
	let config;
	try {
		config = readJsonFile(CONFIG_PATH);
	} catch (error) {
		diagnostics.error(
			"config.unreadable",
			`cannot read docs-sync.json: ${error.message}`,
			{ file: "docs-sync.json" },
		);
		return null;
	}
	const sections = Object.values(config.sections ?? {});
	if (sections.length === 0) {
		diagnostics.error("config.sections", "docs-sync.json declares no sections", {
			file: "docs-sync.json",
		});
	}
	for (const section of sections) {
		if (!existsSync(join(CONTENT_ROOT, section.dir))) {
			diagnostics.error(
				"config.section-missing",
				`section "${section.id}" points to a missing directory "${section.dir}"`,
				{ file: "docs-sync.json" },
			);
		}
	}
	for (const [name, path] of Object.entries(config.sources ?? {})) {
		if (Array.isArray(path)) {
			for (const entry of path) {
				if (!existsSync(fromRepo(entry))) {
					diagnostics.error(
						"config.source-missing",
						`sources.${name} points to missing file "${entry}"`,
						{ file: "docs-sync.json" },
					);
				}
			}
			continue;
		}
		if (!existsSync(fromRepo(path))) {
			diagnostics.error(
				"config.source-missing",
				`sources.${name} points to missing path "${path}"`,
				{ file: "docs-sync.json" },
			);
		}
	}
	const seenRegions = new Set();
	for (const region of config.regions ?? []) {
		const key = `${region.file}#${region.id}`;
		if (seenRegions.has(key)) {
			diagnostics.error(
				"config.duplicate-region",
				`region "${region.id}" is declared twice for ${region.file}`,
				{ file: "docs-sync.json" },
			);
		}
		seenRegions.add(key);
		if (!existsSync(fromRepo(region.file))) {
			diagnostics.error(
				"config.region-file-missing",
				`region "${region.id}" points to missing file "${region.file}"`,
				{ file: "docs-sync.json" },
			);
		}
	}
	return config;
}

function loadSpec(config, diagnostics) {
	if (!config) return null;
	try {
		return loadSpecFile(fromRepo(config.sources.openapi));
	} catch (error) {
		diagnostics.error("api.spec-unreadable", error.message, {
			file: config.sources.openapi,
			hint: "Run 'pnpm generate:openapi' to regenerate the spec from the tRPC router.",
		});
		return null;
	}
}

function loadNamespaces(config, diagnostics) {
	if (!config) return [];
	const path = fromRepo(config.sources.apiRouter);
	try {
		const namespaces = readRouterNamespaces(readTextFile(path));
		if (namespaces.length === 0) {
			diagnostics.error(
				"api.router-empty",
				"no namespaces found in the tRPC router registration",
				{ file: config.sources.apiRouter },
			);
		}
		return namespaces;
	} catch (error) {
		diagnostics.error("api.router-unreadable", error.message, {
			file: config.sources.apiRouter,
		});
		return [];
	}
}

function loadCliGroups(config, diagnostics) {
	if (!config) return [];
	try {
		const groups = parseCommandsFile(
			readTextFile(fromRepo(config.sources.cliCommands)),
		);
		if (groups.length === 0) {
			diagnostics.error(
				"cli.no-groups",
				"no command groups parsed from the generated CLI",
				{
					file: config.sources.cliCommands,
					hint: "Run 'pnpm --filter @notploy/cli run generate'.",
				},
			);
		}
		return groups;
	} catch (error) {
		diagnostics.error("cli.unreadable", error.message, {
			file: config.sources.cliCommands,
		});
		return [];
	}
}

function loadTemplates(config, diagnostics) {
	if (!config) return { blueprints: [], helpers: [] };
	let helpers = [];
	try {
		helpers = extractTemplateHelpers(
			readTextFile(fromRepo(config.sources.templateHelpers)),
		);
	} catch (error) {
		diagnostics.error("templates.helpers-unreadable", error.message, {
			file: config.sources.templateHelpers,
		});
	}
	const { blueprints, issues } = validateBlueprints(
		fromRepo(config.sources.blueprints),
		helpers,
	);
	for (const issue of issues) {
		diagnostics.add(issue.severity, issue.code, issue.message, {
			file: repoPath(issue.file),
		});
	}
	return { blueprints, helpers };
}

function expectedRegions(config, spec, templates, cliGroups = []) {
	const sections = Object.values(config.sections);
	const values = new Map();
	let registrations;
	const getRegistrations = () => {
		if (!registrations) {
			const routerPath = fromRepo(config.sources.apiRouter);
			registrations = readRouterRegistrations(
				readTextFile(routerPath),
				dirname(routerPath),
			);
		}
		return registrations;
	};
	for (const region of config.regions ?? []) {
		if (region.generator === "docs-map") {
			values.set(`${region.file}#${region.id}`, renderDocsMap(sections, CONTENT_ROOT));
		} else if (region.generator === "api-namespaces") {
			if (!spec) continue;
			values.set(
				`${region.file}#${region.id}`,
				renderApiNamespaces({
					tags: (spec.tags ?? []).map((tag) => tag.name).filter(Boolean),
					operations: Object.entries(spec.paths ?? {}).flatMap(
						([path, item]) =>
							Object.entries(item ?? {})
								.filter(([method]) => method !== "parameters")
								.map(([, operation]) => ({ path, operation })),
					),
					apiDir: join(CONTENT_ROOT, "api"),
					namespaceDocs: config.api?.namespaceDocs ?? {},
				}),
			);
		} else if (region.generator === "template-catalog") {
			values.set(
				`${region.file}#${region.id}`,
				renderTemplateCatalog(templates.blueprints),
			);
		} else if (region.generator === "core-features") {
			const registered = getRegistrations();
			values.set(
				`${region.file}#${region.id}`,
				renderCoreFeatures({
					core: config.core ?? [],
					namespacesByFeature: Object.fromEntries(
						(config.core ?? []).map((feature) => [
							feature.id,
							namespacesForSources(
								registered,
								(feature.sources ?? []).map((source) => fromRepo(source)),
							),
						]),
					),
					cliGroups: cliGroups.map((group) => group.name),
				}),
			);
		} else {
			values.set(`${region.file}#${region.id}`, null);
		}
	}
	return values;
}

function readRegions(diagnostics) {
	const regionsByFile = new Map();
	for (const file of listFiles(CONTENT_ROOT, { extensions: [".mdx"] })) {
		const source = readTextFile(file);
		const { regions, errors } = parseGeneratedRegions(source);
		const relative = repoPath(file);
		for (const error of errors) {
			diagnostics.error(error.code, error.message, {
				file: relative,
				line: error.line,
			});
		}
		if (regions.size > 0) regionsByFile.set(file, { source, regions });
	}
	return regionsByFile;
}

function checkRegions(config, spec, templates, cliGroups, diagnostics) {
	const values = expectedRegions(config, spec, templates, cliGroups);
	const declared = new Set(
		(config.regions ?? []).map((region) => `${region.file}#${region.id}`),
	);
	const found = readRegions(diagnostics);

	for (const region of config.regions ?? []) {
		const file = fromRepo(region.file);
		if (!existsSync(file)) continue;
		const entry = found.get(file);
		if (!entry) {
			diagnostics.error(
				"regions.page-has-no-region",
				`page has no generated region "${region.id}"`,
				{ file: region.file, hint: "Add the BEGIN/END GENERATED markers." },
			);
			continue;
		}
		const parsed = entry.regions.get(region.id);
		if (!parsed) {
			diagnostics.error(
				"regions.region-missing",
				`generated region "${region.id}" is missing`,
				{ file: region.file, hint: "Add the BEGIN/END GENERATED markers." },
			);
			continue;
		}
		if (region.generator !== "none") {
			const expected = values.get(`${region.file}#${region.id}`);
			if (expected == null) continue;
			if (parsed.content.replace(/^\n+|\n+$/g, "") !== expected) {
				diagnostics.error(
					"regions.stale",
					`generated region "${region.id}" does not match the implementation`,
					{
						file: region.file,
						line: parsed.startLine + 1,
						hint: "Run 'pnpm docs:generate' and commit the result.",
					},
				);
			}
		}
		declared.delete(`${region.file}#${region.id}`);
	}

	for (const [file, { regions }] of found) {
		for (const id of regions.keys()) {
			const key = `${repoPath(file)}#${id}`;
			if (declared.has(key)) continue;
			if ((config.regions ?? []).some((region) => region.file === repoPath(file) && region.id === id)) {
				continue;
			}
			diagnostics.error(
				"regions.undeclared",
				`generated region "${id}" is not declared in docs-sync.json`,
				{
					file: repoPath(file),
					hint: "Add it to the regions list, or remove the markers if it is no longer generated.",
				},
			);
		}
	}
}

function checkSpecCopies(config, spec, diagnostics) {
	if (!config || !spec) return;
	const canonical = readFileSync(fromRepo(config.sources.openapi), "utf8");
	for (const copy of config.sources.openapiCopies ?? []) {
		const path = fromRepo(copy);
		if (!existsSync(path)) {
			diagnostics.error("api.copy-missing", "OpenAPI copy is missing", {
				file: copy,
				hint: "Run 'pnpm docs:generate'.",
			});
			continue;
		}
		if (readFileSync(path, "utf8") !== canonical) {
			diagnostics.error(
				"api.copy-stale",
				"OpenAPI copy differs from the canonical openapi.json",
				{ file: copy, hint: "Run 'pnpm docs:generate'." },
			);
		}
	}
}

function runDocsGenerator(script, args, diagnostics, { code, file, hint }) {
	const result = spawnSync(process.execPath, [script, ...args], {
		cwd: DOCS_ROOT,
		encoding: "utf8",
		timeout: 240_000,
		env: { ...process.env, NO_COLOR: "1" },
	});
	if (result.error) {
		diagnostics.error(code, `cannot run ${script}: ${result.error.message}`, {
			file,
			hint,
		});
		return false;
	}
	if (result.status !== 0) {
		const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
		diagnostics.error(code, output || `${script} exited ${result.status}`, {
			file,
			hint,
		});
		return false;
	}
	return true;
}

function checkApiReference(diagnostics) {
	const script = join(DOCS_ROOT, "generate-docs.mjs");
	if (!existsSync(script)) {
		diagnostics.error(
			"api.reference-generator-missing",
			"web/apps/docs/generate-docs.mjs is missing",
			{ file: "web/apps/docs/generate-docs.mjs" },
		);
		return;
	}
	runDocsGenerator(script, ["--check"], diagnostics, {
		code: "api.reference-stale",
		file: "web/apps/docs/content/docs/api/reference",
		hint: "Run 'pnpm docs:generate' and commit the regenerated pages.",
	});
}

function checkCli(config, groups, spec, diagnostics) {
	if (!config) return;
	const outDir = join(CONTENT_ROOT, "cli");
	const script = join(DOCS_ROOT, "scripts/generate-cli-docs.mjs");
	if (!existsSync(script)) {
		diagnostics.error(
			"cli.generator-missing",
			"the CLI documentation generator is missing",
			{ file: "web/apps/docs/scripts/generate-cli-docs.mjs" },
		);
		return;
	}
	runDocsGenerator(script, ["--check"], diagnostics, {
		code: "cli.docs-stale",
		file: "web/apps/docs/content/docs/cli",
		hint: "Run 'pnpm docs:generate' and commit the regenerated pages.",
	});

	const specPaths = new Set(Object.keys(spec?.paths ?? {}));
	for (const group of groups) {
		if (!existsSync(join(outDir, `${group.name}.mdx`))) {
			diagnostics.error(
				"cli.page-missing",
				`command group "${group.name}" has no page`,
				{
					file: "web/apps/docs/content/docs/cli",
					hint: "Run 'pnpm docs:generate'.",
				},
			);
		}
		for (const command of group.commands) {
			if (command.endpoint && specPaths.size > 0 && !specPaths.has(`/${command.endpoint}`)) {
				diagnostics.error(
					"cli.endpoint-missing",
					`command "${group.name} ${command.action}" calls "/${command.endpoint}", which is not in openapi.json`,
					{ file: config.sources.cliCommands },
				);
			}
		}
	}

	checkCliHelp(config, groups, diagnostics);
}

/**
 * Verifies a sample of documented commands against the CLI's own --help output.
 * Skipped as a warning when the CLI dependencies are not installed, so the
 * check stays usable from a docs-only install.
 */
function checkCliHelp(config, groups, diagnostics) {
	const tsx = [
		join(REPO_ROOT, "node_modules/.bin/tsx"),
		join(REPO_ROOT, "packages/cli/node_modules/.bin/tsx"),
	].find((path) => existsSync(path));
	if (!tsx) {
		diagnostics.warning(
			"cli.help-unavailable",
			"tsx is not installed, so CLI help output was not verified",
			{ hint: "Run 'pnpm install' to enable the help comparison." },
		);
		return;
	}

	const run = (args) =>
		spawnSync(tsx, ["src/index.ts", ...args], {
			cwd: fromRepo("packages/cli"),
			encoding: "utf8",
			timeout: 60_000,
			env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
		});

	const top = run(["--help"]);
	if (top.status !== 0) {
		diagnostics.warning(
			"cli.help-unavailable",
			`notploy --help failed: ${(top.stderr || top.stdout || "").trim().split("\n")[0]}`,
		);
		return;
	}
	for (const group of groups) {
		if (!new RegExp(`\\b${group.name}\\b`).test(top.stdout)) {
			diagnostics.error(
				"cli.help-mismatch",
				`documented group "${group.name}" does not appear in notploy --help`,
				{ file: config.sources.cliCommands },
			);
		}
	}

	for (const group of groups.slice(0, 3)) {
		const command = group.commands[0];
		if (!command) continue;
		const result = run([group.name, command.action, "--help"]);
		if (result.status !== 0) {
			diagnostics.warning(
				"cli.help-unavailable",
				`notploy ${group.name} ${command.action} --help failed`,
			);
			continue;
		}
		const documented = new Set(
			command.options.map((option) => option.flag.split(" ")[0]),
		);
		for (const match of result.stdout.matchAll(/(--[A-Za-z0-9-]+)/g)) {
			if (["--help", "--version", "--json", "--profile"].includes(match[1])) {
				continue;
			}
			if (!documented.has(match[1])) {
				diagnostics.error(
					"cli.help-mismatch",
					`"${match[1]}" is offered by notploy ${group.name} ${command.action} but not documented`,
					{ file: "web/apps/docs/content/docs/cli" },
				);
			}
		}
	}
}

async function checkLinks(config, diagnostics) {
	const routes = collectRoutes(CONTENT_ROOT);
	const redirects = config
		? await collectRedirectSources(fromRepo(config.sources.redirects))
		: new Set();
	const issues = validateInternalLinks({
		contentRoot: CONTENT_ROOT,
		routes,
		redirects,
	});
	for (const issue of issues) diagnostics.add(issue.severity, issue.code, issue.message, issue);
}

function checkMapping(config, namespaces, groups, spec, templates, diagnostics) {
	if (!config) return;
	const seenCore = new Set();
	for (const feature of config.core ?? []) {
		if (!feature.id) {
			diagnostics.error("mapping.core-id", "a core mapping has no id", {
				file: "docs-sync.json",
			});
			continue;
		}
		if (seenCore.has(feature.id)) {
			diagnostics.error(
				"mapping.core-duplicate",
				`core feature "${feature.id}" is mapped twice`,
				{ file: "docs-sync.json" },
			);
		}
		seenCore.add(feature.id);
		for (const source of feature.sources ?? []) {
			if (!existsSync(fromRepo(source))) {
				diagnostics.error(
					"mapping.source-missing",
					`core feature "${feature.id}" maps a missing source "${source}"`,
					{ file: "docs-sync.json", hint: "Update or remove the mapping." },
				);
			}
		}
		if ((feature.docs ?? []).length === 0) {
			diagnostics.warning(
				"mapping.core-no-docs",
				`core feature "${feature.id}" maps no documentation page`,
				{ file: "docs-sync.json" },
			);
		}
		for (const doc of feature.docs ?? []) {
			if (!existsSync(join(CONTENT_ROOT, "core", `${doc}.mdx`))) {
				diagnostics.error(
					"mapping.doc-missing",
					`core feature "${feature.id}" maps a missing page "content/docs/core/${doc}.mdx"`,
					{ file: "docs-sync.json", hint: "Move the page back or update the mapping." },
				);
			}
		}
	}

	const specTags = new Set((spec?.tags ?? []).map((tag) => tag.name));
	for (const namespace of namespaces) {
		if (!specTags.has(namespace)) {
			diagnostics.warning(
				"mapping.namespace-not-in-spec",
				`router namespace "${namespace}" has no operations in openapi.json`,
				{
					file: config.sources.apiRouter,
					hint: "Add an openapi meta entry to its procedures, or document why it is internal.",
				},
			);
			continue;
		}
		const guide = apiGuideSlug(config, namespace);
		if (guide && !existsSync(join(CONTENT_ROOT, "api", `${guide}.mdx`))) {
			if (config.api?.ignore?.[namespace]) continue;
			diagnostics.warning(
				"mapping.api-guide-missing",
				`API namespace "${namespace}" has no guide page "content/docs/api/${guide}.mdx"`,
				{
					file: "docs-sync.json",
					hint: "Write the guide, or add the namespace to api.ignore with a reason.",
				},
			);
		}
	}

	for (const group of groups) {
		if (!existsSync(join(CONTENT_ROOT, "cli", `${group.name}.mdx`))) {
			diagnostics.error(
				"mapping.cli-page-missing",
				`CLI group "${group.name}" has no page`,
				{ file: "web/apps/docs/content/docs/cli" },
			);
		}
	}

	const blueprintIds = new Set(templates.blueprints.map((blueprint) => blueprint.id));
	const templateDocs = listFiles(join(CONTENT_ROOT, "templates"), {
		extensions: [".mdx"],
	});
	for (const file of templateDocs) {
		const source = readTextFile(file);
		for (const match of source.matchAll(
			/templates\/blueprints\/([A-Za-z0-9._-]+)/g,
		)) {
			if (match[1] === "<id>" || match[1].includes(".")) continue;
			if (!blueprintIds.has(match[1])) {
				diagnostics.error(
					"mapping.template-missing",
					`references missing blueprint "${match[1]}"`,
					{ file: repoPath(file) },
				);
			}
		}
	}
}

function checkTemplateDocs(config, templates, diagnostics) {
	const configPage = join(CONTENT_ROOT, "templates", "configuration.mdx");
	if (!existsSync(configPage)) {
		diagnostics.error(
			"templates.config-doc-missing",
			"the template configuration reference page is missing",
			{ file: "web/apps/docs/content/docs/templates/configuration.mdx" },
		);
		return;
	}
	const source = readTextFile(configPage);
	for (const helper of templates.helpers) {
		const documented = new RegExp(`\\$\\{${helper}(?::[^}]*)?\\}`).test(source);
		if (!documented) {
			diagnostics.warning(
				"templates.helper-undocumented",
				`helper "\${${helper}}" is implemented but not documented`,
				{ file: repoPath(configPage) },
			);
		}
	}
}

function checkBreakingChanges(config, spec, options, diagnostics) {
	if (!options.base) return;
	let baseRef;
	try {
		baseRef = resolveBaseRef(options.base);
		if (!baseRef) return;
	} catch {
		return;
	}
	let baseSpec;
	try {
		baseSpec = JSON.parse(
			execFileSync("git", ["show", `${baseRef}:${config.sources.openapi}`], {
				cwd: REPO_ROOT,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}),
		);
	} catch {
		return;
	}
	for (const issue of diffSpecs(baseSpec, spec)) {
		diagnostics.warning(issue.code, issue.message, {
			file: config.sources.openapi,
			hint: "Review whether the documentation and clients need an update.",
		});
	}
}

function generate(config, spec, templates, cliGroups, diagnostics, options) {
	const changed = [];
	const write = (path, content) => {
		const current = existsSync(path) ? readFileSync(path, "utf8") : null;
		if (current === content) return;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
		changed.push(repoPath(path));
	};

	if (!config) return changed;
	const canonical = readFileSync(fromRepo(config.sources.openapi), "utf8");
	for (const copy of config.sources.openapiCopies ?? []) {
		const resolved = resolve(fromRepo(copy));
		if (!resolved.startsWith(REPO_ROOT)) {
			diagnostics.error(
				"generate.outside-repo",
				`refusing to write outside the repository: ${copy}`,
				{ file: "docs-sync.json" },
			);
			continue;
		}
		write(resolved, canonical);
	}

	if (!options.only || options.only.includes("api-reference")) {
		const apiScript = join(DOCS_ROOT, "generate-docs.mjs");
		if (existsSync(apiScript)) {
			const result = spawnSync(process.execPath, [apiScript], {
				cwd: DOCS_ROOT,
				encoding: "utf8",
				timeout: 240_000,
				env: { ...process.env, NO_COLOR: "1" },
			});
			if (result.status !== 0) {
				diagnostics.error(
					"generate.api-reference",
					`${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
					{ file: "web/apps/docs/content/docs/api/reference" },
				);
			}
		}
	}

	if (!options.only || options.only.includes("cli")) {
		const cliScript = join(DOCS_ROOT, "scripts/generate-cli-docs.mjs");
		if (existsSync(cliScript)) {
			const result = spawnSync(process.execPath, [cliScript], {
				cwd: DOCS_ROOT,
				encoding: "utf8",
				timeout: 120_000,
				env: { ...process.env, NO_COLOR: "1" },
			});
			if (result.status !== 0) {
				diagnostics.error(
					"generate.cli-docs",
					`${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
					{ file: "web/apps/docs/content/docs/cli" },
				);
			}
		}
	}

	const values = expectedRegions(config, spec, templates, cliGroups);
	for (const region of config.regions ?? []) {
		const expected = values.get(`${region.file}#${region.id}`);
		if (expected == null) continue;
		const file = fromRepo(region.file);
		if (!existsSync(file)) continue;
		const source = readTextFile(file);
		const result = applyGeneratedRegion(source, region.id, expected);
		if (result.error) {
			diagnostics.error("regions.update-failed", result.error, {
				file: region.file,
			});
			continue;
		}
		write(file, result.source);
	}

	return changed;
}

async function run(options) {
	const diagnostics = new Diagnostics();
	const config = loadConfig(diagnostics);

	let groups = null;
	if (options.changed) {
		const base = resolveBaseRef(options.base);
		if (base) {
			const files = changedFiles(base);
			groups = groupsForChangedFiles(files);
			if (!options.json) {
				console.log(
					`docs: using changed-file mode against ${base.slice(0, 12)}${
						groups ? ` (${[...groups].sort().join(", ")})` : " (full validation)"
					}`,
				);
			}
		}
	}

	const specBundle =
		shouldRun(options, groups, "spec") ||
		shouldRun(options, groups, "regions") ||
		shouldRun(options, groups, "api-reference")
			? loadSpec(config, diagnostics)
			: null;
	const spec = specBundle?.spec ?? null;
	const namespaces = shouldRun(options, groups, "mapping")
		? loadNamespaces(config, diagnostics)
		: [];
	const cliGroups =
		shouldRun(options, groups, "cli") ||
		shouldRun(options, groups, "mapping") ||
		shouldRun(options, groups, "regions")
			? loadCliGroups(config, diagnostics)
			: [];
	const templates =
		shouldRun(options, groups, "templates") ||
		shouldRun(options, groups, "regions") ||
		shouldRun(options, groups, "mapping")
			? loadTemplates(config, diagnostics)
			: { blueprints: [], helpers: [] };

	if (!config) {
		diagnostics.print({ json: options.json, command: "docs:check" });
		process.exitCode = 1;
		return;
	}

	if (options.command === "generate") {
		const changed = generate(
			config,
			spec,
			templates,
			cliGroups,
			diagnostics,
			options,
		);
		diagnostics.print({ json: options.json, command: "docs:generate" });
		if (!options.json) {
			if (changed.length === 0) {
				console.log("docs:generate: no files changed.");
			} else {
				console.log(`docs:generate: ${changed.length} file(s) updated:`);
				for (const file of changed) console.log(`  ${file}`);
			}
		}
		process.exitCode = diagnostics.hasErrors ? 1 : 0;
		return;
	}

	if (options.command === "coverage") {
		await runCoverage({
			options,
			config,
			namespaces,
			groups: cliGroups,
			templates,
			diagnostics,
		});
		return;
	}

	if (options.command === "help") {
		printHelp();
		return;
	}

	if (shouldRun(options, groups, "spec") && spec) {
		for (const issue of validateSpec(spec)) {
			diagnostics.add(issue.severity, issue.code, issue.message, {
				file: config?.sources.openapi,
			});
		}
		checkSpecCopies(config, spec, diagnostics);
		checkBreakingChanges(config, spec, options, diagnostics);
	}
	if (shouldRun(options, groups, "api-reference")) {
		checkApiReference(diagnostics);
	}
	if (shouldRun(options, groups, "cli")) {
		checkCli(config, cliGroups, spec, diagnostics);
	}
	if (shouldRun(options, groups, "templates")) {
		checkTemplateDocs(config, templates, diagnostics);
	}
	if (shouldRun(options, groups, "regions")) {
		checkRegions(config, spec, templates, cliGroups, diagnostics);
	}
	if (shouldRun(options, groups, "links")) {
		await checkLinks(config, diagnostics);
	}
	if (shouldRun(options, groups, "mapping")) {
		checkMapping(config, namespaces, cliGroups, spec, templates, diagnostics);
	}

	diagnostics.print({ json: options.json, command: "docs:check" });
	process.exitCode = diagnostics.hasErrors ? 1 : 0;
}

async function runCoverage({ options, config, namespaces, groups, templates, diagnostics }) {
	const rows = [];
	if (!config) {
		process.exitCode = 2;
		return;
	}

	const apiMissing = namespaces.filter((namespace) => {
		if (config.api?.ignore?.[namespace]) return false;
		const guide = apiGuideSlug(config, namespace);
		return !existsSync(join(CONTENT_ROOT, "api", `${guide}.mdx`));
	});
	rows.push(
		`API namespaces: ${namespaces.length - apiMissing.length}/${namespaces.length} with a guide page`,
	);
	for (const namespace of apiMissing) {
		diagnostics.warning(
			"coverage.api-guide",
			`namespace "${namespace}" has no API guide`,
			{ hint: `Add content/docs/api/${apiGuideSlug(config, namespace)}.mdx` },
		);
	}

	const cliMissing = groups.filter(
		(group) => !existsSync(join(CONTENT_ROOT, "cli", `${group.name}.mdx`)),
	);
	rows.push(
		`CLI groups: ${groups.length - cliMissing.length}/${groups.length} with a page`,
	);
	for (const group of cliMissing) {
		diagnostics.warning("coverage.cli-page", `group "${group.name}" has no page`);
	}

	const mappedDocs = new Set(
		(config.core ?? []).flatMap((feature) => feature.docs ?? []),
	);
	const coreFiles = listFiles(join(CONTENT_ROOT, "core"), {
		extensions: [".mdx"],
	})
		.map((file) =>
			repoPath(file)
				.replace("web/apps/docs/content/docs/core/", "")
				.replace(/\.mdx$/, ""),
		)
		.filter((path) => !path.startsWith("meta"));
	const unmapped = coreFiles.filter((path) => !mappedDocs.has(path));
	rows.push(
		`Core pages: ${coreFiles.length - unmapped.length}/${coreFiles.length} connected to a mapped feature`,
	);
	if (unmapped.length > 0) {
		diagnostics.warning(
			"coverage.core-pages",
			`${unmapped.length} core page(s) are not connected to a mapped feature`,
			{
				hint: `Add them to a core mapping in docs-sync.json. Examples: ${unmapped
					.slice(0, 5)
					.join(", ")}`,
			},
		);
	}

	const helperPage = join(CONTENT_ROOT, "templates", "configuration.mdx");
	const helperSource = existsSync(helperPage) ? readTextFile(helperPage) : "";
	const undocumentedHelpers = templates.helpers.filter(
		(helper) => !new RegExp(`\\$\\{${helper}(?::[^}]*)?\\}`).test(helperSource),
	);
	rows.push(
		`Template helpers: ${templates.helpers.length - undocumentedHelpers.length}/${templates.helpers.length} documented`,
	);

	rows.push(`Blueprints: ${templates.blueprints.length} discovered and validated`);

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					version: 1,
					summary: rows,
					apiMissing,
					cliMissing,
					coreUnmapped: unmapped,
					undocumentedHelpers,
				},
				null,
				2,
			),
		);
	} else {
		for (const row of rows) console.log(row);
		console.log(diagnostics.renderText());
	}

	const strict = options.strict;
	const hasGaps =
		apiMissing.length > 0 ||
		cliMissing.length > 0 ||
		undocumentedHelpers.length > 0;
	process.exitCode = strict && hasGaps ? 1 : 0;
}

function printHelp() {
	console.log(`Notploy documentation sync

Usage:
  node scripts/docs/cli.mjs check [options]
  node scripts/docs/cli.mjs generate [options]
  node scripts/docs/cli.mjs coverage [--strict] [--json]

Options:
  --only <groups>   Comma-separated: ${ALL_GROUPS.join(", ")}
  --changed         Only run checks affected by git changes
  --base <ref>      Base reference for change detection and breaking changes
  --strict          coverage: exit 1 when a gap exists
  --json            Machine-readable output

Run 'pnpm docs:check', 'pnpm docs:generate' or 'pnpm docs:check:coverage'.`);
}

try {
	const options = parseArgs(process.argv.slice(2));
	await run(options);
} catch (error) {
	if (error instanceof UsageError) {
		console.error(`docs: ${error.message}`);
		console.error("Run 'node scripts/docs/cli.mjs --help'.");
		process.exitCode = 2;
	} else {
		console.error(`docs: ${error.message}`);
		if (error.stack) console.error(error.stack);
		process.exitCode = 2;
	}
}
