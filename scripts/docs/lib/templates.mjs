import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "toml";
import { parse as parseYaml } from "yaml";

const LOGO_EXTENSIONS = [".svg", ".png", ".webp", ".jpg", ".jpeg"];
const REQUIRED_LINK_KEYS = ["github", "website", "docs"];
const ALLOW_HOST_PORTS = "# notploy: allow-host-ports";
const ALLOW_CONTAINER_NAMES = "# notploy: allow-container-names";
// Injected by the template processor; APP_NAME is documented as always present.
const BUILTIN_VARIABLES = new Set(["APP_NAME"]);

/**
 * The helper names implemented by packages/server/src/templates/processors.ts.
 * Extracted from the source instead of copied, so adding a helper without
 * documenting it is visible in review.
 */
export function extractTemplateHelpers(source) {
	const helpers = new Set();
	const pattern =
		/varName\s*===\s*"([^"]+)"|varName\.startsWith\("([^"]+):"\)/g;
	for (const match of source.matchAll(pattern)) {
		const name = match[1] ?? match[2];
		if (name) helpers.add(name);
	}
	return [...helpers].sort();
}

export function discoverBlueprints(blueprintsDir) {
	return readdirSync(blueprintsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

function variableTokens(value, tokens = []) {
	if (typeof value === "string") {
		for (const match of value.matchAll(/\$\{([^}]+)\}/g)) tokens.push(match[1]);
		return tokens;
	}
	if (Array.isArray(value)) {
		for (const entry of value) variableTokens(entry, tokens);
		return tokens;
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value)) variableTokens(entry, tokens);
	}
	return tokens;
}

function readJson(file, issues) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.invalid-json",
			message: `cannot parse JSON: ${error.message}`,
		});
		return undefined;
	}
}

function validateMeta(id, dir, issues) {
	const file = join(dir, "meta.json");
	if (!existsSync(file)) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.missing-file",
			message: "meta.json is required",
		});
		return undefined;
	}
	const meta = readJson(file, issues);
	if (!meta) return undefined;
	if (meta.id !== id) {
		issues.push({
			severity: "error",
			code: "templates.id-mismatch",
			message: `meta.json id "${meta.id}" must equal the folder name "${id}"`,
		});
	}
	for (const key of ["name", "version", "description"]) {
		if (typeof meta[key] !== "string" || meta[key].trim() === "") {
			issues.push({
				severity: "error",
				file: "meta.json",
				code: "templates.meta-field",
				message: `meta.json "${key}" must be a non-empty string`,
			});
		}
	}
	if (typeof meta.logo !== "string" || !meta.logo) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.meta-logo",
			message: "meta.json logo must name a file in the blueprint folder",
		});
	} else if (!existsSync(join(dir, meta.logo))) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.missing-logo",
			message: `meta.json logo "${meta.logo}" does not exist`,
		});
	} else if (
		!LOGO_EXTENSIONS.some((extension) =>
			meta.logo.toLowerCase().endsWith(extension),
		)
	) {
		issues.push({
			severity: "warning",
			file: "meta.json",
			code: "templates.logo-format",
			message: `logo "${meta.logo}" is not one of ${LOGO_EXTENSIONS.join(", ")}`,
		});
	}
	if (!meta.links || typeof meta.links !== "object") {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.meta-links",
			message: "meta.json links must be an object",
		});
	} else {
		for (const key of REQUIRED_LINK_KEYS) {
			if (typeof meta.links[key] !== "string") {
				issues.push({
					severity: "error",
					file: "meta.json",
					code: "templates.meta-links",
					message: `meta.json links.${key} is required (empty string allowed)`,
				});
			}
		}
	}
	if (!Array.isArray(meta.tags) || meta.tags.length === 0) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.meta-tags",
			message: "meta.json tags must be a non-empty array",
		});
	} else if (meta.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
		issues.push({
			severity: "error",
			file: "meta.json",
			code: "templates.meta-tags",
			message: "meta.json tags must contain non-empty strings",
		});
	}
	return meta;
}

