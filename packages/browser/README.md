# Notploy Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](../../.github/CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/GUkDugVh34)

> Quick access to your Notploy projects and deployments, from the browser toolbar.

**Notploy Browser** is the official browser extension for [Notploy](https://notploy.com). It is a contextual shortcut to the projects and deployments your API key may access — plus deep links into the console — not a replacement for the console. It talks to one or several Notploy instances (Notploy Cloud, your own self-hosted instance, or one running on `localhost`) over the same public API the CLI, the TypeScript SDK, the VS Code extension, and the MCP server use.

**Perfect for:** checking project status and recent deployments without leaving the browser, jumping to the right console page in one click, and managing Cloud and local instances side by side.

MVP scope (P0): Chromium popup + options page, configurable instances, `x-api-key` auth, project list, recent deployments, manual refresh, and full UI states. No side panel, no GitHub contextual integration, and no diagnostics yet (see [Roadmap](#roadmap)).

## Contents

- [Notploy Browser](#notploy-browser)
  - [Contents](#contents)
  - [Why Browser matters](#why-browser-matters)
  - [What you can do](#what-you-can-do)
    - [Connect](#connect)
    - [Review](#review)
    - [Open](#open)
  - [Quick start](#quick-start)
    - [Load the extension in Chromium](#load-the-extension-in-chromium)
  - [How Browser is built](#how-browser-is-built)
    - [Package layout](#package-layout)
    - [Core components](#core-components)
    - [Shared contracts](#shared-contracts)
    - [Architecture decisions](#architecture-decisions)
  - [Development](#development)
    - [Package commands](#package-commands)
    - [Popup and options workflows](#popup-and-options-workflows)
  - [FAQ](#faq)
    - [How does sign-in work?](#how-does-sign-in-work)
    - [Where are my instances and API keys stored?](#where-are-my-instances-and-api-keys-stored)
    - [Which browsers are supported?](#which-browsers-are-supported)
    - [Can I use plain HTTP?](#can-i-use-plain-http)
    - [Where is the documentation?](#where-is-the-documentation)
    - [How do I get help or report a bug?](#how-do-i-get-help-or-report-a-bug)
  - [Related resources](#related-resources)
    - [Official](#official)
    - [Community](#community)
    - [Commercial](#commercial)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
  - [Security](#security)
  - [License](#license)
  - [Note](#note)

## Why Browser matters

🎯 **Companion, not a clone** — The console stays the system of record. The extension offers fast access and contextual links without duplicating the full application.

🚀 **API-first** — It reuses the Notploy API and `@notploy/sdk` contracts. No parallel business logic lives in the extension.

📦 **One key, several instances** — Cloud, self-hosted, and local instances coexist with per-instance credentials and state. Switching instances never leaks the previous session's projects.

🔒 **Secure by default** — Minimal base permission (`storage`), per-instance host grants, no content scripts, no history or page-content collection, HTTPS by default, and short-lived in-memory caches.

🧩 **Portable by design** — Browser differences sit behind small adapters (storage, messaging, tabs, permissions). Chromium ships first; other targets follow only after dedicated builds and tests.

🤝 **Open source and extensible** — The package lives in the Notploy monorepo with shared lint, type-check, tests, and CI, ready for diagnostics and GitHub integrations later.

## What you can do

### Connect

- Configure the Notploy instances the extension may talk to: Cloud-first, self-hosted, or local. URLs are validated and normalized to the instance origin.
- Sign in by pasting an API key generated in the dashboard under **Settings → API Keys**. The key is verified with `user.session` and kept only when the instance accepts it; a rejected key is deleted immediately.
- Grant network access per instance via optional host permissions (`https://your-instance/*`), revocable at any time in `chrome://extensions`.
- Test a connection, switch the active instance, sign out, or remove an instance (which also deletes its stored key).

### Review

- See the projects your key may access and the 20 most recent deployments with their status.
- Refresh manually from the popup (`⟳`, or `R` when the popup is focused). There is no background polling and the API timeout is 30 seconds.
- Read every UI state explicitly: unconfigured, disconnected, loading, ready, empty, error, and session-expired. Switching instance or signing out clears the previous session's data immediately.

### Open

- Open the active instance dashboard or jump to a project's (and application/service) console page directly from the popup.
- Open the API-keys page for the active instance when a key is rejected or missing.

See the [product documentation](https://docs.notploy.com) and the [API reference](https://docs.notploy.com/docs/api/index) for details.

## Quick start

The fastest way to try the extension:

```bash
pnpm install --frozen-lockfile
pnpm --filter @notploy/browser run build
```

Then load the unpacked build and add your first instance (steps below). The API key flow is the same one the CLI, SDK, and VS Code extension use: `x-api-key` header, verified with `user.session`.

### Load the extension in Chromium

Requirements: Node.js 24.4 or later in the 24.x line and pnpm 10.22 or later (monorepo standard; this package declares `engines: node >= 20.0.0`), plus Chromium 114+.

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
pnpm install --frozen-lockfile
pnpm --filter @notploy/browser run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `packages/browser/dist`.
3. Pin **Notploy** to the toolbar and open **Settings** (gear) to add an instance.
4. Grant the per-origin permission when prompted (`https://your-instance/*`).

Useful follow-ups:

```bash
pnpm --filter @notploy/browser run dev              # rebuild on change
pnpm --filter @notploy/browser run test             # run the test suite
pnpm --filter @notploy/browser run manifest:check   # verify MV3, permissions, CSP, icons
```

`pnpm dev` at the repository root runs the Notploy web application; it is unrelated to this extension's `dev` watcher.

## How Browser is built

Notploy Browser is a Manifest V3 extension bundled with esbuild for browsers. The service worker owns state and all network calls; the popup and options pages are thin vanilla TS + CSS views that talk to it through a validated message protocol. There is no framework, no remote code, and no Node-only code in the bundles.

### Package layout

```text
packages/browser/
├── manifest.json            # MV3 manifest (storage-only base permissions)
├── esbuild.mjs              # browser bundles: background / popup / options
├── scripts/
│   ├── check-manifest.mjs   # MV3, permissions, CSP, and icons verification
│   └── package.mjs          # versioned ZIP + dist secret scan
├── public/icons/            # extension icons (16 / 32 / 48 / 128 SVG)
├── src/
│   ├── background/          # service worker: state manager + storage
│   ├── popup/               # quick-access UI (html / css / ts)
│   ├── options/             # instance + sign-in UI (html / css / ts)
│   ├── api/                 # NotployBrowserClient over @notploy/sdk
│   └── shared/              # domain types, URL rules, errors, message protocol
├── tests/                   # Vitest suite + mock server helper
└── dist/                    # build output (load this unpacked in Chromium)
```

### Core components

| Path | Role |
| --- | --- |
| `src/background/index.ts` | MV3 service worker: validates messages, runs them through the state manager, never fetches unconfigured origins, never logs tokens |
| `src/background/state.ts` | Active instance, connection status, and per-instance project/deployment cache; cleared on instance switch and logout |
| `src/background/storage.ts` | `chrome.storage.local` persistence with a `MemoryStorage` fallback for hermetic tests |
| `src/popup/` | Toolbar popup: instance picker, manual refresh, projects, recent deployments, deep links |
| `src/options/` | Settings page: add/select/remove instances, API-key sign-in, test connection, API-keys shortcut |
| `src/api/client.ts` | One SDK client per instance, `x-api-key` header, per-request timeout via `AbortSignal.timeout` |

### Shared contracts

| Path | Role |
| --- | --- |
| `@notploy/sdk` | Generated TypeScript API client reused by the CLI, VS Code extension, MCP server, and this extension |
| `src/shared/types.ts` | Instance, project, deployment, and UI-state models aligned with `packages/vscode/src/core/domain.ts` |
| `src/shared/url.ts` | Origin normalization and validation (strips `/api`, paths, query, hash; rejects credentials in URL) |
| `src/shared/errors.ts` | `NotployError` taxonomy with credential redaction, mirroring `packages/vscode/src/core/errors.ts` |
| `src/shared/messages.ts` | Popup/options ↔ service-worker protocol; unknown kinds are rejected |

### Architecture decisions

Decisions below were checked against the monorepo during Phase 0 and must not be assumed otherwise.

| Question | Decision | Why |
| --- | --- | --- |
| Monorepo conventions | `packages/browser` with `build` / `dev` / `typecheck` / `lint` / `test` / `package` scripts, Biome, Vitest, `tsc --noEmit` | Same as `packages/vscode`, `packages/github`, and `packages/cli` |
| Bundler | `esbuild` 0.28.2, `platform: "browser"`, ESM, `target chrome114` | Already used by `packages/vscode`; no new framework. Vanilla TS + CSS keeps the bundle small and CSP-clean |
| API client | Reuse `@notploy/sdk` (`workspace:*`), one client per instance, `x-api-key` header, 30s timeout | `packages/sdk/src/generated/client` is `fetch`-based with no Node-only dependencies, so it bundles for browsers. No parallel business logic |
| Auth | API key pasted from Dashboard → `Settings → API Keys`, verified with `user.session`, stored only on accept, removed on reject/logout | Same contract as VS Code (`authentication-service.ts`) and the CLI. The API exposes no OAuth/interactive flow (`openapi.json`: `x-api-key` header) |
| Endpoints used | `settings.health`, `user.session`, `settings.getNotployVersion`, `settings.isCloud`, `project.all`, `deployment.allCentralized` | All present in `@notploy/sdk`; no invented endpoints |
| URL rules | Normalize to origin; allow `https` everywhere, `http` only on `localhost` / `127.0.0.1` / `[::1]`; reject credentials in URL | Mirrors `normalizeInstanceUrl` (VS Code) / `normalizeServerUrl` (CLI) with an explicit localhost exception |
| Permissions | Base `permissions: ["storage"]`; network per instance via `optional_host_permissions` + `chrome.permissions.request(origin/*)` on add | No `<all_urls>`, no content scripts, no history/page-content collection in the MVP |
| Secrets | Instance metadata in `chrome.storage.local`; tokens in `chrome.storage.local` under `notploy.tokens` (map), never `storage.sync`, never logged | Browsers expose no OS-keychain equivalent to VS Code `SecretStorage`; documented as “not a vault” — sign out on shared machines |
| Compatibility | MVP target: Chromium (Chrome, and Edge where compatible), MV3, `minimum_chrome_version 114` | Firefox and side panel deferred: different API, manifest, and storage semantics, needs a dedicated pass |

## Development

The monorepo uses **Node.js 24.4 or later in the 24.x line** and **pnpm 10.22 or later**. Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

### Package commands

Inside `packages/browser`:

| Command | Purpose |
| --- | --- |
| `pnpm build` | Bundle `background` / `popup` / `options` with esbuild into `dist/` and copy `manifest`, HTML, CSS, and icons |
| `pnpm dev` | Rebuild on change |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm lint` | Check formatting and lint rules with Biome |
| `pnpm test` | Run the unit suite with Vitest (URL validators, errors/redaction, SDK client + mock server, storage/sessions, manifest) |
| `pnpm run manifest:check` | Verify MV3, storage-only base permissions, pinned CSP, and icons |
| `pnpm run package` | Verify manifest version, build, secret-scan `dist/`, and produce `notploy-browser-0.1.0.zip` |

To try a build locally, load the packaged output as an unpacked extension (see [Quick start](#quick-start)). Releases are versioned ZIPs; signing, accounts, and store validation must be configured before any store submission.

### Popup and options workflows

**Popup** (`src/popup`):

```bash
pnpm --filter @notploy/browser run build
# chrome://extensions → Load unpacked → packages/browser/dist
```

**Options** (`src/options`): add an instance (name + URL + kind), sign in with an API key, test the connection, and jump to the API-keys page. Plain HTTP only works on localhost.

**Background worker** (`src/background`): validates every message kind, re-validates URLs, and only fetches configured instance origins. Switching instance or signing out clears the cached projects and deployments first.

## FAQ

### How does sign-in work?

Paste an API key generated in the Notploy dashboard under **Settings → API Keys**. Browser verifies it with `user.session` and stores it only when the instance accepts it. There is no OAuth or interactive login in the API, so “sign in” means “store an API key for this instance” — the same wording the VS Code extension uses.

### Where are my instances and API keys stored?

Instance metadata lives in `chrome.storage.local` under `notploy.instances`; the active id under `notploy.activeInstance`; API keys in a `notploy.tokens` map in the same local storage. Keys are never synced (`storage.sync` is never used), never written to logs, and removed on sign-out or instance removal. This storage is convenient but not an OS keychain: sign out on shared machines.

### Which browsers are supported?

Chromium MV3 (Chrome 114+, Edge where compatible), verified by local load and `manifest:check`. Firefox is intentionally out of the MVP: different extension APIs, manifest behavior, side-panel support, and storage semantics require a dedicated build-and-test pass. No browser is declared supported before that pass runs.

### Can I use plain HTTP?

Only for local instances (`localhost`, `127.0.0.1`, `[::1]`). Everywhere else requires `https://`. URLs with embedded credentials (`user:pass@host`) are rejected, and pasted `/api` suffixes or deep dashboard URLs are normalized to the instance origin.

### Where is the documentation?

The full product documentation lives at [docs.notploy.com](https://docs.notploy.com). Deployment and feature guides are linked throughout the root [README](../../README.md#related-resources).

### How do I get help or report a bug?

Join the [Notploy Discord](https://discord.gg/GUkDugVh34) for questions, or open a [GitHub issue](https://github.com/skygenesisenterprise/notploy/issues) for bugs and feature requests. Never report a security vulnerability in a public issue — see [Security](#security).

## Related resources

### Official

- Product docs: [docs.notploy.com](https://docs.notploy.com)
- API reference: [docs.notploy.com/docs/api/index](https://docs.notploy.com/docs/api/index)
- Website: [notploy.com](https://notploy.com)
- Hosted platform: [app.notploy.com](https://app.notploy.com)
- TypeScript SDK: See [`packages/sdk`](../sdk)
- CLI: See [`packages/cli`](../cli)
- VS Code extension: See [`packages/vscode`](../vscode)
- GitHub integration: See [`packages/github`](../github)
- MCP server: See [`packages/mcp`](../mcp)

### Community

- Questions and discussions: [Notploy Discord](https://discord.gg/GUkDugVh34)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)
- Contribution guide: [`.github/CONTRIBUTING.md`](../../.github/CONTRIBUTING.md)

### Commercial

- Commercial edition and premium support: [Sky Genesis Enterprise](https://skygenesisenterprise.com)

## Roadmap

From the Browser director issue. P0 below is delivered; P1–P3 are explicitly out of the MVP.

- **P0 (delivered):** installable Chromium extension, instance configuration and selection, approved `x-api-key` auth, permitted projects and deployments only, loading/error/empty/disconnected/session-expired states, deep links, documented permissions and limits.
- **P1 — Contextual integration and Web diagnostics:** persistent side panel if worthwhile and supportable; active-tab domain inspection only after an explicit user action (hostname, protocol, observable redirects/headers); explicit browser-observed vs. Notploy-provided labeling; domain ↔ project association when APIs and rights allow.
- **P2 — GitHub integration:** repository-page shortcut to the linked Notploy project when an association exists; deployment info via Notploy APIs; reuse `packages/github` contracts; no extra personal token when the existing integration suffices; modular and switchable off.
- **P3 — Advanced:** extension/context-menu actions, explicitly user-generated diagnostic reports, MCP/agent hooks via authorized and auditable interfaces only, deployment-assistance data the user may already access. Notifications, automations, and mutating actions only after demand is evaluated.

Compatibility note: API compatibility follows the instance. A trimmed self-hosted instance that does not expose `project.all` or `deployment.allCentralized` shows empty states with the server's message instead of invented data. No automatic store publication: `pnpm run package` produces a versioned ZIP for review.

## Contributing

Contributions and suggestions are welcome. Please read the [Code of Conduct](../../CODE_OF_CONDUCT.md) before participating, then follow the [contribution guide](../../.github/CONTRIBUTING.md) for setup and review expectations.

- Keep PR titles in [Conventional Commits](https://www.conventionalcommits.org) format (`fix: …`, `feat: …`, `docs: …`).
- Add a changeset with `pnpm changeset` when your change is user-facing.
- Run `pnpm --filter @notploy/browser run test`, `pnpm --filter @notploy/browser run typecheck`, and `pnpm --filter @notploy/browser run lint` before opening a pull request.
- Keep base permissions to `storage`; any new permission needs a justification in this README and in `manifest.json`.

## Security

Do not report security vulnerabilities in public issues. Follow the private reporting instructions in [SECURITY.md](../../SECURITY.md).

Browser-specific rules enforced in code and checked by `manifest:check` and tests:

- Minimal base permission (`storage`); hosts granted per instance and revocable in `chrome://extensions`.
- No content scripts in the MVP; no history, tab-URL, or page-content collection.
- `http:` rejected outside loopback; origins re-validated before every request; messages kind-checked with unknown kinds rejected.
- Only configured instance origins are ever fetched. Tokens never appear in URLs, logs, or error surfaces (`redact()` mirrors the VS Code extension).
- CSP: `script-src 'self'; object-src 'self'` — no remote code, no `eval`.
- No privileged operations from the extension (no Docker socket, hosts, secrets, or database access).

## License

[MIT](LICENSE) © Sky Genesis Enterprise. The root project is licensed under [Apache 2.0](../../LICENSE); this package carries its own MIT terms — check the package license file before redistributing it.

## Note

Notploy is an open-source project maintained by [Sky Genesis Enterprise](https://skygenesisenterprise.com). Links to external services are provided for convenience and do not imply endorsement. Check each service's own terms before relying on it in production.
