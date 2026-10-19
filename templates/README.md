# Notploy Templates

The public template gallery is served at [templates.notploy.com](https://templates.notploy.com).
It is a Vite + React single-page application that reads the blueprint catalogue
from `templates/blueprints`.

## Structure

| Path | Role |
| --- | --- |
| `app/` | Vite/React gallery (`@notploy/templates-app`) |
| `blueprints/` | Source of truth for the catalogue (one folder per template) |
| `build-scripts/` | Metadata generation, dist verification and blueprint validators |

Each blueprint folder contains `meta.json`, `docker-compose.yml`, `template.toml`
and a logo. `instructions.md` is optional.

## Local development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm templates:dev      # generates app/public/meta.json, then starts Vite
```

Other scripts:

```bash
pnpm templates:typecheck
pnpm templates:test
pnpm templates:build
```

## Build

`pnpm templates:build` runs the production pipeline:

1. `build-scripts/generate-meta.js` validates every `blueprints/<id>/meta.json`
   and aggregates the catalogue into `app/public/meta.json`.
2. `tsc -b` type-checks the app.
3. `vite build` emits `app/dist`.
4. `build-scripts/verify-dist.js` fails the build if a template, logo or
   required blueprint file is missing from `app/dist`.

### Static assets

Blueprints are exposed to the browser under `/blueprints/<id>/...`. The source
remains `templates/blueprints`; `app/public/blueprints` is a symlink to it, and
Vite copies the contents of `public/` into `dist/`. There is no separate copy
plugin to keep in sync. Do not replace the symlink with a copy.

The catalogue URL is `/meta.json`, generated at build time and never committed
(`app/public/meta.json` is git-ignored).

### Client-side routing

The app uses `BrowserRouter`: `/` shows the catalogue and `/templates/<id>`
opens the matching template dialog, so template pages can be linked and
reloaded directly. Cloudflare Pages serves `index.html` for unmatched paths as
long as the output has no top-level `404.html`; do not add one.

## Cloudflare Pages

The `notploy-templates` Pages project builds the app independently from the
website and the documentation:

| Setting | Value |
| --- | --- |
| Repository | `skygenesisenterprise/notploy` |
| Production branch | `master` |
| Root directory | `/` |
| Build command | `pnpm install --frozen-lockfile --filter="@notploy/templates-app..." && pnpm --filter @notploy/templates-app run build` |
| Output directory | `templates/app/dist` |
| Node.js | `24.4.0` |
| pnpm | `10.22.0` |
| Environment | `SKIP_DEPENDENCY_INSTALL=1` |

Production deployment is handled by the Pages Git integration; no duplicate
GitHub Actions deployment workflow should be added.

### Build watch paths

The templates app has no dependency on the website, the docs site or the
platform packages. Configure the Pages project to build only when these paths
change, so website/docs-only changes do not rebuild the gallery:

- `templates/**`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `package.json`

Preview deployments use the same command on non-production branches.

The custom domain is `templates.notploy.com`. The catalogue is public: do not
put it behind Cloudflare Access, a VPN, or an internal-only SSO application.
