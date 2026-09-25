#!/bin/bash

# Notploy Security Migration Script
# Configures secure database credentials for Notploy installations

set -e

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root" >&2
    exit 1
fi

generate_random_password() {
    local password=""
    
    if command -v openssl >/dev/null 2>&1; then
        password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    elif [ -r /dev/urandom ]; then
        password=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
    else
        if command -v sha256sum >/dev/null 2>&1; then
            password=$(date +%s%N | sha256sum | base64 | head -c 32)
        elif command -v shasum >/dev/null 2>&1; then
            password=$(date +%s%N | shasum -a 256 | base64 | head -c 32)
        else
            password=$(echo "$(date +%s%N)-$(hostname)-$$-$RANDOM" | base64 | tr -d "=+/" | head -c 32)
        fi
    fi
    
    if [ -z "$password" ] || [ ${#password} -lt 20 ]; then
        echo "❌ Error: Failed to generate random password" >&2
        exit 1
    fi
    
    echo "$password"
}

# Check if Notploy is installed
if ! docker service ls 2>/dev/null | grep -q notploy; then
    echo "Error: Notploy service not found. Is Notploy installed?" >&2
    exit 1
fi

# Check if already configured via Docker Secret
if docker secret ls 2>/dev/null | grep -q "notploy_postgres_password"; then
    echo "✅ Secure credentials are already configured!"
    echo "   (Stored securely in Docker Secrets)"
    echo ""
    exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Notploy Security Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👋 Hey! I noticed your Notploy installation doesn't have"
echo "   secure credentials configured yet."
echo ""
echo "📝 I'll set up unique, secure credentials for your database"
echo "   automatically. This will only take a few seconds."
echo ""

# Generate new secure password
echo "🔐 Generating secure credentials..."
NEW_PASSWORD=$(generate_random_password)

# Store in Docker Secret (encrypted and secure)
echo "$NEW_PASSWORD" | docker secret create notploy_postgres_password - 2>/dev/null

echo "✅ Credentials saved securely in Docker Secrets (encrypted)"

# Update PostgreSQL password
echo "🔄 Updating database..."
POSTGRES_CONTAINER=$(docker ps --filter "name=notploy-postgres" --format "{{.ID}}" | head -n1)

if [ -n "$POSTGRES_CONTAINER" ]; then
    docker exec \
      -e PGPASSWORD=amukds4wi9001583845717ad2 \
      "$POSTGRES_CONTAINER" \
      psql -U notploy -d notploy \
      -c "ALTER USER notploy WITH PASSWORD '${NEW_PASSWORD}';"
fi

# Update Postgres service to use Docker Secret
echo "🔄 Updating PostgreSQL service..."
docker service update \
    --env-rm POSTGRES_PASSWORD \
    --secret-add source=notploy_postgres_password,target=/run/secrets/postgres_password \
    --env-add POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
    notploy-postgres

# Update Notploy service to use Docker Secret
echo "🔄 Updating Notploy service..."
docker service update \
    --secret-add source=notploy_postgres_password,target=/run/secrets/postgres_password \
    --env-add POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
    --env-rm DATABASE_URL \
    notploy

echo "⏳ Waiting for services to restart..."
sleep 5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All done! Your database is now secured with unique credentials."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What was configured:"
echo "   • Unique secure password generated"
echo "   • Password stored in Docker Secrets (encrypted, in-memory only)"
echo "   • PostgreSQL service updated to use secrets"
echo "   • Notploy service updated to use secrets"
echo ""
echo "💡 Security features:"
echo "   • Password stored encrypted in Docker Swarm"
echo "   • Mounted in memory (tmpfs) - not accessible via bind mounts"
echo "   • Only accessible by authorized services"
echo "   • Cannot be read by user containers"
echo ""
echo "💡 Next steps:"
echo "   • Your Notploy should be accessible shortly"
echo "   • No action needed - everything is configured automatically"
echo ""
echo ""
