import type { ZodObject, ZodRawShape } from "zod";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AnyCapability } from "../contracts/capability.js";
import { describePermission } from "../contracts/core.js";
import { effectiveRisk } from "../policies/engine.js";

const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";

function stripNestedSchemaKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) stripNestedSchemaKeys(item);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === "$schema") {
      delete record[key];
    } else {
      stripNestedSchemaKeys(record[key]);
    }
  }
}

// Provider schema validators (OpenAI, Anthropic strict, DeepSeek) accept only a
// conservative subset of ECMA-262: lookarounds and loosely-escaped character
// classes are rejected even though JS allows them. Lookarounds compile under
// the strict "v" flag, so they need their own check; everything else is caught
// by the "v" compile test.
function usesUnsupportedRegexSyntax(pattern: unknown): boolean {
  if (typeof pattern !== "string") return false;
  if (/\(\?<?[=!]/.test(pattern)) return true;
  try {
    new RegExp(pattern, "v");
    return false;
  } catch {
    return true;
  }
}

function stripUnsupportedRegexPatterns(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) stripUnsupportedRegexPatterns(item);
    return;
  }

  const record = value as Record<string, unknown>;
  if (usesUnsupportedRegexSyntax(record.pattern)) {
    delete record.pattern;
  }

  for (const child of Object.values(record)) {
    stripUnsupportedRegexPatterns(child);
  }
}

/**
 * Claude and several providers require JSON Schema draft 2020-12. The MCP SDK's
 * built-in Zod converter emits draft-07, so tool listing is served from
 * pre-converted schemas with a custom list handler.
 *
 * See https://github.com/skygenesisenterprise/notploy/issues/32
 */
export function toDraft2020_12JsonSchema(schema: ZodObject<ZodRawShape>): Record<string, unknown> {
  const result = zodToJsonSchema(schema, {
    target: "jsonSchema2019-09",
    strictUnions: true,
  }) as Record<string, unknown>;

  stripNestedSchemaKeys(result);
  stripUnsupportedRegexPatterns(result);
  result.$schema = JSON_SCHEMA_2020_12;
  return result;
}

const outputSchemaCache = new WeakMap<AnyCapability, Record<string, unknown>>();
const inputSchemaCache = new WeakMap<AnyCapability, Record<string, unknown>>();

export function capabilityInputSchema(capability: AnyCapability): Record<string, unknown> {
  let schema = inputSchemaCache.get(capability);
  if (!schema) {
    schema = toDraft2020_12JsonSchema(capability.inputSchema);
    inputSchemaCache.set(capability, schema);
  }
  return schema;
}

export function capabilityOutputSchema(capability: AnyCapability): Record<string, unknown> {
  let schema = outputSchemaCache.get(capability);
  if (!schema) {
    schema = toDraft2020_12JsonSchema(z.object(capability.outputSchema));
    outputSchemaCache.set(capability, schema);
  }
  return schema;
}

export interface ToolListEntry {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: AnyCapability["annotations"];
  _meta: Record<string, unknown>;
}

/** Self-describing catalog entry exposed through `tools/list`. */
export function toToolListEntry(capability: AnyCapability): ToolListEntry {
  const risk = effectiveRisk(capability);
  return {
    name: capability.name,
    title: capability.title,
    description: capability.description,
    inputSchema: capabilityInputSchema(capability),
    outputSchema: capabilityOutputSchema(capability),
    annotations: capability.annotations,
    _meta: {
      "notploy/mode": capability.mode,
      "notploy/source": capability.source,
      "notploy/risk": risk,
      "notploy/environments": [...capability.environments],
      "notploy/permissions": capability.permissions.map(describePermission),
      "notploy/version": capability.version,
      "notploy/status": capability.status,
      "notploy/effects": capability.effects,
      "notploy/approvalRequired": risk >= 2,
    },
  };
}
