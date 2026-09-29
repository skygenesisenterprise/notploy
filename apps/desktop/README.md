# Notploy Desktop

Native client to control and operate one or several [Notploy](https://notploy.com) instances from a single window.

Notploy is an open-source, self-hostable platform for deploying and operating applications. The web dashboard remains the full administration interface; the desktop client is the **operational control centre** — what is running, where, and what needs attention — and it talks to Notploy Cloud, a self-hosted instance, a local one, or several at once, over the same public API the CLI, the TypeScript SDK, the MCP server and the VS Code extension use.

## What you can do

- Keep several instances configured at once (Cloud, staging, production, a home lab) and switch between them without re-authenticating.
- See at a glance what an instance is running: projects, applications, deployments, servers and containers.
- Deploy, redeploy, restart, start, stop and cancel an application, and read its container logs.
- Inspect the deployment history and the deploy queue, and read or follow a deployment's build log.
- Work with Docker: containers (start, stop, restart, kill, remove, inspect), images, volumes, networks and Docker Swarm nodes.
- Watch container health per server and Docker's disk usage report.
- Have the instance's real capabilities reported rather than guessed: the client reads the instance's own OpenAPI document and says which routers exist, so a trimmed-down self-hosted install explains itself instead of showing empty pages.

## Requirements

- Node.js **24.4 or later in the 24.x line** and pnpm **10.22 or later** for development.
- A reachable Notploy instance — install one with the [Notploy documentation](https://docs.notploy.com/docs/core/installation), or sign in to [Notploy Cloud](https://app.notploy.com).
- An **API key** for that instance, generated in the Notploy dashboard under **Settings → API Keys**.

Notploy's public API authenticates with that key sent as an `x-api-key` header. There is no OAuth or interactive login in the API, so "signing in" means storing an API key for a connection.

## Architecture

```
Electron main process                      src/main
├── window lifecycle, native menus         window.ts, menu.ts
├── secure storage (OS keychain)           security/
├── connection manager (one per instance)  connection/
├── Notploy client (built on @notploy/sdk) client/
├── OS notifications                       notifications.ts
└── filesystem, logging, IPC handlers      store/, logging.ts, ipc.ts

Preload                                    src/preload
└── contextBridge — a closed list of operations, nothing else

Renderer                                   src/renderer
└── React 19 + Vite + Tailwind UI

Identity                                   assets/
└── generated icon and mark (generate-icon.mjs)
```

The three layers share exactly one contract, `src/shared/ipc.ts`, which defines
the channels, the payload types and the bridge the renderer consumes. Adding a
channel without a handler is a type error.

### Connections

A connection is `{ id, name, url, kind, allowInsecureTls, timeout }`. Non-secret
metadata lives in `connections.json` in the app's user-data directory; the API key
lives in the operating system keychain (see **Security**). The main process owns
one client per connection and caches it, rebuilding only when the URL, the
credential, the timeout or the TLS setting changes.

`kind` (`cloud`, `self-hosted`, `local`, `custom`) is presentation only. What an
instance can do is never inferred from it: the client reads the instance's
OpenAPI document, or probes a small set of read-only endpoints when the document
is not available.

### Capability detection

`settings.getOpenApiDocument` is the primary source, because it is the
authoritative list of routers the running instance exposes. When it cannot be
read, a probe fallback marks each router as available, restricted or missing. A
capability the API does not have stays `false` — Kubernetes, for example, has no
router and therefore no page.

## Security

- **API keys are stored in the OS keychain**, through Electron's `safeStorage`:
  Windows DPAPI, the macOS Keychain, and Linux Secret Service (gnome-libsecret or
  kwallet). The encrypted blobs live in a `secrets/credentials.json` file with
  owner-only permissions; the key never reaches the config file, a log line, or
  the renderer.
- **When no keyring is available**, nothing is written in clear. The client falls
  back to session-only memory storage and says so in Settings, rather than
  pretending the credential is protected.
- **The renderer is sandboxed**: `contextIsolation: true`, `nodeIntegration:
  false`, `sandbox: true`, `webSecurity: true`. It reaches the main process only
  through a fixed list of operations exposed with `contextBridge`, and it cannot
  invoke an arbitrary channel.
- **The renderer has no network access.** Every API request is made by the main
  process; requests that are not the app's own bundle are cancelled at the
  session level, and every permission request (camera, geolocation, clipboard
  read, …) is denied.
- **Navigation is locked down.** A link opens in the system browser; the app
  window can never be navigated away from its bundle, and `http(s)` is the only
  protocol ever handed to `shell.openExternal`.
- **TLS verification is on by default.** `allowInsecureTls` is an explicit,
  per-connection opt-in that routes that connection's requests through its own
  Chromium session.
- **Everything that crosses the IPC boundary is validated and normalized.** Only
  `NotployError.toSerialized()` reaches the renderer, and anything resembling a
  credential is redacted before it is logged or displayed.
- **Destructive actions ask first**, controlled by
  `confirmDestructiveActions` (on by default).

## Development

From the repository root:

```bash
pnpm install --frozen-lockfile
```

Then, inside `apps/desktop`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server + esbuild watch + Electron, restarted on main-process changes |
| `pnpm build` | Build the main process, the preload and the renderer into `dist/` |
| `pnpm typecheck` | Type-check the Node side and the renderer with `tsc --noEmit` |
| `pnpm lint` | Check formatting and lint rules with Biome |
| `pnpm test` | Run the unit tests with Vitest |
| `pnpm start` | Run the built app with Electron |
| `pnpm package` | Build and produce installers with electron-builder |
| `pnpm package:dir` | Build an unpacked app directory, without an installer |
| `pnpm generate:icon` | Regenerate the app icon and the vector mark from their geometry |

The main process and the preload are bundled with esbuild (`scripts/`), the
renderer with Vite. `electron-builder.yml` packages `dist/`, the manifest and the
icon assets: every dependency is inlined, so a packaged app ships no
`node_modules` tree.

### Identity

`assets/notploy.svg` and `assets/icon.png` (1024×1024) are generated by
`scripts/generate-icon.mjs` from the same hexagonal crate-and-arrow geometry the
VS Code extension uses, so the editor, the installers and the app window carry
one identity. The generator is dependency-free — it rasterises the mark with a
supersampled point-in-polygon test and writes the PNG with Node's `zlib` — which
is why the icon can be regenerated in CI without an image toolchain.

`electron-builder` derives the macOS `.icns` and the Windows `.ico` from the
single PNG. The renderer masks the SVG with `currentColor` for the in-app mark
(`src/renderer/components/brand-mark.tsx`), and the main process reads the PNG
for the window and taskbar icon on Linux and Windows.

The unit tests never touch Electron or a real instance: they use an in-process
stand-in for the Notploy REST API (`tests/helpers/mock-server.ts`) that the real
SDK client talks to, which is what keeps the request and error paths under test.

## Known limitations

These follow from the Notploy API, not from the client, and the UI states them
rather than hiding them.

- **Kubernetes is not available.** The API has no `kubernetes` router; the
  `cluster.*` and `swarm.*` procedures manage Docker Swarm. No Kubernetes page
  exists.
- **Logs are polled, not streamed.** There is no WebSocket or server-events
  route, so "follow" re-reads on an interval.
- **No container logs.** The API exposes logs for applications and deployments
  only.
- **Disk usage is admin-only.** A non-admin API key gets a `forbidden`, which is
  shown as "not permitted" rather than as an empty report.
- **Notification providers are read-only here.** Creating one means filling in a
  provider-specific credential form, which the dashboard already owns.
- **Availability follows the instance.** Pages stay empty and explain why for
  routers an instance does not expose.

## Support

- Documentation: [docs.notploy.com](https://docs.notploy.com)
- Questions and discussions: [Notploy Discord](https://discord.gg/2tBnJ3jDJc)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)

Do not report security vulnerabilities in public issues; follow the private
reporting instructions in [SECURITY.md](https://github.com/skygenesisenterprise/notploy/blob/master/SECURITY.md).

## License

[MIT](https://github.com/skygenesisenterprise/notploy/blob/master/LICENSE) © Sky Genesis Enterprise
