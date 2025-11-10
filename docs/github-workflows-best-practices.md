# Bonnes Pratiques GitHub Workflows

Ce guide présente les bonnes pratiques à suivre pour maintenir des workflows GitHub efficaces et sécurisés pour le projet Notploy.

## 📋 Table des matières

- [Structure et organisation](#structure-et-organisation)
- [Sécurité](#sécurité)
- [Performance](#performance)
- [Maintenabilité](#maintenabilité)
- [Monitoring et alertes](#monitoring-et-alertes)
- [Documentation](#documentation)

## 🏗️ Structure et organisation

### 1. Convention de nommage

```yaml
# Noms de fichiers descriptifs
ci.yml                    # CI/CD principal
code-quality.yml          # Qualité du code
security.yml              # Scans de sécurité
release.yml               # Gestion des releases
performance.yml           # Tests de performance
dependency-update.yml     # Mises à jour auto
maintenance.yml           # Tâches de maintenance

# Noms de jobs clairs
jobs:
  test-and-validate:       # Au lieu de "test"
  build-and-package:       # Au lieu de "build"
  deploy-staging:          # Au lieu de "deploy"
  security-scan:          # Au lieu de "security"
```

### 2. Organisation des workflows

```yaml
# Structure recommandée
.github/
├── workflows/
│   ├── ci.yml                    # Workflow principal
│   ├── code-quality.yml          # Qualité
│   ├── security.yml              # Sécurité
│   ├── release.yml               # Releases
│   └── maintenance.yml           # Maintenance
├── actions/                       # Actions custom
│   ├── setup-node/
│   │   └── action.yml
│   ├── docker-build/
│   │   └── action.yml
│   └── notify-slack/
│       └── action.yml
└── templates/                     # Templates
    ├── bug_report.md
    └── feature_request.md
```

### 3. Variables d'environnement

```yaml
# Variables globales au niveau du workflow
env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

# Variables spécifiques aux jobs
jobs:
  test:
    env:
      TEST_TIMEOUT: 30000
      COVERAGE_THRESHOLD: 80
```

## 🔒 Sécurité

### 1. Gestion des secrets

```yaml
# Utiliser les secrets GitHub
- name: Deploy to production
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
    API_KEY: ${{ secrets.PROD_API_KEY }}
  run: |
    deploy-script.sh

# Ne jamais logger les secrets
- name: Use secret safely
  run: |
    echo "Using secret..."  # ✅ Correct
    echo "$SECRET"         # ❌ Incorrect
```

### 2. Permissions minimales

```yaml
# Définir les permissions minimales requises
permissions:
  contents: read          # Lire le contenu du repo
  actions: read           # Lire les actions
  security-events: write  # Écrire les événements de sécurité
  pull-requests: write    # Commenter les PRs

# Pour les releases
permissions:
  contents: write         # Créer des releases
  packages: write         # Publier des packages
```

### 3. Validation des entrées

```yaml
# Valider les entrées utilisateur
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version'
        required: true
        type: string
        validation:
          pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
          error_message: 'Invalid version format. Use X.Y.Z'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate version
        run: |
          if [[ ! "${{ github.event.inputs.version }}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid version format"
            exit 1
          fi
```

## ⚡ Performance

### 1. Stratégies de cache

```yaml
# Cache des dépendances Node.js
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: ${{ env.NODE_VERSION }}
    cache: 'npm'

# Cache pnpm
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8
    cache: 'npm'

# Cache Docker layers
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### 2. Parallélisation

```yaml
# Jobs parallèles quand possible
jobs:
  test:
    strategy:
      matrix:
        node-version: [18, 20]
        os: [ubuntu-latest, macos-latest]

  security-scan:
    strategy:
      matrix:
        service: [app, api, worker]
```

### 3. Optimisation du temps

```yaml
# Utiliser les dépendances entre jobs
jobs:
  test:
    # Tests rapides d'abord

  build:
    needs: test
    # Build seulement si tests passent

  deploy:
    needs: [test, build]
    # Déployer seulement si tout passe

# Conditions pour éviter les jobs inutiles
- name: Deploy
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: |
    deploy.sh
```

## 🔧 Maintenabilité

### 1. Actions réutilisables

```yaml
# .github/actions/setup-node/action.yml
name: 'Setup Node.js Environment'
description: 'Setup Node.js with pnpm and cache'
inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'
  cache-key:
    description: 'Cache key'
    required: false
    default: 'npm'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: ${{ inputs.cache-key }}

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8

# Utilisation dans les workflows
- name: Setup Node.js
  uses: ./.github/actions/setup-node
  with:
    node-version: '18'
```

### 2. Templates de workflows

```yaml
# Template pour les services
- name: Build and test service
  uses: ./.github/actions/build-test-service
  with:
    service-name: ${{ matrix.service }}
    dockerfile: Dockerfile.${{ matrix.service }}
```

### 3. Documentation inline

```yaml
# Commenter les étapes complexes
- name: Run database migrations
  # Les migrations sont nécessaires pour les tests d'intégration
  # Elles créent les tables et insèrent les données de test
  run: |
    cd apps/dokploy
    pnpm run migration:run

# Expliquer les conditions
- name: Deploy to production
  # Déployer uniquement sur la branche principale pour éviter les déploiements accidentels
  if: github.ref == 'refs/heads/main' && success()
  run: |
    deploy.sh
```

## 📊 Monitoring et alertes

### 1. Notifications

```yaml
# Notification Slack en cas d'échec
- name: Notify failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    channel: '#ci-cd'
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: |
      🚨 Workflow failed: ${{ github.workflow }}
      Repository: ${{ github.repository }}
      Branch: ${{ github.ref }}
      Commit: ${{ github.sha }}

# Notification pour les releases
- name: Notify release
  if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')
  uses: 8398a7/action-slack@v3
  with:
    status: success
    channel: '#releases'
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2. Rapports

```yaml
# Générer des rapports de qualité
- name: Generate quality report
  run: |
    cat > quality-report.md << EOF
    # Quality Report
    
    ## Tests
    - Unit tests: ${{ needs.unit-tests.result }}
    - Integration tests: ${{ needs.integration-tests.result }}
    
    ## Coverage
    - Lines: ${{ steps.coverage.outputs.lines }}%
    - Functions: ${{ steps.coverage.outputs.functions }}%
    
    ## Security
    - Vulnerabilities: ${{ steps.security.outputs.vulnerabilities }}
    EOF

- name: Comment PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: require('fs').readFileSync('quality-report.md', 'utf8')
      });
```

### 3. Métriques

```yaml
# Suivre les métriques de performance
- name: Record metrics
  run: |
    # Temps de build
    BUILD_TIME=$(($(date +%s) - BUILD_START))
    echo "build_time=$BUILD_TIME" >> $GITHUB_OUTPUT
    
    # Taille des artifacts
    ARTIFACT_SIZE=$(du -sh artifacts/ | cut -f1)
    echo "artifact_size=$ARTIFACT_SIZE" >> $GITHUB_OUTPUT

- name: Send metrics to monitoring
  uses: actions/github-script@v7
  with:
    script: |
      await fetch('${{ secrets.METRICS_WEBHOOK }}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: context.workflow,
          build_time: '${{ steps.metrics.outputs.build_time }}',
          artifact_size: '${{ steps.metrics.outputs.artifact_size }}'
        })
      });
```

## 📚 Documentation

### 1. README des workflows

```markdown
# GitHub Workflows

Cette section décrit les workflows GitHub utilisés dans le projet Notploy.

## Workflows principaux

### CI/CD Pipeline (`ci.yml`)
- **Déclencheur**: Push sur main/develop, PR
- **Fonction**: Tests, build, déploiement
- **Durée estimée**: 10-15 minutes

### Code Quality (`code-quality.yml`)
- **Déclencheur**: Push, PR, hebdomadaire
- **Fonction**: Linting, tests, couverture
- **Seuils**: Couverture > 80%

## Variables d'environnement

- `NODE_VERSION`: Version de Node.js (20)
- `REGISTRY`: Registry Docker (ghcr.io)
- `IMAGE_NAME`: Nom de l'image Docker

## Secrets requis

- `DOCKER_HUB_TOKEN`: Token Docker Hub
- `SLACK_WEBHOOK_URL`: Webhook Slack
- `PROD_DATABASE_URL`: URL BDD production
```

### 2. Documentation des actions custom

```yaml
# .github/actions/docker-build/action.yml
name: 'Build Docker Image'
description: 'Build and push Docker image with caching'
inputs:
  dockerfile:
    description: 'Path to Dockerfile'
    required: true
  context:
    description: 'Build context'
    required: false
    default: '.'
  tags:
    description: 'Image tags'
    required: true
  push:
    description: 'Push to registry'
    required: false
    default: 'false'

# Exemple d'utilisation
# - name: Build Docker image
#   uses: ./.github/actions/docker-build
#   with:
#     dockerfile: './Dockerfile'
#     tags: 'myapp:latest'
#     push: true
```

### 3. Guides de dépannage

```markdown
# Dépannage des Workflows

## Problèmes courants

### Timeout de build
**Cause**: Build trop long ou ressources insuffisantes
**Solution**: 
- Optimiser le Dockerfile
- Augmenter le timeout
- Utiliser le cache

### Échec des tests
**Cause**: Tests flaky ou environnement incorrect
**Solution**:
- Vérifier les logs
- Exécuter localement
- Mettre à jour les dépendances

### Erreur de permissions
**Cause**: Secrets manquants ou permissions incorrectes
**Solution**:
- Vérifier les secrets GitHub
- Configurer les permissions du workflow
```

## 🎯 Checklist de qualité

### Avant de merger un workflow

- [ ] Le workflow a un nom descriptif
- [ ] Les permissions sont minimales
- [ ] Les secrets sont correctement utilisés
- [ ] Le cache est configuré
- [ ] Les erreurs sont gérées
- [ ] Les notifications sont configurées
- [ ] La documentation est à jour

### Review des workflows

1. **Sécurité**
   - [ ] Pas de secrets hardcodés
   - [ ] Permissions minimales
   - [ ] Validation des entrées

2. **Performance**
   - [ ] Cache configuré
   - [ ] Jobs parallélisés
   - [ ] Conditions optimales

3. **Maintenabilité**
   - [ ] Actions réutilisables
   - [ ] Documentation claire
   - [ ] Noms cohérents

---

**Amélioration continue** : Ces bonnes pratiques évoluent avec les besoins du projet. Contribuez à les améliorer !