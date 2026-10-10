// Generates the CLI reference under content/docs/cli/ from the CLI itself, so
// the documentation always mirrors the surface that `notploy` ships. Every
// command group is a page of the CLI section — siblings of "Introduction" and
// "Authentication" — so a group can be read on its own, without a nested
// reference folder.
//
// Source of truth: packages/cli/src/generated/commands.ts — the file the CLI
// registers with commander (itself produced from packages/cli/openapi.json by
// packages/cli/scripts/generate.ts). Parsing that file keeps the docs tied to
// the commands the binary actually exposes, including required flags and enum
// values, rather than to a hand-written copy of them.
//
// Usage: pnpm run generate:cli   (from web/apps/docs)

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_ROOT = resolve(DOCS_ROOT, "../../../packages/cli");
const COMMANDS_SOURCE = join(CLI_ROOT, "src/generated/commands.ts");
const CLI_PACKAGE = JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf8"));
const OUT_DIR = join(DOCS_ROOT, "content/docs/cli");
// Earlier builds nested the generated pages one level deeper; drop that layout
// so the section is not documented twice.
const LEGACY_OUT_DIR = join(OUT_DIR, "commands");

// Fields the section's meta.json keeps next to the generated page list.
const SECTION_META = {
	title: "CLI",
	description: "Command-line interface for managing Notploy from your terminal.",
	icon: "SquareTerminal",
	root: true,
};

// Hand-written pages of the section, kept in place when the generated list is
// rewritten.
const STATIC_PAGES = [
	"---Get started---",
	"index",
	"authentication",
	"---Reference---",
	"reference",
];

// ---------------------------------------------------------------------------
// Presentation metadata — the CLI only knows group/action names, so the
// human-facing title, blurb and sidebar section are curated here.
// ---------------------------------------------------------------------------

