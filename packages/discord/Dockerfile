# syntax=docker/dockerfile:1
#
# Notploy Community Discord bot — image.
#
# Built from the repository root: the whole monorepo is one pnpm workspace with
# a single `pnpm-lock.yaml`, so only the root context is ever used.
#
#   docker build -f packages/discord/Dockerfile -t notploy-discord .            # production (default)
#   docker build --target dev -f packages/discord/Dockerfile -t notploy-discord-dev .  # development
#
# Stages / targets
#   base      Node + pnpm toolchain
#   dev       workspace sources + dependencies, runs the bot with hot reload
#   builder   installs + compiles the bot and its workspace dependencies
#   runtime   production image (compiled bot, tini as PID 1, non-root user)
#
# The bot is a long-running gateway client: it publishes no port and needs no
# health endpoint. `restart: unless-stopped` (Compose) plus the process's own
# reconnect logic keep it alive.

# ---------------------------------------------------------------------------
# Toolchain
# ---------------------------------------------------------------------------
FROM node:24.4.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.22.0
# ca-certificates keeps outbound TLS verification (Discord, GitHub, Notploy API)
# working in the slim image.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Development image — workspace sources + dependencies. The Compose `dev`
# service bind-mounts packages/discord and packages/sdk over it so the bot
# always runs the code on the host and hot-reloads it.
# ---------------------------------------------------------------------------
FROM base AS dev
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

ENV NODE_ENV=development
CMD ["pnpm", "--filter=@notploy/discord", "run", "dev"]

# ---------------------------------------------------------------------------
# Builder (production artifacts)
# ---------------------------------------------------------------------------
FROM base AS builder
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the bot and its workspace dependencies (@notploy/sdk) in topological
# order: @notploy/discord needs the SDK's compiled dist for its types.
RUN pnpm --filter=@notploy/discord... run build

# ---------------------------------------------------------------------------
# Production runtime
# ---------------------------------------------------------------------------
FROM base AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

# tini reaps child processes and forwards signals, so SIGTERM reaches the bot's
# graceful shutdown handler.
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Install only the production dependencies of the bot and its workspace deps.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/discord/package.json ./packages/discord/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --filter=@notploy/discord... --prod --frozen-lockfile --ignore-scripts

# Copy the compiled artifacts.
COPY --from=builder /usr/src/app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /usr/src/app/packages/discord/dist ./packages/discord/dist

ARG NOTPLOY_VERSION=dev
LABEL org.opencontainers.image.title="notploy-discord" \
      org.opencontainers.image.description="Notploy Community — official Discord bot" \
      org.opencontainers.image.source="https://github.com/skygenesisenterprise/notploy" \
      org.opencontainers.image.version="${NOTPLOY_VERSION}" \
      org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /usr/src/app/packages/discord

# Least privilege: the bot only reads its compiled code and talks outbound.
USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
