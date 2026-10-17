---
"@notploy/mcp": minor
---

Redesign the MCP server as a secure, agent-first automation interface: a business catalog (discovery, diagnostics, controlled deployments, long-running operation tracking) is now the default instead of 604 generated tools, with the OpenAPI surface kept behind an explicit opt-in advanced mode with read-only/deploy/full profiles.

Every call is re-authorized at execution time against the credential's effective permissions, classified by risk level, gated by an approval token for high-impact actions, bounded by timeouts, rate/concurrency limits and a result budget, verified, and recorded in a redacted audit trail.

The HTTP transport now requires a bearer token and binds to loopback by default, sessions expire and are capped and bound to the credential fingerprint, and request bodies are size-limited. Generation is deterministic with a `generate:check` CI guard over a single canonical `openapi.json`.

Breaking changes: the default tool list changes (business catalog), the advanced catalog requires `NOTPLOY_MCP_MODE`, and remote HTTP now fails closed without `NOTPLOY_MCP_HTTP_TOKEN`. Legacy `NOTPLOY_TOOL_PRESET` / `NOTPLOY_ENABLED_TAGS` / `NOTPLOY_DISABLED_TAGS` configurations are still honored and map to `advanced` mode with the `full` profile. See `packages/mcp/AUDIT.md` for the audit, confirmed risks and deferred work.