const GROUPS = {
	overview: {
		title: "Overview",
		section: "Overview",
		blurb: "Aggregated counters for the dashboard: services, backups and domains.",
	},
	project: {
		title: "Projects",
		section: "Projects",
		blurb:
			"Create, update, search and remove projects, and read the onboarding state of an instance.",
	},
	environment: {
		title: "Environments",
		section: "Projects",
		blurb:
			"Applications and databases live inside an environment, and environments belong to a project.",
	},
	tag: {
		title: "Tags",
		section: "Projects",
		blurb: "Label projects and filter the dashboard by tag.",
	},
	deployment: {
		title: "Deployments",
		section: "Projects",
		blurb:
			"Inspect deployment history and queues, read deployment logs and kill a running build.",
	},
	rollback: {
		title: "Rollbacks",
		section: "Projects",
		blurb: "Roll a deployment back to a previously built image.",
	},
	application: {
		title: "Applications",
		section: "Applications",
		blurb:
			"Create applications, connect a source, configure the build and drive the whole lifecycle.",
	},
	compose: {
		title: "Compose",
		section: "Applications",
		blurb:
			"Docker Compose projects: templates, imports, isolated deployments and previews.",
	},
	"preview-deployment": {
		title: "Preview deployments",
		section: "Applications",
		blurb: "Per-branch deployments created when preview deployments are enabled.",
	},
	patch: {
		title: "Patches",
		section: "Applications",
		blurb: "Versioned file overrides applied to an application at deploy time.",
	},
	schedule: {
		title: "Schedules",
		section: "Applications",
		blurb: "Cron jobs that run a shell command inside a deployed service.",
	},
	mounts: {
		title: "Mounts",
		section: "Applications",
		blurb: "Bind mounts and named volumes attached to applications and Compose services.",
	},
	security: {
		title: "Security",
		section: "Applications",
		blurb: "Per-application HTTP basic auth and response security headers.",
	},
	"vault-provider": {
		title: "Vault providers",
		section: "Applications",
		blurb: "External secret managers connected to the platform to resolve secrets at deploy time.",
	},
	postgres: {
		title: "PostgreSQL",
		section: "Databases",
		blurb: "Provision and operate PostgreSQL databases, including backups and external ports.",
	},
	mysql: {
		title: "MySQL",
		section: "Databases",
		blurb: "Provision and operate MySQL databases, including backups and external ports.",
	},
	mariadb: {
		title: "MariaDB",
		section: "Databases",
		blurb: "Provision and operate MariaDB databases, including backups and external ports.",
	},
	mongo: {
		title: "MongoDB",
		section: "Databases",
		blurb: "Provision and operate MongoDB databases, including backups and external ports.",
	},
	redis: {
		title: "Redis",
		section: "Databases",
		blurb: "Provision and operate Redis instances, including backups and external ports.",
	},
	libsql: {
		title: "libSQL",
		section: "Databases",
		blurb: "Provision and operate libSQL (SQLite-compatible) databases.",
	},
	backup: {
		title: "Backups",
		section: "Backups",
		blurb: "Scheduled and manual backups for databases, Compose services and the web server.",
	},
	"volume-backups": {
		title: "Volume backups",
		section: "Backups",
		blurb: "Back up Docker volumes on a schedule and download the resulting archives.",
	},
	destination: {
		title: "Destinations",
		section: "Backups",
		blurb: "S3-compatible storage destinations that backups are uploaded to.",
	},
	domain: {
		title: "Domains",
		section: "Domains & networking",
		blurb: "Attach domains to applications and Compose stacks, and generate or validate them.",
	},
	redirects: {
		title: "Redirects",
		section: "Domains & networking",
		blurb: "HTTP redirects served by Traefik for an application's domains.",
	},
	port: {
		title: "Ports",
		section: "Domains & networking",
		blurb: "Publish container ports directly, without routing them through a domain.",
	},
	network: {
		title: "Networks",
		section: "Domains & networking",
		blurb: "Docker networks: create, import, inspect and resynchronise them across servers.",
	},
	certificates: {
		title: "Certificates",
		section: "Domains & networking",
		blurb: "Custom TLS certificates loaded by Traefik alongside automatic Let's Encrypt ones.",
	},
	"forward-auth": {
		title: "Forward auth",
		section: "Domains & networking",
		blurb: "Deploy an authentication proxy in front of applications and manage its domains.",
	},
	"dns-provider": {
		title: "DNS providers",
		section: "Domains & networking",
		blurb: "Zones and records for connected DNS providers such as Cloudflare and Route 53.",
	},
	github: {
		title: "GitHub",
		section: "Git providers",
		blurb: "GitHub app connections, plus branch and repository lookups.",
	},
	gitlab: {
		title: "GitLab",
		section: "Git providers",
		blurb: "GitLab connections, plus branch and repository lookups.",
	},
	gitea: {
		title: "Gitea",
		section: "Git providers",
		blurb: "Gitea connections, plus branch and repository lookups.",
	},
	bitbucket: {
		title: "Bitbucket",
		section: "Git providers",
		blurb: "Bitbucket connections, plus branch and repository lookups.",
	},
	"git-provider": {
		title: "Git providers",
		section: "Git providers",
		blurb: "List, share and remove every Git provider connected to an organization.",
	},
	server: {
		title: "Servers",
		section: "Servers & infrastructure",
		blurb: "Add remote servers over SSH, validate them and read their metrics and services.",
	},
	swarm: {
		title: "Swarm",
		section: "Servers & infrastructure",
		blurb: "Inspect Docker Swarm nodes, node workloads and container statistics.",
	},
	cluster: {
		title: "Cluster",
		section: "Servers & infrastructure",
		blurb: "Add and remove Swarm workers and managers.",
	},
	docker: {
		title: "Docker",
		section: "Servers & infrastructure",
		blurb: "Containers, the Docker daemon configuration, events and container files.",
	},
	"docker-image": {
		title: "Docker images",
		section: "Servers & infrastructure",
		blurb: "List, inspect and remove images stored on a server.",
	},
	"docker-volume": {
		title: "Docker volumes",
		section: "Servers & infrastructure",
		blurb: "Inspect volumes, their size and the files inside them.",
	},
	"docker-disk-usage": {
		title: "Docker disk usage",
		section: "Servers & infrastructure",
		blurb: "Disk usage per Docker object type, and build cache pruning.",
	},
	registry: {
		title: "Registries",
		section: "Servers & infrastructure",
		blurb: "Container registries used to pull private images.",
	},
	"ssh-key": {
		title: "SSH keys",
		section: "Servers & infrastructure",
		blurb: "SSH keys used to reach servers and clone private repositories.",
	},
	notification: {
		title: "Notifications",
		section: "Notifications",
		blurb:
			"Notification channels — Slack, Discord, Telegram, email and others — plus test deliveries.",
	},
	user: {
		title: "Users",
		section: "Team & access",
		blurb: "Accounts, API keys, sessions, permissions and per-user metrics.",
	},
	organization: {
		title: "Organizations",
		section: "Team & access",
		blurb: "Organizations, members, invitations and the active organization.",
	},
	"custom-role": {
		title: "Custom roles",
		section: "Team & access",
		blurb: "Organization roles built from a set of permission statements.",
	},
	sso: {
		title: "SSO",
		section: "Team & access",
		blurb: "Single sign-on providers, enforcement and trusted origins.",
	},
	scim: {
		title: "SCIM",
		section: "Team & access",
		blurb: "SCIM provisioning providers and tokens used for directory sync.",
	},
	"audit-log": {
		title: "Audit log",
		section: "Team & access",
		blurb: "Every recorded action performed in the organization.",
	},
	settings: {
		title: "Settings",
		section: "Platform",
		blurb:
			"Instance-wide settings: Traefik, Docker cleanup, monitoring, GPUs, updates and SSH.",
	},
	"license-key": {
		title: "License keys",
		section: "Platform",
		blurb: "Activate and inspect the enterprise license of the instance.",
	},
	stripe: {
		title: "Stripe",
		section: "Platform",
		blurb: "Billing for Notploy Cloud: plans, invoices, checkout and the customer portal.",
	},
	whitelabeling: {
		title: "Whitelabeling",
		section: "Platform",
		blurb: "Rebrand the instance: application name, logos, favicon and links.",
	},
	admin: {
		title: "Admin",
		section: "Platform",
		blurb: "Administrative operations that apply to the whole instance.",
	},
	ai: {
		title: "AI",
		section: "Automation",
		blurb: "AI providers and models, plus log analysis and configuration suggestions.",
	},
};

