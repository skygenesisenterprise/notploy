import { type AdvancedCatalogSummary, buildAdvancedCatalog } from "../advanced-api/catalog.js";
import { businessCapabilities } from "../capabilities/index.js";
import type { McpConfig } from "../config.js";
import type { AnyCapability } from "../contracts/capability.js";
import type { CatalogMode } from "../contracts/core.js";
import type { GeneratedApiOperation } from "../contracts/generated.js";
import { generatedOperations } from "../generated/operations.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Catalog");

export interface CatalogSummary {
  mode: CatalogMode;
  businessCount: number;
  advancedCount: number;
  total: number;
  advanced: AdvancedCatalogSummary | null;
}

export interface Catalog {
  capabilities: AnyCapability[];
  warnings: string[];
  summary: CatalogSummary;
}

/**
 * Assembles the catalog for the configured mode.
 *
 * `business` is the default. `advanced` exposes the generated OpenAPI surface
 * behind an explicit profile. `all` exposes both. Filters only decide what is
 * listed; the executor never trusts this selection for authorization.
 */
export function buildCatalog(
  config: McpConfig,
  operations: readonly GeneratedApiOperation[] = generatedOperations,
): Catalog {
  const includeBusiness = config.mode !== "advanced";
  const includeAdvanced = config.mode !== "business";

  const business = includeBusiness ? [...businessCapabilities] : [];
  const advanced = includeAdvanced
    ? buildAdvancedCatalog(operations, config)
    : { capabilities: [], warnings: [], summary: null };

  const capabilities = [...business, ...advanced.capabilities];
  const warnings = [...advanced.warnings];

  const summary: CatalogSummary = {
    mode: config.mode,
    businessCount: business.length,
    advancedCount: advanced.capabilities.length,
    total: capabilities.length,
    advanced: advanced.summary,
  };

  logger.info("Loaded MCP catalog", { ...summary });
  for (const warning of warnings) logger.warn(warning);

  return { capabilities, warnings, summary };
}

/**
 * Name-indexed capability registry with duplicate detection.
 *
 * The registry answers "what can be offered to this client". It is not an
 * authorization source: `ToolExecutor` re-evaluates permissions and policy on
 * every call.
 */
export class CapabilityRegistry {
  private readonly byName = new Map<string, AnyCapability>();

  constructor(private readonly capabilities: readonly AnyCapability[]) {
    for (const capability of capabilities) {
      if (this.byName.has(capability.name)) {
        throw new Error(`Duplicate MCP capability name: ${capability.name}`);
      }
      this.byName.set(capability.name, capability);
    }
  }

  get(name: string): AnyCapability | undefined {
    return this.byName.get(name);
  }

  list(): readonly AnyCapability[] {
    return this.capabilities;
  }

  get size(): number {
    return this.capabilities.length;
  }
}
