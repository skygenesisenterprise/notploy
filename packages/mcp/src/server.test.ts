import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, type McpConfig } from "./config.js";
import type { ApiPort, ApiRequest } from "./contracts/api.js";
import type { ResolvedPermissions } from "./contracts/core.js";
import type { AuditEvent, AuditPort } from "./observability/audit.js";
import type { ToolListEntry } from "./protocol/schemas.js";
import { createRuntime, type McpRuntime } from "./protocol/server.js";

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
    private readonly handler: (request: ApiRequest) => unknown = () => ({}),
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
    return this.handler(request) as T;
  }
}

class MemoryAudit implements AuditPort {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

function testConfig(overrides: Partial<McpConfig> = {}): McpConfig {
  const base = loadConfig({
    NOTPLOY_URL: "https://notploy.example.com",
    NOTPLOY_API_KEY: API_KEY,
  } as NodeJS.ProcessEnv);
  return {
    ...base,
    ...overrides,
    policy: { ...base.policy, ...(overrides.policy ?? {}) },
    limits: { ...base.limits, ...(overrides.limits ?? {}) },
    advanced: { ...base.advanced, ...(overrides.advanced ?? {}) },
    legacySelection: { ...base.legacySelection, ...(overrides.legacySelection ?? {}) },
  };
}

interface Connected {
  client: Client;
  runtime: McpRuntime;
  api: FakeApi;
  audit: MemoryAudit;
}

describe("MCP server", () => {
  const runtimes: McpRuntime[] = [];
  const clients: Client[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) await client.close().catch(() => undefined);
    for (const runtime of runtimes.splice(0)) await runtime.server.close().catch(() => undefined);
  });

  async function connect(config: McpConfig, api: FakeApi): Promise<Connected> {
    const audit = new MemoryAudit();
    const runtime = await createRuntime({ config, api, audit });
    runtimes.push(runtime);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await runtime.server.connect(serverTransport);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
    clients.push(client);
    return { client, runtime, api, audit };
  }

  it("exposes the business catalog by default", async () => {
    const api = new FakeApi();
    const { client, runtime } = await connect(testConfig(), api);
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(19);
    expect(tools.map((tool) => tool.name)).toContain("list_projects");
    expect(tools.map((tool) => tool.name)).toContain("execute_deployment");
    expect(tools.map((tool) => tool.name)).not.toContain("application-create");
    expect(runtime.catalog.summary.advancedCount).toBe(0);
  });

  it("serves JSON Schema draft 2020-12 without nested $schema keys", async () => {
    const api = new FakeApi();
    const { client } = await connect(testConfig(), api);
    const { tools } = await client.listTools();

    function nestedSchemaKeys(value: unknown, path = ""): string[] {
      if (value === null || typeof value !== "object") return [];
      if (Array.isArray(value)) {
        return value.flatMap((item, index) => nestedSchemaKeys(item, `${path}[${index}]`));
      }
      const record = value as Record<string, unknown>;
      const found: string[] = [];
      for (const [key, child] of Object.entries(record)) {
        const current = path ? `${path}.${key}` : key;
        if (key === "$schema" && path !== "") found.push(current);
        found.push(...nestedSchemaKeys(child, current));
      }
      return found;
    }

    for (const tool of tools) {
      const schema = tool.inputSchema as Record<string, unknown>;
      expect(schema.$schema, `${tool.name} $schema`).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(schema.type, `${tool.name} type`).toBe("object");
      expect(nestedSchemaKeys(schema), `${tool.name} nested $schema`).toHaveLength(0);
      expect(tool.description?.length ?? 0, `${tool.name} description`).toBeGreaterThan(20);
    }
  });

  it("only exposes provider-compatible regex patterns", async () => {
    const api = new FakeApi();
    const { client } = await connect(testConfig(), api);
    const { tools } = await client.listTools();

    function patterns(value: unknown): string[] {
      if (value === null || typeof value !== "object") return [];
      if (Array.isArray(value)) return value.flatMap(patterns);
      const record = value as Record<string, unknown>;
      const found = typeof record.pattern === "string" ? [record.pattern] : [];
      return [...found, ...Object.values(record).flatMap(patterns)];
    }

    for (const tool of tools) {
      for (const pattern of patterns(tool.inputSchema)) {
        expect(() => new RegExp(pattern, "v"), `${tool.name}: ${pattern}`).not.toThrow();
        expect(pattern, `${tool.name} lookaround`).not.toMatch(/\(\?<?[=!]/);
      }
    }
  });

  it("returns structured content for a successful call", async () => {
    const api = new FakeApi((request) => {
      if (request.path === "/project.all") {
        return [{ projectId: "p1", name: "Demo" }];
      }
      return {};
    });
    const { client, audit } = await connect(testConfig(), api);

    const response = await client.callTool({ name: "list_projects", arguments: {} });
    const structured = response.structuredContent as {
      ok: boolean;
      status: string;
      capability: string;
      data: { count: number; projects: unknown[] };
      meta: { environment: string; risk: number; requestId: string };
    };

    expect(response.isError).toBeFalsy();
    expect(structured.ok).toBe(true);
    expect(structured.status).toBe("succeeded");
    expect(structured.capability).toBe("list_projects");
    expect(structured.data.count).toBe(1);
    expect(structured.meta.environment).toBe("self");
    expect(structured.meta.risk).toBe(0);
    expect(response.content[0]?.type).toBe("text");
    expect(audit.events.at(-1)?.code).toBe("ok");
  });

  it("enforces effective permissions at execution time", async () => {
    const api = new FakeApi(() => ({ applicationId: "app-1" }), {
      deployment: { read: true },
    });
    const { client } = await connect(testConfig(), api);

    const response = await client.callTool({
      name: "get_application",
      arguments: { applicationId: "app-1" },
    });
    const structured = response.structuredContent as {
      error?: { code?: string };
    };

    expect(response.isError).toBe(true);
    expect(structured.error?.code).toBe("permission_denied");
    expect(api.calls.some((call) => call.path === "/application.one")).toBe(false);
  });

  it("refuses high-impact deployment without approval", async () => {
    const config = testConfig();
    config.policy.approvalToken = APPROVAL_TOKEN;
    const api = new FakeApi();
    const { client } = await connect(config, api);

    const response = await client.callTool({
      name: "execute_deployment",
      arguments: { applicationId: "app-1" },
    });
    const structured = response.structuredContent as { error?: { code?: string } };

    expect(response.isError).toBe(true);
    expect(structured.error?.code).toBe("approval_required");
    expect(api.calls.some((call) => call.path === "/application.deploy")).toBe(false);
  });

  it("exposes the advanced catalog only when explicitly configured", async () => {
    const api = new FakeApi();
    const { client } = await connect(
      testConfig({
        mode: "advanced",
        advanced: { ...testConfig().advanced, profile: "read-only" },
      }),
      api,
    );
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map((tool) => tool.name)).not.toContain("list_projects");
    for (const tool of tools) {
      const meta = (tool as ToolListEntry & { _meta?: Record<string, unknown> })._meta;
      expect(meta?.["notploy/mode"]).toBe("advanced");
      expect(meta?.["notploy/risk"]).toBe(0);
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("returns a stable error for an unknown tool", async () => {
    const api = new FakeApi();
    const { client } = await connect(testConfig(), api);

    const response = await client.callTool({ name: "does_not_exist", arguments: {} });
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join(" ");

    expect(response.isError).toBe(true);
    expect(text).toMatch(/not found|unknown/i);
  });
});
