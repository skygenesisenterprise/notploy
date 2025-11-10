# Configuration requise pour les releases Notploy

## Secrets GitHub requis

Ajoutez ces secrets dans les paramètres de votre repository GitHub :

### Docker Hub
- `DOCKERHUB_USERNAME`: Votre nom d'utilisateur Docker Hub
- `DOCKERHUB_TOKEN`: Token d'accès Docker Hub (créé dans les settings Docker Hub)

### Quay.io (optionnel)
- `QUAY_USERNAME`: Votre nom d'utilisateur Quay.io
- `QUAY_TOKEN`: Token d'accès Quay.io

### Notifications (optionnel)
- `SLACK_WEBHOOK_URL`: Webhook pour les notifications Slack
- `SECURITY_SLACK_WEBHOOK`: Webhook pour les alertes de sécurité

## Configuration du repository

### 1. Activer GitHub Pages
Pour la documentation :
- Allez dans Settings > Pages
- Source : Deploy from a branch
- Branch : gh-pages (ou main)
- Folder : /root

### 2. Configurer les environnements
Créez les environnements suivants dans Settings > Environments :
- `staging` : Pour les déploiements de test
- `production` : Pour les déploiements en production

### 3. Activer les security features
Dans Settings > Security & analysis :
- ✅ Dependabot alerts
- ✅ Dependabot security updates
- ✅ Code scanning
- ✅ Secret scanning

## Droits requis

Le workflow a besoin des permissions suivantes :
- `contents: write` : Pour créer les releases
- `packages: write` : Pour publier sur les registres
- `security-events: write` : Pour les rapports de sécurité
- `pull-requests: write` : Pour commenter les PRs

## Structure des tags

Les releases sont créées automatiquement quand vous poussez un tag :
```bash
git tag v1.0.0
git push origin v1.0.0
```

Formats supportés :
- `v1.0.0` : Release standard
- `v1.0.0-beta.1` : Prerelease
- `v1.0.0-rc.1` : Release candidate

## Résultat de la release

Une fois le workflow terminé, vous aurez :

### Docker Hub
- `skygenesisenterprise/notploy:1.0.0`
- `skygenesisenterprise/notploy:1.0`
- `skygenesisenterprise/notploy:latest`
- `skygenesisenterprise/notploy-api:1.0.0`
- `skygenesisenterprise/notploy-schedules:1.0.0`
- `skygenesisenterprise/notploy-monitoring:1.0.0`

### Archives binaires
- `notploy-1.0.0-linux-amd64.tar.gz`
- `notploy-1.0.0-linux-arm64.tar.gz`
- `notploy-1.0.0-darwin-amd64.tar.gz`
- `notploy-1.0.0-darwin-arm64.tar.gz`
- `notploy-1.0.0-windows-amd64.zip`

Chaque archive inclut :
- Le binaire compilé pour la plateforme
- Le fichier de checksum SHA256
- Un fichier d'installation détaillé

### Documentation
- Documentation mise à jour sur GitHub Pages
- Changelog généré automatiquement
- SBOM (Software Bill of Materials) pour chaque image Docker