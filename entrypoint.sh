#!/usr/bin/env bash
#
# Notploy container entrypoint — the single place that decides how a container
# starts. Every target of the root Dockerfile calls this script, and the role is
# selected by NOTPLOY_ROLE (or by the first argument, which is how the one-shot
# `migrate` job asks for the migrations):
#
#   api       backend: identity, wait for PostgreSQL, optionally migrate,
#             exec dist/server.mjs (tRPC/OpenAPI, auth, WebSockets, workers, DNS)
#   migrate   one-shot job: wait for PostgreSQL, apply the migrations, exit
#   client    frontend: exec `next start` (or `next dev` in development)
#   status    standalone status page (apps/status), independent from the stack
#   healthcheck  probe the container role and exit (used by Docker HEALTHCHECK)
#
# Flow of the backend roles:
#   1. resolve mode (development | production)
#   2. locate the app directory (production runs in /app, dev runs in the
#      monorepo workspace)
#   3. bootstrap the instance identity (PKI), shared with install.sh
#   4. wait for PostgreSQL to accept connections
#   5. apply database migrations (always for `migrate`, opt-in for `api`)
#   6. exec the server
#
# Escape hatches:
#   NOTPLOY_ROLE=api|client|migrate|status  select the role explicitly
#   NOTPLOY_MODE=development                force dev mode
#   NOTPLOY_SKIP_IDENTITY=1                 skip the identity bootstrap
#   NOTPLOY_SKIP_DB_WAIT=1                  skip the wait-for-postgres step
#   NOTPLOY_SKIP_MIGRATIONS=1               skip migrations
#   NOTPLOY_RUN_MIGRATIONS=1                migrate before starting the API
#   NOTPLOY_COMMAND="<cmd>"                 run an arbitrary command instead
#   <entrypoint> shell                      drop into a bash shell
set -euo pipefail

ROLE="${1:-${NOTPLOY_ROLE:-api}}"
case "$ROLE" in
api | client | migrate | status | healthcheck) ;;
*)
	ROLE="api"
	;;
esac

MODE="${NOTPLOY_MODE:-${NODE_ENV:-production}}"
case "$MODE" in
dev | development) MODE="development" ;;
prod | production) MODE="production" ;;
*)
	MODE="production"
	;;
esac

log() { printf '[notploy] %s\n' "$*"; }

# --- Healthcheck ------------------------------------------------------------
# One image serves every role, so the Docker HEALTHCHECK cannot hard-code a
# single path: it asks the entrypoint, which probes the *container* role
# (NOTPLOY_ROLE) on its own port. Exits 0 when the app answers.
if [ "$ROLE" = "healthcheck" ]; then
	probe_role="${NOTPLOY_ROLE:-api}"
	case "$probe_role" in
	client)
		# Notploy has no /login route: `/` is the login/onboarding page (and may
		# redirect to /dashboard/home or /register), so accept any non-5xx reply.
		probe="http://127.0.0.1:${PORT:-3000}/"
		exec node -e 'fetch(process.argv[1]).then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))' "$probe"
		;;
	status)
		probe="http://127.0.0.1:${PORT:-4100}/api/v1/pages"
		;;
	*)
		probe="http://127.0.0.1:${PORT:-4000}/api/health"
		;;
	esac
	exec node -e 'fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' "$probe"
fi

# --- Escape hatches --------------------------------------------------------
if [ "${1:-}" = "shell" ] || [ "${2:-}" = "shell" ]; then
	exec bash
fi
if [ -n "${NOTPLOY_COMMAND:-}" ]; then
	log "running custom command: ${NOTPLOY_COMMAND}"
	exec bash -lc "${NOTPLOY_COMMAND}"
fi

# The api role needs root (/etc/notploy, Docker socket). The client role does
# not: drop to the unprivileged user created in the platform image when present.
run_unprivileged() {
	if [ "$(id -u)" = "0" ] && id -u notploy >/dev/null 2>&1 && command -v gosu >/dev/null 2>&1; then
		exec gosu notploy "$@"
	fi
	exec "$@"
}

# --- Status page application -----------------------------------------------
# No PostgreSQL, no Redis, no migrations. The engine keeps its state in a
# SQLite file under STATUS_DATA_DIR.
if [ "$ROLE" = "status" ]; then
	STATUS_CONTAINER_PORT="${PORT:-4100}"
	if [ "$MODE" = "development" ]; then
		log "role: status (development, port ${STATUS_CONTAINER_PORT})"
		if [ -d ./apps/status ]; then
			cd apps/status
		fi
		exec pnpm exec next dev -p "${STATUS_CONTAINER_PORT}" -H "${HOST:-${HOSTNAME:-0.0.0.0}}"
	fi
	log "role: status (production, port ${STATUS_CONTAINER_PORT}, dir: $(pwd))"
	exec ./node_modules/.bin/next start -p "${STATUS_CONTAINER_PORT}" -H "${HOST:-${HOSTNAME:-0.0.0.0}}"
