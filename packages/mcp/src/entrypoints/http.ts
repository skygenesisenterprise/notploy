import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { HttpBindings } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { getConfig, type HttpConfig, type McpConfig } from "../config.js";
import {
  buildMcpServer,
  closeServerParts,
  createServerParts,
  type ServerParts,
} from "../protocol/server.js";
import { createLogger } from "../utils/logger.js";
import { MCP_SERVER_VERSION } from "../version.js";

const logger = createLogger("MCP-HTTP-Server");

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: "2.0" as const,
  error: { code, message },
  id: null,
});

function neverResolve(): Promise<never> {
  return new Promise(() => {});
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function secureEquals(expected: string, supplied: string): boolean {
  return timingSafeEqual(digest(expected), digest(supplied));
}

function fingerprint(token: string | undefined): string {
  return token ? digest(token).toString("hex").slice(0, 32) : "anonymous";
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

class PayloadTooLargeError extends Error {}

async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PayloadTooLargeError("Request body exceeds NOTPLOY_MCP_HTTP_MAX_BODY_BYTES");
  }
  if (text.trim() === "") return undefined;
  return JSON.parse(text) as unknown;
}

/**
 * Fails closed when the HTTP transport is not protected.
 *
 * Remote transports require a bearer token. An explicit opt-out is accepted
 * only on loopback, so a published container cannot expose an unauthenticated
 * Notploy automation surface by accident.
 */
export function assertHttpSecurity(http: HttpConfig): void {
  if (!http.token && !http.allowUnauthenticated) {
    throw new Error(
      "HTTP transport requires NOTPLOY_MCP_HTTP_TOKEN (at least 16 characters). " +
        "For local development only, set NOTPLOY_MCP_HTTP_ALLOW_UNAUTHENTICATED=true with a loopback bind address.",
    );
  }
  if (!http.token && http.allowUnauthenticated && !isLoopbackHost(http.host)) {
    throw new Error(
      "NOTPLOY_MCP_HTTP_ALLOW_UNAUTHENTICATED is only allowed when NOTPLOY_MCP_HTTP_HOST is loopback",
    );
  }
}

interface SessionBase {
  server: McpServer;
  fingerprint: string;
  createdAt: number;
  lastSeen: number;
}

type SessionRecord =
  | (SessionBase & { kind: "streamable"; transport: StreamableHTTPServerTransport })
  | (SessionBase & { kind: "sse"; transport: SSEServerTransport });

export interface HttpApplication {
  app: Hono<{ Bindings: HttpBindings }>;
  parts: ServerParts;
  sessions: Map<string, SessionRecord>;
  close(): Promise<void>;
}

export interface CreateHttpApplicationOptions {
  config: McpConfig;
  parts?: ServerParts;
}

/**
 * Builds the HTTP application without binding a port.
 *
 * This is the security boundary used by both the container entrypoint and the
 * transport tests: authentication, body limits, session ownership and TTL are
 * applied here, independently of the MCP protocol server or the catalog.
 */
