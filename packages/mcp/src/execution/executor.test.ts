import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { IdentityResolver } from "../adapters/identity.js";
import { ApiError } from "../adapters/notployApi.js";
import { getOperationStatusCapability } from "../capabilities/operations.js";
import type { McpConfig } from "../config.js";
import { loadConfig } from "../config.js";
import type { ApiPort, ApiRequest } from "../contracts/api.js";
import type { AnyCapability } from "../contracts/capability.js";
import { defineCapability } from "../contracts/capability.js";
import type { ResolvedPermissions } from "../contracts/core.js";
import type { AuditEvent, AuditPort } from "../observability/audit.js";
import { ToolExecutor } from "./executor.js";
import { ExecutionLimiter } from "./limiter.js";
import { OperationStore } from "./operations.js";

const API_KEY = "test-api-key-12345678";
const APPROVAL_TOKEN = "approval-token-0123456789";

const FULL_PERMISSIONS: ResolvedPermissions = {
  service: { read: true, create: true, delete: true },
  deployment: { read: true, create: true, cancel: true },
  domain: { read: true },
  server: { read: true },
  project: { create: true, delete: true },
};

class FakeApi implements ApiPort {
  readonly calls: ApiRequest[] = [];

  constructor(
    private readonly handler: (request: ApiRequest) => unknown | Promise<unknown> = () => ({}),
    public permissions: ResolvedPermissions = FULL_PERMISSIONS,
  ) {}

  async request<T>(request: ApiRequest): Promise<T> {
    this.calls.push(request);
    if (request.path === "/user.session") {
      return {
        user: { id: "user-1" },
        session: { activeOrganizationId: "org-1" },
      } as T;
    }
    if (request.path === "/user.getPermissions") {
      return this.permissions as T;
    }
    return (await this.handler(request)) as T;
  }

  businessCalls(): ApiRequest[] {
    return this.calls.filter(
      (call) => call.path !== "/user.session" && call.path !== "/user.getPermissions",
    );
  }
}

class MemoryAudit implements AuditPort {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

function testConfig(
  overrides: { policy?: Partial<McpConfig["policy"]>; limits?: Partial<McpConfig["limits"]> } = {},
): McpConfig {
  const base = loadConfig({
    NOTPLOY_URL: "https://notploy.example.com",
    NOTPLOY_API_KEY: API_KEY,
  } as NodeJS.ProcessEnv);

  return {
    ...base,
    policy: {
      ...base.policy,
      approvalToken: APPROVAL_TOKEN,
      ...(overrides.policy ?? {}),
    },
    limits: { ...base.limits, ...(overrides.limits ?? {}) },
  };
}

function makeCapability(
  overrides: {
    name?: string;
    risk?: number;
    permissions?: AnyCapability["permissions"];
    effects?: Partial<AnyCapability["effects"]>;
    environments?: AnyCapability["environments"];
    schema?: z.ZodObject<z.ZodRawShape>;
    execute?: AnyCapability["execute"];
    verify?: AnyCapability["verify"];
  } = {},
): AnyCapability {
  const base = defineCapability({
    name: overrides.name ?? "test_capability",
    title: "Test capability",
    description: "A capability used by tests",
    category: "discovery",
    mode: "business",
    source: "business",
    version: "1.0.0",
    status: "available",
    environments: overrides.environments ?? ["self", "cloud", "console"],
    risk: (overrides.risk ?? 0) as AnyCapability["risk"],
    permissions: overrides.permissions ?? [],
    effects: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      supportsIdempotencyKey: false,
      longRunning: false,
      ...(overrides.effects ?? {}),
    },
    inputSchema:
      overrides.schema ??
      z.object({
        approvalToken: z.string().optional(),
        idempotencyKey: z.string().optional(),
        applicationId: z.string().optional(),
      }),
    outputSchema: {},
    annotations: {},
    execute: overrides.execute ?? (async () => ({ data: { ok: true } })),
    ...(overrides.verify ? { verify: overrides.verify } : {}),
  });
  return base;
}

interface Harness {
  executor: ToolExecutor;
  api: FakeApi;
  audit: MemoryAudit;
  operations: OperationStore;
  config: McpConfig;
}

async function harness(
  options: { config?: McpConfig; api?: FakeApi; operations?: OperationStore } = {},
): Promise<Harness> {
  const config = options.config ?? testConfig();
  const api = options.api ?? new FakeApi();
  const operations = options.operations ?? new OperationStore({ retentionMs: 60_000 });
  const audit = new MemoryAudit();
  const limiter = new ExecutionLimiter({
    maxRequestsPerMinute: config.limits.maxRequestsPerMinute,
    maxConcurrentRequests: config.limits.maxConcurrentRequests,
  });

  const executor = new ToolExecutor({
    config,
    api,
    identities: new IdentityResolver(api),
    limiter,
    operations,
    audit,
  });

  return { executor, api, audit, operations, config };
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("condition was not met before the test timeout");
}

