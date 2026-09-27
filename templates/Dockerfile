# Build from the repository root; the root pnpm-workspace.yaml is the
# single workspace for the whole monorepo.
FROM node:24.4-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /usr/src/app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter=@notploy/templates-app... --frozen-lockfile
RUN pnpm --filter=@notploy/templates-app run build

FROM nginx:1.29-alpine AS runtime
COPY templates/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/templates/app/dist/ /usr/share/nginx/html/

EXPOSE 80
