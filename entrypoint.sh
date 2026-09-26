#!/usr/bin/env bash
#
# Notploy container entrypoint — the single place that decides how the app
# starts. Both the production image (self-hosted / cloud targets) and the dev
# image call this script.
#
# Flow:
#   1. resolve mode (development | production/cloud)
#   2. locate the app directory (production runs in /app, dev runs in the
#      monorepo workspace)
#   3. wait for PostgreSQL to accept connections
#   4. apply database migrations
#   5. exec the server (Next client + tRPC API)
#
# Escape hatches:
#   NOTPLOY_MODE=development        force dev mode
#   NOTPLOY_SKIP_DB_WAIT=1          skip the wait-for-postgres step
#   NOTPLOY_SKIP_MIGRATIONS=1       skip migrations
#   NOTPLOY_COMMAND="<cmd>"         run an arbitrary command instead
#   <entrypoint> shell              drop into a bash shell
set -euo pipefail

MODE="${NOTPLOY_MODE:-${NODE_ENV:-production}}"
case "$MODE" in
	dev | development) MODE="development" ;;
	prod | production) MODE="production" ;;
	cloud) MODE="production" ;;
	*)
		MODE="production"
		;;
esac

log() { printf '[notploy] %s\n' "$*"; }

# --- Escape hatches --------------------------------------------------------
if [ "${1:-}" = "shell" ]; then
	exec bash
fi
if [ -n "${NOTPLOY_COMMAND:-}" ]; then
	log "running custom command: ${NOTPLOY_COMMAND}"
	exec bash -lc "${NOTPLOY_COMMAND}"
fi

# --- Locate the application ------------------------------------------------
if [ -n "${NOTPLOY_APP_DIR:-}" ]; then
	cd "${NOTPLOY_APP_DIR}"
elif [ ! -f "./dist/server.mjs" ] && [ -f "./apps/notploy/package.json" ]; then
	# Dev image: we are at the monorepo root, the app lives in apps/notploy.
	cd apps/notploy
fi

# --- Mode-specific runners -------------------------------------------------
if [ "$MODE" = "development" ]; then
	log "mode: development (app dir: $(pwd))"
	RUNNER=(pnpm exec tsx -r dotenv/config)
	SCRIPT_DIR="."
	SCRIPT_EXT="ts"
	SERVER_CMD=(pnpm dev)
else
	log "mode: production (app dir: $(pwd))"
	RUNNER=(node -r dotenv/config)
	SCRIPT_DIR="dist"
	SCRIPT_EXT="mjs"
	SERVER_CMD=(node -r dotenv/config dist/server.mjs)
fi

# --- Wait for PostgreSQL ---------------------------------------------------
if [ "${NOTPLOY_SKIP_DB_WAIT:-0}" != "1" ]; then
	if [ -f "${SCRIPT_DIR}/wait-for-postgres.${SCRIPT_EXT}" ]; then
		log "waiting for the database to accept connections..."
		"${RUNNER[@]}" "${SCRIPT_DIR}/wait-for-postgres.${SCRIPT_EXT}"
	else
		log "wait-for-postgres script not found, skipping"
	fi
fi

# --- Migrations ------------------------------------------------------------
if [ "${NOTPLOY_SKIP_MIGRATIONS:-0}" != "1" ]; then
	if [ -f "${SCRIPT_DIR}/migration.${SCRIPT_EXT}" ]; then
		log "applying database migrations..."
		"${RUNNER[@]}" "${SCRIPT_DIR}/migration.${SCRIPT_EXT}"
	else
		log "migration script not found, skipping"
	fi
fi

# --- Start -----------------------------------------------------------------
log "starting Notploy..."
exec "${SERVER_CMD[@]}"
