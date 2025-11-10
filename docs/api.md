# Documentation API

L'API REST de Notploy permet d'automatiser toutes les opérations de déploiement et de gestion d'applications.

## 📋 Base URL

```
Production: https://votre-notploy.com/api
Développement: http://localhost:3000/api
```

## 🔐 Authentification

### Bearer Token

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://votre-notploy.com/api/applications
```

### Obtenir un token

```bash
# Login
curl -X POST https://votre-notploy.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "votre-mot-de-passe"
  }'

# Réponse
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": "user_123",
    "email": "admin@example.com"
  }
}
```

## 📊 Applications

### Lister les applications

```bash
GET /api/applications

# Query parameters
?page=1&limit=20&search=mon-app&type=docker&status=running
```

**Réponse :**
```json
{
  "applications": [
    {
      "id": "app_123",
      "name": "mon-app",
      "description": "Mon application Node.js",
      "type": "docker",
      "status": "running",
      "url": "https://mon-app.votredomaine.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:45:00Z",
      "owner": {
        "id": "user_123",
        "email": "admin@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Créer une application

```bash
POST /api/applications
Content-Type: application/json

{
  "name": "mon-app",
  "description": "Mon application Node.js",
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
      "NODE_ENV": "production",
      "PORT": "3000"
    }
  },
  "environment": {
    "DATABASE_URL": "postgresql://...",
    "API_KEY": "secret-key"
  },
  "resources": {
    "memory": "1GB",
    "cpu": "1",
    "storage": "10GB"
  }
}
```

### Détails d'une application

```bash
GET /api/applications/{appId}
```

**Réponse :**
```json
{
  "id": "app_123",
  "name": "mon-app",
  "description": "Mon application Node.js",
  "type": "docker",
  "status": "running",
  "url": "https://mon-app.votredomaine.com",
  "source": {
    "type": "git",
    "repository": "https://github.com/user/mon-app",
    "branch": "main",
    "lastCommit": "abc123def456"
  },
  "docker": {
    "image": "mon-app:latest",
    "dockerfile": "./Dockerfile",
    "context": "./",
    "buildArgs": {
      "NODE_ENV": "production"
    }
  },
  "environment": {
    "DATABASE_URL": "postgresql://...",
    "PORT": "3000"
  },
  "resources": {
    "memory": "1GB",
    "cpu": "1",
    "storage": "10GB"
  },
  "domains": [
    {
      "id": "domain_123",
      "name": "mon-app.com",
      "type": "custom",
      "ssl": true,
      "status": "active"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T11:45:00Z"
}
```

### Mettre à jour une application

```bash
PUT /api/applications/{appId}
Content-Type: application/json

{
  "description": "Nouvelle description",
  "environment": {
    "DATABASE_URL": "postgresql://...",
    "NEW_VAR": "new-value"
  },
  "resources": {
    "memory": "2GB",
    "cpu": "2"
  }
}
```

### Supprimer une application

```bash
DELETE /api/applications/{appId}
```

## 🚀 Déploiements

### Lister les déploiements

```bash
GET /api/applications/{appId}/deployments

# Query parameters
?page=1&limit=20&status=running&branch=main
```

### Créer un déploiement

```bash
POST /api/applications/{appId}/deployments
Content-Type: application/json

{
  "branch": "main",
  "commit": "abc123def456",
  "force": false,
  "environment": {
    "DEPLOYMENT_ID": "deploy_123"
  }
}
```

### Détails d'un déploiement

```bash
GET /api/deployments/{deploymentId}
```

**Réponse :**
```json
{
  "id": "deploy_123",
  "applicationId": "app_123",
  "status": "running",
  "branch": "main",
  "commit": "abc123def456",
  "commitMessage": "Fix: Update dependencies",
  "author": "john.doe@example.com",
  "startedAt": "2024-01-15T12:00:00Z",
  "completedAt": null,
  "duration": 180,
  "logs": [
    {
      "timestamp": "2024-01-15T12:00:00Z",
      "level": "info",
      "message": "Starting deployment..."
    },
    {
      "timestamp": "2024-01-15T12:01:00Z",
      "level": "info",
      "message": "Building Docker image..."
    }
  ],
  "steps": [
    {
      "name": "clone",
      "status": "completed",
      "duration": 15
    },
    {
      "name": "build",
      "status": "running",
      "duration": 120
    },
    {
      "name": "deploy",
      "status": "pending",
      "duration": 0
    }
  ]
}
```

### Annuler un déploiement

```bash
POST /api/deployments/{deploymentId}/cancel
```

### Logs d'un déploiement

```bash
GET /api/deployments/{deploymentId}/logs

# Query parameters
?level=error&since=2024-01-15T12:00:00Z&limit=1000
```

## 🌐 Domaines

### Lister les domaines

```bash
GET /api/applications/{appId}/domains
```

### Ajouter un domaine

```bash
POST /api/applications/{appId}/domains
Content-Type: application/json

{
  "name": "mon-app.com",
  "type": "custom",
  "ssl": true
}
```

### Vérifier un domaine

```bash
POST /api/domains/{domainId}/verify
```

### Supprimer un domaine

```bash
DELETE /api/domains/{domainId}
```

## 📊 Monitoring

### Métriques d'une application

```bash
GET /api/applications/{appId}/metrics

# Query parameters
?period=1h&metrics=cpu,memory,network
```

**Réponse :**
```json
{
  "metrics": {
    "cpu": [
      {
        "timestamp": "2024-01-15T12:00:00Z",
        "value": 45.2
      },
      {
        "timestamp": "2024-01-15T12:01:00Z",
        "value": 52.8
      }
    ],
    "memory": [
      {
        "timestamp": "2024-01-15T12:00:00Z",
        "value": 512
      },
      {
        "timestamp": "2024-01-15T12:01:00Z",
        "value": 528
      }
    ]
  },
  "summary": {
    "avgCpu": 49.0,
    "maxCpu": 52.8,
    "avgMemory": 520,
    "maxMemory": 528
  }
}
```

### État de santé

```bash
GET /api/applications/{appId}/health
```

**Réponse :**
```json
{
  "status": "healthy",
  "checks": [
    {
      "name": "http",
      "status": "pass",
      "responseTime": 145,
      "lastCheck": "2024-01-15T12:00:00Z"
    },
    {
      "name": "container",
      "status": "pass",
      "uptime": "2d 5h 30m",
      "lastCheck": "2024-01-15T12:00:00Z"
    }
  ]
}
```

## 🔔 Notifications

### Configurer les notifications

```bash
POST /api/applications/{appId}/notifications
Content-Type: application/json

{
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/services/...",
    "channel": "#deployments"
  },
  "events": ["deployment.started", "deployment.completed", "deployment.failed"]
}
```

### Lister les notifications

```bash
GET /api/applications/{appId}/notifications
```

### Supprimer une notification

```bash
DELETE /api/notifications/{notificationId}
```

## 💾 Backups

### Lister les backups

```bash
GET /api/applications/{appId}/backups

# Query parameters
?page=1&limit=20&status=completed
```

### Créer un backup

```bash
POST /api/applications/{appId}/backups
Content-Type: application/json

{
  "type": "full",
  "compression": true,
  "encryption": false
}
```

### Restaurer un backup

```bash
POST /api/backups/{backupId}/restore
Content-Type: application/json

{
  "targetAppId": "app_456",
  "restoreData": true,
  "restoreDatabase": true
}
```

## 👥 Utilisateurs et équipes

### Lister les utilisateurs

```bash
GET /api/users

# Query parameters
?page=1&limit=20&search=john&role=admin
```

### Créer un utilisateur

```bash
POST /api/users
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "name": "John Doe",
  "role": "developer",
  "password": "secure-password"
}
```

### Mettre à jour un utilisateur

```bash
PUT /api/users/{userId}
Content-Type: application/json

{
  "name": "John Smith",
  "role": "admin"
}
```

### Supprimer un utilisateur

```bash
DELETE /api/users/{userId}
```

## 🔑 Clés API

### Lister les clés API

```bash
GET /api/users/{userId}/api-keys
```

### Créer une clé API

```bash
POST /api/users/{userId}/api-keys
Content-Type: application/json

{
  "name": "Production Key",
  "permissions": ["read", "write"],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Réponse :**
```json
{
  "id": "key_123",
  "name": "Production Key",
  "key": "np_live_1234567890abcdef...",
  "permissions": ["read", "write"],
  "createdAt": "2024-01-15T12:00:00Z",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

### Révoquer une clé API

```bash
DELETE /api/api-keys/{keyId}
```

## 📈 Webhooks

### Configurer un webhook

```bash
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://votre-app.com/webhooks/notploy",
  "events": ["deployment.started", "deployment.completed"],
  "secret": "webhook-secret",
  "active": true
}
```

### Lister les webhooks

```bash
GET /api/webhooks
```

### Tester un webhook

```bash
POST /api/webhooks/{webhookId}/test
Content-Type: application/json

{
  "event": "deployment.completed",
  "data": {
    "deploymentId": "deploy_123",
    "status": "success"
  }
}
```

## 🛠️ Utilitaires

### Validation de Dockerfile

```bash
POST /api/utils/validate-dockerfile
Content-Type: text/plain

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Analyse de sécurité

```bash
POST /api/utils/security-scan
Content-Type: application/json

{
  "image": "mon-app:latest",
  "severity": "high"
}
```

### Coûts estimés

```bash
GET /api/applications/{appId}/costs?period=30d
```

**Réponse :**
```json
{
  "period": "30d",
  "totalCost": 45.67,
  "breakdown": {
    "compute": 32.50,
    "storage": 8.75,
    "bandwidth": 4.42
  },
  "currency": "USD"
}
```

## 🚨 Erreurs

### Format des erreurs

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  },
  "requestId": "req_1234567890"
}
```

### Codes d'erreur courants

- `400` - `VALIDATION_ERROR` : Paramètres invalides
- `401` - `UNAUTHORIZED` : Non authentifié
- `403` - `FORBIDDEN` : Permissions insuffisantes
- `404` - `NOT_FOUND` : Ressource non trouvée
- `409` - `CONFLICT` : Conflit de ressources
- `429` - `RATE_LIMIT_EXCEEDED` : Trop de requêtes
- `500` - `INTERNAL_ERROR` : Erreur serveur

## 📝 Limites de taux

```json
{
  "limits": {
    "requests": 1000,
    "window": "1h",
    "remaining": 950,
    "resetAt": "2024-01-15T13:00:00Z"
  }
}
```

## 🧪 Exemples d'utilisation

### Script de déploiement automatique

```bash
#!/bin/bash
# deploy.sh

API_URL="https://votre-notploy.com/api"
TOKEN="votre-token-api"
APP_NAME="mon-app"

# Créer un déploiement
DEPLOYMENT=$(curl -s -X POST "$API_URL/applications/$APP_NAME/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "main",
    "force": false
  }')

DEPLOYMENT_ID=$(echo $DEPLOYMENT | jq -r '.id')

# Surveiller le déploiement
while true; do
  STATUS=$(curl -s "$API_URL/deployments/$DEPLOYMENT_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [[ "$STATUS" == "completed" ]]; then
    echo "✅ Déploiement réussi !"
    exit 0
  elif [[ "$STATUS" == "failed" ]]; then
    echo "❌ Déploiement échoué !"
    exit 1
  fi
  
  sleep 10
done
```

### Client Python

```python
import requests
import time

class NotployClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def deploy_application(self, app_name, branch="main"):
        """Déployer une application"""
        response = requests.post(
            f"{self.base_url}/applications/{app_name}/deployments",
            headers=self.headers,
            json={"branch": branch}
        )
        response.raise_for_status()
        return response.json()
    
    def wait_deployment(self, deployment_id, timeout=1800):
        """Attendre la fin d'un déploiement"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            response = requests.get(
                f"{self.base_url}/deployments/{deployment_id}",
                headers=self.headers
            )
            response.raise_for_status()
            
            data = response.json()
            status = data["status"]
            
            if status in ["completed", "failed"]:
                return data
            
            time.sleep(10)
        
        raise TimeoutError("Déploiement timeout")

# Utilisation
client = NotployClient("https://votre-notploy.com/api", "votre-token")
deployment = client.deploy_application("mon-app")
result = client.wait_deployment(deployment["id"])
```

## 🆘 Support

- [Documentation complète](./README.md)
- [Guide de dépannage](./troubleshooting.md)
- [Issues GitHub](https://github.com/votre-org/notploy/issues)
- [Email support](mailto:support@notploy.com)