function validateCompose(dir, issues) {
	const file = join(dir, "docker-compose.yml");
	if (!existsSync(file)) {
		issues.push({
			severity: "error",
			file: "docker-compose.yml",
			code: "templates.missing-file",
			message: "docker-compose.yml is required",
		});
		return undefined;
	}
	const source = readFileSync(file, "utf8");
	let compose;
	try {
		compose = parseYaml(source);
	} catch (error) {
		issues.push({
			severity: "error",
			file: "docker-compose.yml",
			code: "templates.invalid-compose",
			message: `docker-compose.yml is not valid YAML: ${error.message}`,
		});
		return undefined;
	}
	const services = compose?.services;
	if (!services || typeof services !== "object" || Array.isArray(services)) {
		issues.push({
			severity: "error",
			file: "docker-compose.yml",
			code: "templates.compose-services",
			message: "docker-compose.yml must declare at least one service",
		});
		return undefined;
	}
	const serviceNames = Object.keys(services);
	if (serviceNames.length === 0) {
		issues.push({
			severity: "error",
			file: "docker-compose.yml",
			code: "templates.compose-services",
			message: "docker-compose.yml must declare at least one service",
		});
	}
	if (compose.networks !== undefined) {
		issues.push({
			severity: "error",
			file: "docker-compose.yml",
			code: "templates.compose-networks",
			message:
				"docker-compose.yml must not declare networks; Notploy creates the network",
		});
	}
	for (const name of serviceNames) {
		const service = services[name] ?? {};
		if (service.container_name && !source.includes(ALLOW_CONTAINER_NAMES)) {
			issues.push({
				severity: "error",
				file: "docker-compose.yml",
				code: "templates.compose-container-name",
				message: `service "${name}" sets container_name; Notploy names containers per deployment`,
			});
		}
		for (const port of service.ports ?? []) {
			if (typeof port === "string" && port.includes(":")) {
				if (source.includes(ALLOW_HOST_PORTS)) continue;
				issues.push({
					severity: "error",
					file: "docker-compose.yml",
					code: "templates.compose-ports",
					message: `service "${name}" publishes host port "${port}"; use the bare container port, or add the "${ALLOW_HOST_PORTS}" marker when the protocol requires it`,
				});
			}
		}
	}
	return { compose, serviceNames };
}