describe("ToolExecutor", () => {
  it("executes a capability and records a successful audit event", async () => {
    const execute = vi.fn(async () => ({
      data: { projects: [{ projectId: "p1" }] },
      resourceIds: { projectId: "p1" },
    }));
    const harnessValue = await harness();
    const capability = makeCapability({ execute });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(result.data).toEqual({ projects: [{ projectId: "p1" }] });
    expect(result.meta).toMatchObject({
      requestId: "req-1",
      environment: "self",
      risk: 0,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(harnessValue.audit.events).toHaveLength(1);
    expect(harnessValue.audit.events[0]).toMatchObject({
      requestId: "req-1",
      capability: "test_capability",
      decision: "allowed",
      code: "ok",
      identityId: "user-1",
      organizationId: "org-1",
      risk: 0,
      approvalUsed: false,
    });
  });

  it("rejects invalid input without echoing submitted values", async () => {
    const execute = vi.fn(async () => ({ data: {} }));
    const harnessValue = await harness();
    const capability = makeCapability({
      schema: z.object({ applicationId: z.string().min(1) }),
      execute,
    });

    const result = await harnessValue.executor.execute(
      capability,
      { applicationId: 12345 },
      { requestId: "req-2" },
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("invalid_input");
    expect(result.error?.message).toContain("applicationId");
    expect(result.error?.message).not.toContain("12345");
    expect(execute).not.toHaveBeenCalled();
    expect(harnessValue.audit.events[0]?.decision).toBe("denied");
  });

  it("denies a capability when the effective permissions are insufficient", async () => {
    const api = new FakeApi(undefined, { deployment: { read: true } });
    const execute = vi.fn(async () => ({ data: {} }));
    const harnessValue = await harness({ api });
    const capability = makeCapability({
      permissions: [{ resource: "service", actions: ["read"] }],
      execute,
    });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-3" });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("permission_denied");
    expect(result.error?.message).toContain("service:read");
    expect(execute).not.toHaveBeenCalled();
    expect(harnessValue.audit.events[0]?.decision).toBe("denied");
    expect(harnessValue.api.businessCalls()).toHaveLength(0);
  });

  it("rejects an unsupported environment before resolving identity", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({ environments: ["cloud"] });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-4" });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unsupported_environment");
    expect(harnessValue.api.calls).toHaveLength(0);
  });

  it("requires a valid approval token for high-impact capabilities", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({
      risk: 2,
      permissions: [{ resource: "deployment", actions: ["create"] }],
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: false,
      },
    });

    const withoutToken = await harnessValue.executor.execute(
      capability,
      {},
      { requestId: "req-5a" },
    );
    expect(withoutToken.error?.code).toBe("approval_required");

    const wrongToken = await harnessValue.executor.execute(
      capability,
      { approvalToken: "wrong-token-0123456789" },
      { requestId: "req-5b" },
    );
    expect(wrongToken.error?.code).toBe("approval_required");

    const allowed = await harnessValue.executor.execute(
      capability,
      { approvalToken: APPROVAL_TOKEN },
      { requestId: "req-5c" },
    );
    expect(allowed.ok).toBe(true);
    expect(harnessValue.audit.events.at(-1)?.approvalUsed).toBe(true);
  });

  it("refuses destructive capabilities unless explicitly enabled", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({
      risk: 2,
      effects: {
        readOnly: false,
        destructive: true,
        idempotent: true,
        supportsIdempotencyKey: false,
        longRunning: false,
      },
    });

    const result = await harnessValue.executor.execute(
      capability,
      { approvalToken: APPROVAL_TOKEN },
      { requestId: "req-6" },
    );
    expect(result.error?.code).toBe("policy_denied");
    expect(result.error?.message).toContain("NOTPLOY_MCP_ALLOW_DESTRUCTIVE");
  });

  it("enforces the per-identity rate limit", async () => {
    const harnessValue = await harness({
      config: testConfig({ limits: { maxRequestsPerMinute: 1 } }),
    });
    const capability = makeCapability();

    const first = await harnessValue.executor.execute(capability, {}, { requestId: "req-7a" });
    const second = await harnessValue.executor.execute(capability, {}, { requestId: "req-7b" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe("rate_limited");
  });

  it("enforces a hard execution deadline", async () => {
    const harnessValue = await harness({
      config: testConfig({ limits: { toolTimeoutMs: 30 } }),
    });
    const capability = makeCapability({
      execute: async () => new Promise(() => {}),
    });

    const startedAt = Date.now();
    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-8" });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("timeout");
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it("redacts field names and literal credentials from results", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({
      execute: async () => ({
        data: {
          password: "hunter2",
          authorization: `Bearer ${API_KEY}`,
          note: `request failed for key ${API_KEY}`,
          appName: "web",
        },
      }),
    });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-9" });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).toContain("[REDACTED]");
    expect((result.data as Record<string, unknown>).appName).toBe("web");
  });

  it("truncates results that exceed the configured budget", async () => {
    const harnessValue = await harness({
      config: testConfig({ limits: { maxResultBytes: 1_500 } }),
    });
    const capability = makeCapability({
      execute: async () => ({ data: { blob: "x".repeat(50_000) } }),
    });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-10" });
    const serialized = JSON.stringify(result);

    expect(result.meta.truncated).toBe(true);
    expect((result.data as Record<string, unknown>).truncated).toBe(true);
    expect(serialized.length).toBeLessThan(4_000);
    expect(serialized).not.toContain("x".repeat(5_000));
  });

  it("returns an operation id for long-running work and replays idempotent calls", async () => {
    const execute = vi.fn(async () => ({ data: { queued: true } }));
    const harnessValue = await harness();
    const capability = makeCapability({
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: true,
      },
      execute,
    });
    const input = { idempotencyKey: "deploy-key-123" };

    const first = await harnessValue.executor.execute(capability, input, { requestId: "req-11a" });
    expect(first.ok).toBe(true);
    expect(first.status).toBe("pending");
    expect(first.meta.operationId).toBeTruthy();

    await waitFor(async () => {
      const operation = await harnessValue.operations.findByIdempotencyKey("deploy-key-123");
      return operation?.status === "succeeded";
    });

    const second = await harnessValue.executor.execute(capability, input, {
      requestId: "req-11b",
    });

    expect(second.status).toBe("succeeded");
    expect(second.message).toContain("Replayed idempotent result");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("refuses to reuse an idempotency key for a different capability", async () => {
    const harnessValue = await harness();
    const firstCapability = makeCapability({
      name: "first_capability",
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: true,
      },
    });
    const secondCapability = makeCapability({
      name: "second_capability",
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: true,
      },
    });

    await harnessValue.executor.execute(
      firstCapability,
      { idempotencyKey: "shared-key-123" },
      {
        requestId: "req-12a",
      },
    );
    const result = await harnessValue.executor.execute(
      secondCapability,
      { idempotencyKey: "shared-key-123" },
      { requestId: "req-12b" },
    );

    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("idempotency_mismatch");
  });

  it("stores long-running failures and exposes them through get_operation_status", async () => {
    const harnessValue = await harness();
    const failing = makeCapability({
      name: "failing_operation",
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: true,
      },
      execute: async () => {
        throw new ApiError({ code: "api_error", message: "The deployment queue rejected the job" });
      },
    });

    const started = await harnessValue.executor.execute(
      failing,
      { idempotencyKey: "failing-key-123" },
      { requestId: "req-13a" },
    );
    expect(started.status).toBe("pending");

    await waitFor(async () => {
      const operation = await harnessValue.operations.findByIdempotencyKey("failing-key-123");
      return operation?.status === "failed";
    });

    const status = await harnessValue.executor.execute(
      getOperationStatusCapability,
      { operationId: started.meta.operationId },
      { requestId: "req-13b" },
    );

    expect(status.ok).toBe(true);
    expect((status.data as Record<string, unknown>).status).toBe("failed");
    expect((status.data as { error?: { message?: string } }).error?.message).toContain(
      "deployment queue",
    );
  });

  it("turns a failed post-condition into a failed result", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({
      verify: async () => ({ status: "failed", message: "The resource is still present" }),
    });

    const result = await harnessValue.executor.execute(capability, {}, { requestId: "req-14" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("conflict");
    expect(result.error?.message).toContain("still present");
    expect(harnessValue.audit.events.at(-1)?.decision).toBe("failed");
  });

  it("never writes the approval token or input values to the audit trail", async () => {
    const harnessValue = await harness();
    const capability = makeCapability({
      risk: 2,
      permissions: [{ resource: "deployment", actions: ["create"] }],
      effects: {
        readOnly: false,
        idempotent: false,
        supportsIdempotencyKey: true,
        longRunning: false,
      },
    });

    await harnessValue.executor.execute(
      capability,
      { approvalToken: APPROVAL_TOKEN, idempotencyKey: "sensitive-key-123" },
      { requestId: "req-15" },
    );

    const serialized = JSON.stringify(harnessValue.audit.events);
    expect(serialized).not.toContain(APPROVAL_TOKEN);
    expect(serialized).not.toContain("sensitive-key-123");
  });
});
