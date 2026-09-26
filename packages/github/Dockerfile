# syntax=docker/dockerfile:1
# Notploy GitHub integration image.
#
# Build from the repository root (the root pnpm-workspace.yaml is the single
# workspace for the whole monorepo):
#   docker build -f packages/github/Dockerfile .
#
# The image runs the Notploy GitHub App service (webhook receiver + app
# installation sync). It is intentionally thin: it depends on
# @notploy/github for GitHub API access and does not contain any deployment
# engine logic.

# ----- Build Stage -----
FROM node:24.4.0-slim AS builder
WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy the workspace definition + lockfile and the package sources
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/github ./packages/github

# Install dependencies and build the package
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --filter=@notploy/github... --frozen-lockfile
RUN pnpm --filter=@notploy/github run build

# ----- Production Stage -----
FROM node:24.4.0-slim
WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy workspace definition + lockfile and the package manifest for a
# production-only install. Only `dist` ships: sources and tests stay out.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/github/package.json ./packages/github/

# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --filter=@notploy/github --prod --frozen-lockfile --ignore-scripts

# Copy built artifacts
COPY --from=builder /usr/src/app/packages/github/dist ./packages/github/dist

WORKDIR /usr/src/app/packages/github

# Run as the non-root node user
USER node

# Internal port for the webhook receiver / health endpoint
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No secrets are baked into the image: credentials are injected at runtime
# via the environment (see docker-compose.yml / your secret manager).
CMD ["node", "dist/index.js"]
