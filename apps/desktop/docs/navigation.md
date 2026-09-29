# Notploy Desktop — navigation

The desktop keeps App's **concepts** and adapts their **representation**. A
Notploy App user should find every destination without being taught a second
mental model; the difference is that the desktop is organised around instances
and long-lived views, where the dashboard is organised around one origin and
pages.

## The model

A route is a **section** plus an optional **resource**, and it is the same shape
as a deep link. One model serves the sidebar, the command palette, the native
View menu, the tray and a `notploy://` URL, so there is one thing to keep in step
rather than four.

```text
Instance
├── Overview
├── Databases            (every engine the instance exposes)
├── Projects ───────────▶ Project
│                        └── Environments ─▶ Applications / Compose / Databases
├── Applications
├── Deployments
├── Infrastructure       (servers, containers, images, volumes, networks, Swarm)
├── Monitoring
├── Tags · Certificates · SSH keys · Registries · Destinations
└── Notifications

Connections · Settings   (local to this machine, not instance-scoped)
```

The five configuration sections share one page (`pages/operations-page.tsx`).
They are the same screen — a table of things configured on the instance — five
times, so the columns and the copy affordance live in a table there and only the
data differs. Each one is read-only and links to the dashboard form that creates
it, because every one of them needs key material or a password to create.

The user must always be able to answer four questions without leaving the window:

| Question | Answered by |
| --- | --- |
| Which instance am I operating? | The instance switcher, at the top of the sidebar, and the title strip. |
| Which section am I in? | The sidebar highlights the current section even while a resource is open. |
| Which resource am I looking at? | The breadcrumb trail, rendered by the page. |
| What did I just do? | The action's own inline result, or a toast. |

### Sidebar

Sections the active instance does not expose are shown **disabled with the
reason**, not hidden. An operator looking for "Databases" on an instance that
runs none should learn why, rather than wonder whether they mis-remembered the
menu.

### Breadcrumbs

Rendered by the page, not by the shell: the page is what knows the display
names. A project id is not a label, and inventing one in the shell would mean
re-fetching data the page already has. The last crumb is the current view and is
not a button — there is nowhere to go.

## `notploy://` deep links

```text
notploy://<section>[/<resource-path>]?instance=<name-or-id>
```

The resource path is read **relative to the section**, so it never repeats the
section name:

```text
notploy://overview?instance=production
notploy://projects/6541?instance=production
notploy://projects/6541/environments/9987?instance=production
notploy://applications/4231?instance=production
notploy://deployments/88213?instance=production
notploy://databases/postgres/5512?instance=production
notploy://infrastructure/servers/77?instance=production
notploy://ssh-keys?instance=production
notploy://connections
```

The configuration sections carry no resource path: they have no detail view to
open, so `notploy://tags` is the whole link.

### Why the instance is a query parameter

The shape `notploy://instance/section/...` looks natural but is ambiguous: a
connection may legitimately be called `projects`, and then
`notploy://projects/42` cannot be resolved. Putting the instance in the query
removes the ambiguity entirely.

An absent `instance` means "whichever instance is already active". When it is
present, the client matches it against the connection list by **id or by name**,
selects it first, and only then opens the resource — so a link always lands on
the instance it names.

### Resource and section cannot contradict

A link's section is *derived* from its resource (`RESOURCE_SECTIONS` in
`src/shared/deep-link.ts`), so `notploy://monitoring/applications/1` cannot exist
as a link that parses but points somewhere unrelated. When a path does not name a
resource the section can show (`notploy://databases/cassandra/1`), the link
degrades to the section — a useful destination — rather than being rejected
outright.

### Delivery

Three platform behaviours, reconciled in `src/main/deep-links.ts`:

| Platform | How it arrives |
| --- | --- |
| macOS | An `open-url` event on the running app — possibly **before** `whenReady`. |
| Windows / Linux | An argument of a *second* process, which the single-instance lock reports as `second-instance`. |
| Cold start | The URL is already on `process.argv` of the first process. |

Links that arrive before the router exists are queued and replayed, because
dropping the link that launched the app would be the worst possible behaviour.
`registerProtocolClient` handles the development case, where the executable is
Electron itself and the protocol has to be registered with the full command line.

A link is untrusted input: `parseDeepLink` refuses anything that is not a
recognised section, an unparseable link is logged **without echoing the URL**, and
nothing else is ever done with the raw string.

## Command palette

`Cmd/Ctrl+K`. The desktop counterpart to hunting through a sidebar, and
deliberately built only from what exists:

- **Go to** — only the sections the active instance exposes.
- **Instances** — every configured connection, with its live status.
- **Actions** — refresh, open the instance in the browser, and the
  capability-gated shortcuts ("Deploy an application" only when `deployments` is
  reported, "Open a server" only when `docker` is).

A palette full of entries that navigate to an empty page is worse than no
palette, so an entry that cannot work is not offered.

Keyboard handling is complete — arrows move, Home/End jump, Enter runs, Escape
closes, and focus returns to whatever had it — because a palette that needs the
mouse defeats its own purpose.

## Native menus

The View menu mirrors the sidebar in the same order, so the menu, the sidebar and
the palette never disagree about where something lives. `CmdOrCtrl+1`…`9` jump to
the first nine sections; the rest of the list has no accelerator and is reached
through the menu item itself or the palette.

Two rules in `menu.ts`:

- **Edit and Window use built-in roles.** Re-implementing copy/paste or minimise
  would break platform conventions.
- **"Refresh" is not a reload.** Reloading throws away all in-memory state,
  which in an operational client means losing which instance you were looking at.
  `Refresh` sends a command to the renderer, which re-reads its data; reload stays
  in the View menu as an explicit developer action.
