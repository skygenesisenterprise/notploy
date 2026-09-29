# Notploy Desktop — architecture

Notploy Desktop is a **client of Notploy Platform**, not a second implementation
of it. It renders what an instance reports, performs the actions the API
defines, and adds the things an operating system can do and a browser cannot.

```text
Notploy Platform
├── API  ·  Authentication  ·  RBAC  ·  Deployments
├── Infrastructure  ·  Monitoring  ·  Events  ·  Capabilities
                        │
                        ▼
                  @notploy/sdk          (packages/sdk, generated from OpenAPI)
                        │
                        ▼
                 Notploy Desktop
```

Nothing between the SDK and the UI re-implements the API: no second client, no
second set of models, no business logic that belongs on the server.

## Layers

```text
Electron main process                      src/main
├── lifecycle, window, menus, tray         index.ts, window.ts, menu.ts, tray.ts
├── deep links                             deep-links.ts
├── secure storage (OS keychain)           security/
├── one client per instance                connection/, client/
├── SDK-backed services                    services/
├── deployment watcher → OS notifications  deployment-watcher.ts, notifications.ts
└── filesystem, logging, IPC, clipboard    store/, logging.ts, ipc.ts

Preload                                    src/preload
└── contextBridge: a closed list of operations, nothing else

Renderer                                   src/renderer
└── React 19 + Vite + Tailwind 4
    ├── App on Notploy App's design tokens  styles.css
    ├── components ported from App          components/ui/
    ├── one page per section                pages/
    └── the five configuration catalogs     pages/operations-page.tsx
        share one page

Shared contract                            src/shared
├── IPC channels, payload types, bridge     ipc.ts
├── domain model                            domain.ts
├── status vocabulary (UI + tray)           status.ts
└── `notploy://` codec (main + renderer)    deep-link.ts
```

The three layers share exactly one contract, `src/shared/ipc.ts`. `IpcInvokeMap`
is the single source of truth: the main process registers handlers against it and
the preload implements `NotployBridge` from it, so **adding a channel without a
handler is a type error**.

`src/shared/*` must stay free of `node:` and `electron` imports — the renderer
imports these modules directly and runs sandboxed.

## Capability detection

The client never decides what to show from a version number or a
cloud/self-hosted flag. It asks the instance:

1. **`settings.getOpenApiDocument`** — the instance returns its own OpenAPI
   document, which lists the routers it really exposes. A router added to the
   server is picked up without a client release.
2. **Probe fallback** — when the document cannot be read (restricted credential,
   older instance), a small set of read-only probes marks each router available,
   restricted or missing.

`InstanceCapabilities` carries one flag per concern — including one per database
engine, because the routers are separate and an instance can expose Postgres
while omitting LibSQL. `databases` is the aggregate the navigation uses.

A capability the API does not have stays `false` and the UI explains it. The
page for a missing router names the router and says the availability came from
the instance's own document.

## The client layer

`src/main/client/notploy-client.ts` is the only module allowed to import
generated SDK operations. Everything above it deals in `src/shared/domain` types.

- **One client per connection.** The SDK ships a process-wide `client`
  singleton; the desktop never uses it, because one window is routinely
  connected to several instances at once.
- **A per-request timeout**, enforced through an injected `fetch`.
- **Every failure becomes a `NotployError`** with a user-safe message. Only
  `toSerialized()` crosses the IPC boundary, so a raw SDK error body, a stack
  trace or a token can never reach the renderer.
- **One deliberate `as` cast per generated operation**, in the database dispatch
  table. Six engines expose the same procedure names as six differently-typed
  functions; erasing the option type once there is what turns them into a table
  instead of six near-identical methods. Because the entries are the *real*
  exports, a renamed operation is still a compile error.

The response types in `src/shared/domain.ts` are hand-written and say so: the
generated OpenAPI responses for most procedures are declared as empty objects,
so response shapes have no generated types.

## Services

One service per concern, each holding a `ConnectionManager` and nothing else:

| Service | Covers |
| --- | --- |
| `overview-service` | The Overview aggregate, with per-section notes instead of zeros. |
| `project-service` | Projects, environments, applications, Compose, application logs and actions. |
| `deployment-service` | History, queue, build logs, kill/cancel/remove. |
| `database-service` | Six engines behind one implementation; LibSQL resolved from the project tree. |
| `infrastructure-service` | Servers, containers, images, volumes, networks, Swarm. |
| `monitoring-service` | Container health and Docker disk usage (admin-only, reported as such). |

A service method that reads through `authenticatedClient()` surfaces a missing or
rejected API key as a `NotployError` the UI can explain, rather than as an empty
list.

## Ownership of state

| State | Owner |
| --- | --- |
| Connection list and active selection | main process (`ConnectionManager`); pushed to the renderer and the tray |
| Credentials | main process only, in the OS keychain |
| Capabilities and connection status | main process; recomputed on check |
| Route | renderer |
| Refresh token | renderer; one counter every page watches |
| Preferences | main process, read by both sides |

The renderer never polls the connection list. `manager.onChanged` emits the full
list to every subscriber, so the window and the tray are two views of one source
of truth rather than two copies that can disagree.

## Process boundaries

`window.ts` holds the security boundary, and each setting is load-bearing:

- `contextIsolation: true` — the preload's globals are not shared with the page.
- `nodeIntegration: false` — no `require`, no `process`, no `fs` in the renderer.
- `sandbox: true` — the renderer runs in Chromium's sandbox; the preload gets
  only the IPC primitives, which is all it uses.
- `webSecurity: true`, `allowRunningInsecureContent: false`.

On top of that, the session applies `security/content-policy.ts`: the renderer may
load only its own bundle (or the Vite dev server), **every** other request is
cancelled, and every permission request — camera, geolocation, clipboard — is
denied. The renderer therefore has no network path at all: every API call is made
by the main process and crosses IPC as data. Clipboard *writes* go through
`app:copy-text` for the same reason.

`security/` also owns credential encryption: `safe-storage.ts` resolves Electron's
`safeStorage` to a backend (DPAPI, Keychain, libsecret) and falls back to
session-only memory — **saying so in Settings** — when no keyring exists, rather
than writing a secret in clear.

`ipc.ts` treats the renderer as untrusted in both directions: every argument is
validated and normalized (`assertId`, `requireHttpUrl`, `requireEngine`, …) and
only serialized errors cross back.

## Build

The main process and the preload are bundled with esbuild (`scripts/`), the
renderer with Vite. `electron-builder.yml` packages `dist/`, the manifest and the
icon assets; every dependency is inlined, so a packaged app ships no
`node_modules` tree.

See `development.md` for the workflow and `native-capabilities.md` for the
OS-facing pieces.
