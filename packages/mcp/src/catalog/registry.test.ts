import { describe, expect, it } from "vitest";
import { loadConfig, type McpConfig } from "../config.js";
import type { CatalogMode } from "../contracts/core.js";
import { generatedMetadata } from "../generated/meta.js";
import { generatedOperations } from "../generated/operations.js";
import { buildCatalog, CapabilityRegistry } from "./registry.js";

function config(overrides: Partial<McpConfig> = {}): McpConfig {
  const base = loadConfig({
    NOTPLOY_URL: "https://notploy.example.com",
    NOTPLOY_API_KEY: "test-api-key-12345678",
  } as NodeJS.ProcessEnv);
  return {
    ...base,
    ...overrides,
    advanced: { ...base.advanced, ...(overrides.advanced ?? {}) },
    legacySelection: { ...base.legacySelection, ...(overrides.legacySelection ?? {}) },
  };
}

function mode(modeValue: CatalogMode, extra: Partial<McpConfig> = {}): McpConfig {
  return config({ mode: modeValue, ...extra });
}

describe("generated operations", () => {
  it("matches the generated metadata and has unique names", () => {
    expect(generatedOperations).toHaveLength(generatedMetadata.operationCount);
    const names = new Set(generatedOperations.map((operation) => operation.name));
    expect(names.size).toBe(generatedOperations.length);
  });
});

describe("buildCatalog", () => {
  it("exposes only business capabilities by default", () => {
    const catalog = buildCatalog(config());
    expect(catalog.summary.mode).toBe("business");
    expect(catalog.summary.advancedCount).toBe(0);
    expect(catalog.summary.businessCount).toBeGreaterThan(10);
    expect(catalog.capabilities.map((capability) => capability.name)).toContain("list_projects");
    expect(catalog.capabilities.map((capability) => capability.name)).not.toContain(
      "application-create",
    );
  });

  it("exposes only generated operations in advanced mode", () => {
    const catalog = buildCatalog(mode("advanced"));
    expect(catalog.summary.businessCount).toBe(0);
    expect(catalog.summary.advancedCount).toBeGreaterThan(0);
    expect(catalog.capabilities.every((capability) => capability.mode === "advanced")).toBe(true);
  });

  it("exposes both catalogs in all mode", () => {
    const business = buildCatalog(config());
    const advanced = buildCatalog(mode("advanced"));
    const all = buildCatalog(mode("all"));
    expect(all.summary.total).toBe(business.summary.total + advanced.summary.total);
  });

  it("keeps the default advanced profile read-only", () => {
    const catalog = buildCatalog(mode("advanced"));
    expect(catalog.capabilities.length).toBeGreaterThan(0);
    expect(catalog.capabilities.every((capability) => capability.risk === 0)).toBe(true);
    expect(catalog.capabilities.every((capability) => capability.effects.readOnly)).toBe(true);
  });

  it("exposes fewer operations in the deploy profile than in full", () => {
    const deploy = buildCatalog(
      mode("advanced", { advanced: { ...config().advanced, profile: "deploy" } }),
    );
    const full = buildCatalog(
      mode("advanced", { advanced: { ...config().advanced, profile: "full" } }),
    );
    expect(deploy.summary.advancedCount).toBeGreaterThan(0);
    expect(deploy.summary.advancedCount).toBeLessThan(full.summary.advancedCount);
    expect(full.summary.advancedCount).toBe(generatedOperations.length);
  });

  it("never exposes destructive operations in the deploy profile", () => {
    const catalog = buildCatalog(
      mode("advanced", { advanced: { ...config().advanced, profile: "deploy" } }),
    );
    expect(catalog.capabilities.some((capability) => capability.effects.destructive)).toBe(false);
  });

  it("applies tag filters and exclusions", () => {
    const catalog = buildCatalog(
      mode("advanced", {
        advanced: {
          ...config().advanced,
          profile: "full",
          enabledTags: ["project"],
          disabledTags: [],
          excludedOperations: ["project-remove"],
        },
      }),
    );
    expect(catalog.capabilities.length).toBeGreaterThan(0);
    expect(catalog.capabilities.every((capability) => capability.source === "generated")).toBe(
      true,
    );
    expect(catalog.capabilities.map((capability) => capability.name)).not.toContain(
      "project-remove",
    );
  });

  it("supports legacy presets for existing configurations", () => {
    const catalog = buildCatalog(
      mode("advanced", {
        advanced: { ...config().advanced, profile: "full" },
        legacySelection: { preset: "minimal", enabledTags: [], disabledTags: [] },
      }),
    );
    expect(catalog.capabilities.length).toBeGreaterThan(0);
    expect(
      catalog.capabilities.every((capability) =>
        ["application", "project"].includes(capability.name.split("-")[0] ?? ""),
      ),
    ).toBe(true);
  });

  it("honors legacy enabled and disabled tags", () => {
    const catalog = buildCatalog(
      mode("advanced", {
        advanced: { ...config().advanced, profile: "full" },
        legacySelection: {
          enabledTags: ["project", "application"],
          disabledTags: ["application"],
        },
      }),
    );
    expect(catalog.capabilities.length).toBeGreaterThan(0);
    expect(catalog.capabilities.every((capability) => capability.name.startsWith("project-"))).toBe(
      true,
    );
  });

  it("warns when a legacy preset is unknown", () => {
    const catalog = buildCatalog(
      mode("advanced", {
        advanced: { ...config().advanced, profile: "read-only" },
        legacySelection: { preset: "unknown", enabledTags: [], disabledTags: [] },
      }),
    );
    expect(
      catalog.warnings.some((warning) => warning.includes("Unknown NOTPLOY_TOOL_PRESET")),
    ).toBe(true);
  });
});

describe("CapabilityRegistry", () => {
  it("indexes capabilities and rejects duplicate names", () => {
    const catalog = buildCatalog(config());
    const registry = new CapabilityRegistry(catalog.capabilities);
    expect(registry.get("list_projects")).toBeDefined();
    expect(registry.size).toBe(catalog.capabilities.length);
    expect(
      () => new CapabilityRegistry([catalog.capabilities[0]!, catalog.capabilities[0]!]),
    ).toThrow(/Duplicate MCP capability name/);
  });
});
