# Guide de configuration

Ce guide détaille la configuration de Notploy pour l'adapter à vos besoins spécifiques.

## 📋 Fichiers de configuration

### Structure des fichiers d'environnement

```
notploy/
├── apps/
│   ├── dokploy/.env          # Application principale
│   ├── api/.env              # API de déploiement
│   └── schedules/.env        # Service de planification
├── monitoring/
│   └── config/
│       └── metrics.go        # Configuration monitoring
└── .env                      # Variables globales (optionnel)
```

## ⚙️ Configuration de l'application principale

### `apps/dokploy/.env`

```bash
# ===========================================
# Configuration de base
# ===========================================
NODE_ENV=production                    # ou development
PORT=3000                              # Port de l'application
HOST=0.0.0.0                           # Hôte d'écoute

# ===========================================
# Base de données
# ===========================================
DATABASE_URL="postgresql://user:password@localhost:5432/notploy"

# ===========================================
# Authentification
# ===========================================
NEXTAUTH_SECRET="votre-secret-super-securise"
NEXTAUTH_URL="http://localhost:3000"   # URL de production en prod
BETTER_AUTH_SECRET="votre-secret-auth"
BETTER_AUTH_URL="http://localhost:3000"

# ===========================================
# Configuration Docker
# ===========================================
DOCKER_HOST="unix:///var/run/docker.sock"
DOCKER_TLS_VERIFY=false
DOCKER_CERT_PATH=""

# ===========================================
# Configuration Traefik
# ===========================================
TRAEFIK_ENABLED=true
TRAEFIK_HTTP_PORT=80
TRAEFIK_HTTPS_PORT=443
TRAEFIK_DASHBOARD_PORT=8080

# ===========================================
# Configuration des domaines
# ===========================================
DEFAULT_DOMAIN="notploy.local"
WILDCARD_DOMAIN="*.notploy.local"

# ===========================================
# Configuration des notifications
# ===========================================
# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="votre-email@gmail.com"
SMTP_PASSWORD="votre-mot-de-passe"
SMTP_FROM="noreply@notploy.com"

# Discord (optionnel)
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Slack (optionnel)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# ===========================================
# Configuration des backups
# ===========================================
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"              # Tous les jours à 2h du matin
BACKUP_RETENTION_DAYS=30
BACKUP_STORAGE_PATH="/var/backups/notploy"

# ===========================================
# Configuration des services externes
# ===========================================
# GitHub
GITHUB_CLIENT_ID="votre-github-client-id"
GITHUB_CLIENT_SECRET="votre-github-client-secret"

# GitLab
GITLAB_CLIENT_ID="votre-gitlab-client-id"
GITLAB_CLIENT_SECRET="votre-gitlab-client-secret"

# Stripe (pour la version cloud)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# ===========================================
# Configuration monitoring
# ===========================================
MONITORING_ENABLED=true
MONITORING_PORT=9090
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3001"

# ===========================================
# Configuration des logs
# ===========================================
LOG_LEVEL="info"                        # debug, info, warn, error
LOG_FILE_PATH="/var/log/notploy/app.log"
LOG_MAX_SIZE="100MB"
LOG_MAX_FILES=10

# ===========================================
# Configuration sécurité
# ===========================================
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
SESSION_SECRET="votre-session-secret"

# ===========================================
# Configuration des performances
# ===========================================
CACHE_TTL=3600                          # 1 heure
MAX_CONCURRENT_DEPLOYMENTS=5
DEPLOYMENT_TIMEOUT=1800                 # 30 minutes
```

## 🔌 Configuration de l'API de déploiement

### `apps/api/.env`

```bash
# ===========================================
# Configuration de base
# ===========================================
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# ===========================================
# Configuration Inngest
# ===========================================
INNGEST_EVENT_KEY="inngest-event-key"
INNGEST_SIGNING_KEY="inngest-signing-key"
INNGEST_API_URL="http://localhost:8288"

# ===========================================
# Configuration des déploiements
# ===========================================
DEPLOYMENT_TIMEOUT=1800                 # 30 minutes
MAX_DEPLOYMENT_SIZE="1GB"
BUILD_TIMEOUT=900                       # 15 minutes

# ===========================================
# Configuration des registres Docker
# ===========================================
DOCKER_REGISTRY_URL="https://registry-1.docker.io"
DOCKER_REGISTRY_USERNAME=""
DOCKER_REGISTRY_PASSWORD=""

# ===========================================
# Configuration des builders
# ===========================================
BUILDER_TYPE="docker"                   # docker, buildkit, kaniko
BUILDKIT_HOST="tcp://buildkitd:1234"

# ===========================================
# Configuration des caches
# ===========================================
BUILD_CACHE_ENABLED=true
BUILD_CACHE_PATH="/var/cache/notploy/builds"
LAYER_CACHE_SIZE="5GB"
```

