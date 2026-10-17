import type { CapabilityEffects } from "../contracts/capability.js";
import type { AdvancedProfile, Environment, RiskLevel } from "../contracts/core.js";

export interface OperationClassification {
  risk: RiskLevel;
  effects: CapabilityEffects;
  environments: readonly Environment[];
}

/** Minimal shape needed to classify an operation (generated file or docs). */
export interface OperationLike {
  name: string;
  tag: string;
  method: "GET" | "POST";
}

export const ADVANCED_ENVIRONMENTS: readonly Environment[] = ["self", "cloud", "console"];

/**
 * Explicit classification overrides.
 *
 * The default classifier is conservative but coarse. These entries document
 * operations whose name or HTTP method alone would be misleading. Overrides
 * change *risk metadata only*; they never grant access.
 */
export const RISK_OVERRIDES: Readonly<Record<string, RiskLevel>> = {
  "application-deployNginxQuickstart": 2,
  "application-reload": 1,
  "application-start": 1,
  "application-stop": 1,
  "application-markRunning": 1,
  "application-refreshToken": 1,
  "deployment-cancelDeployment": 1,
  "project-duplicate": 1,
  "settings-health": 0,
  "settings-isCloud": 0,
  "settings-getOpenApiDocument": 0,
  "user-getPermissions": 0,
  "user-session": 0,
};

const DESTRUCTIVE_TOKENS = [
  "delete",
  "remove",
  "drop",
  "prune",
  "clean",
  "destroy",
  "kill",
  "clear",
] as const;

/**
 * Tags whose mutations affect the platform, credentials or permissions rather
 * than a single application. A mutation in one of these groups is high impact.
 */
export const HIGH_RISK_TAGS = new Set([
  "admin",
  "settings",
  "server",
  "cluster",
  "security",
  "licensekey",
  "sshkey",
  "registry",
  "vaultprovider",
  "dnsprovider",
  "networkprovider",
  "customrole",
  "user",
  "auditlog",
  "destination",
  "objectstorage",
  "backup",
  "volumebackups",
]);

const HIGH_RISK_TOKENS = [
  "deploy",
  "redeploy",
  "rollback",
  "restore",
  "setup",
  "toggle",
  "reload",
  "rotate",
  "generatetoken",
  "createapikey",
  "savesshprivatekey",
  "updatetraefik",
] as const;

const IDEMPOTENT_TOKENS = [
  "update",
  "save",
  "set",
  "assign",
  "markrunning",
  "reload",
  "start",
  "stop",
  "remove",
  "delete",
  "clean",
  "prune",
  "kill",
  "cancel",
] as const;

/** Tags that form the deployment workflow for the `deploy` advanced profile. */
export const DEPLOY_PROFILE_TAGS = new Set([
  "project",
  "environment",
  "application",
  "compose",
  "deployment",
  "domain",
  "server",
  "registry",
  "sshkey",
  "gitprovider",
  "github",
  "gitlab",
  "bitbucket",
  "gitea",
  "rollbacks",
  "previewdeployment",
]);

export const LEGACY_TOOL_PRESETS: Readonly<Record<string, readonly string[] | null>> = {
  all: null,
  minimal: ["project", "application"],
  core: ["project", "server", "application"],
  deploy: ["project", "environment", "server", "application", "compose", "domain", "deployment"],
  databases: ["postgres", "redis", "mysql", "mariadb", "mongo", "libsql"],
  git: ["github", "gitlab", "bitbucket", "gitea", "gitprovider", "registry", "sshkey"],
};

function containsToken(name: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => name.includes(token));
}

/**
 * Classifies a generated operation.
 *
 * - GET is always read-only (risk 0).
 * - Destructive name tokens are risk 2 and flagged destructive.
 * - Platform, credential and permission mutations are risk 2.
 * - Deployment operations are risk 2.
 * - Any other mutation is risk 1.
 *
 * This is metadata. The executor still re-authorizes every call against the
 * identity's effective permissions and the configured policy.
 */
export function classifyOperation(operation: OperationLike): OperationClassification {
  const name = operation.name.toLowerCase();
  const tag = operation.tag.toLowerCase();
  const readOnly = operation.method === "GET";
  const destructive = !readOnly && containsToken(name, DESTRUCTIVE_TOKENS);
  const override = RISK_OVERRIDES[operation.name];

  let risk: RiskLevel;
  if (readOnly) {
    risk = override ?? 0;
  } else if (destructive) {
    risk = 2;
  } else if (override !== undefined) {
    risk = override;
  } else if (HIGH_RISK_TAGS.has(tag)) {
    risk = 2;
  } else if (containsToken(name, HIGH_RISK_TOKENS)) {
    risk = 2;
  } else {
    risk = 1;
  }

  const effects: CapabilityEffects = {
    readOnly,
    destructive,
    idempotent: readOnly || (!destructive && containsToken(name, IDEMPOTENT_TOKENS)),
    supportsIdempotencyKey: false,
    // Generated operations call the API directly; they are not tracked as
    // server-side operations. Use a business capability for that.
    longRunning: false,
  };

  return { risk, effects, environments: ADVANCED_ENVIRONMENTS };
}

export function isAllowedByProfile(
  profile: AdvancedProfile,
  operation: OperationLike,
  classification: OperationClassification,
): boolean {
  if (profile === "full") return true;
  if (classification.risk === 0) return true;
  if (profile === "read-only") return false;

  // deploy: non-destructive mutations that belong to the deployment workflow.
  if (classification.effects.destructive) return false;
  return DEPLOY_PROFILE_TAGS.has(operation.tag.toLowerCase()) && classification.risk <= 2;
}