function validateConfig(dir, issues, helpers, serviceNames) {
	const file = join(dir, "template.toml");
	if (!existsSync(file)) {
		issues.push({
			severity: "error",
			file: "template.toml",
			code: "templates.missing-file",
			message: "template.toml is required",
		});
		return undefined;
	}
	let config;
	try {
		config = parseToml(readFileSync(file, "utf8"));
	} catch (error) {
		issues.push({
			severity: "error",
			file: "template.toml",
			code: "templates.invalid-toml",
			message: `template.toml is not valid TOML: ${error.message}`,
		});
		return undefined;
	}

	const variables = config.variables ?? {};
	if (variables && (typeof variables !== "object" || Array.isArray(variables))) {
		issues.push({
			severity: "error",
			file: "template.toml",
			code: "templates.variables",
			message: "[variables] must be a table of names to strings",
		});
	}
	const declared = new Set(
		Object.keys(variables ?? {}).filter(
			(name) => typeof variables[name] === "string",
		),
	);

	const configSection = config.config ?? {};
	// The processor accepts an array of strings, an array of single-key tables
	// (`[[config.env]]`) and a `[config.env]` table.
	const env = configSection.env;
	if (Array.isArray(env)) {
		for (const entry of env) {
			const valid =
				typeof entry === "string" ||
				(entry &&
					typeof entry === "object" &&
					!Array.isArray(entry) &&
					Object.keys(entry).length > 0);
			if (!valid) {
				issues.push({
					severity: "error",
					file: "template.toml",
					code: "templates.env",
					message: "[config] env must contain strings or single-key tables",
				});
				break;
			}
		}
	} else if (env !== undefined && (typeof env !== "object" || Array.isArray(env))) {
		issues.push({
			severity: "error",
			file: "template.toml",
			code: "templates.env",
			message: "[config] env must be an array of strings or a table",
		});
	}

	for (const [index, domain] of (configSection.domains ?? []).entries()) {
		if (!domain || typeof domain !== "object") {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.domains",
				message: `config.domains[${index}] must be a table`,
			});
			continue;
		}
		if (typeof domain.serviceName !== "string") {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.domains",
				message: `config.domains[${index}] is missing serviceName`,
			});
		} else if (serviceNames && !serviceNames.includes(domain.serviceName)) {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.domain-service",
				message: `config.domains[${index}] targets service "${domain.serviceName}", which is not in docker-compose.yml`,
			});
		}
		const port = Number(domain.port);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.domains",
				message: `config.domains[${index}] needs a port between 1 and 65535`,
			});
		}
		if (typeof domain.host !== "string" || !domain.host.trim()) {
			// processDomains falls back to a generated domain when host is absent.
			issues.push({
				severity: "warning",
				file: "template.toml",
				code: "templates.domains-default-host",
				message: `config.domains[${index}] has no host; a generated domain is used`,
			});
		}
	}

	for (const [index, mount] of (configSection.mounts ?? []).entries()) {
		if (!mount || typeof mount !== "object") {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.mounts",
				message: `config.mounts[${index}] must be a table`,
			});
			continue;
		}
		if (typeof mount.filePath !== "string" || !mount.filePath.trim()) {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.mounts",
				message: `config.mounts[${index}] needs a filePath`,
			});
		}
		if (typeof mount.content !== "string") {
			issues.push({
				severity: "error",
				file: "template.toml",
				code: "templates.mounts",
				message: `config.mounts[${index}] needs string content`,
			});
		}
	}

	const helperSet = new Set(helpers);
	for (const token of variableTokens(config)) {
		const name = token.split(":")[0];
		if (declared.has(token) || declared.has(name)) continue;
		if (helperSet.has(name) || BUILTIN_VARIABLES.has(name)) continue;
		issues.push({
			severity: "warning",
			file: "template.toml",
			code: "templates.undefined-variable",
			message: `"${token}" is not declared in [variables] and is not a helper`,
		});
	}

	return { config, variables: declared };
}

/**
 * Validates every blueprint folder. Templates are treated as untrusted data:
 * they are parsed, never executed.
 */
export function validateBlueprints(blueprintsDir, helpers) {
	const blueprints = [];
	const issues = [];
	for (const id of discoverBlueprints(blueprintsDir)) {
		const dir = join(blueprintsDir, id);
		const blueprintIssues = [];
		const meta = validateMeta(id, dir, blueprintIssues);
		const compose = validateCompose(dir, blueprintIssues);
		const config = validateConfig(
			dir,
			blueprintIssues,
			helpers,
			compose?.serviceNames,
		);
		for (const issue of blueprintIssues) {
			issues.push({
				...issue,
				file: `${blueprintsDir}/${id}/${issue.file}`,
			});
		}
		blueprints.push({ id, meta, compose, config });
	}
	return { blueprints, issues };
}

/** Deterministic summary used by the managed region of templates/index.mdx. */
export function renderTemplateCatalog(blueprints) {
	const tagCounts = new Map();
	for (const blueprint of blueprints) {
		for (const tag of blueprint.meta?.tags ?? []) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}
	const topTags = [...tagCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, 12);
	const rows = topTags
		.map(([tag, count]) => `| \`${tag}\` | ${count} |`)
		.join("\n");

	return [
		`**${blueprints.length} blueprints** are available from the catalogue, filtered by ${tagCounts.size} tags.`,
		"",
		"Most used tags:",
		"",
		"| Tag | Blueprints |",
		"| --- | --- |",
		rows,
	].join("\n");
}
