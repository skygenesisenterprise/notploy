/**
 * Shared primitives for the MCP capability model.
 *
 * These types are deliberately small and dependency-free so that the catalog,
 * the policy engine and the execution layer can all agree on them without
 * importing each other.
 */

export const ENVIRONMENTS = ["self", "cloud", "console"] as const;

/**
 * The Notploy product an MCP server talks to.
 *
 * The environment is resolved from server-side configuration
 * (`NOTPLOY_MCP_ENVIRONMENT`) and is never accepted from a tool argument.
 */
export type Environment = (typeof ENVIRONMENTS)[number];

export const RISK_LEVELS = [0, 1, 2, 3] as const;

/**
 * Risk classification for an exposed capability.
 *
 * - 0: read-only inspection.
 * - 1: reversible write with limited impact (restart, configuration update).
 * - 2: high impact, destructive or infrastructure-affecting action.
 * - 3: forbidden in every context.
 */
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LABELS: Record<RiskLevel, string> = {
  0: "read-only",
  1: "reversible-write",
  2: "high-impact",
  3: "forbidden",
};

export const CATALOG_MODES = ["business", "advanced", "all"] as const;
export type CatalogMode = (typeof CATALOG_MODES)[number];

export const ADVANCED_PROFILES = ["read-only", "deploy", "full"] as const;
export type AdvancedProfile = (typeof ADVANCED_PROFILES)[number];

/** Effective permissions returned by `user.getPermissions`. */
export type ResolvedPermissions = Record<string, Record<string, boolean>>;

export interface PermissionRequirement {
  resource: string;
  actions: readonly string[];
}

export function describePermission(requirement: PermissionRequirement): string {
  return `${requirement.resource}:${requirement.actions.join("|")}`;
}

export function hasPermission(
  permissions: ResolvedPermissions,
  requirement: PermissionRequirement,
): boolean {
  const resource = permissions[requirement.resource];
  if (!resource) return false;
  return requirement.actions.every((action) => resource[action] === true);
}
