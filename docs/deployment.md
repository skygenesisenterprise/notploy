# Guide de déploiement

Ce guide explique comment déployer des applications avec Notploy, des simples sites statiques aux applications complexes conteneurisées.

## 📋 Types de déploiements supportés

### 1. Applications Docker
- Applications Node.js, Python, Go, etc.
- Applications avec Dockerfile personnalisé
- Images Docker pré-construites

### 2. Docker Compose
- Applications multi-services
- Applications avec bases de données
- Architectures microservices

### 3. Applications Git
- Déploiement depuis GitHub/GitLab
- Build automatique avec CI/CD
- Déploiement par branches

### 4. Sites statiques
- HTML/CSS/JavaScript
- Frameworks comme React, Vue, Angular
- Générateurs de sites statiques

## 🚀 Déploiement d'une application Docker

### Méthode 1: Via l'interface web

1. **Connectez-vous** à votre instance Notploy
2. **Cliquez sur "Nouvelle application"**
3. **Sélectionnez "Application Docker"**
4. **Configurez les paramètres :**

```yaml
# Configuration de base
Nom: mon-app
Description: Mon application Node.js
Type: Application Docker

# Source
Source: Repository Git
Repository: https://github.com/user/mon-app
Branche: main

# Configuration Docker
Dockerfile: ./Dockerfile
Context: ./
Build Args:
  NODE_ENV: production
  PORT: 3000

# Variables d'environnement
Environment:
  - DATABASE_URL=postgresql://...
  - API_KEY=secret-key
```

5. **Cliquez sur "Déployer"**

### Méthode 2: Via l'API

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "mon-app",
    "type": "docker",
    "source": {
      "type": "git",
      "repository": "https://github.com/user/mon-app",
      "branch": "main"
    },
    "docker": {
      "dockerfile": "./Dockerfile",
      "context": "./",
      "buildArgs": {
        "NODE_ENV": "production"
      }
    },
    "environment": {
      "DATABASE_URL": "postgresql://...",
      "PORT": "3000"
    }
  }'
```

### Exemple de Dockerfile

```dockerfile
# Dockerfile pour une application Node.js
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

## 🐳 Déploiement avec Docker Compose

### Configuration

1. **Créez une nouvelle application**
2. **Sélectionnez "Docker Compose"**
3. **Configurez votre compose file :**

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Variables d'environnement

```yaml
# Configuration dans Notploy
Environment Variables:
  - POSTGRES_PASSWORD=secure-password
  - REDIS_PASSWORD=redis-password
  - APP_SECRET=your-app-secret
```

## 🔄 Déploiement depuis Git

### Configuration GitHub

1. **Créez une GitHub App**
   - Allez dans Settings > Developer settings > GitHub Apps
   - Créez une nouvelle app avec les permissions :
     - Repository contents: Read
     - Commit statuses: Read & Write
     - Pull requests: Read & Write

2. **Configurez les webhooks**
   - Payload URL: `https://votre-notploy.com/api/webhooks/github`
   - Content type: `application/json`
   - Events: Push, Pull Request

3. **Ajoutez les clés dans Notploy**

```bash
# apps/dokploy/.env
GITHUB_APP_ID=12345
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET="webhook-secret"
```

### Workflow de déploiement

```yaml
# .github/workflows/deploy.yml
name: Deploy to Notploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t my-app:${{ github.sha }} .
          
      - name: Trigger Notploy deployment
        run: |
          curl -X POST https://votre-notploy.com/api/deployments \
            -H "Authorization: Bearer ${{ secrets.NOTPLOY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repository": "${{ github.repository }}",
              "commit": "${{ github.sha }}",
              "branch": "${{ github.ref_name }}",
              "image": "my-app:${{ github.sha }}"
            }'
```

## 🌐 Configuration des domaines

### Domaine personnalisé

1. **Allez dans les paramètres de l'application**
2. **Cliquez sur "Domaines"**
3. **Ajoutez votre domaine :**

```bash
# Configuration DNS
Type: A Record
Name: @
Value: IP_DE_VOTRE_SERVEUR
TTL: 300

# Ou CNAME
Type: CNAME
Name: www
Value: votre-notploy.com
TTL: 300
```

### SSL/TLS automatique

Notploy configure automatiquement les certificats SSL avec Let's Encrypt :

