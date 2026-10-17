/**
 * Generates the advanced API catalog and the tool reference from the canonical
 * Notploy OpenAPI document.
 *
 * Usage:
 *   tsx scripts/generate-tools.ts            # write generated files
 *   tsx scripts/generate-tools.ts --check    # fail if any generated file is stale
 *
 * The output is deterministic: operations are sorted by name, no timestamp is
 * embedded, and every metadata field comes from the checked-in spec or from the
 * business capability declarations.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { type JsonSchema, jsonSchemaToZod } from "json-schema-to-zod";
import {
  classifyOperation,
  isAllowedByProfile,
  type OperationLike,
} from "../src/advanced-api/classification.js";
import { businessCapabilities } from "../src/capabilities/index.js";
import type { AdvancedProfile } from "../src/contracts/core.js";

interface OpenAPISpec {
  info?: { version?: string };
  paths: Record<string, Record<string, OperationObject>>;
}

interface OperationObject {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: {
    required?: boolean;
    content: {
      "application/json"?: {
        schema: JsonSchema;
      };
    };
  };
}

interface ParameterObject {
  name: string;
  in: string;
  schema: JsonSchema;
  required?: boolean;
  description?: string;
}

interface NormalizedOperation {
  name: string;
  description: string;
  tag: string;
  method: "GET" | "POST";
  path: string;
  schema: string;
  paramNames: string[];
}

const ROOT = resolve(import.meta.dirname, "..");
const SPEC_PATH = resolve(ROOT, "openapi.json");
const OPERATIONS_PATH = resolve(ROOT, "src/generated/operations.ts");
const META_PATH = resolve(ROOT, "src/generated/meta.ts");
const TOOLS_PATH = resolve(ROOT, "TOOLS.md");
const LEGACY_SPEC_PATH = resolve(ROOT, "src/generated/openapi.json");
const LEGACY_TOOLS_PATH = resolve(ROOT, "src/generated/tools.ts");

const GENERATOR_VERSION = 1;

function firstDifference(expected: string, actual: string): number | undefined {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const max = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < max; index += 1) {
    if (expectedLines[index] !== actualLines[index]) return index + 1;
  }
  return undefined;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function checkFile(path: string, expected: string): boolean {
  if (!existsSync(path)) {
    console.error(`stale: ${relative(ROOT, path)} does not exist`);
    return false;
  }
  const actual = readFileSync(path, "utf8");
  if (actual === expected) return true;
  const line = firstDifference(expected, actual);
  console.error(`stale: ${relative(ROOT, path)} differs${line ? ` at line ${line}` : ""}`);
  return false;
}

function formatTitle(operationId: string): string {
  return operationId
    .split("-")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function schemaProperties(schema: unknown): Record<string, JsonSchema> {
  if (schema === null || typeof schema !== "object") return {};
  const properties = (schema as { properties?: unknown }).properties;
  if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }
  return properties as Record<string, JsonSchema>;
}

function schemaRequired(schema: unknown): string[] {
  if (schema === null || typeof schema !== "object") return [];
  const required = (schema as { required?: unknown }).required;
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === "string")
    : [];
}

function buildInputSchema(operation: OperationObject): string {
  const parameters = operation.parameters ?? [];
  const bodySchema = operation.requestBody?.content["application/json"]?.schema;

  const properties: Record<string, JsonSchema> = {};
  const required = new Set<string>();

  if (bodySchema) {
    Object.assign(properties, schemaProperties(bodySchema));
    for (const name of schemaRequired(bodySchema)) required.add(name);
  }

  for (const parameter of parameters) {
    const parameterSchema =
      typeof parameter.schema === "object" && parameter.schema !== null
        ? {
            ...parameter.schema,
            ...(parameter.description ? { description: parameter.description } : {}),
          }
        : parameter.schema;
    properties[parameter.name] = parameterSchema as JsonSchema;
    if (parameter.required) required.add(parameter.name);
  }

  if (Object.keys(properties).length === 0) return "z.object({})";

  return jsonSchemaToZod(
    {
      type: "object",
      properties,
      ...(required.size > 0 ? { required: [...required].sort() } : {}),
    },
    { zodVersion: 3 },
  );
}

function normalizeOperation(
  path: string,
  method: string,
  operation: OperationObject,
): NormalizedOperation | undefined {
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET" && upperMethod !== "POST") {
    console.warn(`Skipping ${upperMethod} ${path}: unsupported method`);
    return undefined;
  }
  if (!operation.operationId) {
    console.warn(`Skipping ${upperMethod} ${path}: no operationId`);
    return undefined;
  }

  const description = (operation.summary || operation.description || `${upperMethod} ${path}`)
    .replace(/`/g, "'")
    .trim();
  const parameters = operation.parameters ?? [];
  const bodySchema = operation.requestBody?.content["application/json"]?.schema;

  return {
    name: operation.operationId,
    description,
    tag: operation.tags?.[0] ?? "unknown",
    method: upperMethod,
    path,
    schema: buildInputSchema(operation),
    paramNames: [
      ...Object.keys(schemaProperties(bodySchema)),
      ...parameters.map((parameter) => parameter.name),
    ].sort(),
  };
}

function renderOperationsFile(operations: readonly NormalizedOperation[]): string {
  const entries = operations.map((operation) => {
    const classification = classifyOperation(operation);
    return `  {
    name: ${JSON.stringify(operation.name)},
    description: ${JSON.stringify(operation.description)},
    tag: ${JSON.stringify(operation.tag)},
    method: ${JSON.stringify(operation.method)},
    path: ${JSON.stringify(operation.path)},
    schema: ${operation.schema},
    annotations: {
      title: ${JSON.stringify(formatTitle(operation.name))},
      readOnlyHint: ${classification.effects.readOnly},
      destructiveHint: ${classification.effects.destructive},
      idempotentHint: ${classification.effects.idempotent},
      openWorldHint: true,
    },
  }`;
  });

  return `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated from openapi.json. Run \`pnpm generate\` to regenerate.
// Regeneration is checked in CI with \`pnpm generate:check\`.

import { z } from "zod";
import type { GeneratedApiOperation } from "../contracts/generated.js";

export const generatedOperations: GeneratedApiOperation[] = [
${entries.join(",\n")},
];
`;
}

function renderMetaFile(specVersion: string, specHash: string, operationCount: number): string {
  return `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated from openapi.json. Run \`pnpm generate\` to regenerate.

export const generatedMetadata = {
  generator: "notploy-mcp/openapi",
  generatorVersion: ${GENERATOR_VERSION},
  specVersion: ${JSON.stringify(specVersion)},
  specHash: ${JSON.stringify(specHash)},
  operationCount: ${operationCount},
} as const;
`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderToolsMarkdown(
  operations: readonly NormalizedOperation[],
  specVersion: string,
): string {
  const profiles: AdvancedProfile[] = ["read-only", "deploy", "full"];
  const lines: string[] = [
    "# Notploy MCP catalog",
    "",
    "> Generated from [`openapi.json`](openapi.json) (version " +
      `${specVersion}) and the business capability declarations. Run \`pnpm generate\` to update; CI runs \`pnpm generate:check\` and fails on drift. Do not edit this file manually.`,
    "",
    `- **Business capabilities (default mode)**: ${businessCapabilities.length}`,
    `- **Generated API operations (advanced mode)**: ${operations.length}`,
    "",
    "## Modes",
    "",
    "- `business` (default): workflow-oriented capabilities listed below. Use it for discovery, diagnostics and controlled deployments.",
    "- `advanced`: generated OpenAPI operations, filtered by `NOTPLOY_MCP_ADVANCED_PROFILE` and optional tags. It is opt-in and never enabled by default.",
    "- `all`: both catalogs.",
    "",
    "Catalog filters are a usability feature. Every call is re-authorized at execution time against the credential's effective permissions and the configured risk/approval policy.",
    "",
    "## Business capabilities",
    "",
    "| Tool | Category | Risk | Permissions | Long-running |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const capability of businessCapabilities) {
    const permissions =
      capability.permissions.length > 0
        ? capability.permissions
            .map((requirement) => `${requirement.resource}:${requirement.actions.join("|")}`)
            .join(", ")
        : "API-enforced";
    lines.push(
      `| \`${capability.name}\` | ${capability.category} | ${capability.risk} | ${escapeCell(permissions)} | ${capability.effects.longRunning ? "yes" : "no"} |`,
    );
  }

  lines.push("", "### Capability details", "");

  for (const capability of businessCapabilities) {
    lines.push(`#### \`${capability.name}\` — ${capability.title}`, "");
    lines.push(capability.description, "");
    lines.push(
      `- Risk: **${capability.risk}** (${capability.effects.readOnly ? "read-only" : capability.effects.destructive ? "destructive" : "mutation"})`,
      `- Environments: ${capability.environments.join(", ")}`,
      `- Status: ${capability.status} (contract version ${capability.version})`,
      `- Idempotent: ${capability.effects.idempotent ? "yes" : "no"}; idempotency key: ${capability.effects.supportsIdempotencyKey ? "supported" : "not supported"}; long-running: ${capability.effects.longRunning ? "yes" : "no"}`,
    );
    for (const precondition of capability.preconditions ?? []) {
      lines.push(`- Precondition: ${precondition}`);
    }
    for (const limitation of capability.limitations ?? []) {
      lines.push(`- Limitation: ${limitation}`);
    }
    lines.push("");
  }

  lines.push(
    "## Advanced API operations",
    "",
    "The table lists every operation generated from the OpenAPI document, its risk classification and the profiles that expose it. Risk is metadata: the Notploy API still enforces the credential's permissions, and high-risk operations require an approval token.",
    "",
    "| Tool | Method | Tag | Risk | Destructive | read-only | deploy | full |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const operation of operations) {
    const classification = classifyOperation(operation as OperationLike);
    const allowed = profiles.map((profile) =>
      isAllowedByProfile(profile, operation as OperationLike, classification) ? "yes" : "no",
    );
    lines.push(
      `| \`${operation.name}\` | ${operation.method} | ${escapeCell(operation.tag)} | ${classification.risk} | ${classification.effects.destructive ? "yes" : "no"} | ${allowed[0] ?? "no"} | ${allowed[1] ?? "no"} | ${allowed[2] ?? "no"} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function main(): void {
  if (!existsSync(SPEC_PATH)) {
    console.error(`Missing OpenAPI document at ${SPEC_PATH}`);
    process.exitCode = 1;
    return;
  }

  const rawSpec = readFileSync(SPEC_PATH, "utf8");
  const spec = JSON.parse(rawSpec) as OpenAPISpec;
  const specHash = createHash("sha256").update(rawSpec).digest("hex");
  const specVersion = spec.info?.version ?? "unknown";

  const operations: NormalizedOperation[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const normalized = normalizeOperation(path, method, operation);
      if (normalized) operations.push(normalized);
    }
  }
  operations.sort((a, b) => a.name.localeCompare(b.name));

  const files = [
    { path: OPERATIONS_PATH, content: renderOperationsFile(operations) },
    { path: META_PATH, content: renderMetaFile(specVersion, specHash, operations.length) },
    { path: TOOLS_PATH, content: renderToolsMarkdown(operations, specVersion) },
  ];

  const check = process.argv.includes("--check");
  if (check) {
    const results = files.map((file) => checkFile(file.path, file.content));
    if (results.some((upToDate) => !upToDate)) {
      console.error("Run 'pnpm run generate' and commit the result.");
      process.exitCode = 1;
      return;
    }
    console.log(
      `Generated output is up to date (${operations.length} operations, ${businessCapabilities.length} business capabilities).`,
    );
    return;
  }

  for (const file of files) writeFile(file.path, file.content);

  // Remove the pre-refactor duplicates so a single document and a single
  // generated module remain authoritative.
  for (const legacyPath of [LEGACY_SPEC_PATH, LEGACY_TOOLS_PATH]) {
    if (existsSync(legacyPath)) unlinkSync(legacyPath);
  }

  console.log(
    `Generated ${operations.length} API operations and ${businessCapabilities.length} business capabilities.`,
  );
  console.log(
    `Wrote ${relative(ROOT, OPERATIONS_PATH)}, ${relative(ROOT, META_PATH)} and TOOLS.md.`,
  );
}

main();