## ⏰ Configuration du service de planification

### `apps/schedules/.env`

```bash
# ===========================================
# Configuration de base
# ===========================================
NODE_ENV=production
PORT=3002
HOST=0.0.0.0

# ===========================================
# Configuration Redis (pour les queues)
# ===========================================
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# ===========================================
# Configuration des tâches planifiées
# ===========================================
CRON_TIMEZONE="UTC"
MAX_CONCURRENT_JOBS=10
JOB_TIMEOUT=3600                         # 1 heure

# ===========================================
# Configuration des backups
# ===========================================
BACKUP_CRON="0 2 * * *"                 # Tous les jours à 2h
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION=false
BACKUP_ENCRYPTION_KEY=""

# ===========================================
# Configuration du nettoyage
# ===========================================
CLEANUP_CRON="0 3 * * 0"                # Tous les dimanches à 3h
LOG_RETENTION_DAYS=30
TEMP_FILE_RETENTION_HOURS=24
```

## 🐳 Configuration Docker

### Docker Compose pour le développement

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: notploy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: notploy
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Docker Compose pour la production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/notploy
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - app_data:/app/data
    restart: unless-stopped

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - INNGEST_API_URL=http://inngest:8288
    depends_on:
      - inngest
    restart: unless-stopped

  schedules:
    build:
      context: ./apps/schedules
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: notploy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  inngest:
    image: inngest/inngest:latest
    ports:
      - "8288:8288"
    environment:
      - INNGEST_EVENT_KEY=${INNGEST_EVENT_KEY}
      - INNGEST_SIGNING_KEY=${INNGEST_SIGNING_KEY}
    restart: unless-stopped

  traefik:
    image: traefik:v3.0
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - traefik_data:/etc/traefik
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  app_data:
  traefik_data:
```

## 🔧 Configuration avancée

### Configuration des domaines personnalisés

```bash
# Configuration DNS
DOMAIN_CONFIG_PATH="/etc/notploy/domains"
DNS_PROVIDER="cloudflare"                # cloudflare, route53, digitalocean
DNS_API_TOKEN="votre-token-dns"

# Configuration SSL
SSL_AUTO_RENEW=true
SSL_RENEWAL_DAYS=30
SSL_EMAIL="admin@votredomaine.com"
```

### Configuration des ressources

```bash
# Limites des ressources
MAX_MEMORY_PER_APP="2GB"
MAX_CPU_PER_APP="2"
MAX_STORAGE_PER_APP="10GB"

# Configuration des quotas
QUOTA_ENABLED=true
DEFAULT_QUOTA_APPS=10
DEFAULT_QUOTA_BANDWIDTH="100GB/mois"
```

### Configuration monitoring avancé

```bash
# Métriques Prometheus
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH="/metrics"

# Alertes
ALERT_WEBHOOK_URL="https://votre-webhook.com/alerts"
ALERT_EMAIL_RECIPIENTS="admin@votredomaine.com"
ALERT_SLACK_CHANNEL="#alerts"
```

## 🚀 Scripts de configuration

### Script d'initialisation

```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🚀 Configuration de Notploy..."

# Vérifier les prérequis
command -v docker >/dev/null 2>&1 || { echo "Docker requis"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm requis"; exit 1; }

# Créer les répertoires nécessaires
mkdir -p /var/log/notploy
mkdir -p /var/backups/notploy
mkdir -p /var/cache/notploy

# Configurer les permissions
chmod 755 /var/log/notploy
chmod 755 /var/backups/notploy
chmod 755 /var/cache/notploy

# Générer les secrets
if [ ! -f .env.local ]; then
    echo "🔑 Génération des secrets..."
    openssl rand -base64 32 > .nextauth_secret
    openssl rand -base64 32 > .session_secret
fi

echo "✅ Configuration terminée !"
```

### Script de validation

```bash
#!/bin/bash
# scripts/validate.sh

echo "🔍 Validation de la configuration..."

# Vérifier les variables d'environnement requises
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Variable manquante: $var"
        exit 1
    fi
done

# Vérifier la connexion à la base de données
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Impossible de se connecter à la base de données"
    exit 1
fi

# Vérifier Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas accessible"
    exit 1
fi

echo "✅ Configuration valide !"
```

## 🎯 Prochaines étapes

Après la configuration :

1. [Déployez votre première application](./deployment.md)
2. [Configurez le monitoring](../monitoring/README.md)
3. [Explorez l'API REST](./api.md)

## 🆘 Support

- [Guide de dépannage](./troubleshooting.md)
- [Issues GitHub](https://github.com/votre-org/notploy/issues)
- [Documentation complète](./README.md)