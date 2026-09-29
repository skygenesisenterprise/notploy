# Notploy Desktop ↔ Notploy App — parity

This file is a **maintenance tool**, not a status report. It records what the
desktop client shares with Notploy App, what it adapts, and what is deliberately
absent — with the reason, so a future contributor can tell "not done yet" from
"not possible" without re-deriving it.

## How the reference was read

Notploy App (`apps/notploy`) is the reference. Three things were read from it,
in this order, because each constrains the next:

1. **The API surface** — `apps/notploy/server/api/root.ts` and the generated
   OpenAPI document (`packages/sdk/openapi.json`, 604 paths). This is what
   decides whether a feature can exist at all.
2. **The design system** — `apps/notploy/styles/globals.css`. Its `@theme`
   block and dark palette are now the desktop's, verbatim.
3. **The components and pages** — `apps/notploy/components/ui/*` for the
   primitives, `apps/notploy/pages/dashboard/*` for the screen inventory.

A static capture of the running app
(`apps/Capture d'écran du 2026-09-29 21-44-03.png`, 1912×962) was also analysed
pixel-by-pixel and **confirmed** the palette read from the stylesheet: a flat
neutral dark theme with `#0a0a0a` dominating, `#171717` panels, `#fafafa` text,
`#a1a1a1` muted text, and only 104 saturated pixels in the whole frame — all of
them emerald (`#00bc7d`) or red (`#fb2c36`). Saturated colour in this product
means **status**, never decoration.

## Design system parity

The desktop does not have its own palette. `src/renderer/styles.css` declares
App's `--background` / `--foreground` / `--card` / `--popover` / `--primary` /
`--secondary` / `--muted` / `--accent` / `--destructive` / `--border` /
`--input` / `--ring` / `--sidebar-*` variables with App's values, so the copied
components address colour through the same semantic names and resolve to the
same pixels.

Two deliberate differences:

| Difference | Reason |
| --- | --- |
| The dark palette is declared on `:root`; `<html class="dark">` is set. | The desktop has no theme toggle. The `dark:` variants inside the copied components still need a `.dark` ancestor, so the class is present even though there is nothing to switch. |
| `@tailwindcss/typography`, `fancy-ansi` and the shadcn registry layer are not imported. | They exist for marketing prose, log colourisation and the registry's own layer. No ported component uses them, and each would be a dependency carried for nothing. |

`Tone → Badge variant` mapping lives in `src/renderer/components/ui/primitives.tsx`:
`ok → green`, `warn → yellow`, `danger → red`, `info → blue`, `muted → blank`.
Those are **App's own Badge variants**, so a "Running" chip in the desktop and a
"Running" chip in the dashboard are the same component with the same classes.

## Component parity

Copied from `apps/notploy/components/ui/`, with the `cn` import pointed at
`@/renderer/lib/cn` and nothing else changed except where noted.

### Ported

| Component | Changes from App | Notes |
| --- | --- | --- |
| `button.tsx` | `busy` accepted as an alias of `isLoading` | Variants and sizes byte-for-byte identical. |
| `card.tsx` | none | Carries the `ring-1 ring-foreground/10` panel look. |
| `badge.tsx` | none | Includes the `green`/`red`/`yellow`/`orange`/`blue`/`blank` status variants. |
| `separator.tsx` | none | |
| `skeleton.tsx` | none | |
| `label.tsx` | none | |
| `table.tsx` | `"use client"` dropped | RSC marker; meaningless in a Vite bundle. |
| `alert.tsx` | none | The destructive variant backs the desktop's `ErrorNote`. |
| `input.tsx` | Copy goes through `app.copyText` (main process); the password generator is reimplemented locally | The desktop renderer's clipboard permission is denied by its content policy, so the browser clipboard is not reachable. App's `lib/password-utils` is not carried over. |

### Pending

These exist in App and are **not yet ported**. Each needs a call-site rewrite
because App's version is a Radix composition rather than a styled native
element, which is why they are tracked here instead of being half-done:

