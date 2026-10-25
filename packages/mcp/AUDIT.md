# Notploy MCP Audit

This document is the Phase 0 audit requested by [issue #109](https://github.com/skygenesisenterprise/notploy/issues/109). It records the state of `@notploy/mcp` before the redesign, the defects that were verified, and the work that remains deliberately deferred.

- Package: `@notploy/mcp`
- Baseline version: `0.30.7` (`1.0.0` for this release)
- Baseline commit: `9a8e9ac` (`fix: publish workflow process support registry`, repository `master`)
- Baseline date: 2026-10-17
- Specification: `openapi.json` (`info.version` = `1.0.0`, 604 operations)
- Verified with: `pnpm run type-check`, `pnpm run generate:check`, `pnpm test` (113 tests). See [Verification](#verification).

Everything below was verified by reading the code and the checked-in artifacts at that commit, or by running the checks. Items that could not be confirmed are listed separately as *potential* risks.

## Phase 0 — inventoried surface

| Area | Baseline state |
| --- | --- |
| Catalog | 604 tools generated from OpenAPI, all exposed by default, grouped in 57 tags |
| Filtering | `NOTPLOY_TOOL_PRESET`, `NOTPLOY_ENABLED_TAGS`, `NOTPLOY_DISABLED_TAGS` |
| Transports | stdio (default), Streamable HTTP, legacy SSE |
| Auth | `x-api-key` upstream; no authentication on the HTTP transport |
| Risk model | MCP annotations derived from HTTP method and operation-name keywords |
| Execution | Direct API call per tool, no permission check, no approval, no verification |
| Limits | Upstream timeout and (declared) retries; no result budget, rate limit or concurrency cap |
| Operations | None: deployments returned the API response only |
| Audit | Structured stderr logs; no MCP-level audit trail |
| Tests | Tool listing, presets, schema draft, custom headers, redaction, response formatting |

## Phase 0 — verified findings

### 1. Catalog and documentation drift

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| Two OpenAPI documents existed and diverged | `openapi.json` and `src/generated/openapi.json` differed on `/compose.update`; only the root document had `pullImages`, which matches `packages/server/src/db/schema/compose.ts` | The generator read the stale document, so one generated tool schema was wrong | A single canonical `openapi.json` at the package root; the stale copy was deleted; `meta.ts` records a SHA-256 of the spec |
| README advertised 508 tools / 49 categories while the generated catalog had 604 / 57 | `README.md` vs `TOOLS.md` and `generated/tools.ts` | Users could not trust the documented surface | `TOOLS.md` is now generated from the same declarations the runtime uses; the README derives its counts from them |
| Generation embedded the current date | Old `scripts/generate-tools.ts` header used `new Date()` | Regeneration always produced a diff, so drift checks were impossible | Deterministic output: sorted operations, no timestamp, spec hash in `meta.ts` |
| No drift check | No `generate:check` script and no MCP workflow | Stale generated files could ship | `pnpm generate:check` plus a `packages/mcp` CI workflow |

### 2. Authorization and permissions

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| The MCP layer performed no authorization of its own | `handler.ts` called the API directly; the only access control was the upstream API | Correct for the API, but the MCP layer could not refuse, classify or record anything; catalog filters were the only MCP-side control | One execution pipeline that resolves identity (`user.session`) and effective permissions (`user.getPermissions`) and re-authorizes every call; catalog filters are documented as a usability feature |
| Tool filters could be mistaken for a security boundary | README described tag filtering next to safety annotations | An operator could believe a hidden tool cannot be called | Documented and tested: filtering only decides what is listed |
| Destructive behavior was inferred from the tool name | `deriveAnnotations` used `delete`/`remove` substrings | A misnamed operation could be mislabeled and shown as safe | Risk plus a destructive invariant in the policy engine: a destructive capability is treated as high risk even if declared otherwise |

### 3. Secrets and logging

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| Error paths bypassed redaction | `handler.ts` returned `Error: ${error.message}` without `redactSensitive` | A server or proxy could echo a credential into model context | All outputs and errors pass field-based redaction and a literal-credential pass; known secrets are registered at startup |
| Credentials could appear in error text or keys | No literal-value redaction existed | Same | `redactKnownSecrets` replaces registered secret values in strings, keys and arrays |
| Reserved custom headers were too narrow | Only `x-api-key`, `content-type`, `accept` were rejected; names and values were unchecked | A custom header could override `Authorization`, `Host`, `Cookie` or inject via CRLF | Reserved list extended (auth, transport, content); header names must match the RFC 7230 token grammar and values reject control characters |
| `environment` redaction replaced a resource object | `DEFAULT_REDACTED_FIELDS` contained `environment` | Diagnostics lost the environment context for a field that holds no secret itself | Removed from the defaults; `env`, `envVars`-style and secret-bearing keys are still redacted |

### 4. HTTP transport

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| No authentication | Old `http-server.ts` served `/mcp`, `/sse`, `/messages` to anyone | An exposed instance gave an anonymous caller the full API surface of its key | Bearer token required (`NOTPLOY_MCP_HTTP_TOKEN`); the only opt-out is loopback-only and explicit |
| Bound to all interfaces | `serve({ port: 3000 })`; `docker-compose.yml` published the port with no auth | Same | Binds `127.0.0.1` by default; Compose sets `0.0.0.0` and now requires the token |
| Sessions were unbounded and never expired | Two plain objects keyed by session id, cleaned only on transport close | Memory growth and indefinite session lifetime | TTL, session cap, cleanup interval, session→credential fingerprint binding, rejection of unknown/mismatched ids |
| No request size limit | `c.req.json()` with no bound | Trivial memory pressure | `NOTPLOY_MCP_HTTP_MAX_BODY_BYTES` enforced before parsing |

### 5. Client, retries and limits

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| Axios client created at module load, config frozen at import | `utils/apiClient.ts` called `getClientConfig()` at module scope | Importing the package required env vars; credentials could not be rotated; tests had to mock the module | The client is an injected instance built from validated configuration; no import-time side effects |
| `NOTPLOY_RETRY_ATTEMPTS` / `NOTPLOY_RETRY_DELAY` were never used | No retry logic in `apiClient.ts` | Dead configuration; operators believed retries existed | Bounded exponential backoff with jitter, only for `GET`/declared-idempotent calls |
| No per-call deadline, no result budget | Only the Axios timeout existed | A slow call could occupy the client for the full timeout; a large payload could exhaust the context window | Per-call deadline, verification deadline, byte-budgeted result truncation reporting `meta.truncated` |
| `setAuthToken` / `clearAuthToken` were unused | Only exported, never called | Misleading API surface | Removed with the module |

### 6. Operations, results and tests

| Finding | Evidence | Impact | Resolution |
| --- | --- | --- | --- |
| Deployments were fire-and-forget | `application-deploy` posts the job and returns `true` | An agent could not tell whether the deployment succeeded | `execute_deployment` returns an operation id; the server verifies in the background; `get_operation_status` reports the outcome |
| Results were a JSON string in a text block | `ResponseFormatter.success` emitted `JSON.stringify` only | Clients could not rely on structured output | One envelope returned as both text and `structuredContent`, declared with `outputSchema` |
| Errors were classified by substring matching | `handler.ts` matched `"401"`, `"Unauthorized"`, `"404"` in `error.message` | Brittle mapping; server-provided text could be surfaced verbatim | Typed error codes in the adapter and one mapping table with actionable hints |
| Tests did not cover permissions, refusals, transports, approvals or generation | Baseline suite covered listing, presets, schemas, headers, redaction, formatting | Security regressions would go unnoticed | 113 tests now cover policy, execution, operations, catalog modes, HTTP security, generation and redaction |

### Potential risks (not confirmed exploitable)

- `NOTPLOY_URL` was not validated, so credentials embedded in the URL could have reached the debug log through `baseURL`. Now rejected at configuration time.
- The destructive annotation was keyword-derived, so an operation with an unexpected name could have been labeled safe. Now protected by the policy invariant.
- OpenAPI-generated operations do not declare MCP permissions; their authorization rests on the API. This is stated in each generated description and documented in the README.
- Application logs and environment variables returned by the API can contain secrets the platform does not manage (values printed by the application itself). Known MCP credentials are redacted; the limitation is documented.

## Deliverables

- **Business catalog (default):** 18 capabilities across discovery, diagnostics, deployment, administration and long-running operations, each declaring environments, permissions, risk, effects, preconditions and limitations.
- **Advanced API catalog (opt-in):** generated operations behind `NOTPLOY_MCP_MODE=advanced`, filtered by profile (`read-only` default, `deploy`, `full`), tags and explicit exclusions; legacy preset variables are honored and flagged as deprecated.
- **Policy engine:** risk levels 0–3, permission checks from effective permissions, approval token for high-impact calls, destructive opt-in, blocked capabilities, and the destructive→high-risk invariant.
- **Controlled execution cycle:** environment, schema, identity, permissions, policy, limits, idempotency, execution, verification, audit — in that order, on every call.
- **Long-running operations:** operation store (in memory, or durable JSON via `NOTPLOY_MCP_OPERATION_STORE`), identity-scoped lookup, interrupted-run detection at startup, `get_operation_status`.
- **Normalized results:** one envelope with `ok`, `status`, `message`, `data`, `error` and `meta`, returned as structured content and text.
- **Secure HTTP transport:** bearer authentication, loopback default, session TTL/cap/fingerprint, body limit, public health endpoint, graceful shutdown.
- **Deterministic generation:** single `openapi.json`, `src/generated/operations.ts` + `meta.ts` + `TOOLS.md`, and `generate:check` for CI.
- **Documentation:** rewritten `README.md`, generated `TOOLS.md`, this audit, and a CI workflow for the package.

## Verification

Run from `packages/mcp`:

```bash
pnpm run type-check    # passes
pnpm run generate:check # 604 operations, 18 business capabilities, up to date
pnpm test              # 113 tests pass
pnpm run lint          # Biome
```

The test suite runs entirely against an in-memory API double and a local HTTP server on an ephemeral port. A live smoke test against a supported Notploy instance is still required before a release; it is not run here because no instance is available.

## Acceptance criteria status

| Criterion | Status |
| --- | --- |
| A reproducible commit-bound audit is available | **Done** (this document, commit `9a8e9ac`) |
| Tool inventory and generated documents are consistent, or the difference is justified | **Done** (`meta.ts`, `TOOLS.md`, `generate:check`; the stale duplicate spec was removed) |
| Business catalog is the default; the advanced API mode is distinct and opt-in | **Done** |
| Every exposed capability has a validated schema, a useful description and metadata matching its behavior | **Done** (tested; destructive misclassification fails closed) |
| Effective permissions are enforced at execution; catalog filters are not a security boundary | **Done** for business capabilities; generated operations rely on the API's own authorization, which is documented |
| Self, Cloud and Console rights cannot be confused or escalated by a request parameter | **Done** (environment comes from server configuration only) |
| Mutating and sensitive operations are classified, authorized, logged and verified | **Done** (risk levels, approval, audit, post-condition checks) |
| Long-running operations return an understandable initial result and a follow-up mechanism | **Done** (`pending` result + `get_operation_status`) |
| Outputs and logs reveal no secrets in security tests | **Done** (field + literal redaction, tested) |
| Errors and results follow stable agent-usable conventions | **Done** (typed envelope and error codes) |
| Limits, timeouts, retries and failure behavior are defined and tested | **Done** (deadline, rate/concurrency caps, byte budget, retry rules) |
| Catalog generation is reproducible and CI-controlled | **Done** (`generate:check`, workflow) |
| Tests cover nominal cases, refusals, invalid inputs and execution failures | **Done** (113 tests) |
| Documented examples are runnable or explicitly illustrative | **Done** (client snippets are copy-paste configurations; the live server smoke test is explicitly deferred) |
| Migration does not silently break existing configurations | **Partially done** — legacy preset variables map to `advanced`/`full`; the new HTTP transport requires a token, which is a documented breaking change |

## Deferred work

1. **SDK reuse** — `@notploy/sdk` exposes generated types but not a runtime client with the permission, redaction and error semantics the MCP server needs. The adapter stays independent; revisiting this requires a shared client contract.
2. **Console-only capability set** — the `console` environment is supported as a server-side setting, but no console-only tools are exposed: selecting it grants nothing extra.
3. **Distributed operation store** — the JSON store is single-writer. Multi-instance deployments need an external queue or database, and rate limits remain per process.
4. **Generated-operation permission mapping** — mapping OpenAPI tags to effective permissions would risk denying valid calls; the API stays authoritative and the limitation is documented.
5. **Deployment log streaming and MCP `tasks`** — follow-up uses application-level operation polling, not protocol-level tasks or live log streaming.
6. **Live release smoke test** — must run against a supported Notploy instance before publishing.
7. **License metadata consistency** — `packages/mcp/package.json` declares `Apache-2.0` while the package `LICENSE` file currently contains an MIT text; the two must be reconciled before the next release.

## Follow-up — 2026-10-25 (plan directeur)

Follow-up work against the umbrella issue, verified with `pnpm run type-check`, `pnpm run generate:check` and `pnpm test` from `packages/mcp` (see package README for the full contract).

- **License reconciled to MIT**: `README.md` (badge, FAQ, License section) now declares MIT, matching `package.json` (`"license": "MIT"`) and `LICENSE` (MIT text). The stale `Apache-2.0` references are removed.
- **Counts reconciled**: the checked-in spec now generates **724** operations (`src/generated/meta.ts`); `README.md` and `TOOLS.md` report 724. The `604` references in the Phase 0 baseline above describe the pre-regeneration spec and are kept as history.
- **Connection diagnostics**: new business capability `get_connection_status` (risk 0, discovery) validates the key, resolves identity/org/permissions server-side, and reports instance, environment, catalog mode, permission keys and revocation guidance. It is the documented first call before any mutating workflow. Business catalog grows from 18 to **19** capabilities; `src/server.test.ts` updated accordingly.
- **Prompt-injection boundary documented**: `get_connection_status` and log/diagnostic capability descriptions state that retrieved Notploy content (logs, deployment output, repository metadata) is untrusted data and must never override tool policy or be executed.
- **Distribution metadata**: new `server.json` (MCP registry source, stdio + streamable-http transports, `business` default, 19 business capabilities) and `CHANGELOG.md` (SemVer + deprecation policy). `README.md` gains a Distribution section (npm, registry, Claude, ChatGPT, private-network guidance) and a Connection health flow; `web/apps/docs/content/docs/core/develop/mcp.mdx` expanded to match the implementation instead of contradicting it.
- **Remaining deferred items** (unchanged): console-only capability set, distributed operation store, generated-operation permission mapping (API stays authoritative by design), deployment log streaming / MCP tasks, live smoke test against a supported instance before release.

## Follow-up — ChatGPT first-class client (2026-10-25)

Mission: faire de ChatGPT un client de premiere classe sans creer de package `@notploy/chatgpt`, sans dependance OpenAI/SGE/Cloudflare pour Notploy Self, sans faux OAuth ni fausses URLs.

- HTTP distant: `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource"` sur 401 et `GET /.well-known/oauth-protected-resource` public. Sans `NOTPLOY_MCP_OAUTH_ISSUER` il repond 404 `oauth_not_configured` (bearer-only prive/developer-mode) ; avec issuer il expose la metadata RFC 9728. Aucun authorization server invente.
- Config: `NOTPLOY_MCP_PUBLIC_BASE_URL`, `NOTPLOY_MCP_OAUTH_ISSUER`, `NOTPLOY_MCP_OAUTH_AUDIENCE` valides, testees (`src/config.test.ts`, `src/entrypoints/http.test.ts`).
- Docs: `CHATGPT.md` (parcours dev prive, reseau, permissions, demo, diagnostic, checklist publication honnete) et `APPS-SPEC.md` (spec UI seule, aucune ressource runtime). `README.md` lie les deux ; `TOOLS.md`/`generate:check` inchanges (724 ops, 19 capacites).
- Verifie: `pnpm run typecheck`, `pnpm run lint:ci`, `pnpm run generate:check`, `pnpm run test` (116 tests). SDK `@modelcontextprotocol/sdk@^1.12.0` conserve, pas de migration aveugle.
- Bloquants restants: OAuth 2.1 + DCR complet pour listing public, validations depuis ChatGPT (compte requis), URLs support/privacy reelles, smoke test live sur instance jetable.