fi

# --- Frontend ---------------------------------------------------------------
# The client serves the Next.js UI and proxies `/api/*` to the API service
# through the rewrites in next.config.mjs (API_INTERNAL_URL). It never waits for
# PostgreSQL, never migrates and never starts a worker.
if [ "$ROLE" = "client" ]; then
	CLIENT_CONTAINER_PORT="${PORT:-3000}"
	CLIENT_BIND_HOST="${HOST:-${HOSTNAME:-0.0.0.0}}"
	if [ "$MODE" = "development" ]; then
		log "role: client (development, port ${CLIENT_CONTAINER_PORT})"
		if [ -d ./apps/notploy ]; then
			cd apps/notploy
		fi
		# Webpack, not Turbopack: the console imports server-only modules
		# (@notploy/server, @notploy/status) from getServerSideProps pages, which
		# Turbopack 16 tries to bundle into the client graph (node:fs panic).
		run_unprivileged pnpm exec next dev --webpack -p "${CLIENT_CONTAINER_PORT}" -H "${CLIENT_BIND_HOST}"
	fi
	log "role: client (production, port ${CLIENT_CONTAINER_PORT}, dir: $(pwd))"
	run_unprivileged ./node_modules/.bin/next start -p "${CLIENT_CONTAINER_PORT}" -H "${CLIENT_BIND_HOST}"
fi

# --- Locate the backend application ----------------------------------------
if [ -n "${NOTPLOY_APP_DIR:-}" ]; then
	cd "${NOTPLOY_APP_DIR}"
elif [ ! -f "./dist/server.mjs" ] && [ -f "./apps/notploy/package.json" ]; then
	# Dev image: we are at the monorepo root, the app lives in apps/notploy.
	cd apps/notploy
fi

if [ "$MODE" = "development" ]; then
	log "role: ${ROLE} (development, app dir: $(pwd))"
	RUNNER=(pnpm exec tsx -r dotenv/config)
	SCRIPT_DIR="."
	SCRIPT_EXT="ts"
	# `tsx watch` reloads the API in place when a source file changes, including
	# packages/server, which is imported from source in development.
	SERVER_CMD=(pnpm dev:api)
else
	log "role: ${ROLE} (production, app dir: $(pwd))"
	RUNNER=(node -r dotenv/config)
	SCRIPT_DIR="dist"
	SCRIPT_EXT="mjs"
	SERVER_CMD=(node -r dotenv/config dist/server.mjs)
fi

# --- Instance identity (PKI) -----------------------------------------------
# Self-hosted generates it locally, cloud verifies a signed entitlement.
# install.sh doubles as a library here, so the container and the host installer
# share one implementation and can never drift.
if [ "${NOTPLOY_SKIP_IDENTITY:-0}" != "1" ]; then
	if [ -f /usr/local/bin/notploy-install.sh ]; then
		log "bootstrapping the instance identity (product: ${NOTPLOY_PRODUCT:-self})..."
		export NOTPLOY_SOURCE_ONLY=1
		# shellcheck source=/dev/null
		source /usr/local/bin/notploy-install.sh
		bootstrap_identity
	else
		log "identity bootstrap library not found, skipping"
	fi
fi

# --- Wait for PostgreSQL ---------------------------------------------------
if [ "${NOTPLOY_SKIP_DB_WAIT:-0}" != "1" ]; then
	if [ -f "${SCRIPT_DIR}/wait-for-postgres.${SCRIPT_EXT}" ]; then
		log "waiting for the database to accept connections..."
		"${RUNNER[@]}" "${SCRIPT_DIR}/wait-for-postgres.${SCRIPT_EXT}"
	else
		log "wait-for-postgres script not found, skipping"
	fi
else
	log "database wait disabled (NOTPLOY_SKIP_DB_WAIT=1)"
fi

# --- Migrations ------------------------------------------------------------
# Only the `migrate` job and an explicitly opted-in API run them: two API
# replicas must never race on the same schema.
RUN_MIGRATIONS="0"
if [ "$ROLE" = "migrate" ] || [ "${NOTPLOY_RUN_MIGRATIONS:-0}" = "1" ]; then
	RUN_MIGRATIONS="1"
fi

if [ "$RUN_MIGRATIONS" = "1" ] && [ "${NOTPLOY_SKIP_MIGRATIONS:-0}" != "1" ]; then
	if [ -f "${SCRIPT_DIR}/migration.${SCRIPT_EXT}" ]; then
		log "applying database migrations..."
		"${RUNNER[@]}" "${SCRIPT_DIR}/migration.${SCRIPT_EXT}"
	else
		log "migration script not found, skipping"
	fi
fi

# The one-shot job is done: a zero exit is what lets the API start.
if [ "$ROLE" = "migrate" ]; then
	log "migrations applied, exiting"
	exit 0
fi

# --- Start -----------------------------------------------------------------
log "starting Notploy (${ROLE})..."
exec "${SERVER_CMD[@]}"
