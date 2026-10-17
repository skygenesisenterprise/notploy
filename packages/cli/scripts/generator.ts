import * as crypto from "node:crypto";

export interface OpenAPISpec {
	openapi?: string;
	info?: { version?: string; title?: string };
	paths: Record<string, Record<string, OperationObject>>;
	components?: { schemas?: Record<string, SchemaObject> };
	tags?: Array<{ name: string; description?: string }>;
}

export interface OperationObject {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: ParameterObject[];
	requestBody?: {
		content?: {
			"application/json"?: {
				schema?: SchemaObject;
			};
		};
	};
}

export interface ParameterObject {
	name: string;
	in: string;
	required?: boolean;
	schema?: SchemaObject;
	description?: string;
}

export interface SchemaObject {
	$ref?: string;
	type?: string | string[];
	nullable?: boolean;
	properties?: Record<string, SchemaObject>;
	required?: string[];
	items?: SchemaObject;
	enum?: unknown[];
	const?: unknown;
	anyOf?: SchemaObject[];
	oneOf?: SchemaObject[];
	allOf?: SchemaObject[];
	description?: string;
	default?: unknown;
	additionalProperties?: unknown;
}

export type ResolvedType = "string" | "number" | "boolean" | "array" | "object";

export interface ResolvedSchema {
	type: ResolvedType;
	nullable: boolean;
	isNull?: boolean;
	enumValues?: string[];
	description?: string;
	default?: unknown;
}

export interface OptionInfo {
	name: string;
	required: boolean;
	type: ResolvedType;
	nullable: boolean;
	enumValues?: string[];
	description: string;
	flag: string;
	negatedFlag?: string;
}

export interface CommandInfo {
	endpoint: string;
	group: string;
	groupCommand: string;
	groupVariable: string;
	action: string;
	commandName: string;
	method: "get" | "post";
	description: string;
	options: OptionInfo[];
}

export interface GeneratedResult {
	commandsFile: string;
	metaFile: string;
	commandCount: number;
	groupCount: number;
	specHash: string;
}

export class GeneratorError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GeneratorError";
	}
}

