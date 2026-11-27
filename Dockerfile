# syntax=docker/dockerfile:1
#
# Notploy — single canonical Dockerfile for the main product.
#
# Built from the repository root: the whole monorepo is one pnpm workspace with
# a single `pnpm-lock.yaml`, so only the root context is ever used.
#
#   docker build -t notploy .                  # the single platform image (default)
#   docker build --target dev -t notploy:dev . # same image, dev mode
#
# Stages / targets
#   base           Node + pnpm toolchain
#   dev            sources + dependencies + deployment tooling, no production build
#   builder        installs + compiles the app, deploys a pruned /prod/notploy
#   platform       the ONE production image: client AND api (LAST => default)
#
# Two editions only: `self` and `cloud`. They share the SAME image — no
# `notploy-cloud` artifact. The edition is selected at runtime by NOTPLOY_FLAVOR
# / NOTPLOY_PRODUCT / IS_CLOUD (Compose, installer or orchestrator), and so is
# the container role (NOTPLOY_ROLE):
#
#   NOTPLOY_ROLE=client   `next start`                     (port 3000)
#   NOTPLOY_ROLE=api      `node dist/server.mjs`           (port 4000, DNS 53)
#   NOTPLOY_ROLE=migrate  one-shot migrations, then exit
#
# Notploy-specific requirement kept from the previous architecture: the control
# plane manages the host Docker Engine through the mounted /var/run/docker.sock
# (not DinD) and writes instance identity + Traefik config to /etc/notploy. The
# `api` role therefore runs as root; the `client` role drops to an unprivileged
# user in entrypoint.sh. The deployment tooling is installed by
# docker/install-deploy-tooling.sh in both `dev` and `platform`, so the one image
# can serve either edition.

# ---------------------------------------------------------------------------
# Toolchain
# ---------------------------------------------------------------------------
FROM node:24.4.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Compile native addons (node-pty, bcrypt, ssh2, cpu-features) against the
# headers already shipped in the Node image. Without this node-gyp downloads
# node-v24.4.0-headers.tar.gz from nodejs.org during pnpm install, which fails
# on networks that only allow the npm registry and breaks the dev build.
ENV npm_config_nodedir=/usr/local
# Matches the `packageManager` field of the root package.json, and therefore the
# lockfile validated by `--frozen-lockfile`.
ARG PNPM_VERSION=12.23.0
RUN npm install -g pnpm@${PNPM_VERSION}
# openssl signs the local instance identity at container start (entrypoint.sh
# sources install.sh); ca-certificates and curl keep outbound HTTPS working.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Development image (sources + dependencies + deployment tooling; never runs a
# production build). Compose bind-mounts apps/notploy and packages over these
# sources, so the dev servers always run the code from the host.
# ---------------------------------------------------------------------------
FROM base AS dev
COPY . /usr/src/app
WORKDIR /usr/src/app

# Build toolchain (native modules) plus the deployment tooling, so a dev
# container drives Docker exactly like the self-hosted one.
RUN apt-get update && apt-get install -y python3 make g++ git python3-pip pkg-config libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=0755 docker/install-deploy-tooling.sh /tmp/install-deploy-tooling.sh
RUN /tmp/install-deploy-tooling.sh && rm -f /tmp/install-deploy-tooling.sh

COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# All launch logic (identity, wait for DB, migrations, server) lives here.
COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh
# install.sh doubles as a library (NOTPLOY_SOURCE_ONLY=1): the entrypoint sources
# it to bootstrap the instance identity with a single source of truth.
COPY --chmod=0755 install.sh /usr/local/bin/notploy-install.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# ---------------------------------------------------------------------------
# Builder (production artifacts)
# ---------------------------------------------------------------------------
FROM base AS builder
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++ git python3-pip pkg-config libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Next.js otherwise phones home during the build; disabling it removes a network
# round-trip from every CI build without changing the produced artifacts.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Server bundle (esbuild: dist/server.mjs, dist/migration.mjs, …), the status
# engine used by the dashboard, then the Next build of the main app. There is no
# standalone status page/image: everything ships in this one platform image.
RUN pnpm --filter=@notploy/server build
RUN pnpm --filter=@notploy/status build
RUN pnpm --filter=./apps/notploy run build

