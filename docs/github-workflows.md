# Workflows GitHub pour Notploy

Ce guide présente les workflows GitHub mis en place pour assurer la qualité, la sécurité et la performance du projet Notploy.

## 📋 Vue d'ensemble

Les workflows GitHub sont organisés en plusieurs catégories :

- **CI/CD** : Intégration et déploiement continus
- **Qualité de code** : Linting, formatting, tests
- **Sécurité** : Scans de vulnérabilités, dépendances
- **Release** : Gestion des versions et déploiements
- **Maintenance** : Nettoyage, monitoring, rapports

## 🏗️ Structure des workflows

```
.github/
├── workflows/
│   ├── ci.yml                    # CI principal
│   ├── code-quality.yml          # Qualité du code
│   ├── security.yml              # Scans de sécurité
│   ├── release.yml               # Gestion des releases
│   ├── docs.yml                  # Déploiement de la documentation
│   ├── performance.yml            # Tests de performance
│   ├── dependency-update.yml     # Mises à jour de dépendances
│   └── maintenance.yml           # Tâches de maintenance
├── actions/                       # Actions custom
│   ├── setup-node/
│   ├── docker-build/
│   └── notify-slack/
└── templates/                     # Templates d'issues et PRs
```

## 🚀 Workflows principaux

### 1. CI/CD Principal (`ci.yml`)

Déclenché sur chaque push et pull request pour valider le code.

**Événements :**
- Push sur `main`, `develop`
- Pull request vers `main`, `develop`

**Tâches :**
- Installation des dépendances
- Build des applications
- Exécution des tests
- Vérification de la couverture
- Build des images Docker

### 2. Qualité du code (`code-quality.yml`)

Assure le respect des standards de code.

**Tâches :**
- Linting avec Biome
- Formatting check
- Analyse statique
- Vérification des types TypeScript
- Tests unitaires et intégration

### 3. Sécurité (`security.yml`)

Scan automatique des vulnérabilités.

**Tâches :**
- Code scanning avec CodeQL
- Dépendances scanning
- Secrets scanning
- Analyse des containers

### 4. Release (`release.yml`)

Gestion automatisée des versions.

**Déclencheurs :**
- Tags de version (v*.*.*)
- Release manuelle

**Tâches :**
- Création du changelog
- Build des assets de production
- Publication sur Docker Hub
- Déploiement sur les environnements

## 📊 Métriques et monitoring

### Indicateurs de qualité

- **Couverture de code** : > 80%
- **Temps de CI** : < 10 minutes
- **Taux de succès** : > 95%
- **Vulnérabilités critiques** : 0

### Alertes et notifications

- Slack pour les échecs de CI
- Email pour les vulnérabilités critiques
- GitHub Issues pour les dépendances obsolètes

## 🔧 Configuration requise

### Secrets GitHub

```yaml
# Secrets requis dans GitHub Settings
DOCKER_HUB_TOKEN:              # Token Docker Hub
SLACK_WEBHOOK_URL:             # Webhook Slack notifications
CODEQL_LICENSE:                # Licence CodeQL (si nécessaire)
SONAR_TOKEN:                   # Token SonarCloud (optionnel)
AWS_ACCESS_KEY_ID:             # Clé AWS (pour déploiement)
AWS_SECRET_ACCESS_KEY:         # Secret AWS
NPM_TOKEN:                     # Token npm (pour publication)
```

### Environnements

- **Development** : `develop` branch
- **Staging** : `main` branch
- **Production** : Tags de version

## 🎯 Bonnes pratiques

### 1. Conventions de nommage

- Branches : `feature/`, `bugfix/`, `hotfix/`
- Tags : `v1.0.0`, `v1.0.1-beta.1`
- Commits : Conventional Commits

### 2. Stratégie de branches

```
main (production)
├── develop (staging)
│   ├── feature/new-feature
│   ├── bugfix/fix-bug
│   └── hotfix/critical-fix
└── release/v1.0.0
```

### 3. Reviews de code

- Minimum 2 reviewers
- Tests requis pour nouvelles fonctionnalités
- Documentation mise à jour
- Performance impact évalué

## 📚 Guides spécifiques

- [Configuration CI/CD](./ci-cd.md)
- [Qualité du code](./code-quality.md)
- [Sécurité](./security.md)
- [Gestion des releases](./releases.md)
- [Dépannage des workflows](./troubleshooting.md)

## 🚀 Mise en place rapide

1. **Copier les workflows** dans `.github/workflows/`
2. **Configurer les secrets** dans GitHub Settings
3. **Adapter les variables** d'environnement
4. **Tester avec une PR** de validation

## 🆘 Support

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Issues du projet](https://github.com/votre-org/notploy/issues)
- [Community discussions](https://github.com/votre-org/notploy/discussions)

---

**Amélioration continue** : Ces workflows évoluent avec le projet. N'hésitez pas à proposer des améliorations !