import type { Command } from "commander";
import {
	collectSecretValues,
	DEFAULT_TIMEOUT_MS,
	resolveAuth,
	resolveTimeout,
} from "../config.js";
import {
	type CliError,
	ExitCode,
	normalizeError,
	usageError,
} from "../errors.js";
import { apiGet, apiPost } from "../http.js";
import {
	configureOutput,
	isJsonMode,
	printError,
	printResult,
} from "../output.js";
import {
	type LoadedProjectConfig,
	loadProjectConfig,
	type ProjectValueKey,
	projectValueKeys,
	resolveProjectValue,
} from "../project-config.js";

export type OptionType =
	| "string"
	| "string?"
	| "number"
	| "number?"
	| "boolean"
	| "boolean?"
	| "array"
	| "array?"
	| "object"
	| "object?";

export interface CommandMeta {
	/** Property names that must be present in the request payload. */
	required?: string[];
	/** Non-string coercion rules. */
	types?: Record<string, OptionType>;
	/** Allowed values, validated before the request is sent. */
	enums?: Record<string, string[]>;
}

const GLOBAL_KEYS = new Set([
	"json",
	"profile",
	"ansi",
	"notployUrl",
	"notployToken",
	"timeout",
]);

const PROJECT_KEYS = new Set<string>(projectValueKeys());

function parseBoolean(key: string, raw: unknown): boolean {
	if (typeof raw === "boolean") return raw;
	const value = String(raw).trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(value)) return true;
	if (["false", "0", "no", "off"].includes(value)) return false;
	throw usageError(
		`Invalid boolean for --${key}: "${raw}". Use true or false.`,
	);
}

function parseNumber(key: string, raw: unknown): number {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw;
	const text = String(raw).trim();
	const value = Number(text);
	if (!text || !Number.isFinite(value)) {
		throw usageError(`Invalid number for --${key}: "${raw}".`);
	}
	return value;
}