const RESERVED_OPTION_NAMES = new Set([
	"json",
	"profile",
	"ansi",
	"notployUrl",
	"notployToken",
	"timeout",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function camelToKebab(value: string): string {
	return value.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function toCommandName(value: string): string {
	const name = camelToKebab(value)
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!name) {
		throw new GeneratorError(`Cannot derive a command name from "${value}".`);
	}
	return name;
}

export function humanize(value: string): string {
	const words = value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim();
	return words ? words.charAt(0).toUpperCase() + words.slice(1) : value;
}

function sanitizeDescription(
	value: string | undefined,
	fallback: string,
): string {
	const cleaned = value?.replace(/\s+/g, " ").trim();
	return cleaned || fallback;
}

function refName(ref: string): string {
	const prefix = "#/components/schemas/";
	if (!ref.startsWith(prefix)) {
		throw new GeneratorError(
			`Unsupported $ref "${ref}". Only local component schemas are supported.`,
		);
	}
	return decodeURIComponent(
		ref.slice(prefix.length).replace(/~1/g, "/").replace(/~0/g, "~"),
	);
}

function mergeRaw(base: SchemaObject, next: SchemaObject): SchemaObject {
	return {
		...base,
		...next,
		type: next.type ?? base.type,
		properties: {
			...(base.properties ?? {}),
			...(next.properties ?? {}),
		},
		required: [
			...new Set([...(base.required ?? []), ...(next.required ?? [])]),
		],
		enum: next.enum ?? base.enum,
		items: next.items ?? base.items,
		anyOf: next.anyOf ?? base.anyOf,
		oneOf: next.oneOf ?? base.oneOf,
		nullable: base.nullable === true || next.nullable === true,
		description: base.description ?? next.description,
	};
}

/**
 * Resolves local $ref and allOf so body properties can be inspected.
 */
export function flattenSchema(
	schema: SchemaObject = {},
	components: Record<string, SchemaObject> = {},
	seen: Set<string> = new Set(),
): SchemaObject {
	if (schema.$ref) {
		const name = refName(schema.$ref);
		if (seen.has(name)) {
			throw new GeneratorError(`Circular $ref detected at "${schema.$ref}".`);
		}
		const target = components[name];
		if (!target) {
			throw new GeneratorError(`Unresolved $ref "${schema.$ref}".`);
		}
		const flattened = flattenSchema(
			target,
			components,
			new Set([...seen, name]),
		);
		return {
			...flattened,
			...schema,
			$ref: undefined,
			description: schema.description ?? flattened.description,
		};
	}

	let result: SchemaObject = { ...schema };
	if (schema.allOf?.length) {
		result = { ...schema, allOf: undefined };
		for (const part of schema.allOf) {
			result = mergeRaw(result, flattenSchema(part, components, seen));
		}
	}

	if (
		!result.properties &&
		!result.items &&
		!result.type &&
		(result.anyOf?.length || result.oneOf?.length)
	) {
		const variants = [...(result.anyOf ?? []), ...(result.oneOf ?? [])];
		for (const variant of variants) {
			const flattened = flattenSchema(variant, components, seen);
			if (flattened.properties || flattened.items || flattened.type) {
				result = mergeRaw(result, flattened);
				break;
			}
		}
	}

	return result;
}

function mapPrimitiveType(type: string | undefined): ResolvedType | undefined {
	switch (type) {
		case "string":
			return "string";
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		case "array":
			return "array";
		case "object":
			return "object";
		default:
			return undefined;
	}
}

function enumStrings(values: unknown[] | undefined): string[] | undefined {
	if (!values?.length) return undefined;
	const strings = values
		.filter((value) => value !== null && value !== undefined)
		.map((value) => String(value));
	return [...new Set(strings)];
}

/**
 * Resolves a property schema into a CLI-safe type plus enum/nullable metadata.
 */
export function resolveSchema(
	schema: SchemaObject = {},
	components: Record<string, SchemaObject> = {},
	seen: Set<string> = new Set(),
): ResolvedSchema {
	if (schema.$ref) {
		const name = refName(schema.$ref);
		if (seen.has(name)) {
			throw new GeneratorError(`Circular $ref detected at "${schema.$ref}".`);
		}
		const target = components[name];
		if (!target) {
			throw new GeneratorError(`Unresolved $ref "${schema.$ref}".`);
		}
		const resolved = resolveSchema(
			target,
			components,
			new Set([...seen, name]),
		);
		return {
			...resolved,
			description: schema.description ?? resolved.description,
			default: schema.default ?? resolved.default,
		};
	}

	const flattened = flattenSchema(schema, components, seen);
	const rawTypes = Array.isArray(flattened.type)
		? flattened.type
		: flattened.type
			? [flattened.type]
			: [];
	let nullable = flattened.nullable === true || rawTypes.includes("null");
	const mainType = rawTypes.find((type) => type !== "null");

	const variants = [...(flattened.anyOf ?? []), ...(flattened.oneOf ?? [])].map(
		(variant) => resolveSchema(variant, components, seen),
	);
	const nonNullVariants = variants.filter((variant) => !variant.isNull);
	if (variants.length !== nonNullVariants.length) {
		nullable = true;
	}

	const isNullOnly =
		rawTypes.length > 0 && rawTypes.every((entry) => entry === "null");

	let type =
		mapPrimitiveType(mainType) ??
		(flattened.properties || flattened.additionalProperties
			? "object"
			: flattened.items
				? "array"
				: undefined);

	if (!type && nonNullVariants.length > 0) {
		const variantTypes = new Set(
			nonNullVariants.map((variant) => variant.type),
		);
		if (variantTypes.size === 1) {
			type = nonNullVariants[0].type;
		}
	}

	const enumValues =
		enumStrings(flattened.enum) ??
		(flattened.const !== undefined ? [String(flattened.const)] : undefined) ??
		(nonNullVariants.flatMap((variant) => variant.enumValues ?? []).length
			? [
					...new Set(
						nonNullVariants.flatMap((variant) => variant.enumValues ?? []),
					),
				]
			: undefined);

	if (!type && enumValues?.length) {
		const first = flattened.enum?.find(
			(value) => value !== null && value !== undefined,
		);
		type = mapPrimitiveType(typeof first) ?? "string";
	}

	return {
		type: type ?? "string",
		nullable: nullable || isNullOnly,
		isNull: isNullOnly,
		enumValues,
		description: flattened.description,
		default: flattened.default,
	};
}

function describeOption(
	name: string,
	resolved: ResolvedSchema,
	required: boolean,
	rawDescription: string | undefined,
): string {
	const parts = [sanitizeDescription(rawDescription, humanize(name))];
	if (required) parts.push("[required]");
	if (resolved.enumValues?.length) {
		parts.push(`(one of: ${resolved.enumValues.join(", ")})`);
	}
	if (resolved.default !== undefined) {
		parts.push(`(default: ${JSON.stringify(resolved.default)})`);
	}
	if (resolved.nullable) {
		parts.push('(nullable: pass "null")');
	}
	if (resolved.type === "array") {
		parts.push("(JSON array)");
	}
	if (resolved.type === "object") {
		parts.push("(JSON object)");
	}
	return parts.join(" ");
}

function buildOption(
	name: string,
	schema: SchemaObject,
	required: boolean,
	components: Record<string, SchemaObject>,
	rawDescription?: string,
): OptionInfo {
	if (RESERVED_OPTION_NAMES.has(name)) {
		throw new GeneratorError(
			`Option "${name}" collides with a global CLI option. Rename the API property or update the reserved option list.`,
		);
	}
	const resolved = resolveSchema(schema, components);
	const flag =
		resolved.type === "boolean"
			? `--${name} [boolean]`
			: resolved.type === "array" || resolved.type === "object"
				? `--${name} <json>`
				: `--${name} <value>`;
	const option: OptionInfo = {
		name,
		required,
		type: resolved.type,
		nullable: resolved.nullable,
		enumValues: resolved.enumValues,
		description: describeOption(name, resolved, required, rawDescription),
		flag,
	};
	if (resolved.type === "boolean" && !required) {
		option.negatedFlag = `--no-${name}`;
	}
	return option;
}

function optionsFromParameters(
	parameters: ParameterObject[],
	components: Record<string, SchemaObject>,
): OptionInfo[] {
	const options: OptionInfo[] = [];
	for (const parameter of parameters) {
		if (parameter.in !== "query") {
			if (parameter.in === "header" || parameter.in === "cookie") {
				continue;
			}
			throw new GeneratorError(
				`Unsupported parameter location "${parameter.in}" for "${parameter.name}".`,
			);
		}
		options.push(
			buildOption(
				parameter.name,
				parameter.schema ?? {},
				parameter.required ?? false,
				components,
				parameter.description,
			),
		);
	}
	return options;
}

function optionsFromBody(
	schema: SchemaObject | undefined,
	components: Record<string, SchemaObject>,
): OptionInfo[] {
	if (!schema) return [];
	const flattened = flattenSchema(schema, components);
	if (!flattened.properties) return [];
	const required = new Set(flattened.required ?? []);
	return Object.entries(flattened.properties).map(([name, property]) =>
		buildOption(
			name,
			property,
			required.has(name),
			components,
			property.description,
		),
	);
}

function groupDescription(spec: OpenAPISpec, group: string): string {
	const tag = spec.tags?.find(
		(entry) =>
			entry.name === group || entry.name.toLowerCase() === group.toLowerCase(),
	);
	return sanitizeDescription(tag?.description, `${group} commands`);
}

/**
 * Parses the spec into the deterministic command model used by the renderer.
 */
export function parseSpec(spec: OpenAPISpec): CommandInfo[] {
	if (!isRecord(spec.paths)) {
		throw new GeneratorError("The OpenAPI document has no paths object.");
	}
	const components = spec.components?.schemas ?? {};
	const commands: CommandInfo[] = [];

	for (const [pathKey, methods] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(methods)) {
			if (method === "parameters" || method === "$ref") continue;
			if (method !== "get" && method !== "post") {
				throw new GeneratorError(
					`Unsupported HTTP method "${method}" for "${pathKey}".`,
				);
			}

			const endpoint = pathKey.replace(/^\//, "");
			const [group, ...rest] = endpoint.split(".");
			const action = rest.join(".");
			if (!group || !action) {
				throw new GeneratorError(
					`Endpoint "${pathKey}" is not in "<group>.<action>" form.`,
				);
			}

			const parameterOptions = optionsFromParameters(
				operation.parameters ?? [],
				components,
			);
			const bodyOptions = optionsFromBody(
				operation.requestBody?.content?.["application/json"]?.schema,
				components,
			);

			const seen = new Set<string>();
			const options: OptionInfo[] = [];
			for (const option of [...parameterOptions, ...bodyOptions]) {
				if (seen.has(option.name)) {
					throw new GeneratorError(
						`Duplicate option "${option.name}" on "${endpoint}".`,
					);
				}
				seen.add(option.name);
				options.push(option);
			}

			commands.push({
				endpoint,
				group,
				groupCommand: toCommandName(group),
				groupVariable: `g_${group.replace(/[^a-zA-Z0-9]/g, "_")}`,
				action,
				commandName: toCommandName(action),
				method,
				description: sanitizeDescription(
					operation.summary ?? operation.description,
					humanize(action),
				),
				options,
			});
		}
	}

	return commands.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function optionLines(option: OptionInfo): string[] {
	const description = JSON.stringify(option.description);
	const lines = [`\t\t.option(${JSON.stringify(option.flag)}, ${description})`];
	if (option.negatedFlag) {
		lines.push(
			`\t\t.option(${JSON.stringify(option.negatedFlag)}, ${JSON.stringify(
				`Set ${option.name} to false`,
			)})`,
		);
	}
	return lines;
}

function metaLiteral(command: CommandInfo): string {
	const required = command.options
		.filter((option) => option.required)
		.map((option) => option.name);
	const types: Record<string, string> = {};
	const enums: Record<string, string[]> = {};

	for (const option of command.options) {
		if (option.type !== "string" || option.nullable) {
			types[option.name] = option.nullable ? `${option.type}?` : option.type;
		}
		if (option.enumValues?.length) {
			enums[option.name] = option.enumValues;
		}
	}

	const parts: string[] = [];
	if (required.length) {
		parts.push(`required: ${JSON.stringify(required)}`);
	}
	if (Object.keys(types).length) {
		const sorted = Object.fromEntries(
			Object.entries(types).sort(([a], [b]) => a.localeCompare(b)),
		);
		parts.push(`types: ${JSON.stringify(sorted)}`);
	}
	if (Object.keys(enums).length) {
		const sorted = Object.fromEntries(
			Object.entries(enums).sort(([a], [b]) => a.localeCompare(b)),
		);
		parts.push(`enums: ${JSON.stringify(sorted)}`);
	}

	return parts.length ? `, { ${parts.join(", ")} }` : "";
}

function renderCommand(command: CommandInfo): string {
	const lines: string[] = [];
	lines.push(`\t${command.groupVariable}`);
	lines.push(`\t\t.command(${JSON.stringify(command.commandName)})`);
	lines.push(`\t\t.description(${JSON.stringify(command.description)})`);
	for (const option of command.options) {
		lines.push(...optionLines(option));
	}
	lines.push(`\t\t.option("--json", "Output machine-readable JSON")`);
	lines.push(`\t\t.option("--profile <name>", "Configuration profile to use")`);
	lines.push("\t\t.action((options, command) =>");
	lines.push(
		`\t\t\trunApiCommand(command, ${JSON.stringify(command.endpoint)}, ${JSON.stringify(command.method)}, options${metaLiteral(command)}),`,
	);
	lines.push("\t\t);");
	return lines.join("\n");
}

function renderGroups(spec: OpenAPISpec, commands: CommandInfo[]): string {
	const groups = new Map<string, CommandInfo[]>();
	for (const command of commands) {
		const entries = groups.get(command.group) ?? [];
		entries.push(command);
		groups.set(command.group, entries);
	}

	const blocks: string[] = [];
	for (const [group, groupCommands] of [...groups.entries()].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		const variable = groupCommands[0].groupVariable;
		const commandName = groupCommands[0].groupCommand;
		blocks.push(
			`\tconst ${variable} = program.command(${JSON.stringify(commandName)}).description(${JSON.stringify(groupDescription(spec, group))});`,
		);
		for (const command of groupCommands) {
			blocks.push(renderCommand(command));
		}
	}
	return blocks.join("\n");
}

export function renderMeta(
	spec: OpenAPISpec,
	specHash: string,
	commandCount: number,
	groupCount: number,
): string {
	return `// Auto-generated from openapi.json — do not edit manually.
// Run: pnpm run generate

export const SPEC_VERSION = ${JSON.stringify(spec.info?.version ?? "unknown")};
export const SPEC_SHA256 = ${JSON.stringify(specHash)};
export const GENERATED_COMMAND_COUNT = ${commandCount};
export const GENERATED_GROUP_COUNT = ${groupCount};
`;
}

export function renderCommands(
	spec: OpenAPISpec,
	specHash: string,
	commands: CommandInfo[],
): string {
	const shortHash = specHash.slice(0, 16);
	const groupCount = new Set(commands.map((command) => command.group)).size;
	return `// Auto-generated from openapi.json (sha256:${shortHash}) — do not edit manually.
// Run: pnpm run generate
//
// ${commands.length} commands in ${groupCount} groups.

import type { Command } from "commander";
import { runApiCommand } from "../commands/run.js";

export function registerGeneratedCommands(program: Command) {
${renderGroups(spec, commands)}
}
`;
}

export function generateFromSpec(
	spec: OpenAPISpec,
	specHash: string,
): GeneratedResult {
	const commands = parseSpec(spec);
	const groupCount = new Set(commands.map((command) => command.group)).size;
	return {
		commandsFile: renderCommands(spec, specHash, commands),
		metaFile: renderMeta(spec, specHash, commands.length, groupCount),
		commandCount: commands.length,
		groupCount,
		specHash,
	};
}

export function hashSpec(source: string | Buffer): string {
	return crypto.createHash("sha256").update(source).digest("hex");
}
