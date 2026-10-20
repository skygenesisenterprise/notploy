#!/bin/bash

# Notploy 1.1.5 Security Migration Script
# Moves BETTER_AUTH_SECRET into Docker Secrets and re-encrypts existing 2FA data.
#
# Usage:
#   curl -sSL https://notploy.com/security/1.1.5.sh | sudo bash
#
# Idempotent: if the service already reads BETTER_AUTH_SECRET_FILE, nothing is
# changed. If a previous run created the Docker secret but failed before
# updating the service, the script refuses to guess whether the 2FA migration
# completed. Re-run with NOTPLOY_ASSUME_MIGRATED=1 only if it did; otherwise
# remove the leftover secret first so a fresh migration can run.

set -eu

SERVICE_NAME="notploy"
SECRET_NAME="notploy_auth_secret"
SECRET_TARGET="/run/secrets/notploy_auth_secret"
LEGACY_SECRET="better-auth-secret-123456789"

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root" >&2
    exit 1
fi

# Check if Notploy is installed
if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SERVICE_NAME"; then
    echo "Error: Notploy service not found. Is Notploy installed?" >&2
    exit 1
fi

service_env() {
    docker service inspect "$SERVICE_NAME" \
        --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
        2>/dev/null
}

# Check if already configured (the service must actually be using the secret,
# not just have the secret created — an interrupted run leaves the secret
# behind without the service update)
if service_env | grep -q "^BETTER_AUTH_SECRET_FILE="; then
    echo "✅ Auth secret is already configured!"
    echo "   (Stored securely in Docker Secrets)"
    echo ""
    exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Notploy Auth Secret Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👋 This script will generate a unique auth secret for your"
echo "   Notploy installation and migrate any existing 2FA data."
echo ""

SECRET_CREATED=0
NEW_SECRET=""

if docker secret ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SECRET_NAME"; then
    if [ "${NOTPLOY_ASSUME_MIGRATED:-0}" != "1" ]; then
        echo "⚠️  Found '$SECRET_NAME' from a previous run, but the service does" >&2
        echo "   not use it yet. The 2FA migration may or may not have run." >&2
        echo "" >&2
        echo "   If the previous run reported a successful migration, finish the" >&2
        echo "   update with:" >&2
        echo "     NOTPLOY_ASSUME_MIGRATED=1 bash 1.1.5.sh" >&2
        echo "" >&2
        echo "   Otherwise the secret is unused and can be removed before a fresh" >&2
        echo "   run (this is safe only if the migration did not complete):" >&2
        echo "     docker secret rm $SECRET_NAME" >&2
        exit 1
    fi
    echo "⚠️  Resuming with the existing '$SECRET_NAME' (migration assumed done)."
else
    # Generate new secret
    echo "🔐 Generating secure auth secret..."
    NEW_SECRET=$(openssl rand -hex 32)

    # Store in Docker Secret (no trailing newline)
    printf '%s' "$NEW_SECRET" | docker secret create "$SECRET_NAME" - >/dev/null
    echo "✅ Auth secret saved in Docker Secrets"
    SECRET_CREATED=1

    # The old value may be the legacy hardcoded secret (fresh installations
    # before 1.1.5) or a custom inline value. Migrating with the wrong old key
    # would corrupt 2FA records, so read it from the running service.
    OLD_SECRET=$(service_env | sed -n 's/^BETTER_AUTH_SECRET=//p' | head -n1)
    if [ -z "$OLD_SECRET" ]; then
        OLD_SECRET="$LEGACY_SECRET"
    fi

    # Run 2FA migration inside the Notploy container. Match the Swarm service
    # label rather than a name prefix: "notploy-postgres" and "notploy-status"
    # also start with "notploy".
    echo "🔄 Migrating existing 2FA records..."
    NOTPLOY_CONTAINER=$(docker ps \
        --filter "label=com.docker.swarm.service.name=$SERVICE_NAME" \
        --format "{{.ID}}" | head -n1)

    if [ -z "$NOTPLOY_CONTAINER" ]; then
        echo "Error: no '$SERVICE_NAME' container found on this node." >&2
        echo "Notploy runs its task on a manager node; run this script from that" >&2
        echo "node. The newly created secret is removed so the next run can start" >&2
        echo "cleanly (no 2FA record was touched)." >&2
        docker secret rm "$SECRET_NAME" >/dev/null 2>&1 || true
        exit 1
    fi

    # Some images finish the migration but never exit when there are no 2FA
    # records, so cap it with a timeout.
    set +e
    timeout 120 docker exec \
        -e OLD_SECRET="$OLD_SECRET" \
        -e NEW_SECRET="$NEW_SECRET" \
        "$NOTPLOY_CONTAINER" \
        sh -c "cd /app && pnpm run migrate-auth-secret"
    MIGRATE_STATUS=$?
    set -e

    if [ $MIGRATE_STATUS -eq 124 ]; then
        echo "⚠️  Migration finished but did not exit on its own, continuing..."
    elif [ $MIGRATE_STATUS -ne 0 ]; then
        echo "Error: 2FA migration failed (exit code $MIGRATE_STATUS)" >&2
        # The migration runs in a single transaction and rolls back on error,
        # so removing the unused secret makes a re-run safe and clean.
        docker secret rm "$SECRET_NAME" >/dev/null 2>&1 || true
        echo "No 2FA record was changed; the new secret was removed. Fix the" >&2
        echo "error above and re-run this script." >&2
        exit 1
    else
        echo "✅ 2FA records migrated"
    fi
fi

# Attach the secret only when it is not already attached, so an interrupted run
# can be resumed without Docker rejecting a duplicate secret.
HAS_SECRET=$(docker service inspect "$SERVICE_NAME" \
    --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{println .SecretName}}{{end}}' \
    2>/dev/null | grep -cx "$SECRET_NAME" || true)

# Update Notploy service to use the Docker Secret
echo "🔄 Updating Notploy service..."
if [ "$HAS_SECRET" -gt 0 ]; then
    docker service update \
        --env-add BETTER_AUTH_SECRET_FILE="$SECRET_TARGET" \
        --env-rm BETTER_AUTH_SECRET \
        "$SERVICE_NAME" >/dev/null
else
    docker service update \
        --secret-add "source=$SECRET_NAME,target=$SECRET_TARGET" \
        --env-add BETTER_AUTH_SECRET_FILE="$SECRET_TARGET" \
        --env-rm BETTER_AUTH_SECRET \
        "$SERVICE_NAME" >/dev/null
fi

# The update is asynchronous, but the env var is part of the new spec
# immediately; fail loudly instead of reporting success on a broken update.
if ! service_env | grep -q "^BETTER_AUTH_SECRET_FILE=$SECRET_TARGET$"; then
    echo "Error: the service update did not apply BETTER_AUTH_SECRET_FILE." >&2
    docker service ps "$SERVICE_NAME" --no-trunc >&2 2>/dev/null || true
    exit 1
fi

echo "⏳ Waiting for service to restart..."
sleep 5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All done! Your auth secret is now secured."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What was configured:"
echo "   • Unique auth secret generated with openssl rand -hex 32"
echo "   • Secret stored in Docker Secrets (encrypted, in-memory only)"
echo "   • Existing 2FA records re-encrypted with the new secret"
echo "   • Notploy service updated to use the new secret"
echo ""
echo "💡 Next steps:"
echo "   • All active sessions have been invalidated — users will need to log in again"
echo "   • 2FA remains fully functional"
echo "   • Verify the service is healthy: docker service ps $SERVICE_NAME"
echo ""
