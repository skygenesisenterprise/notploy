# Documentation Notploy

Bienvenue dans la documentation complète de Notploy, votre alternative open source aux plateformes de déploiement cloud comme Vercel, Netlify et Heroku.

## 📖 Table des matières

- [Qu'est-ce que Notploy ?](#quest-ce-que-notploy)
- [Architecture](#architecture)
- [Guides de démarrage](#guides-de-démarrage)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [API](#api)
- [Dépannage](#dépannage)

## 🚀 Qu'est-ce que Notploy ?

Notploy est une plateforme de déploiement d'applications open source qui vous permet de :

- **Déployer des applications** conteneurisées avec Docker
- **Gérer les domaines** et certificats SSL automatiquement
- **Surveiller les performances** de vos applications
- **Automatiser les déploiements** avec GitHub/GitLab integrations
- **Gérer les bases de données** et services associés
- **Configurer des backups** automatiques

### Fonctionnalités principales

- 🐳 **Support Docker natif**
- 🔄 **CI/CD intégré**
- 🌐 **Gestion des domaines**
- 🔒 **SSL/TLS automatique**
- 📊 **Monitoring en temps réel**
- 💾 **Backups automatisés**
- 🔐 **Authentification sécurisée**
- 📱 **Interface web moderne**

## 🏗️ Architecture

Notploy est construit avec une architecture microservices :

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │      API        │    │   Schedules     │
│   (Next.js)     │    │   (Hono)        │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Monitoring    │
                    │     (Go)        │
                    └─────────────────┘
```

### Composants

- **Application** : Interface web principale (Next.js + TypeScript)
- **API** : Service de déploiement (Hono + Inngest)
- **Schedules** : Gestion des tâches planifiées
- **Monitoring** : Surveillance des performances (Go)

## 📚 Guides de démarrage

### Installation rapide
```bash
git clone https://github.com/votre-org/notploy.git
cd notploy
pnpm install
pnpm run setup
pnpm run dev
```

### Pour aller plus loin
- [Guide d'installation complet](./installation.md)
- [Configuration initiale](./configuration.md)
- [Premier déploiement](./deployment.md)

## ⚙️ Configuration

Notploy utilise un système de configuration flexible basé sur des variables d'environnement :

```bash
# Configuration de base
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Base de données
DATABASE_URL=postgresql://...

# Authentification
NEXTAUTH_SECRET=votre-secret
NEXTAUTH_URL=http://localhost:3000
```

[Voir la configuration complète](./configuration.md)

## 🚀 Déploiement

### Types de déploiement supportés

1. **Applications Docker**
2. **Docker Compose**
3. **Applications Node.js**
4. **Sites statiques**

### Méthodes de déploiement

- **GitHub Integration** : Déploiement automatique sur push
- **GitLab Integration** : Intégration avec GitLab CI/CD
- **Déploiement manuel** : Via l'interface web
- **API REST** : Déploiement programmatique

[Guide de déploiement détaillé](./deployment.md)

## 🔌 API

Notploy expose une API REST complète pour l'automatisation :

```bash
# Lister les applications
GET /api/applications

# Créer un déploiement
POST /api/deployments

# Obtenir les logs
GET /api/logs/{deploymentId}
```

[Documentation API complète](./api.md)

## 🔧 Dépannage

### Problèmes courants

- **Connexion Docker** : Vérifiez que Docker est en cours d'exécution
- **Permissions** : Assurez-vous d'avoir les droits nécessaires
- **Ports** : Vérifiez que les ports ne sont pas déjà utilisés

[Guide de dépannage complet](./troubleshooting.md)

## 🤝 Contribuer

Nous apprécions les contributions ! Consultez notre [guide de contribution](../CONTRIBUTING.md) pour commencer.

## 📄 Licence

Ce projet est sous licence MIT. Consultez le fichier [LICENSE](../LICENSE) pour plus d'informations.

---

**Besoin d'aide ?** 
- Consultez notre [documentation](./)
- Ouvrez une [issue](https://github.com/skygenesisenterprise/notploy/issues)
- Rejoignez notre [communauté](https://github.com/skygenesisenterprise/notploy/discussions)