```bash
# Configuration SSL
Auto-renewal: Activé
Renewal threshold: 30 jours avant expiration
Email: admin@votredomaine.com
```

### Configuration avancée

```yaml
# Configuration Traefik personnalisée
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.mon-app.rule=Host(`mon-app.com`)"
  - "traefik.http.routers.mon-app.tls=true"
  - "traefik.http.routers.mon-app.tls.certresolver=letsencrypt"
  - "traefik.http.services.mon-app.loadbalancer.server.port=3000"
  - "traefik.http.middlewares.mon-app-headers.headers.customRequestHeaders.X-Forwarded-Proto=https"
```

## 📊 Monitoring et logs

### Logs en temps réel

```bash
# Via l'interface web
1. Allez dans votre application
2. Cliquez sur "Logs"
3. Sélectionnez le type de logs:
   - Build logs
   - Application logs
   - Error logs

# Via l'API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/applications/mon-app/logs
```

### Métriques de performance

```bash
# Métriques disponibles
- CPU usage
- Memory usage
- Network I/O
- Disk I/O
- Response time
- Error rate
```

### Alertes

```yaml
# Configuration des alertes
Alerts:
  - type: cpu_usage
    threshold: 80%
    duration: 5m
    action: webhook
    
  - type: memory_usage
    threshold: 90%
    duration: 2m
    action: email
    
  - type: error_rate
    threshold: 5%
    duration: 1m
    action: slack
```

## 🔄 Stratégies de déploiement

### Rolling Update

```yaml
# Configuration du rolling update
Strategy: Rolling
Max unavailable: 25%
Max surge: 25%
Health check: /health
Grace period: 30s
```

### Blue-Green Deployment

```yaml
# Configuration blue-green
Strategy: Blue-Green
Traffic split: 50/50
Health check: /health
Promotion delay: 5m
```

### Canary Deployment

```yaml
# Configuration canary
Strategy: Canary
Traffic split: 10/90
Increment: 10%
Health check: /health
Auto-promotion: true
```

## 🔧 Déploiement avancé

### Variables d'environnement dynamiques

```yaml
# Configuration des secrets
Secrets:
  - name: DATABASE_URL
    source: vault
    path: secret/data/db
    key: url
    
  - name: API_KEY
    source: aws-secrets
    region: us-west-2
    secret: my-app/api-key
```

### Volumes persistants

```yaml
# Configuration des volumes
Volumes:
  - name: uploads
    path: /app/uploads
    size: 10GB
    type: ssd
    
  - name: logs
    path: /app/logs
    size: 5GB
    type: standard
```

### Health checks

```yaml
# Configuration des health checks
Health Check:
  Path: /health
  Interval: 30s
  Timeout: 10s
  Retries: 3
  Start period: 60s
  
  # Commande personnalisée
  Command: ["curl", "-f", "http://localhost:3000/health"]
```

## 🚨 Gestion des erreurs

### Échecs de déploiement

```bash
# Causes communes
- Dockerfile invalide
- Variables d'environnement manquantes
- Ports déjà utilisés
- Images trop volumineuses
- Timeouts de build

# Solutions
1. Vérifiez les logs de build
2. Validez votre Dockerfile
3. Vérifiez les variables d'environnement
4. Augmentez les timeouts
5. Optimisez la taille de l'image
```

### Rollback automatique

```yaml
# Configuration du rollback
Rollback:
  Enabled: true
  Trigger: health_check_failure
  Delay: 30s
  Max attempts: 3
  
  # Conditions
  Conditions:
    - error_rate > 5%
    - response_time > 2s
    - cpu_usage > 90%
```

## 🎯 Bonnes pratiques

### Optimisation des images Docker

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

### Sécurité

```yaml
# Configuration de sécurité
Security:
  - Non-root user
  - Read-only filesystem
  - No privileged containers
  - Resource limits
  - Network policies
```

### Performance

```yaml
# Optimisation des performances
Performance:
  - Image caching
  - Parallel builds
  - Layer optimization
  - Resource allocation
  - CDN integration
```

## 📚 Exemples complets

### Application React

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Application Python Django

```dockerfile
# Dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "myapp.wsgi:application"]
```

## 🆘 Support et dépannage

- [Guide de dépannage](./troubleshooting.md)
- [Documentation API](./api.md)
- [Issues GitHub](https://github.com/votre-org/notploy/issues)

---

**Déploiement réussi !** 🎉 Votre application est maintenant en ligne.