`alert-dialog`, `avatar`, `breadcrumb`, `checkbox`, `collapsible`, `command`,
`context-menu`, `dialog`, `dropdown-menu`, `form`, `popover`, `progress`,
`radio-group`, `scroll-area`, `select`, `sheet`, `switch`, `tabs`, `textarea`,
`toggle`, `tooltip`, `time-badge`, `sonner` (App's themed wrapper).

Until then the desktop uses native controls carrying App's `border-input` /
`ring-ring` / `radius` tokens, so they are visually consistent even where the
component itself is not yet shared. `sonner` **is** mounted (as `<Toaster>` in
`main.tsx`) with `theme="dark"`, so the ported `Input` and future components get
App's toast behaviour.

## Credential material never crosses the bridge

Five things the desktop lists — SSH keys, certificates, registries, backup
destinations, and the server records behind them — arrive from the API carrying
something that must not reach the renderer: a private key, certificate material,
a registry password, an S3 secret access key.

The desktop does not handle that by remembering to delete fields. Each payload is
**rebuilt field by field** in the normalizers in `src/shared/domain.ts`
(`toSshKey`, `toCertificate`, `toRegistry`, `toDestination`), so a new secret
field on the server cannot leak by default: it is simply not copied. What
survives is a **boolean** where the presence of material is worth knowing —
`hasPrivateKey`, `hasCertificateData` — which is enough for the UI to say
"incomplete" and useless to anyone else.

`tests/shared/operations.test.ts` asserts this on the **serialized** object, which
is what would actually cross the boundary, rather than on the field list, which is
what a future edit would change.

## Feature parity matrix

Status legend: **shared** = the same API and the same SDK call; **ported** = App's
component is used in the desktop; **desktop-native** = implemented differently on
purpose; **absent** = not in the desktop, with the reason in the last column.

| Feature | App | Desktop | SDK | Adaptation / reason |
| --- | --- | --- | --- | --- |
| Overview | yes | yes | shared | Aggregated in the main process (`overview.summary`), N+1 reads avoided. |
| Projects | yes | yes | shared | Same `project.all` + `environment.byProjectId` tree. |
| Environments | yes | yes | shared | Read lazily per project; the environment payload is the only way to enumerate LibSQL. |
| Applications | yes | yes | shared | Deploy / redeploy / restart / start / stop / cancel + logs. |
| Application detail page | yes | partial | shared | The desktop acts from the list and from the project tree; a dedicated detail route is pending. |
| Compose projects | yes | read-only | shared | Listed through the environment payload. **`compose.readLogs` requires a container id**, and there is no compose-scoped way to enumerate a stack's containers, so no compose log view is offered rather than a half-working one. |
| Deployments (history) | yes | yes | shared | `deployment.allCentralized`. |
| Deploy queue | yes | yes | shared | `deployment.queueList`. |
| Deployment build logs | yes | yes | shared | Polled: **the API has no WebSocket or SSE route**, so "follow" re-reads on an interval and the UI says so. |
| Kill a running build | yes | yes | shared | `deployment.killProcess`, distinct from `cancel` (`application.cancelDeployment`). |
| Preview deployments | yes | partial | shared | Shown and labelled in the history; no dedicated preview view. |
| Rollback | yes | absent | shared | `rollback.rollback` exists. Pending: it needs a target-selection UI, and a one-click rollback is too destructive to ship without one. |
| Managed databases | yes (6 pages) | yes (1 page) | shared | One engine-parameterised page instead of six near-identical ones. See below. |
| ↳ PostgreSQL / MySQL / MariaDB / MongoDB / Redis | yes | yes | shared | `*.search`, `*.one`, `*.start`, `*.stop`, `*.deploy`, `*.reload`, `*.rebuild`, `*.remove`, `*.readLogs`, `*.changePassword`. |
| ↳ LibSQL | yes | partial | shared | **No `libsql.search`** in the API, so services are enumerated from the project environment tree; **no `libsql.changePassword`**, so the action is hidden. |
| Database backups | yes | absent | shared | `backup.*` exists. Pending: it needs a destination *choice* at backup time; the destinations catalog lists them but does not select among them. |
| Volume backups | yes | absent | shared | `volumeBackups.*`, same dependency. Pending. |
| Servers | yes | yes | shared | `server.all`. |
| Docker containers | yes | yes | shared | Start / stop / restart / kill / remove + config inspection. |
| Container logs | — | absent | — | **The API exposes no container logs**, only application and deployment logs. Not a desktop gap. |
| Docker images / volumes / networks | yes | yes | shared | |
| Volume size | yes | yes | shared | Falls back to `dockerVolume.getVolumesSize` only when the cheap listing lacks sizes. |
| Docker Swarm | yes | yes | shared | `swarm.getNodes`, falling back to the legacy `cluster.getNodes`. |
| Monitoring (container health) | yes | yes | shared | `docker.getServerHealth`. |
| Disk usage | yes | yes | shared | `settings.getDockerDiskUsage` is **admin-only**; a `forbidden` is shown as "not permitted", never as an empty report. |
| Notifications (providers) | yes | yes | shared | `notification.all`. Read-only: creating a provider means a provider-specific credential form, which the dashboard owns. |
| Schedules | yes | absent | shared | **`schedule.list` takes a service id *and* a schedule type**, so the API has no instance-wide schedule route; a page would have to pick a service first. `InstanceCapabilities.schedules` already reports the router. Pending. |
| Tags | yes | yes | shared | `tag.all`, read-only. |
| Certificates | yes | yes | shared | `certificates.all`, read-only. Certificate material is reduced to `hasCertificateData` / `hasPrivateKey` before it crosses the bridge. |
| SSH keys | yes | yes | shared | `sshKey.all`, read-only. The public half is shown and copyable; the private half is reduced to `hasPrivateKey`. |
| Registries | yes | yes | shared | `registry.all`, read-only. The password is dropped by the normalizer. |
| Git providers | yes | absent | shared | Provider setup is a credential flow the dashboard owns; the desktop would only ever delete. |
| Destinations | yes | yes | shared | `destination.all`, read-only. Both access keys are dropped by the normalizer. |
| Domains, redirects, ports, mounts | yes | absent | shared | Exist in the API. Pending: each is a per-service sub-view. |
| Traefik configuration | yes | absent | shared | `settings.readTraefikConfig` et al. Pending: a config editor is its own project. |
| Secrets / Vault | yes | absent | shared | `vaultProvider.*`. Pending. |
| Users / organizations / RBAC | yes | absent | shared | `user.*`, `organization.*`, `customRole.*`. **Deliberately out of scope**: this is administration, which is App's job — see the product split below. |
| SSO / SCIM | yes | absent | shared | Same reason. |
| Audit logs | yes | absent | shared | `auditLog.all` is enterprise/Cloud; `InstanceCapabilities.auditLogs` already reports it. |
| Whitelabeling | yes | absent | shared | Same reason. |
| Billing / invoices / license | yes | absent | shared | Same reason. |
| Web server settings | yes | absent | shared | `settings.*` web-server group is administration. |
| Auth | yes | desktop-native | shared | **Secure credential storage**: the API key lives in the OS keychain (Windows DPAPI, macOS Keychain, Linux Secret Service) and is never written to a file, a log or the renderer. App keeps a session cookie because it is a browser; a desktop client must not. |
| Multi-instance | limited | desktop-native | shared | One client per connection, cached and rebuilt only when URL, credential, timeout or TLS setting changes. The App is bound to one origin. |
| System tray | — | desktop-native | — | Live state of the selected instance, instance switching, refresh, quit. |
| Native notifications | — | desktop-native | shared | Connection loss and deployment outcomes, on **transition** only. |
| Deep links (`notploy://`) | — | desktop-native | — | See `navigation.md`. |
| Command palette | — | desktop-native | — | Built from real capabilities only. |
| Close to tray / single instance | — | desktop-native | — | A second launch focuses the running window instead of racing for the same keychain entries. |
| Error, loading and empty states | yes | yes | — | Three distinct states for "empty", "not permitted" and "could not be read". |
| Capability detection | — | desktop-native | shared | The instance's own OpenAPI document is authoritative; a probe fallback exists for when it cannot be read. |

## The product split

The split is intentional and is why several App features are absent rather than
pending:

```text
App      = Administration   (users, billing, SSO, whitelabeling, provider setup)
Desktop  = Operations       (what is running, where, and what needs attention)
```

A feature is **absent on purpose** when it is an administration concern that
needs a form the dashboard owns, or when shipping it in the desktop would mean
re-implementing an account-management flow for no operational gain. Those rows
say so above. Nothing is absent silently: every `absent` row names the API it
would use.

## Rules this file enforces

1. **Never simulate a capability.** If the instance does not expose a router,
   the page says so and `InstanceCapabilities` carries the flag. Kubernetes is
   the standing example: there is no `kubernetes` router, so there is no
   Kubernetes page.
2. **Never invent an endpoint.** Every call in
   `src/main/client/notploy-client.ts` is a generated SDK operation; the table
   in that file is built from the real exports, so a renamed operation is a
   compile error.
3. **A gap is recorded, not hidden.** Moving a row from `absent` to `yes`
   requires a code change and a line in this table, in the same commit.
4. **A credential stays on the instance.** A response type in
   `src/shared/domain.ts` may describe *whether* credential material exists; it
   may never carry it. Spreading a raw payload into a shared type is how that
   rule gets broken by accident.