// ---------------------------------------------------------------------------
// Parse packages/cli/src/generated/commands.ts
// ---------------------------------------------------------------------------

// Every generated command adds this option on top of the spec inputs.
const GLOBAL_OPTIONS = new Set(["--json"]);

// Sidebar order for the reference; sections not listed here are appended.
const SECTION_ORDER = [
	"Overview",
	"Projects",
	"Applications",
	"Databases",
	"Backups",
	"Domains & networking",
	"Git providers",
	"Servers & infrastructure",
	"Notifications",
	"Team & access",
	"Platform",
	"Automation",
];

function unescapeJsString(value) {
	return value.replace(/\\(.)/g, "$1");
}

/** `--sourceType <value>` + "sourceType (github, docker)" -> enum values. */
function splitDescription(description) {
	const match = description.match(/^(.*?)\s*\(([^()]*)\)$/);
	if (match) {
		const values = match[2].split(", ").map((v) => v.trim());
		if (values.length > 0 && values.every((v) => /^[A-Za-z0-9_.:-]+$/.test(v))) {
			return { description: match[1], values };
		}
	}
	return { description, values: [] };
}

function parseCommandsFile(source) {
	const groupDeclarations = [
		...source.matchAll(
			/const (g_[A-Za-z0-9_]+) = program\.command\('([^']+)'\)\.description\('([^']*)'\);/g,
		),
	];

	const groups = [];
	for (const [index, declaration] of groupDeclarations.entries()) {
		const [, variable, name] = declaration;
		const segmentStart = declaration.index ?? 0;
		const segmentEnd =
			groupDeclarations[index + 1]?.index ?? source.lastIndexOf("}\n");
		const segment = source.slice(segmentStart, segmentEnd);

		// Each command starts a `.command('action')` chain; split there so the
		// options and the API call that follow stay with their command.
		const chunks = segment.split(/\n\t+\.command\('([^']+)'\)/).slice(1);
		const commands = [];

		for (let i = 0; i < chunks.length; i += 2) {
			const action = chunks[i];
			const body = chunks[i + 1] ?? "";

			const options = [
				...body.matchAll(
					/\.(requiredOption|option)\('(--[^']+)'(?:,\s*'((?:[^'\\]|\\.)*)')?\)/g,
				),
			]
				.filter(([, , flag]) => !GLOBAL_OPTIONS.has(flag.split(" ")[0]))
				.map(([, kind, flag, rawDescription]) => {
					const { values } = splitDescription(unescapeJsString(rawDescription ?? ""));
					const flagName = flag.split(" ")[0].replace(/^--/, "");
					return {
						flag,
						required: kind === "requiredOption",
						values,
						// The generated commands coerce numeric inputs with Number().
						isNumber: body.includes(`opts["${flagName}"] = Number(`),
					};
				});

			const call = body.match(/await (apiGet|apiPost)\("([^"]+)"/);

			commands.push({
				action,
				options,
				endpoint: call?.[2] ?? null,
				method: call?.[1] === "apiGet" ? "GET" : "POST",
			});
		}

		groups.push({ name, variable, commands });
	}

	return groups;
}

