# Guide d'installation

Ce guide vous accompagne dans l'installation de Notploy sur votre système.

## 📋 Prérequis

### Systèmes d'exploitation supportés
- **Linux** (Ubuntu 20.04+, Debian 11+, CentOS 8+)
- **macOS** (12.0+)
- **Windows** (10+ avec WSL2)

### Logiciels requis

#### 1. Node.js
```bash
# Node.js 20.16.0 ou supérieur requis
node --version  # doit afficher v20.16.0 ou plus

# Installation avec nvm (recommandé)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### 2. pnpm
```bash
# pnpm 9.12.0 ou supérieur requis
npm install -g pnpm@latest
pnpm --version  # doit afficher 9.12.0 ou plus
```

#### 3. Docker
```bash
# Docker doit être installé et en cours d'exécution
docker --version
docker-compose --version

# Sur Linux, assurez-vous que votre utilisateur est dans le groupe docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 4. Base de données PostgreSQL
```bash
# PostgreSQL 14+ recommandé
# Option 1: Installation locale
sudo apt-get install postgresql postgresql-contrib  # Ubuntu/Debian
# ou
brew install postgresql  # macOS

# Option 2: Utiliser Docker (recommandé pour les tests)
docker run --name postgres-notploy \
  -e POSTGRES_PASSWORD=notploy \
  -e POSTGRES_DB=notploy \
  -p 5432:5432 \
  -d postgres:15 
```

## 🚀 Installation

### Étape 1: Cloner le dépôt

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
```

### Étape 2: Installer les dépendances

```bash
# Installer toutes les dépendances du workspace
pnpm install
```

### Étape 3: Configuration de l'environnement

```bash
# Copier les fichiers d'exemple
cp apps/dokploy/.env.example apps/dokploy/.env
cp apps/api/.env.example apps/api/.env
cp apps/schedules/.env.example apps/schedules/.env
```

### Étape 4: Configurer la base de données

Éditez `apps/dokploy/.env` et configurez votre base de données :

```bash
# Configuration PostgreSQL
DATABASE_URL="postgresql://postgres:notploy@localhost:5432/notploy"

# Ou avec Docker
DATABASE_URL="postgresql://postgres:notploy@host.docker.internal:5432/notploy"
```

### Étape 5: Initialiser la base de données

```bash
# Naviguer vers l'application principale
cd apps/dokploy

# Exécuter les migrations
pnpm run migration:run

# (Optionnel) Ajouter des données de test
pnpm run db:seed
```

### Étape 6: Démarrer les services

#### Option A: Développement (recommandé pour commencer)

```bash
# Terminal 1: Démarrer l'application principale
cd apps/dokploy
pnpm run dev

# Terminal 2: Démarrer l'API de déploiement
cd apps/api
pnpm run dev

# Terminal 3: Démarrer le service de planification
cd apps/schedules
pnpm run dev

# Terminal 4: Démarrer le monitoring (optionnel)
cd monitoring
go run main.go
```

#### Option B: Production avec Docker

```bash
# Construire les images
docker-compose build

# Démarrer tous les services
docker-compose up -d
```

## 🔧 Vérification de l'installation

### 1. Vérifier les services

Ouvrez votre navigateur et accédez à :
- **Application principale** : http://localhost:3000
- **API Documentation** : http://localhost:3001/swagger
- **Monitoring** : http://localhost:3002 (si activé)

### 2. Créer un compte administrateur

```bash
# Depuis le répertoire apps/dokploy
pnpm run setup
```

Suivez les instructions pour créer votre premier compte administrateur.

### 3. Tester la connexion Docker

```bash
# Vérifier que Docker est accessible depuis l'application
docker ps
```

## 🐛 Problèmes courants

### Port déjà utilisé

```bash
# Vérifier quel processus utilise le port 3000
lsof -i :3000

# Tuer le processus
kill -9 <PID>
```

### Permissions Docker

```bash
# Erreur de permission Docker
sudo chmod 666 /var/run/docker.sock

# Solution permanente (redémarrage requis)
sudo usermod -aG docker $USER
```

### Base de données inaccessible

```bash
# Vérifier que PostgreSQL est en cours d'exécution
sudo systemctl status postgresql

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### Dépendances manquantes

```bash
# Nettoyer et réinstaller
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

## 🎯 Prochaines étapes

Une fois l'installation terminée :

1. [Configurez votre premier domaine](./configuration.md)
2. [Déployez votre première application](./deployment.md)
3. [Explorez l'API](./api.md)

## 🆘 Obtenir de l'aide

Si vous rencontrez des problèmes :

- Consultez le [guide de dépannage](./troubleshooting.md)
- Ouvrez une [issue sur GitHub](https://github.com/votre-org/notploy/issues)
- Rejoignez notre [communauté Discord](https://discord.gg/notploy)

---

**Installation réussie !** 🎉 Notploy est maintenant prêt à être utilisé.