import { createHash, timingSafeEqual } from "node:crypto";
import type { AnyCapability } from "../contracts/capability.js";
import {
  describePermission,
  hasPermission,
  type ResolvedPermissions,
  type RiskLevel,
} from "../contracts/core.js";
import { allow, deny, type PolicyConfig, type PolicyDecision } from "../contracts/policy.js";

export interface PolicyEvaluationInput {
  capability: AnyCapability;
  permissions: ResolvedPermissions;
  approvalToken?: string;
}

function tokenMatches(expected: string, supplied: string | undefined): boolean {
  if (!supplied) return false;
  // Hashing first gives both buffers the same length, which `timingSafeEqual`
  // requires, without leaking the token length through timing.
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

/**
 * Effective risk, defended against inconsistent metadata.
 *
 * A destructive or long-running capability is never treated as low risk even if
 * its declaration is wrong; misclassification therefore fails closed.
 */
export function effectiveRisk(capability: AnyCapability): RiskLevel {
  const minimum = capability.effects.destructive ? 2 : 0;
  return Math.max(capability.risk, minimum) as RiskLevel;
}

/**
 * Central authorization policy.
 *
 * Catalog filtering is a usability feature; this function is the policy
 * boundary. It is invoked on every execution, after the effective permissions
 * have been resolved from the API, and approval never replaces a permission.
 */
export function evaluatePolicy(config: PolicyConfig, input: PolicyEvaluationInput): PolicyDecision {
  const { capability, permissions } = input;
  const risk = effectiveRisk(capability);

  if (config.blockedCapabilities.has(capability.name)) {
    return deny(
      "policy_denied",
      `The capability "${capability.name}" is blocked by NOTPLOY_MCP_BLOCKED_CAPABILITIES`,
      risk,
    );
  }

  if (risk >= 3) {
    return deny("policy_denied", "This capability is classified as forbidden", risk);
  }

  const missing = capability.permissions
    .filter((requirement) => !hasPermission(permissions, requirement))
    .map(describePermission);

  if (missing.length > 0) {
    return deny(
      "permission_denied",
      `The authenticated identity lacks the required permission(s): ${missing.join(", ")}`,
      risk,
    );
  }

  if (risk <= config.maxAutomaticRisk) {
    return allow(risk, `Risk level ${risk} is allowed without approval`);
  }

  if (risk !== 2) {
    return deny(
      "policy_denied",
      `Risk level ${risk} exceeds NOTPLOY_MCP_MAX_RISK (${config.maxAutomaticRisk})`,
      risk,
    );
  }

  if (!config.allowHighRiskWithApproval) {
    return deny("policy_denied", "High-risk capabilities are disabled by policy", risk);
  }

  if (capability.effects.destructive && !config.allowDestructive) {
    return deny(
      "policy_denied",
      "Destructive capabilities are disabled. Set NOTPLOY_MCP_ALLOW_DESTRUCTIVE=true to opt in",
      risk,
    );
  }

  if (!config.approvalToken) {
    return deny(
      "approval_required",
      "This capability requires an approval token, but NOTPLOY_MCP_APPROVAL_TOKEN is not configured",
      risk,
      true,
    );
  }

  if (!tokenMatches(config.approvalToken, input.approvalToken)) {
    return deny(
      "approval_required",
      "A valid approvalToken argument is required for this high-impact capability",
      risk,
      true,
    );
  }

  return {
    allowed: true,
    code: "policy_denied",
    reason: "High-impact capability authorized by a valid approval token",
    risk,
    requiresApproval: true,
  };
}
