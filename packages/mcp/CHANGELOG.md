# Changelog — `@notploy/mcp`

All notable changes to the MCP server are documented here.
Versioning follows SemVer for tool names and response envelopes;
contract compatibility is described below.

## [1.0.0] — 2026-10-25

### Added

- Business catalog by default (19 capabilities): `get_connection_status`,
  `list_projects`, `get_project`, `get_application`,
  `get_environment_overview`, `list_servers`, `list_application_domains`,
  `get_deployment_status`, `get_deployment_history`, `get_application_logs`,
  `inspect_application_health`, `diagnose_deployment`,
  `analyze_recent_failures`, `verify_deployment`, `prepare_deployment`,
  `execute_deployment`, `restart_application`, `delete_application`,
  `get_operation_status`.
- Opt-in advanced catalog: generated OpenAPI operations filtered by profile
  (`read-only` default, `deploy`, `full`), tags and explicit exclusions.
- Single execution pipeline: environment → schema → identity
  (`user.session`) → effective permissions (`user.getPermissions`) → policy
  → limits → idempotency → execution → verification → redacted audit.
- Long-running operations: `execute_deployment` returns an `operationId`;
  `get_operation_status` polls the verified outcome (durable JSON store
  optional via `NOTPLOY_MCP_OPERATION_STORE`).
- Secure HTTP transport: bearer token required, loopback default, session
  TTL/cap/fingerprint binding, body limit, public `/health`.
- `server.json` MCP registry metadata; deterministic generation
  (`pnpm generate` / `pnpm generate:check`) for `src/generated/` and
  `TOOLS.md`.

### Security

- Risk levels 0–3 with destructive→high-risk fail-closed invariant.
- Approval token for risk 2; destructive additionally requires
  `NOTPLOY_MCP_ALLOW_DESTRUCTIVE=true` and `confirm: true` where applicable.
- Field-based + literal secret redaction; `NOTPLOY_URL` validation;
  reserved custom-header rejection; audit never records inputs.

### Compatibility

- Tool names are stable; renaming is a major version change.
- Response envelope (`ok`, `capability`, `status`, `message`, `data`,
  `error`, `meta`) is stable; new optional fields are minor changes.
- Deprecated: `NOTPLOY_TOOL_PRESET`, `NOTPLOY_ENABLED_TAGS`,
  `NOTPLOY_DISABLED_TAGS` (mapped to `advanced`/`full`; migrate to
  `NOTPLOY_MCP_*` variables).

## Versioning policy

- **Major**: tool renames/removals, envelope breaking changes, auth contract
  changes, default catalog changes.
- **Minor**: new business capabilities, new optional inputs/outputs.
- **Patch**: bug fixes, redaction/policy hardening, docs and metadata.
- Deprecations are announced one minor version before removal.