# Pruned production deployment: package.json + the node_modules subset needed at
# runtime, with the workspace packages resolved.
RUN pnpm --filter=./apps/notploy --prod deploy --legacy /prod/notploy
RUN cp -R /usr/src/app/apps/notploy/.next /prod/notploy/.next
RUN cp -R /usr/src/app/apps/notploy/dist /prod/notploy/dist

# ---------------------------------------------------------------------------
# Platform — the single image of an edition, shared by `client` and `api`.
#
#   client role   `.next`, `public`, `next.config.mjs`. `next start` serves the UI
#                 and proxies `/api/*` to the API service (API_INTERNAL_URL).
#   api role      `dist/` + `drizzle/`: tRPC/OpenAPI, better-auth, WebSockets,
#                 workers and the internal DNS server. Only this role receives
#                 the database/Redis credentials and applies the migrations.
#
# Root is kept for the api role (identity + Traefik config in /etc/notploy and
# Docker socket access); entrypoint.sh drops to `notploy` for the client role.
# ---------------------------------------------------------------------------
FROM base AS platform
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default port of the api role; Compose sets PORT=3000 for the client role.
ENV PORT=4000

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini curl unzip zip apache2-utils gosu \
    && rm -rf /var/lib/apt/lists/*

# --- Backend artifacts ------------------------------------------------------
COPY --from=builder /prod/notploy/package.json ./package.json
COPY --from=builder /prod/notploy/node_modules ./node_modules
COPY --from=builder /prod/notploy/drizzle ./drizzle
COPY --from=builder /usr/src/app/apps/notploy/dist ./dist

# --- Frontend artifacts -----------------------------------------------------
COPY --from=builder /prod/notploy/next.config.mjs ./next.config.mjs
COPY --from=builder /prod/notploy/public ./public
COPY --from=builder /usr/src/app/apps/notploy/.next ./.next

# rclone (backup destinations) and tsx (runtime scripts) are shared by both
# editions. The deployment tooling is too: the SAME image must be able to run
# as self-hosted or as cloud, depending on the runtime environment.
RUN curl https://rclone.org/install.sh | bash && pnpm install -g tsx

COPY --chmod=0755 docker/install-deploy-tooling.sh /tmp/install-deploy-tooling.sh
RUN /tmp/install-deploy-tooling.sh && rm -f /tmp/install-deploy-tooling.sh
COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack

# Unprivileged user used by the client role. The api role needs root.
RUN groupadd --system --gid 1001 notploy \
    && useradd --system --uid 1001 --gid notploy --home-dir /app notploy \
    && chown -R notploy:notploy /app

# No edition is baked in: NOTPLOY_FLAVOR / NOTPLOY_PRODUCT / IS_CLOUD come from
# the runtime environment (Compose, installer or orchestrator).
ARG NOTPLOY_VERSION=dev
ENV NOTPLOY_ROLE=api
LABEL org.opencontainers.image.title="notploy" \
      org.opencontainers.image.description="Notploy — dashboard, server and build tooling" \
      org.opencontainers.image.source="https://github.com/skygenesisenterprise/notploy" \
      org.opencontainers.image.version="${NOTPLOY_VERSION}" \
      org.opencontainers.image.licenses="Apache-2.0"

# Client (3000), API (4000) and the internal DNS server (53/udp + 53/tcp).
EXPOSE 3000 4000 53/udp 53/tcp

# Role-aware probe: `client` checks `/`, `api` checks `/api/health`.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD ["/usr/local/bin/entrypoint.sh", "healthcheck"]

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh
# install.sh doubles as the identity bootstrap library for the api role.
COPY --chmod=0755 install.sh /usr/local/bin/notploy-install.sh

# tini reaps child processes left defunct by the server.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
