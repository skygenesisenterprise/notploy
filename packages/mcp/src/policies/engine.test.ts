import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type AnyCapability, defineCapability } from "../contracts/capability.js";
import type { ResolvedPermissions } from "../contracts/core.js";
import type { PolicyConfig } from "../contracts/policy.js";
import { effectiveRisk, evaluatePolicy } from "./engine.js";

const TOKEN = "approval-token-0123456789";

function policy(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    maxAutomaticRisk: 1,
    allowHighRiskWithApproval: true,
    allowDestructive: false,
    approvalToken: TOKEN,
    blockedCapabilities: new Set(),
    ...overrides,
  };
}

function capability(overrides: Partial<AnyCapability> = {}): AnyCapability {
  return {
    ...defineCapability({
      name: "test_capability",
      title: "Test",
      description: "Test capability",
      category: "discovery",
      mode: "business",
      source: "business",
      version: "1.0.0",
      status: "available",
      environments: ["self", "cloud", "console"],
      risk: 0,
      permissions: [],
      effects: {
        readOnly: true,
        destructive: false,
        idempotent: true,
        supportsIdempotencyKey: false,
        longRunning: false,
      },
      inputSchema: z.object({}),
      outputSchema: {},
      annotations: {},
      execute: async () => ({}),
    }),
    ...overrides,
  };
}

const permissions: ResolvedPermissions = {
  service: { read: true },
  deployment: { read: true, create: false },
};

describe("evaluatePolicy", () => {
  it("allows read-only capabilities", () => {
    const decision = evaluatePolicy(policy(), { capability: capability(), permissions });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it("denies missing effective permissions", () => {
    const decision = evaluatePolicy(policy(), {
      capability: capability({
        permissions: [{ resource: "deployment", actions: ["create"] }],
      }),
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("permission_denied");
    expect(decision.reason).toContain("deployment:create");
  });

  it("requires every action of a permission requirement", () => {
    const decision = evaluatePolicy(policy(), {
      capability: capability({
        permissions: [{ resource: "service", actions: ["read", "delete"] }],
      }),
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("permission_denied");
  });

  it("denies capabilities blocked by configuration", () => {
    const decision = evaluatePolicy(policy({ blockedCapabilities: new Set(["test_capability"]) }), {
      capability: capability(),
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("policy_denied");
  });

  it("denies risk level 3", () => {
    const decision = evaluatePolicy(policy(), {
      capability: capability({ risk: 3 }),
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("policy_denied");
  });

  it("requires approval for high-risk capabilities", () => {
    const highRisk = capability({
      name: "deploy",
      risk: 2,
      effects: {
        readOnly: false,
        destructive: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: true,
      },
    });

    const withoutToken = evaluatePolicy(policy(), { capability: highRisk, permissions });
    expect(withoutToken.allowed).toBe(false);
    expect(withoutToken.code).toBe("approval_required");
    expect(withoutToken.requiresApproval).toBe(true);

    const wrongToken = evaluatePolicy(policy(), {
      capability: highRisk,
      permissions,
      approvalToken: "wrong-token-0123456789",
    });
    expect(wrongToken.allowed).toBe(false);
    expect(wrongToken.code).toBe("approval_required");

    const allowed = evaluatePolicy(policy(), {
      capability: highRisk,
      permissions,
      approvalToken: TOKEN,
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.requiresApproval).toBe(true);
  });

  it("denies high-risk actions when no approval token is configured", () => {
    const decision = evaluatePolicy(policy({ approvalToken: undefined }), {
      capability: capability({ risk: 2 }),
      permissions,
      approvalToken: TOKEN,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("approval_required");
    expect(decision.reason).toContain("not configured");
  });

  it("does not let approval replace a missing permission", () => {
    const decision = evaluatePolicy(policy({ allowDestructive: true }), {
      capability: capability({
        risk: 2,
        effects: {
          readOnly: false,
          destructive: true,
          idempotent: false,
          supportsIdempotencyKey: false,
          longRunning: false,
        },
        permissions: [{ resource: "service", actions: ["delete"] }],
      }),
      permissions,
      approvalToken: TOKEN,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("permission_denied");
  });

  it("refuses destructive capabilities unless explicitly allowed", () => {
    const destructive = capability({
      risk: 2,
      effects: {
        readOnly: false,
        destructive: true,
        idempotent: true,
        supportsIdempotencyKey: false,
        longRunning: false,
      },
    });

    const denied = evaluatePolicy(policy(), {
      capability: destructive,
      permissions,
      approvalToken: TOKEN,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.code).toBe("policy_denied");
    expect(denied.reason).toContain("NOTPLOY_MCP_ALLOW_DESTRUCTIVE");

    const allowed = evaluatePolicy(policy({ allowDestructive: true }), {
      capability: destructive,
      permissions,
      approvalToken: TOKEN,
    });
    expect(allowed.allowed).toBe(true);
  });

  it("treats a destructive capability declared as risk 1 as high risk", () => {
    const misdeclared = capability({
      risk: 1,
      effects: {
        readOnly: false,
        destructive: true,
        idempotent: false,
        supportsIdempotencyKey: false,
        longRunning: false,
      },
    });
    expect(effectiveRisk(misdeclared)).toBe(2);

    const decision = evaluatePolicy(policy({ allowDestructive: true }), {
      capability: misdeclared,
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("approval_required");
  });

  it("denies write risk when max automatic risk is read-only", () => {
    const decision = evaluatePolicy(policy({ maxAutomaticRisk: 0 }), {
      capability: capability({
        risk: 1,
        effects: {
          readOnly: false,
          destructive: false,
          idempotent: false,
          supportsIdempotencyKey: false,
          longRunning: false,
        },
      }),
      permissions,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("policy_denied");
  });
});
