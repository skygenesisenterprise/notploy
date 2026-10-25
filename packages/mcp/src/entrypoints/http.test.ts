import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, type McpConfig } from "../config.js";
import { assertHttpSecurity, createHttpApplication } from "./http.js";

const TOKEN = "http-token-0123456789";
const API_KEY = "test-api-key-12345678";

function testConfig(overrides: Record<string, string> = {}): McpConfig {
  return loadConfig({
    NOTPLOY_URL: "https://notploy.example.com",
    NOTPLOY_API_KEY: API_KEY,
    NOTPLOY_MCP_HTTP_TOKEN: TOKEN,
    ...overrides,
  } as NodeJS.ProcessEnv);
}

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "http-test", version: "1.0.0" },
  },
};

describe("assertHttpSecurity", () => {
  it("requires a token when unauthenticated HTTP is not explicitly allowed", () => {
    const config = testConfig({ NOTPLOY_MCP_HTTP_TOKEN: "" });
    expect(() => assertHttpSecurity(config.http)).toThrow(/NOTPLOY_MCP_HTTP_TOKEN/);
  });

  it("only allows the unauthenticated opt-out on loopback", () => {
    const publicConfig = testConfig({
      NOTPLOY_MCP_HTTP_TOKEN: "",
      NOTPLOY_MCP_HTTP_ALLOW_UNAUTHENTICATED: "true",
      NOTPLOY_MCP_HTTP_HOST: "0.0.0.0",
    });
    expect(() => assertHttpSecurity(publicConfig.http)).toThrow(/loopback/);

    const loopbackConfig = testConfig({
      NOTPLOY_MCP_HTTP_TOKEN: "",
      NOTPLOY_MCP_HTTP_ALLOW_UNAUTHENTICATED: "true",
      NOTPLOY_MCP_HTTP_HOST: "127.0.0.1",
    });
    expect(() => assertHttpSecurity(loopbackConfig.http)).not.toThrow();
  });
});

describe("HTTP transport", () => {
  const cleanups: (() => Promise<void>)[] = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
  });

  async function start(config: McpConfig): Promise<{ baseUrl: string }> {
    const application = await createHttpApplication({ config });
    const server = serve({
      fetch: application.app.fetch,
      port: 0,
      hostname: "127.0.0.1",
    });

    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve());
      server.once("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind a port");

    cleanups.push(async () => {
      (server as Server).closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await application.close();
    });

    return { baseUrl: `http://127.0.0.1:${address.port}` };
  }

  it("serves health without authentication but protects MCP endpoints", async () => {
    const { baseUrl } = await start(testConfig());

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { status: string; version: string };
    expect(healthBody.status).toBe("ok");
    expect(healthBody.version).toBeTruthy();

    const unauthorized = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(initializeBody),
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Bearer");
    expect(unauthorized.headers.get("www-authenticate")).toContain("resource_metadata");
    const unauthorizedBody = await unauthorized.text();
    expect(unauthorizedBody).not.toContain(TOKEN);
  });

  it("accepts a bearer token and creates an isolated session", async () => {
    const { baseUrl } = await start(testConfig());

    const controller = new AbortController();
    const initialized = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(initializeBody),
      signal: controller.signal,
    });

    expect(initialized.status).toBe(200);
    const sessionId = initialized.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
    controller.abort();

    const wrongToken = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token-0123456789",
        "content-type": "application/json",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(wrongToken.status).toBe(401);
  });

  it("rejects non-initialization requests without a session", async () => {
    const { baseUrl } = await start(testConfig());

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });

    expect(response.status).toBe(400);
  });

  it("enforces the configured body size limit", async () => {
    const { baseUrl } = await start(testConfig({ NOTPLOY_MCP_HTTP_MAX_BODY_BYTES: "1024" }));

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list", pad: "x".repeat(4096) }),
    });

    expect(response.status).toBe(413);
  });

  it("honestly reports bearer-only auth when OAuth is not configured", async () => {
    const { baseUrl } = await start(testConfig());

    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string; resource?: string };
    expect(body.error).toBe("oauth_not_configured");
    expect(body.resource).toContain("/mcp");
  });

  it("serves RFC 9728 metadata when an OAuth issuer is configured", async () => {
    const { baseUrl } = await start(
      testConfig({
        NOTPLOY_MCP_OAUTH_ISSUER: "https://auth.example.com",
        NOTPLOY_MCP_PUBLIC_BASE_URL: "https://mcp.example.com",
      }),
    );

    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource?: string;
      authorization_servers?: string[];
    };
    expect(body.resource).toBe("https://mcp.example.com/mcp");
    expect(body.authorization_servers).toEqual(["https://auth.example.com"]);
  });
});