function parseJson(
	key: string,
	raw: unknown,
	expected: "array" | "object",
): unknown {
	if (expected === "array" && Array.isArray(raw)) return raw;
	if (
		expected === "object" &&
		raw &&
		typeof raw === "object" &&
		!Array.isArray(raw)
	) {
		return raw;
	}
	if (typeof raw !== "string") {
		throw usageError(`Invalid ${expected} for --${key}.`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw usageError(
			`Invalid JSON for --${key}.`,
			expected === "array"
				? 'Pass an array as JSON, for example: --tags \'["a","b"]\''
				: 'Pass an object as JSON, for example: --metadata \'{"key":"value"}\'',
		);
	}
	if (expected === "array" && !Array.isArray(parsed)) {
		throw usageError(`--${key} must be a JSON array.`);
	}
	if (
		expected === "object" &&
		(!parsed || typeof parsed !== "object" || Array.isArray(parsed))
	) {
		throw usageError(`--${key} must be a JSON object.`);
	}
	return parsed;
}

function coerceValue(key: string, raw: unknown, meta: CommandMeta): unknown {
	const typeSpec = meta.types?.[key];
	const nullable = typeSpec?.endsWith("?") ?? false;
	const type = (typeSpec?.replace(/\?$/, "") ?? "string") as OptionType;

	if (
		nullable &&
		typeof raw === "string" &&
		raw.trim().toLowerCase() === "null"
	) {
		return null;
	}

	let value: unknown;
	switch (type) {
		case "boolean":
			value = parseBoolean(key, raw);
			break;
		case "number":
			value = parseNumber(key, raw);
			break;
		case "array":
			value = parseJson(key, raw, "array");
			break;
		case "object":
			value = parseJson(key, raw, "object");
			break;
		default:
			value = String(raw);
	}

	const allowed = meta.enums?.[key];
	if (allowed && value !== null) {
		const candidate = String(value);
		if (!allowed.includes(candidate)) {
			throw usageError(
				`Invalid value "${candidate}" for --${key}.`,
				`Allowed values: ${allowed.join(", ")}.`,
			);
		}
		if (type === "number") {
			value = Number(candidate);
		} else if (type === "boolean") {
			value = parseBoolean(key, candidate);
		}
	}

	return value;
}

function optionNames(command: Command): Set<string> {
	return new Set(command.options.map((option) => option.attributeName()));
}

function loadProjectSafe(
	cwd: string,
	env: NodeJS.ProcessEnv,
): { project: LoadedProjectConfig | null; error?: CliError } {
	try {
		return { project: loadProjectConfig({ cwd, env }) };
	} catch (error) {
		return { project: null, error: normalizeError(error) };
	}
}

/**
 * Applies the documented identifier precedence:
 * CLI flag > environment variable > notploy.yaml > unset.
 */
function applyProjectFallbacks(
	payload: Record<string, unknown>,
	command: Command,
	project: LoadedProjectConfig | null,
	env: NodeJS.ProcessEnv,
): void {
	const available = optionNames(command);
	for (const key of PROJECT_KEYS) {
		if (payload[key] !== undefined) continue;
		if (!available.has(key)) continue;
		const fallback = resolveProjectValue(key as ProjectValueKey, project, env);
		if (fallback !== undefined) {
			payload[key] = fallback;
		}
	}
}

function buildPayload(
	merged: Record<string, unknown>,
	command: Command,
	meta: CommandMeta,
	project: LoadedProjectConfig | null,
	env: NodeJS.ProcessEnv,
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	for (const [key, raw] of Object.entries(merged)) {
		if (GLOBAL_KEYS.has(key)) continue;
		if (raw === undefined) continue;
		payload[key] = coerceValue(key, raw, meta);
	}

	applyProjectFallbacks(payload, command, project, env);

	for (const key of meta.required ?? []) {
		if (payload[key] === undefined || payload[key] === "") {
			throw usageError(
				`Missing required option --${key}.`,
				"Pass the option, set the matching NOTPLOY_* variable, or define it in notploy.yaml.",
			);
		}
	}

	return payload;
}

/**
 * Central error path for every command. Keeps JSON on stdout and diagnostics
 * on stderr, redacts known credentials and records a stable exit code.
 */
export function handleCommandError(
	error: unknown,
	options: { json?: boolean; secrets?: string[] } = {},
): void {
	configureOutput({ json: options.json ?? isJsonMode() });
	const normalized = normalizeError(
		error,
		options.secrets ?? collectSecretValues(),
	);
	printError(normalized);
	process.exitCode = normalized.code;
}

/**
 * Runs one generated API command.
 *
 * The generated modules contain only command metadata; every cross-cutting
 * concern (profiles, timeout, coercion, JSON, errors) lives here.
 */
export async function runApiCommand(
	command: Command,
	endpoint: string,
	method: "get" | "post",
	rawOptions: Record<string, unknown>,
	meta: CommandMeta = {},
): Promise<void> {
	const cwd = process.cwd();
	const env = process.env;
	const merged = {
		...(command.optsWithGlobals() as Record<string, unknown>),
		...rawOptions,
	};
	const json = merged.json === true;
	const color = merged.ansi !== false;

	configureOutput({ json, color });
	const projectResult = loadProjectSafe(cwd, env);

	try {
		const payload = buildPayload(
			merged,
			command,
			meta,
			projectResult.project,
			env,
		);

		const auth = resolveAuth({
			profile: typeof merged.profile === "string" ? merged.profile : undefined,
			url:
				typeof merged.notployUrl === "string" ? merged.notployUrl : undefined,
			token:
				typeof merged.notployToken === "string"
					? merged.notployToken
					: undefined,
			manifestProfile: projectResult.project?.config.profile,
			env,
			cwd,
		});

		const timeout = resolveTimeout(
			typeof merged.timeout === "string" || typeof merged.timeout === "number"
				? merged.timeout
				: undefined,
			env,
			projectResult.project?.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		);

		const data =
			method === "post"
				? await apiPost(endpoint, payload, { auth, timeout })
				: await apiGet(endpoint, payload, { auth, timeout });

		printResult(data);
	} catch (error) {
		const normalized = normalizeError(error, collectSecretValues(env));
		const manifestExplainsFailure =
			projectResult.error &&
			normalized.code === ExitCode.Usage &&
			normalized.message.startsWith("Missing required option");
		handleCommandError(manifestExplainsFailure ? projectResult.error : error, {
			json,
			secrets: collectSecretValues(env),
		});
	}
}
