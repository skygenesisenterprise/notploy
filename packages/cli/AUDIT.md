# Notploy CLI Audit

This document is the baseline audit requested by [issue #107](https://github.com/skygenesisenterprise/notploy/issues/107). It records the state of `@notploy/cli` before the hardening work, the defects that were fixed, and the work that remains deliberately deferred.

- Package: `@notploy/cli`
- Baseline version: `1.0.0`
- Baseline date: 2026-10-17
- Specification: `openapi.json` (`info.version` = `1.0.0`)
- Baseline generated surface: **604 endpoints in 57 groups** (the previous README claimed 449 commands, which was stale)

## Phase 0 — baseline findings

### 1. Package and runtime

| Finding | Impact | Resolution |
| --- | --- | --- |
| `engines.node` declared `>=18.0.0`, while the test toolchain (Vitest 4) requires a newer runtime and Node 18 is end-of-life | Engine contract did not match the supported toolchain | Raised to `>=20.19.0`; repository CI uses Node 24.4 |
| `tsconfig.json` did not declare Node types, so `tsc -b` could not resolve `process`, `node:fs`, etc. under the current TypeScript | Build could fail on a clean checkout | Added `"types": ["node"]` |
| No package-level ignore file for Biome (`vcs.useIgnoreFile`) | `pnpm lint` failed with “couldn't find an ignore file” | Added `.gitignore` with `node_modules`, `dist`, `.env` and the legacy config |
| README command count and group list were stale | Users could not trust the documented surface | README now derives its counts from the generator output (604 / 57) |
| `CONTRIBUTING.md` said `cd cli` and pointed at the wrong layout | Setup instructions failed from the repository root | Rewritten for `packages/cli` and the root pnpm workflow |

### 2. Configuration and credentials

| Finding | Impact | Resolution |
| --- | --- | --- |
| Config was written to `path.join(__dirname, "..", "config.json")`, i.e. inside the installed package | Global installs could fail with `EACCES` or write into `node_modules`; config was lost on upgrade | User-level OS config directory (`XDG_CONFIG_HOME`/`~/.config`, Application Support, `%APPDATA%`), overridable with `NOTPLOY_CONFIG_DIR` |
| No permissions were applied | Credentials could be world-readable | Directory `0700`, file `0600` where supported; atomic write via temp file and rename |
| Only one credential pair existed | Staging and production credentials mixed easily | Named profiles with current-profile selection |
| No profile inspection commands | Users could not verify what would be used | `auth status`, `profile list`, `profile show` with redacted tokens |
| Legacy package-local config was the only format | Existing users would lose access after the move | Legacy flat config is read and migrated in memory; `auth` writes the new format |
| Error paths used `process.exit(1)` and printed `err.message` | Library-style functions were hard to test and could leak server-provided text | `CliError` with stable codes; all output goes through redaction |

### 3. HTTP and errors

| Finding | Impact | Resolution |
| --- | --- | --- |
| Axios client had no timeout | Hung pipelines could wait indefinitely | `--timeout` / `NOTPLOY_TIMEOUT`, default 30 s, range 1 s–10 min |
| Network, HTTP, tRPC and validation errors had no common shape | Exit codes and messages were inconsistent | `normalizeError()` maps `401/403 → 3`, `400/409/422 → 2`, `5xx/404/429/network → 4`, timeout → `5` |
| tRPC responses with an `error` object and HTTP 200 were not detected | Failures could be treated as success | `unwrapResponse()` detects tRPC errors and maps `UNAUTHORIZED`/`FORBIDDEN` to auth |
| Request headers could be included in Axios error text | API keys could leak into logs | Errors never copy the request config; known secret values and common header patterns are redacted |
| No User-Agent or shared client | Hard to identify CLI traffic and easy to diverge behavior | One shared client with `notploy-cli/<version>` and consistent headers |

### 4. Commands and output

| Finding | Impact | Resolution |
| --- | --- | --- |
| Generated actions did not catch errors | Async rejections could produce stack traces instead of stable exit codes | Every generated command calls `runApiCommand()`, which owns errors and exit codes |
| `--json` was per-command only and mixed with human output paths | Automation could not rely on stdout | Global and per-command `--json`; JSON success data and JSON errors are the only stdout content |
| Success text could be printed to stdout in JSON mode | `jq` and scripts broke | Diagnostics go to stderr; `null` results print as JSON `null` in JSON mode |
| No documented exit-code contract | CI had to parse messages | Documented and tested codes `0, 1, 2, 3, 4, 5, 130` |
| No non-interactive guarantee | CI could hang on a prompt | Prompts only on TTY, not `CI=true`, not `--no-input`, not `NOTPLOY_NO_INPUT=1` |
| No `doctor` or server inspection | Connection/auth problems were diagnosed by trial and error | `doctor` checks config, permissions, timeout, auth, manifest and connectivity; `server info` reports identity/latency/clock |
| No project-level identifier source | Long `--applicationId`/`--environmentId` flags in every pipeline | Optional validated `notploy.yaml` with environment overlays and env-var fallbacks |

### 5. Generator

| Finding | Impact | Resolution |
| --- | --- | --- |
| Arrays and objects were exposed as strings | Users had to guess the encoding and could send the wrong type | Explicit JSON array/object options with local validation |
| Nullable numbers were coerced with `Number("null")` | `NaN` could be sent to the API | Nullable metadata; literal `null` is sent as JSON null |
| Optional booleans could only be set to `true` | No way to send `false` | `--flag` / `--no-flag` and optional explicit boolean values |
| Enums were only mentioned in descriptions | Invalid values reached the server | Enum values are embedded in metadata and validated locally |
| Required options used Commander's `requiredOption` | Could not fall back to env/manifest values | Required metadata is validated by the shared runner after fallbacks |
| `$ref` and `allOf` were ignored in request bodies | Some schemas could not be mapped | Local `$ref`, `allOf`, `anyOf`, `oneOf` and nested object handling |
| No deterministic check | Stale generated output could ship | Stable sorting/hash header; `pnpm generate:check` fails on drift |
| Generated file contained per-command output logic | Cross-cutting behavior diverged | Generated file now contains only command metadata and calls `runApiCommand()` |

### 6. Tests and CI

Baseline tests covered only help/version output and a few config functions. They did not exercise authentication, HTTP failures, JSON isolation, exit codes, non-TTY behavior, profiles, manifests or generation drift.

Added coverage:

- config locations, permissions, precedence and legacy migration;
- `.env` loading and timeout validation;
- secret redaction and error normalization;
- YAML parsing, manifest validation, environment overlays and secret rejection;
- deterministic generation, stale-output comparison, schema types and reserved-name failures;
- end-to-end CLI runs against a local mock API: JSON stdout, exit codes `2`–`5`, profile isolation, schema coercion, `doctor`, `server info` and `notploy.yaml`.

## Verification

Run from `packages/cli`:

```bash
pnpm generate:check   # 604 commands in 57 groups; up to date
pnpm typecheck        # passes
pnpm test             # 73 tests pass
pnpm lint:ci          # passes
```

The tests use a local HTTP mock server. A live smoke test against a supported Notploy instance is still required before a release; it is not run in this environment because no instance is available.

## Acceptance criteria status

| Criterion | Status |
| --- | --- |
| Documented audit of the current CLI, inherited assumptions and defects | **Done** (this document) |
| Configuration location and precedence documented and tested | **Done** |
| API keys not written to project files or emitted by logs/errors/diagnostics | **Done** (manifest rejects secrets; output redacts; profiles are user-level) |
| HTTP timeout strategy and normalized errors without credential leaks | **Done** |
| Tests for representative generated commands, required/optional params and non-string types | **Done** |
| Deterministic generation and CI stale-output detection | **Done** (`generate:check`; workflow added) |
| Valid JSON on stdout, diagnostics on stderr | **Done** and tested |
| Exit codes and non-interactive behavior documented and tested | **Done** |
| Multi-instance/profile behavior documented and tested | **Done** |
| At least one end-to-end CI example validated against a supported instance | **Partially done** — GitHub Actions and shell examples are documented; the mock-API E2E suite passes, but no live instance was available for a release smoke test |
| Package metadata, README, contribution guide and package contents consistent | **Done** for `package.json`, `readme.md`, `CONTRIBUTING.md` and the `dist`/bin layout; npm publication state was not verified |
| Release notes describe compatibility impact, Node versions and deprecations | **Changeset added**; final release notes are produced by the release workflow |
| Real smoke test and automated checks pass before release | **Automated checks pass**; live smoke test remains a release gate |

## Deferred work

These items are intentionally not bundled into the hardening change:

1. **TypeScript SDK boundary** — `@notploy/sdk` remains a separate deliverable with its own API and versioning. The CLI does not expose internals as a programming interface.
2. **Deployment wait/log follow** — `application deploy` starts a deployment; a `--wait` helper and true log streaming depend on server support and stable response fields. Use the generated `deployment`/`read-logs` endpoints in the meantime.
3. **OS keychain storage** — credentials currently live in a `0600` JSON file. A keychain-backed store needs a cross-platform dependency and a migration policy.
4. **Expanded manifest** — only non-secret identifiers, profile selection, timeout and environment overlays are supported initially. Build settings and deployment defaults need a documented contract first.
5. **Live release smoke test** — must run against a supported Notploy instance before publishing.
6. **npm publication/dist-tag audit** — the release workflow must confirm the published version and tags; the repository version alone is not evidence.
7. **CI provider integrations beyond GitHub Actions/shell** — add only when maintainable and based on real usage.
