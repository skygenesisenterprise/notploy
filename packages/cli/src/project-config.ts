import * as fs from "node:fs";
import * as path from "node:path";
import {
	DEFAULT_TIMEOUT_MS,
	MAX_TIMEOUT_MS,
	MIN_TIMEOUT_MS,
} from "./config.js";
import { usageError } from "./errors.js";

export interface ProjectEnvironmentConfig {
	environmentId?: string;
	applicationId?: string;
	serverId?: string;
}

export interface ProjectConfig {
	version: 1;
	profile?: string;
	projectId?: string;
	environmentId?: string;
	applicationId?: string;
	serverId?: string;
	timeoutMs?: number;
	environment?: string;
	environments?: Record<string, ProjectEnvironmentConfig>;
}

export interface LoadedProjectConfig {
	path: string;
	config: ProjectConfig;
	raw: ProjectConfig;
}

interface Token {
	indent: number;
	content: string;
	line: number;
}

const SECRET_KEY_PATTERN =
	/token|secret|password|api[_-]?key|authorization|credential/i;
const ROOT_KEYS = new Set([
	"version",
	"profile",
	"projectId",
	"environmentId",
	"applicationId",
	"serverId",
	"timeoutMs",
	"environment",
	"environments",
]);
const ENVIRONMENT_KEYS = new Set([
	"environmentId",
	"applicationId",
	"serverId",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(
	source: string,
	line: number | undefined,
	message: string,
): never {
	const location = line === undefined ? source : `${source}:${line}`;
	throw usageError(`${location}: ${message}`);
}

function stripComment(value: string): string {
	let quote: string | undefined;
	let result = "";
	for (let i = 0; i < value.length; i += 1) {
		const char = value[i];
		if (quote) {
			result += char;
			if (char === quote) {
				if (quote === "'" && value[i + 1] === "'") {
					result += value[i + 1];
					i += 1;
				} else {
					quote = undefined;
				}
			} else if (char === "\\" && quote === '"') {
				result += value[i + 1] ?? "";
				i += 1;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			result += char;
			continue;
		}
		if (char === "#" && (i === 0 || /\s/.test(value[i - 1] ?? ""))) {
			break;
		}
		result += char;
	}
	return result.trim();
}

function splitKeyValue(content: string): { key: string; value: string } | null {
	let quote: string | undefined;
	for (let i = 0; i < content.length; i += 1) {
		const char = content[i];
		if (quote) {
			if (char === quote) {
				if (quote === "'" && content[i + 1] === "'") {
					i += 1;
				} else if (!(quote === '"' && content[i - 1] === "\\")) {
					quote = undefined;
				}
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === ":") {
			const keyPart = content.slice(0, i).trim();
			if (!keyPart) return null;
			return { key: unquote(keyPart), value: content.slice(i + 1).trim() };
		}
	}
	return null;
}

function unquote(value: string): string {
	if (value.startsWith('"') && value.endsWith('"')) {
		try {
			return JSON.parse(value) as string;
		} catch {
			return value.slice(1, -1);
		}
	}
	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replace(/''/g, "'");
	}
	return value;
}

function parseScalar(value: string, source: string, line: number): unknown {
	if (value.startsWith("|") || value.startsWith(">")) {
		fail(source, line, "block scalars are not supported by notploy.yaml");
	}
	if (value.startsWith("&") || value.startsWith("*")) {
		fail(source, line, "YAML anchors and aliases are not supported");
	}
	if (value.startsWith("{") || value.startsWith("[")) {
		try {
			return JSON.parse(value);
		} catch {
			fail(
				source,
				line,
				'flow collections must use JSON syntax, for example ["a", "b"]',
			);
		}
	}
	if (value.startsWith('"')) {
		try {
			return JSON.parse(value) as unknown;
		} catch {
			fail(source, line, "invalid double-quoted string");
		}
	}
	if (value.startsWith("'")) {
		if (!value.endsWith("'") || value.length < 2) {
			fail(source, line, "unterminated single-quoted string");
		}
		return value.slice(1, -1).replace(/''/g, "'");
	}
	if (value === "null" || value === "~") return null;
	if (value === "true") return true;
	if (value === "false") return false;
	if (/^[-+]?\d+$/.test(value)) return Number(value);
	if (/^[-+]?(?:\d+\.\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(value)) {
		return Number(value);
	}
	return value;
}

/**
 * Parses the constrained YAML subset documented for notploy.yaml.
 *
 * Supported: nested mappings, scalar lists, quoted/unquoted scalars, JSON
 * flow collections and comments. Unsupported YAML features fail with a line
 * number instead of being silently misread.
 */
export function parseYamlSubset(
	source: string,
	file = "notploy.yaml",
): unknown {
	const tokens: Token[] = [];
	const lines = source
		.replace(/^\uFEFF/, "")
		.replace(/\r\n/g, "\n")
		.split("\n");
	let documentStarted = false;

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const leading = line.match(/^[ \t]*/)?.[0] ?? "";
		if (leading.includes("\t")) {
			fail(file, i + 1, "tabs are not allowed for indentation; use spaces");
		}
		const content = stripComment(line.slice(leading.length));
		if (!content) continue;
		if (content === "---") {
			if (documentStarted) {
				fail(file, i + 1, "multiple YAML documents are not supported");
			}
			documentStarted = true;
			continue;
		}
		if (content === "...") {
			fail(file, i + 1, "multiple YAML documents are not supported");
		}
		tokens.push({ indent: leading.length, content, line: i + 1 });
	}

	if (tokens.length === 0) return null;

	let index = 0;

	function parseNode(indent: number): unknown {
		const token = tokens[index];
		if (token.content.startsWith("-")) return parseList(indent);
		return parseMap(indent);
	}

	function parseMap(indent: number): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		while (index < tokens.length) {
			const token = tokens[index];
			if (token.indent < indent) break;
			if (token.indent > indent) {
				fail(file, token.line, "unexpected indentation");
			}
			if (token.content.startsWith("-")) break;

			const pair = splitKeyValue(token.content);
			if (!pair) {
				fail(file, token.line, 'expected "key: value"');
			}
			const key = pair.key;
			if (!key) fail(file, token.line, "empty key");
			if (Object.hasOwn(result, key)) {
				fail(file, token.line, `duplicate key "${key}"`);
			}
			index += 1;

			if (pair.value === "") {
				if (index < tokens.length && tokens[index].indent > indent) {
					result[key] = parseNode(tokens[index].indent);
				} else {
					result[key] = null;
				}
			} else {
				result[key] = parseScalar(pair.value, file, token.line);
			}
		}
		return result;
	}

	function parseList(indent: number): unknown[] {
		const result: unknown[] = [];
		while (index < tokens.length) {
			const token = tokens[index];
			if (token.indent < indent) break;
			if (token.indent > indent) {
				fail(file, token.line, "unexpected indentation");
			}
			if (!token.content.startsWith("-")) break;
			const rest = token.content.slice(1).trim();
			index += 1;
			if (!rest) {
				if (index < tokens.length && tokens[index].indent > indent) {
					result.push(parseNode(tokens[index].indent));
				} else {
					result.push(null);
				}
			} else if (
				rest.includes(":") &&
				!rest.startsWith('"') &&
				!rest.startsWith("'")
			) {
				fail(
					file,
					token.line,
					"inline mappings in lists are not supported; use nested mappings",
				);
			} else {
				result.push(parseScalar(rest, file, token.line));
			}
		}
		return result;
	}

	const root = parseNode(tokens[0].indent);
	if (index !== tokens.length) {
		fail(file, tokens[index].line, "unexpected content");
	}
	return root;
}

function validateOptionalString(
	record: Record<string, unknown>,
	key: string,
	source: string,
): string | undefined {
	const value = record[key];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "string" || !value.trim()) {
		fail(source, undefined, `"${key}" must be a non-empty string`);
	}
	return value.trim();
}

/**
 * Validates a parsed manifest and rejects secret-bearing fields by design.
 */
export function validateProjectConfig(
	raw: unknown,
	source = "notploy.yaml",
): ProjectConfig {
	if (!isRecord(raw)) {
		fail(source, undefined, "the manifest must be a mapping");
	}

	for (const key of Object.keys(raw)) {
		if (!ROOT_KEYS.has(key)) {
			if (SECRET_KEY_PATTERN.test(key)) {
				fail(
					source,
					undefined,
					`"${key}" looks like a secret. notploy.yaml must never contain secrets; use profiles or environment variables`,
				);
			}
			fail(
				source,
				undefined,
				`unknown key "${key}". Supported keys: ${[...ROOT_KEYS].join(", ")}`,
			);
		}
	}

	if (raw.version !== 1) {
		fail(source, undefined, '"version" must be 1');
	}

	const config: ProjectConfig = { version: 1 };
	for (const key of [
		"profile",
		"projectId",
		"environmentId",
		"applicationId",
		"serverId",
		"environment",
	] as const) {
		const value = validateOptionalString(raw, key, source);
		if (value !== undefined) config[key] = value;
	}

	if (raw.timeoutMs !== undefined && raw.timeoutMs !== null) {
		if (
			typeof raw.timeoutMs !== "number" ||
			!Number.isInteger(raw.timeoutMs) ||
			raw.timeoutMs < MIN_TIMEOUT_MS ||
			raw.timeoutMs > MAX_TIMEOUT_MS
		) {
			fail(
				source,
				undefined,
				`"timeoutMs" must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
			);
		}
		config.timeoutMs = raw.timeoutMs;
	}

	if (raw.environments !== undefined && raw.environments !== null) {
		if (!isRecord(raw.environments)) {
			fail(source, undefined, '"environments" must be a mapping');
		}
		const environments: Record<string, ProjectEnvironmentConfig> = {};
		for (const [name, value] of Object.entries(raw.environments)) {
			if (SECRET_KEY_PATTERN.test(name)) {
				fail(source, undefined, `environment name "${name}" is not allowed`);
			}
			if (!isRecord(value)) {
				fail(source, undefined, `"environments.${name}" must be a mapping`);
			}
			for (const key of Object.keys(value)) {
				if (!ENVIRONMENT_KEYS.has(key)) {
					if (SECRET_KEY_PATTERN.test(key)) {
						fail(
							source,
							undefined,
							`"environments.${name}.${key}" looks like a secret; secrets are not allowed in notploy.yaml`,
						);
					}
					fail(source, undefined, `unknown key "environments.${name}.${key}"`);
				}
			}
			const envConfig: ProjectEnvironmentConfig = {};
			for (const key of ENVIRONMENT_KEYS) {
				const envValue = validateOptionalString(
					value,
					key,
					`${source} (${name})`,
				);
				if (envValue !== undefined) {
					envConfig[key as keyof ProjectEnvironmentConfig] = envValue;
				}
			}
			environments[name] = envConfig;
		}
		config.environments = environments;
	}

	if (config.environment) {
		if (!config.environments?.[config.environment]) {
			fail(
				source,
				undefined,
				`"environment" refers to "${config.environment}", which is not defined under "environments"`,
			);
		}
	}

	return config;
}

export function findProjectConfigPath(
	cwd: string = process.cwd(),
): string | undefined {
	for (const name of ["notploy.yaml", "notploy.yml"]) {
		const candidate = path.resolve(cwd, name);
		if (fs.existsSync(candidate)) return candidate;
	}
	return undefined;
}

/**
 * Loads notploy.yaml, validates it and overlays the selected environment.
 * Returns null when the optional manifest is absent.
 */
export function loadProjectConfig(
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): LoadedProjectConfig | null {
	const cwd = options.cwd ?? process.cwd();
	const env = options.env ?? process.env;
	const file = findProjectConfigPath(cwd);
	if (!file) return null;

	let source: string;
	try {
		source = fs.readFileSync(file, "utf8");
	} catch (error) {
		throw usageError(
			`Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const raw = validateProjectConfig(parseYamlSubset(source, file), file);
	const selected = env.NOTPLOY_ENVIRONMENT?.trim() || raw.environment;
	if (!selected) {
		return { path: file, config: raw, raw };
	}

	const environment = raw.environments?.[selected];
	if (!environment) {
		throw usageError(
			`${file}: environment "${selected}" is not defined under "environments".`,
			"Define it in notploy.yaml or unset NOTPLOY_ENVIRONMENT.",
		);
	}

	const config: ProjectConfig = {
		...raw,
		...environment,
		environment: selected,
	};
	return { path: file, config, raw };
}

const ENV_KEYS = {
	projectId: "NOTPLOY_PROJECT_ID",
	environmentId: "NOTPLOY_ENVIRONMENT_ID",
	applicationId: "NOTPLOY_APPLICATION_ID",
	serverId: "NOTPLOY_SERVER_ID",
} as const;

export type ProjectValueKey = keyof typeof ENV_KEYS;

/**
 * Resolves an identifier with environment variables above the project
 * manifest. Command-line flags are applied by the caller before this.
 */
export function resolveProjectValue(
	key: ProjectValueKey,
	project: LoadedProjectConfig | null,
	env: NodeJS.ProcessEnv = process.env,
): string | undefined {
	const envValue = env[ENV_KEYS[key]]?.trim();
	if (envValue) return envValue;
	return project?.config[key]?.trim() || undefined;
}

export function projectValueKeys(): ProjectValueKey[] {
	return Object.keys(ENV_KEYS) as ProjectValueKey[];
}

export const PROJECT_TIMEOUT_FALLBACK = DEFAULT_TIMEOUT_MS;
