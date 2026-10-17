import type { RiskLevel } from "./core.js";
import type { ToolErrorCode } from "./result.js";

export interface PolicyConfig {
  /** Highest risk allowed without an approval token. */
  maxAutomaticRisk: RiskLevel;
  /** Whether risk level 2 may run when a valid approval token is supplied. */
  allowHighRiskWithApproval: boolean;
  /** Whether destructive capabilities may ever run, even with approval. */
  allowDestructive: boolean;
  /** Shared secret that authorizes a single high-risk call. */
  approvalToken?: string;
  /** Capability names refused regardless of risk or permissions. */
  blockedCapabilities: ReadonlySet<string>;
}

export interface PolicyDecision {
  allowed: boolean;
  code: ToolErrorCode;
  reason: string;
  risk: RiskLevel;
  requiresApproval: boolean;
}

export function allow(risk: RiskLevel, reason: string): PolicyDecision {
  return { allowed: true, code: "policy_denied", reason, risk, requiresApproval: false };
}

export function deny(
  code: ToolErrorCode,
  reason: string,
  risk: RiskLevel,
  requiresApproval = false,
): PolicyDecision {
  return { allowed: false, code, reason, risk, requiresApproval };
}
