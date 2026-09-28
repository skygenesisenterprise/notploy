# Notploy for Visual Studio Code

Manage [Notploy](https://notploy.com) projects, deployments, logs and infrastructure without leaving your editor.

Notploy is an open-source, self-hostable platform for deploying and operating applications. This extension adds a **Notploy** view to the Activity Bar that talks to one or several Notploy instances — Notploy Cloud, your own self-hosted instance, or one running on `localhost` — over the same public API the CLI, the TypeScript SDK, and the MCP server use.

## What you can do

- Keep your deployments, containers and servers in view while you work, in five lazy-loaded trees.
- Deploy, redeploy, restart, stop or cancel an application and watch the result without opening the dashboard.
- Read a deployment's logs, follow them while it runs, copy them, or clear the buffer.
- Inspect Docker containers, images, volumes and networks, and start, stop or restart a container.
- Bind a repository folder to an existing Notploy project so deploying is one command.
- Work with a Cloud instance and a local instance side by side: credentials and state are per instance.

## Requirements

- Visual Studio Code **1.96** or newer. There is no desktop-only or remote-specific code, so the extension works the same locally, over Remote-SSH, in a dev container, and in Codespaces.
- A reachable Notploy instance. Install one yourself with the instructions in the [Notploy documentation](https://docs.notploy.com/docs/core/installation), or sign in to [Notploy Cloud](https://app.notploy.com).
- An **API key** for that instance. Generate one in the Notploy dashboard under **Settings → API Keys**.

Notploy's public API authenticates with that key sent as an `x-api-key` header. There is no OAuth or interactive login procedure in the API, so `Notploy: Login` means "store an API key for this instance".

## Getting started

1. **Add an instance.** Open the Notploy view in the Activity Bar and run **Notploy: Add Instance**, or use the palette. Pick the kind of instance you are connecting to:

   | Kind | Default URL |
   | --- | --- |
   | Notploy Cloud | `https://app.notploy.com` |
   | Self-hosted | `https://notploy.example.com` |
   | Local | `http://localhost:3000` |

   Enter the base URL of the instance — the origin only, without `/api`; the extension appends the API path itself. Then give the instance a short label, which is what the views and the status bar show. The first instance you add becomes the active one.

2. **Log in.** Run **Notploy: Login** and paste the API key. The extension verifies it by calling `user.session` and stores it only when the instance accepts it; a rejected key is deleted again immediately, so a bad key is never left behind to be used silently by the next request.

3. **Work from the views.** The status bar shows the active instance and its connection state — when several instances are configured, click it or run **Notploy: Select Instance** to switch.

The extension activates when VS Code starts, and also when a folder containing `notploy.json`, `notploy.yaml`, `notploy.yml`, `docker-compose.yml` or `compose.yml` is opened.

## The views

### Instances

Every configured instance with its connection state. From here you can test the connection, open the instance dashboard in a browser, remove an instance, and log in or out.

**Notploy: Show Instance Capabilities** reports what a given instance actually exposes. The extension reads the instance's OpenAPI document and turns it into a capability report, so a self-hosted instance that has been trimmed down does not advertise views it cannot serve — the trees explain what is missing instead of failing on click.

### Projects

Projects, their environments, applications, and Compose projects, loaded on demand as you expand them. Each application exposes its deploy actions inline.

### Deployments

Deployment history for the selected application, newest first, bounded by the `notploy.deploymentHistoryLimit` setting. Deployments show their status, the environment and server they ran on, and offer redeploy, restart, start, stop, cancel, remove, open in browser, copy ID, and logs.

### Infrastructure

Servers, Docker (containers, images, volumes and networks), and Docker Swarm nodes. Each section is fetched only when you expand it, so opening the view does not issue a burst of requests.

Containers can be started, stopped, restarted and inspected as JSON.

### Workspace

Binds the current folder to an existing Notploy project. The view also shows the repository, branch and commit of the folder — read through VS Code's built-in Git extension only, so GitHub is never required and no additional account is needed — plus the files that suggest the folder is deployable (`Dockerfile`, Compose files, `package.json`).

## Logs

**Notploy: View Logs** writes a deployment's or application's logs into a dedicated output channel per target. **Notploy: Follow Logs** refreshes that channel on an interval until you run **Notploy: Stop Following Logs**.

The Notploy API has no streaming endpoint — there is no WebSocket or server-sent-events route — so following is polling, not a live tail. The interval is controlled by `notploy.logFollowInterval`, and the amount of output kept in memory per target is capped by `notploy.logMaxLines`.

## Binding a workspace with `notploy.yaml`

Add one of `notploy.yaml`, `notploy.yml` or `notploy.json` to a repository root to point the folder at a project:

```yaml
version: 1
instance: local # instance id or name
project: marketing # project id or name
environment: production # optional
application: website # optional
```

Values may be ids or names, the keys other than `version` are optional, and at least one of `instance`, `project`, `environment` or `application` must be present for the file to be used.

This manifest is a convention **defined by this extension**: Notploy itself has no project manifest format, and the file is ignored by the server, the CLI and the SDK. It is entirely optional — **Notploy: Create / Connect Notploy Project** stores the same binding in the workspace state instead. When a manifest is present it wins over a binding chosen from the palette, so the file stays the source of truth for everyone who clones the repository.

## Commands

All commands are available from the Command Palette under the **Notploy** category.

| Area | Commands |
| --- | --- |
| General | Open, Refresh, Copy ID |
| Instances | Add Instance, Remove Instance, Select Instance, Test Connection, Open Dashboard, Show Instance Capabilities |
| Authentication | Login, Logout |
| Deployment | Deploy, Redeploy, Restart Deployment, Start Deployment, Stop Deployment, Cancel Deployment, Remove Deployment, Open Deployment |
| Projects | Open Project, Open in Browser |
| Logs | View Logs, Follow Logs, Stop Following Logs, Clear Logs, Copy Logs |
| Infrastructure | Refresh Infrastructure, Refresh Docker, Start Container, Stop Container, Restart Container, Inspect Container |
| Workspace | Create / Connect Notploy Project, Unlink Workspace Project, Show Workspace Info |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `notploy.defaultInstance` | `""` | Id of the instance selected when a workspace opens. Empty remembers the last selection. |
| `notploy.requestTimeout` | `30000` | Timeout in milliseconds for every Notploy API request. |
| `notploy.autoRefreshInterval` | `0` | Seconds between automatic refreshes of the views. `0` disables background polling. |
| `notploy.logFollowInterval` | `3` | Seconds between log fetches while following a deployment. |
| `notploy.logMaxLines` | `5000` | Maximum number of log lines kept in memory per followed target. |
| `notploy.deploymentHistoryLimit` | `10` | Number of past deployments shown per application. |
| `notploy.confirmDestructiveActions` | `true` | Ask for confirmation before stop, cancel, remove and container actions. |
| `notploy.allowInsecureTls` | `false` | Allow self-signed or otherwise untrusted TLS certificates. Only for an instance you control on a trusted network. |
| `notploy.kubernetes.enabled` | `false` | Reserved for the Kubernetes integration. See the limitations below. |

## Security

- API keys are stored in VS Code's **SecretStorage** (the operating system keychain) and nowhere else. They are never written to `settings.json`, never to a workspace file, and never to a log line.
- An instance is removed without touching the server: only the local entry and its stored credential are deleted.
- Destructive actions (stop, cancel, remove, container stop) ask for confirmation first, and `notploy.confirmDestructiveActions` controls that.
- TLS certificates are verified. `notploy.allowInsecureTls` is an explicit, per-instance opt-in for self-signed certificates, and it is off by default.
- Request failures are normalised before they are shown, and anything that looks like a credential in an error payload is redacted.

## Known limitations

These are properties of the Notploy API, not gaps that can be closed inside the extension. The extension reports them instead of pretending otherwise.

- **Kubernetes is not available.** The Notploy API has no `kubernetes` router: the `cluster.*` and `swarm.*` procedures manage **Docker Swarm**, not Kubernetes. The Infrastructure view therefore states why Kubernetes cannot be listed rather than showing invented clusters, namespaces or pods. The `notploy.kubernetes.enabled` setting is reserved for the integration; the extension is built against a Kubernetes adapter boundary and will enable it as soon as an instance advertises the router.
- **No container logs.** The API has no endpoint that returns a Docker container's logs, so logs are available for deployments and applications only.
- **Logs are polled.** With no streaming route in the API, "following" re-fetches on an interval.
- **Availability follows the instance.** Views for routers an instance does not expose stay empty and explain why, which is expected for a trimmed-down self-hosted installation.

## Development

The extension lives in `packages/vscode` of the [Notploy monorepo](https://github.com/skygenesisenterprise/notploy). It requires Node.js 24.4 or later in the 24.x line and pnpm 10.22 or later. From the repository root:

```bash
pnpm install --frozen-lockfile
```

Then, inside `packages/vscode`:

| Command | Purpose |
| --- | --- |
| `pnpm build` | Bundle the extension into `dist/` with esbuild |
| `pnpm watch` | Rebuild on change |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm lint` | Check formatting and lint rules with Biome |
| `pnpm test` | Run the unit test suite with Vitest |
| `pnpm package` | Build and produce `notploy-vscode.vsix` |

To try a build locally, install the packaged extension into your editor:

```bash
cd packages/vscode
pnpm package
code --install-extension notploy-vscode.vsix
```

Releases are cut from tags of the form `v<major>.<minor>.<patch>-vscode`, and the tag must match the version in `packages/vscode/package.json`. The release workflow verifies, packages, and publishes the extension to the Visual Studio Marketplace before attaching the `.vsix` to a GitHub Release.

## Support

- Documentation: [docs.notploy.com](https://docs.notploy.com)
- Questions and discussions: [Notploy Discord](https://discord.gg/2tBnJ3jDJc)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)

Do not report security vulnerabilities in public issues; follow the private reporting instructions in [SECURITY.md](https://github.com/skygenesisenterprise/notploy/blob/master/SECURITY.md).

## License

[MIT](https://github.com/skygenesisenterprise/notploy/blob/master/packages/vscode/LICENSE) © Sky Genesis Enterprise
