# Notploy

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/2tBnJ3jDJc)

> Deploy and operate applications on infrastructure you own.

**Notploy** is an open-source, self-hostable platform for deploying and operating applications. It provides a web control plane for application and database deployments, Docker Compose projects, servers and clusters. Run it on your own infrastructure, or use [Notploy Cloud](https://app.notploy.com).

**Perfect for:** platform and DevOps teams, self-hosting enthusiasts, agencies running client infrastructure, and any team that wants a modern deploy experience without giving up control of the servers.

## Contents

- [Notploy](#notploy)
  - [Contents](#contents)
  - [Why Notploy matters](#why-notploy-matters)
  - [What you can do](#what-you-can-do)
    - [Deploy](#deploy)
    - [Operate](#operate)
    - [Automate](#automate)
    - [Scale](#scale)
  - [Quick start](#quick-start)
    - [Self-host with Docker Compose](#self-host-with-docker-compose)
  - [How Notploy is built](#how-notploy-is-built)
  - [Development](#development)
  - [FAQ](#faq)
    - [Is Notploy free?](#is-notploy-free)
    - [Do I have to host it myself?](#do-i-have-to-host-it-myself)
    - [What do I need to run it?](#what-do-i-need-to-run-it)
    - [Where is the documentation?](#where-is-the-documentation)
    - [How do I get help or report a bug?](#how-do-i-get-help-or-report-a-bug)
  - [Related resources](#related-resources)
    - [Official](#official)
    - [Community](#community)
    - [Commercial](#commercial)
  - [Contributing](#contributing)
  - [Security](#security)
  - [License](#license)
  - [Note](#note)

## Why Notploy matters

🎯 **You own the infrastructure** — Notploy runs on your servers, your network and your database. Nothing is locked into a managed platform, and the source is yours to audit.

🚀 **Deploy anything, the way you want** — Ship from Git providers or container images using Docker, Nixpacks, Railpack or buildpacks, and target the local server, remote servers over SSH, or a Docker Swarm cluster.

📦 **Databases are first-class** — Provision and operate PostgreSQL, MySQL, MariaDB, MongoDB and Redis with scheduled backups, without wiring up separate tooling.

🔒 **Secure by default** — Route traffic through Traefik with managed domains and certificates, keep secrets in environment variables and vaults, and restrict access with an organization and permission model.

🧩 **Automate everything** — Drive Notploy from the API, CLI, TypeScript SDK or MCP server, so deployments fit into existing pipelines instead of replacing them.

🤝 **Open source and extensible** — The platform is MIT-licensed, self-hostable, and designed around reusable provider adapters and one-click blueprints.

## What you can do

### Deploy

- Deploy applications from Git providers or container images using Docker, Nixpacks, Railpack, or buildpacks.
- Run Docker Compose projects and manage their services, configuration, logs and deployments.
- Browse one-click application blueprints in the [Notploy Templates gallery](https://templates.notploy.com).

### Operate

- Provision and operate PostgreSQL, MySQL, MariaDB, MongoDB and Redis databases, with scheduled backups.
- Route applications with Traefik, manage domains and certificates, and configure environment variables, volumes and resource limits.
- Monitor resource usage and logs, and send deployment notifications to supported providers.

### Automate

- Automate operations with the Notploy API, CLI, TypeScript SDK, or MCP server.

### Scale

- Deploy to the local server, independent remote servers over SSH, or a Docker Swarm cluster.

See the [feature guide](https://docs.notploy.com/docs/core/features) and [deployment options](https://docs.notploy.com/docs/core/deployment-options) for details.

## Quick start

The easiest way to install Notploy:

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
make install
```

After installation, open [http://localhost:3000](http://localhost:3000) to complete setup.

### Self-host with Docker Compose

Requirements: Docker Engine with the Compose plugin. The self-hosted container needs access to the host Docker socket to build and manage workloads; treat this permission as highly privileged.

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
cp .env.example .env
```

Edit `.env` before starting the stack. Set unique values for `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` (for example, generate each with `openssl rand -hex 32`), then start Notploy:

```bash
docker compose up --build -d
docker compose logs -f notploy
```

Open [http://localhost:3000](http://localhost:3000) and complete the initial setup. Keep the `.env` file private and do not expose the dashboard publicly until you have configured authentication and HTTPS. For production installation, updates, networking and TLS guidance, follow the [installation documentation](https://docs.notploy.com/docs/core/installation).

Useful Compose commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

`docker compose down` preserves the named data volumes. Do not remove them if you need to keep your Notploy database and configuration.

## How Notploy is built

Notploy is a pnpm monorepo with a single root lockfile and workspace definition:

| Path | Role |
| --- | --- |
| `apps/notploy` | Main web dashboard, API, and application server |
| `packages/server` | Shared server, deployment, database, and platform logic |
| `apps/api` | API and background-work service |
| `apps/schedules` | Scheduled jobs service |
| `packages/cli` | Notploy command-line client |
| `packages/sdk` | Generated TypeScript API SDK |
| `packages/mcp` | Model Context Protocol server |
| `packages/trpc-openapi`, `packages/github` | Shared API and integration packages |
| `web/apps/website` | Official marketing website |
| `web/apps/docs` | Product documentation |
| `templates` | Template gallery, blueprint catalogue, and validation/build scripts |
| `examples` | Standalone deployment examples; intentionally outside the pnpm workspace |

The root `Dockerfile` has `selfhosted`, `cloud`, and `dev` targets. The default self-hosted image includes deployment tooling; the cloud target uses the same application runtime without that tooling. The root Compose stack runs PostgreSQL and Notploy, while Notploy manages Traefik through the host Docker Engine when needed.

## Development

The monorepo uses **Node.js 24.4 or later in the 24.x line** and **pnpm 10.22 or later**. Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

The root development commands include:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the Notploy application |
| `pnpm build` | Build workspace packages |
| `pnpm test` | Run the application test suite |
| `pnpm typecheck` | Type-check workspace packages |
| `pnpm lint` | Run Biome checks |
| `pnpm web:dev` / `pnpm web:build` | Run or build the official website |
| `pnpm docs:dev` / `pnpm docs:build` | Run or build the documentation site |

The application requires PostgreSQL and its runtime environment configuration. For a ready-to-run local stack with PostgreSQL, use Docker Compose as described above. See `.env.example`, the [installation guide](https://docs.notploy.com/docs/core/installation), and the package scripts for service-specific development commands.

## FAQ

### Is Notploy free?

Yes. The core platform is open source and licensed under MIT, and the self-hosted edition is free to run. Some separately published packages or components may carry their own license terms; check the relevant package's license file before redistributing it. A commercial edition with additional features and premium support is maintained by [Sky Genesis Enterprise](https://skygenesisenterprise.com).

### Do I have to host it myself?

No. You can self-host with `make install` or Docker Compose, or use the hosted [Notploy Cloud](https://app.notploy.com) if you'd rather not manage the control plane.

### What do I need to run it?

Node.js 24.4+ and pnpm 10.22+ for development, or just Docker Engine with the Compose plugin for the containerized stack. The application needs a PostgreSQL database and a filled-in `.env`.

### Where is the documentation?

The full product documentation lives at [docs.notploy.com](https://docs.notploy.com). Deployment and feature guides are linked throughout this README.

### How do I get help or report a bug?

Join the [Notploy Discord](https://discord.gg/2tBnJ3jDJc) for questions, or open a [GitHub issue](https://github.com/skygenesisenterprise/notploy/issues) for bugs and feature requests. Never report a security vulnerability in a public issue — see [Security](#security).

## Related resources

### Official

- Product docs: [docs.notploy.com](https://docs.notploy.com)
- Website: [notploy.com](https://notploy.com)
- Templates: [templates.notploy.com](https://templates.notploy.com)
- Hosted platform: [app.notploy.com](https://app.notploy.com)

### Community

- Questions and discussions: [Notploy Discord](https://discord.gg/2tBnJ3jDJc)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)
- Contribution guide: [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)

### Commercial

- Commercial edition and premium support: [Sky Genesis Enterprise](https://skygenesisenterprise.com)

## Contributing

Contributions and suggestions are welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating, then follow the [contribution guide](.github/CONTRIBUTING.md) for setup and review expectations.

- Pick the right [pull request template](.github/PULL_REQUEST_TEMPLATE) for your change.
- Keep PR titles in [Conventional Commits](https://www.conventionalcommits.org) format (`fix: …`, `feat: …`, `docs: …`).
- Add a changeset with `pnpm changeset` when your change is user-facing.
- Run `pnpm test`, `pnpm typecheck` and `pnpm lint` before opening a pull request.

## Security

Do not report security vulnerabilities in public issues. Follow the private reporting instructions in [SECURITY.md](SECURITY.md).

## License

The root project is licensed under the [Apache 2.0 License](LICENSE). Some separately published packages or included components may have their own license terms; check the relevant package's license file before redistributing it.

## Note

Notploy is an open-source project maintained by [Sky Genesis Enterprise](https://skygenesisenterprise.com). Links to external services are provided for convenience and do not imply endorsement. Check each service's own terms before relying on it in production.