export async function createHttpApplication(
  options: CreateHttpApplicationOptions,
): Promise<HttpApplication> {
  const { config } = options;
  const http = config.http;
  const expectedFingerprint = fingerprint(http.token);
  const parts = options.parts ?? (await createServerParts({ config }));
  const sessions = new Map<string, SessionRecord>();

  const removeSession = (sessionId: string, reason: string) => {
    const record = sessions.get(sessionId);
    if (!record) return;
    sessions.delete(sessionId);
    void record.transport.close().catch(() => undefined);
    void record.server.close().catch(() => undefined);
    logger.info("MCP session closed", { sessionId, reason, kind: record.kind });
  };

  const resourceMetadataUrl = `${http.publicBaseUrl ?? ""}/.well-known/oauth-protected-resource`;
  const resourceUrl = `${http.publicBaseUrl ?? ""}/mcp`;

  const wwwAuthenticate = http.oauthIssuer
    ? `Bearer resource_metadata="${resourceMetadataUrl}"`
    : `Bearer resource_metadata="${resourceMetadataUrl}"`;

  const requireAuth = async (
    c: Context<{ Bindings: HttpBindings }>,
    next: () => Promise<void>,
  ): Promise<Response | undefined> => {
    if (!http.token) {
      await next();
      return;
    }
    const header = c.req.header("authorization");
    const match = /^Bearer\s+(\S+)$/i.exec(header ?? "");
    if (!match?.[1] || !secureEquals(http.token, match[1])) {
      // RFC 9728 discovery hint: ChatGPT and other MCP clients use
      // resource_metadata to locate OAuth protected-resource metadata.
      // When no OAuth issuer is configured the metadata endpoint honestly
      // reports bearer-only auth instead of faking OAuth discovery.
      c.header("WWW-Authenticate", wwwAuthenticate);
      return c.json(jsonRpcError(-32001, "Unauthorized"), 401);
    }
    await next();
    return undefined;
  };

  const app = new Hono<{ Bindings: HttpBindings }>();

  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
  });

  for (const path of ["/mcp", "/mcp/*", "/sse", "/messages"]) {
    app.use(path, requireAuth);
  }

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: MCP_SERVER_VERSION,
      mode: config.mode,
      tools: parts.registry.size,
    }),
  );

  // RFC 9728 OAuth protected-resource metadata (MCP auth discovery).
  // Public by design: it describes how to authenticate, it never accepts
  // credentials and never proxies to the Notploy API.
  // When NOTPLOY_MCP_OAUTH_ISSUER is unset, this endpoint honestly reports
  // bearer-only auth (developer/private-connector path) instead of faking
  // an authorization server. ChatGPT public listing requires a real issuer.
  app.get("/.well-known/oauth-protected-resource", (c) => {
    if (!http.oauthIssuer) {
      return c.json(
        {
          error: "oauth_not_configured",
          message:
            "This MCP server uses bearer-only auth (NOTPLOY_MCP_HTTP_TOKEN) for private/developer connectors. OAuth 2.1 with dynamic client registration is not configured; public ChatGPT listing is not available with this configuration.",
          resource: resourceUrl,
          bearer_methods_supported: ["header"],
          docs: "See packages/mcp/CHATGPT.md for the supported private-connector path.",
        },
        404,
      );
    }
    return c.json({
      resource: resourceUrl,
      authorization_servers: [http.oauthIssuer],
      bearer_methods_supported: ["header"],
      ...(http.oauthAudience ? { audience: http.oauthAudience } : {}),
    });
  });

  app.post("/mcp", async (c) => {
    try {
      const sessionId = c.req.header("mcp-session-id");
      let body: unknown;
      try {
        body = await readJsonBody(c.req.raw, http.maxBodyBytes);
      } catch (error) {
        if (error instanceof PayloadTooLargeError) {
          return c.json(jsonRpcError(-32600, "Request body too large"), 413);
        }
        return c.json(jsonRpcError(-32700, "Parse error"), 400);
      }

      if (sessionId) {
        const record = sessions.get(sessionId);
        if (!record) {
          return c.json(jsonRpcError(-32000, "Invalid or missing session ID"), 400);
        }
        if (record.kind !== "streamable" || record.fingerprint !== expectedFingerprint) {
          return c.json(jsonRpcError(-32000, "Invalid or missing session ID"), 400);
        }
        record.lastSeen = Date.now();
        const { incoming, outgoing } = c.env;
        await record.transport.handleRequest(incoming, outgoing, body);
        return neverResolve();
      }

      if (!isInitializeRequest(body)) {
        return c.json(
          jsonRpcError(-32000, "Bad Request: no session ID and not an initialization request"),
          400,
        );
      }

      if (sessions.size >= http.maxSessions) {
        return c.json(jsonRpcError(-32000, "Too many active MCP sessions"), 429);
      }

      const server = buildMcpServer(parts);
      let initializedId: string | undefined;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionIdValue) => {
          initializedId = sessionIdValue;
          sessions.set(sessionIdValue, {
            transport,
            server,
            kind: "streamable",
            fingerprint: expectedFingerprint,
            createdAt: Date.now(),
            lastSeen: Date.now(),
          });
          logger.info("New MCP session initialized", { sessionId: sessionIdValue });
        },
      });

      transport.onclose = () => {
        if (initializedId) removeSession(initializedId, "transport-closed");
      };

      await server.connect(transport as unknown as Transport);
      const { incoming, outgoing } = c.env;
      await transport.handleRequest(incoming, outgoing, body);
      return neverResolve();
    } catch (error) {
      logger.error("Error handling HTTP request", {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(jsonRpcError(-32603, "Internal server error"), 500);
    }
  });

  app.get("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    const record = sessionId ? sessions.get(sessionId) : undefined;

    if (
      !sessionId ||
      !record ||
      record.kind !== "streamable" ||
      record.fingerprint !== expectedFingerprint
    ) {
      return c.json(jsonRpcError(-32000, "Invalid or missing session ID"), 400);
    }

    record.lastSeen = Date.now();
    try {
      const { incoming, outgoing } = c.env;
      await record.transport.handleRequest(incoming, outgoing);
      return neverResolve();
    } catch (error) {
      logger.error("Error handling GET request", {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(jsonRpcError(-32603, "Internal server error"), 500);
    }
  });

  app.delete("/mcp", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    const record = sessionId ? sessions.get(sessionId) : undefined;

    if (
      !sessionId ||
      !record ||
      record.kind !== "streamable" ||
      record.fingerprint !== expectedFingerprint
    ) {
      return c.json(jsonRpcError(-32000, "Invalid or missing session ID"), 400);
    }

    record.lastSeen = Date.now();
    try {
      const { incoming, outgoing } = c.env;
      await record.transport.handleRequest(incoming, outgoing);
      removeSession(sessionId, "client-terminated");
      return neverResolve();
    } catch (error) {
      logger.error("Error handling DELETE request", {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(jsonRpcError(-32603, "Internal server error"), 500);
    }
  });

  // Legacy SSE transport (MCP 2024-11-05), kept for existing clients.
  app.get("/sse", async (c) => {
    try {
      if (sessions.size >= http.maxSessions) {
        return c.json(jsonRpcError(-32000, "Too many active MCP sessions"), 429);
      }

      const { outgoing } = c.env;
      const transport = new SSEServerTransport("/messages", outgoing);
      const server = buildMcpServer(parts);
      sessions.set(transport.sessionId, {
        transport,
        server,
        kind: "sse",
        fingerprint: expectedFingerprint,
        createdAt: Date.now(),
        lastSeen: Date.now(),
      });

      outgoing.on("close", () => removeSession(transport.sessionId, "sse-closed"));

      await server.connect(transport as unknown as Transport);
      logger.info("New legacy SSE session initialized", { sessionId: transport.sessionId });
      return neverResolve();
    } catch (error) {
      logger.error("Error handling SSE request", {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(jsonRpcError(-32603, "Internal server error"), 500);
    }
  });

  app.post("/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    const record = sessionId ? sessions.get(sessionId) : undefined;

    if (!sessionId) {
      return c.json(jsonRpcError(-32000, "sessionId query parameter is required"), 400);
    }
    if (!record) {
      return c.json(jsonRpcError(-32000, "No transport found for sessionId"), 400);
    }
    if (record.kind !== "sse" || record.fingerprint !== expectedFingerprint) {
      return c.json(jsonRpcError(-32000, "No transport found for sessionId"), 400);
    }

    let body: unknown;
    try {
      body = await readJsonBody(c.req.raw, http.maxBodyBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return c.json(jsonRpcError(-32600, "Request body too large"), 413);
      }
      return c.json(jsonRpcError(-32700, "Parse error"), 400);
    }

    record.lastSeen = Date.now();
    try {
      const { incoming, outgoing } = c.env;
      await record.transport.handlePostMessage(incoming, outgoing, body);
      return neverResolve();
    } catch (error) {
      logger.error("Error handling legacy message request", {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(jsonRpcError(-32603, "Internal server error"), 500);
    }
  });

  const cleanupTimer = setInterval(
    () => {
      const cutoff = Date.now() - http.sessionTtlMs;
      for (const [sessionId, record] of sessions) {
        if (record.lastSeen < cutoff) removeSession(sessionId, "expired");
      }
    },
    Math.min(60_000, Math.max(1_000, Math.floor(http.sessionTtlMs / 2))),
  );
  cleanupTimer.unref();

  return {
    app,
    parts,
    sessions,
    close: async () => {
      clearInterval(cleanupTimer);
      for (const sessionId of [...sessions.keys()]) removeSession(sessionId, "shutdown");
      await closeServerParts(parts);
    },
  };
}

export async function main(): Promise<void> {
  const config = getConfig();
  assertHttpSecurity(config.http);
  if (config.http.allowUnauthenticated) {
    logger.warn("HTTP transport is running without authentication", {
      host: config.http.host,
      restriction: "loopback only",
    });
  }

  const application = await createHttpApplication({ config });
  const httpServer = serve(
    {
      fetch: application.app.fetch,
      port: config.http.port,
      hostname: config.http.host,
    },
    (info) => {
      logger.info("MCP Notploy HTTP server started", {
        host: config.http.host,
        port: info.port,
        authenticated: Boolean(config.http.token),
        sessionTtlMs: config.http.sessionTtlMs,
        maxSessions: config.http.maxSessions,
        endpoints: {
          streamable: `http://${config.http.host}:${info.port}/mcp`,
          legacySse: `http://${config.http.host}:${info.port}/sse`,
          health: `http://${config.http.host}:${info.port}/health`,
        },
      });
    },
  );

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down MCP HTTP server", { signal });
    httpServer.close();
    void application.close().finally(() => process.exit(0));
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
