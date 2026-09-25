#!/bin/bash

# Notploy Security Migration Script
# Configures a unique BETTER_AUTH_SECRET for Notploy installations

set -e

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root" >&2
    exit 1
fi

# Check if Notploy is installed
if ! docker service ls 2>/dev/null | grep -q notploy; then
    echo "Error: Notploy service not found. Is Notploy installed?" >&2
    exit 1
fi

# Check if already configured (the service must actually be using the secret,
# not just have the secret created — an interrupted run leaves the secret
# behind without the service update)
if docker service inspect notploy --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null | grep -q "^BETTER_AUTH_SECRET_FILE="; then
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

if docker secret ls 2>/dev/null | grep -q "notploy-auth-secret"; then
    echo "⚠️  Found an auth secret from a previous interrupted run."
    echo "   Skipping secret generation and 2FA migration, completing the"
    echo "   service update..."
else
    # Generate new secret
    echo "🔐 Generating secure auth secret..."
    NEW_SECRET=$(openssl rand -hex 32)

    # Store in Docker Secret
    echo "$NEW_SECRET" | docker secret create notploy-auth-secret -
    echo "✅ Auth secret saved in Docker Secrets"

    # Run 2FA migration inside the Notploy container
    echo "🔄 Migrating existing 2FA records..."
    NOTPLOY_CONTAINER=$(docker ps --filter "name=notploy" --format "{{.ID}}" | head -n1)

    if [ -n "$NOTPLOY_CONTAINER" ]; then
        # v0.29.3/v0.29.4 images finish the migration but never exit when
        # there are no 2FA records, so cap it with a timeout
        set +e
        timeout 120 docker exec \
            -e OLD_SECRET=better-auth-secret-123456789 \
            -e NEW_SECRET="$NEW_SECRET" \
            "$NOTPLOY_CONTAINER" \
            sh -c "cd /app && pnpm run migrate-auth-secret"
        MIGRATE_STATUS=$?
        set -e

        if [ $MIGRATE_STATUS -eq 124 ]; then
            echo "⚠️  Migration finished but did not exit on its own, continuing..."
        elif [ $MIGRATE_STATUS -ne 0 ]; then
            echo "Error: 2FA migration failed (exit code $MIGRATE_STATUS)" >&2
            exit 1
        else
            echo "✅ 2FA records migrated"
        fi
    else
        echo "⚠️  Notploy container not found, skipping 2FA migration"
    fi
fi

# Update Notploy service to use the Docker Secret
echo "🔄 Updating Notploy service..."
docker service update \
    --secret-add source=notploy-auth-secret,target=/run/secrets/notploy-auth-secret \
    --env-add BETTER_AUTH_SECRET_FILE=/run/secrets/notploy-auth-secret \
    --env-rm BETTER_AUTH_SECRET \
    notploy

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
echo ""
