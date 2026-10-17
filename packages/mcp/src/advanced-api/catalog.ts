import { z } from "zod";
import type { McpConfig } from "../config.js";
import type { AnyCapability } from "../contracts/capability.js";
import { defineCapability } from "../contracts/capability.js";
import type { AdvancedProfile, Environment, RiskLevel } from "../contracts/core.js";
import type { GeneratedApiOperation } from "../contracts/generated.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";
import { classifyOperation, isAllowedByProfile, LEGACY_TOOL_PRESETS } from "./classification.js";

const LARGE_ADVANCED_TOOLSET_THRESHOLD = 150;

const approvalTokenSchema = z
  .string()
  .min(1)
  .max(512)
  .optional()
  .describe(
    "Operator-provided approval token required for high-impact operations. It is verified server-side and never logged or returned.",
  );

export interface AdvancedCatalogSummary {
  profile: AdvancedProfile;
  totalGenerated: number;
  selected: number;
  enabledTags: string[];
  disabledTags: string[];
  excludedOperations: string[];
  usedLegacySelection: boolean;
}

export interface AdvancedCatalogResult {
  capabilities: AnyCapability[];
  warnings: string[];
  summary: AdvancedCatalogSummary;
}

function formatTitle(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDescription(operation: GeneratedApiOperation, risk: RiskLevel): string {
  const raw = operation.description?.trim();
  const summary =
    raw && !/^(GET|POST)\s+\//i.test(raw) ? raw : `${operation.method} ${operation.path}`;
  return `${summary}\n\nAdvanced API operation (${operation.method} ${operation.path}, tag "${operation.tag}", risk ${risk}). Prefer a business-domain capability when one covers the same goal. The Notploy API enforces the credential's permissions; the MCP server additionally applies risk and approval policy.`;
}

function toAdvancedCapability(
  operation: GeneratedApiOperation,
  risk: RiskLevel,
  environments: readonly Environment[],
  effects: {
    readOnly: boolean;
    destructive: boolean;
    idempotent: boolean;
    supportsIdempotencyKey: boolean;
    longRunning: boolean;
  },
): AnyCapability {
  const title = operation.annotations?.title ?? formatTitle(operation.name);
  const inputSchema =
    risk >= 2 ? operation.schema.extend({ approvalToken: approvalTokenSchema }) : operation.schema;

  return defineCapability({
    name: operation.name,
    title,
    description: buildDescription(operation, risk),
    category: "api",
    mode: "advanced",
    source: "generated",
    version: "1.0.0",
    status: "available",
    environments,
    risk,
    // Generated operations do not declare resource permissions: the API's own
    // authorization remains authoritative for them. Risk and approval policy
    // are still enforced here, and catalog filters are never a security boundary.
    permissions: [],
    effects,
    inputSchema,
    outputSchema: toolResultEnvelopeShape(),
    annotations: {
      title,
      readOnlyHint: effects.readOnly,
      destructiveHint: effects.destructive,
      idempotentHint: effects.idempotent,
      openWorldHint: true,
    },
    preconditions: [
      "The API key's identity must be allowed to call this operation; the Notploy API enforces its own permissions.",
    ],
    limitations: [
      "Generated from OpenAPI; availability can differ between Self, Cloud and Console deployments.",
      "Advanced operations are not tracked as long-running MCP operations; use the business catalog when operation tracking is required.",
    ],
    execute: async (input, context) => {
      const payload: Record<string, unknown> = { ...input };
      delete payload.approvalToken;

      const data = await context.api.request<unknown>({
        method: operation.method,
        path: operation.path,
        ...(operation.method === "GET" ? { params: payload } : { body: payload }),
        idempotent: operation.method === "GET",
        signal: context.signal,
      });

      return { data };
    },
  });
}

function parseTagList(values: readonly string[]): Set<string> {
  return new Set(values.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

function resolveEnabledTags(config: McpConfig, warnings: string[]): Set<string> | null {
  const advancedTags = parseTagList(config.advanced.enabledTags);
  if (advancedTags.size > 0) return advancedTags;

  const legacyTags = parseTagList(config.legacySelection.enabledTags);
  if (legacyTags.size > 0) return legacyTags;

  const presetName = config.legacySelection.preset?.trim().toLowerCase();
  if (!presetName) return null;

  const preset = LEGACY_TOOL_PRESETS[presetName];
  if (preset === undefined) {
    warnings.push(
      `Unknown NOTPLOY_TOOL_PRESET "${presetName}"; the advanced catalog exposes all operations allowed by the profile.`,
    );
    return null;
  }
  return preset === null ? null : parseTagList(preset);
}

/**
 * Builds the opt-in advanced catalog.
 *
 * Selection order: explicit advanced tags, legacy enabled tags, legacy preset.
 * Disabled tags and excluded operations are always applied afterwards.
 */
export function buildAdvancedCatalog(
  operations: readonly GeneratedApiOperation[],
  config: McpConfig,
): AdvancedCatalogResult {
  const warnings: string[] = [];
  const summary: AdvancedCatalogSummary = {
    profile: config.advanced.profile,
    totalGenerated: operations.length,
    selected: 0,
    enabledTags: [],
    disabledTags: [],
    excludedOperations: [...config.advanced.excludedOperations],
    usedLegacySelection:
      config.advanced.enabledTags.length === 0 &&
      (config.legacySelection.enabledTags.length > 0 ||
        config.legacySelection.disabledTags.length > 0 ||
        config.legacySelection.preset !== undefined),
  };

  if (summary.usedLegacySelection) {
    warnings.push(
      "NOTPLOY_TOOL_PRESET / NOTPLOY_ENABLED_TAGS / NOTPLOY_DISABLED_TAGS are deprecated for MCP. Use NOTPLOY_MCP_ADVANCED_TAGS / NOTPLOY_MCP_ADVANCED_DISABLED_TAGS; the legacy variables are still honored.",
    );
  }

  const enabledTags = resolveEnabledTags(config, warnings);
  const disabledTags = new Set([
    ...parseTagList(config.advanced.disabledTags),
    ...parseTagList(config.legacySelection.disabledTags),
  ]);
  const excluded = new Set(
    config.advanced.excludedOperations.map((name) => name.trim().toLowerCase()),
  );
  summary.enabledTags = enabledTags ? [...enabledTags] : [];
  summary.disabledTags = [...disabledTags];

  const capabilities: AnyCapability[] = [];

  for (const operation of operations) {
    const classification = classifyOperation(operation);
    if (!isAllowedByProfile(summary.profile, operation, classification)) continue;

    const tag = operation.tag.toLowerCase();
    if (enabledTags && !enabledTags.has(tag)) continue;
    if (disabledTags.has(tag)) continue;
    if (excluded.has(operation.name.toLowerCase())) continue;

    capabilities.push(
      toAdvancedCapability(
        operation,
        classification.risk,
        classification.environments,
        classification.effects,
      ),
    );
  }

  summary.selected = capabilities.length;

  if (capabilities.length > LARGE_ADVANCED_TOOLSET_THRESHOLD) {
    warnings.push(
      `${capabilities.length} advanced operations are exposed. Some MCP clients or LLM providers time out on large toolsets; use NOTPLOY_MCP_ADVANCED_PROFILE or tag filters to narrow the catalog.`,
    );
  }
  if (capabilities.length === 0) {
    warnings.push("The advanced catalog selection exposes no operation with the current filters.");
  }

  return { capabilities, warnings, summary };
}