const groups = parseCommandsFile(readFileSync(COMMANDS_SOURCE, "utf8"));
const knownGroups = new Set(groups.map((group) => group.name));

const missingMeta = [...knownGroups].filter((name) => !GROUPS[name]);
if (missingMeta.length > 0) {
	throw new Error(
		`Missing presentation metadata for CLI group(s): ${missingMeta.join(", ")}. ` +
			"Add them to the GROUPS map in scripts/generate-cli-docs.mjs.",
	);
}
const staleMeta = Object.keys(GROUPS).filter((name) => !knownGroups.has(name));
if (staleMeta.length > 0) {
	throw new Error(
		`scripts/generate-cli-docs.mjs documents group(s) the CLI no longer exposes: ${staleMeta.join(", ")}.`,
	);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function code(value) {
	return `\`${value}\``;
}

/** Sections in the curated order, followed by any that are not listed. */
function orderedSections(groups) {
	const present = new Set(groups.map((group) => GROUPS[group.name].section));
	const ordered = SECTION_ORDER.filter((section) => present.has(section));
	const extra = [...present].filter((section) => !SECTION_ORDER.includes(section));
	return [...ordered, ...extra];
}

function escapeCell(value) {
	return value.replace(/\|/g, "\\|");
}

function usageLine(group, command) {
	const required = command.options
		.filter((option) => option.required)
		.map((option) => {
			const name = option.flag.replace(/^--/, "").split(" ")[0];
			return option.flag.includes("<value>") ? `--${name} <${name}>` : `--${name}`;
		});
	const hasOptional = command.options.some((option) => !option.required);
	const parts = [`notploy ${group} ${command.action}`, ...required];
	if (hasOptional) parts.push("[options]");
	return parts.join(" ");
}

function renderOptionsTable(command) {
	if (command.options.length === 0) return "";
	const rows = command.options
		.map((option) => {
			const type = option.flag.includes("<value>")
				? option.isNumber
					? "number"
					: "string"
				: "boolean";
			const values = option.values.length
				? option.values.map((value) => code(value)).join(", ")
				: "—";
			return `| ${code(escapeCell(option.flag))} | ${type} | ${
				option.required ? "Yes" : "No"
			} | ${values} |`;
		})
		.join("\n");

	return `

| Option | Type | Required | Allowed values |
| --- | --- | --- | --- |
${rows}`;
}

function renderCommand(group, command) {
	const heading = `### ${code(`notploy ${group} ${command.action}`)}`;
	const api = command.endpoint
		? `\nCalls ${code(`${command.method} /api/trpc/${command.endpoint}`)}.\n`
		: "";

	return `${heading}
${api}
\`\`\`bash
${usageLine(group, command)}
\`\`\`${renderOptionsTable(command)}
`;
}

function renderGroupPage(group) {
	const meta = GROUPS[group.name];
	const count = group.commands.length;

	return `---
title: ${JSON.stringify(meta.title)}
description: ${JSON.stringify(`${meta.blurb} Generated from the ${code("notploy")} command surface.`)}
---

import { Callout } from 'fumadocs-ui/components/callout';

${meta.blurb}

${code(`notploy ${group.name}`)} exposes **${count} command${count === 1 ? "" : "s"}**. They map one-to-one onto the ${code(`${group.name}.*`)} API operations, so anything reachable from the dashboard is reachable from here.

<Callout>
	Run ${code(`notploy ${group.name} --help`)} to list these commands in your terminal, or
	${code(`notploy ${group.name} <command> --help`)} for a single command.
</Callout>

## Commands

${group.commands.map((command) => renderCommand(group.name, command)).join("\n")}`;
}

function renderReferenceIndex(groups) {
	const total = groups.reduce((sum, group) => sum + group.commands.length, 0);
	const sections = orderedSections(groups);
	const bySection = sections
		.map((section) => {
			const sectionGroups = groups.filter((group) => GROUPS[group.name].section === section);
			const rows = sectionGroups
				.sort((a, b) => GROUPS[a.name].title.localeCompare(GROUPS[b.name].title))
				.map(
					(group) =>
						`| [${GROUPS[group.name].title}](/docs/cli/${group.name}) | ${code(
							`notploy ${group.name}`,
						)} | ${group.commands.length} | ${GROUPS[group.name].blurb} |`,
				)
				.join("\n");
			return `### ${section}

| Group | Command | Commands | Description |
| --- | --- | --- | --- |
${rows}`;
		})
		.join("\n\n");

	return `---
title: Command reference
description: ${JSON.stringify(
		`Every group and command the Notploy CLI exposes — ${groups.length} groups, ${total} commands.`,
	)}
---

This reference is generated from the CLI source (${code("packages/cli")}), so it lists exactly what
${code(`notploy ${CLI_PACKAGE.version}`)} registers with its command parser — no more, no less.

**${groups.length} groups · ${total} commands.**

Each group below is a page of this section, and every page lists the commands of that group with
their flags, required inputs and allowed values.

<Callout>
	Every command accepts ${code("--json")} to print the raw API response, and
	${code("notploy auth")} — the one command that is not part of the generated groups — is covered in
	[Authentication](/docs/cli/authentication).
</Callout>

## Groups

${bySection}

## Naming

Groups are the first argument and commands the second: ${code("notploy <group> <command>")}. Both are
lowercase and hyphenated, matching the API namespace they call (${code("docker-disk-usage")} →
${code("dockerDiskUsage.*")}).

Flags are the input fields of that operation, in camelCase: ${code("--environmentId")} is passed
through as ${code("environmentId")}. A flag marked **Yes** in the Required column aborts the command
when it is missing, so it always has to be provided; the others are omitted from the request when you
leave them out, which lets the server apply its defaults.

Flag names, required flags and allowed values are read from the CLI itself, so this page cannot drift
from what ${code("notploy --help")} reports.
`;
}

function renderMetaJson(groups) {
	const sections = orderedSections(groups);
	const pages = [...STATIC_PAGES];
	for (const section of sections) {
		pages.push(`---${section}---`);
		for (const group of groups.filter((g) => GROUPS[g.name].section === section)) {
			pages.push(group.name);
		}
	}
	return `${JSON.stringify({ ...SECTION_META, pages }, null, "\t")}\n`;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

rmSync(LEGACY_OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

writeFileSync(join(OUT_DIR, "meta.json"), renderMetaJson(groups));
writeFileSync(join(OUT_DIR, "reference.mdx"), renderReferenceIndex(groups));
for (const group of groups) {
	writeFileSync(join(OUT_DIR, `${group.name}.mdx`), renderGroupPage(group));
}

const total = groups.reduce((sum, group) => sum + group.commands.length, 0);
console.log(
	`Generated ${groups.length} group pages and ${total} commands → ${OUT_DIR.replace(`${DOCS_ROOT}/`, "")}`,
);
