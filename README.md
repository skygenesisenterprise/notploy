# Notploy

Notploy is an open-source, self-hostable platform for deploying and operating applications. It provides a web control plane for application and database deployments, Docker Compose projects, servers, and clusters. Run it on your own infrastructure, or use [Notploy Cloud](https://app.notploy.com).

## What you can do

- Deploy applications from Git providers or container images using Docker, Nixpacks, Railpack, or buildpacks.
- Run Docker Compose projects and manage their services, configuration, logs, and deployments.
- Provision and operate PostgreSQL, MySQL, MariaDB, MongoDB, and Redis databases, with scheduled backups.
- Route applications with Traefik, manage domains and certificates, and configure environment variables, volumes, and resource limits.
- Monitor resource usage and logs, and send deployment notifications to supported providers.
- Deploy to the local server, independent remote servers over SSH, or a Docker Swarm cluster.
- Automate operations with the Notploy API, CLI, TypeScript SDK, or MCP server.
- Browse one-click application blueprints in the [Notploy Templates gallery](https://templates.notploy.com).

See the [feature guide](https://docs.notploy.com/docs/core/features) and [deployment options](https://docs.notploy.com/docs/core/deployment-options) for details.

## Quick start

The easiest way to install Notploy:

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
make install
```

After installation, open [http://localhost:3000](http://localhost:3000) to complete setup.

### Alternative: Docker Compose (manual)

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

Open [http://localhost:3000](http://localhost:3000) and complete the initial setup. Keep the `.env` file private and do not expose the dashboard publicly until you have configured authentication and HTTPS. For production installation, updates, networking, and TLS guidance, follow the [installation documentation](https://docs.notploy.com/docs/core/installation).

Useful Compose commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

`docker compose down` preserves the named data volumes. Do not remove them if you need to keep your Notploy database and configuration.

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

## Repository structure

This repository is a pnpm monorepo with a single root lockfile and workspace definition:

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

## Documentation and community

- Product docs: [docs.notploy.com](https://docs.notploy.com)
- Website: [notploy.com](https://notploy.com)
- Templates: [templates.notploy.com](https://templates.notploy.com)
- Questions and discussions: [Notploy Discord](https://discord.gg/2tBnJ3jDJc)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating. Contributions and suggestions are welcome through GitHub issues and pull requests.

## Security

Do not report security vulnerabilities in public issues. Follow the private reporting instructions in [SECURITY.md](SECURITY.md).

## License

The root project is licensed under the [MIT License](LICENSE). Some separately published packages or included components may have their own license terms; check the relevant package's license file before redistributing it.
