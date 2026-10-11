# Notploy Voyager

> **Notploy Voyager** est l'application mobile officielle de Notploy, conçue pour superviser vos infrastructures, consulter vos projets et suivre vos déploiements depuis votre appareil mobile.

## 📱 À propos

Notploy Voyager est une application mobile React Native (Expo) qui vous permet de :

- Gérer plusieurs instances Notploy
- Superviser vos projets et déploiements
- Consulter les journaux et métriques
- Recevoir des alertes
- Effectuer des opérations d'administration

## 🚀 Installation

### Prérequis

- Node.js 24.4.0 ou supérieur
- pnpm 10.22.0 ou supérieur
- Expo CLI (`npm install -g expo-cli`)
- Un appareil iOS ou Android, ou un simulateur

### Installation des dépendances

```bash
# Depuis la racine du monorepo
pnpm install

# Ou depuis le dossier de l'application
cd apps/voyager
pnpm install
```

### Lancement de l'application

```bash
# Démarrer l'application
pnpm dev

# ou avec Expo
npx expo start
```

### Lancement sur un appareil spécifique

```bash
# iOS
pnpm dev --ios

# Android
pnpm dev --android

# Web (pour le développement)
pnpm dev --web
```

## 🛠 Configuration

### Configuration de base

1. **Créez votre premier compte Notploy** :
   - Installez Notploy sur votre serveur ou utilisez le service cloud
   - Créez un compte et générez un token API

2. **Ajoutez une instance dans Voyager** :
   - Ouvrez l'application
   - Appuyez sur "Ajouter une instance"
   - Entrez l'URL de votre instance Notploy
   - Entrez votre token API

3. **Connectez-vous** :
   - Sélectionnez votre instance
   - Appuyez sur "Connexion"

### Configuration avancée

Vous pouvez configurer :

- **Thème** : Clair, sombre ou système
- **Notifications** : Activer/désactiver les notifications push
- **Authentification biométrique** : Utiliser Face ID ou Touch ID

## 📁 Structure du projet

```
apps/voyager/
├── app/                    # Routage Expo
│   ├── (tabs)/            # Navigation par onglets
│   ├── auth/              # Écrans d'authentification
│   ├── instances/         # Gestion des instances
│   ├── projects/          # Liste des projets
│   ├── deployments/       # Liste des déploiements
│   ├── services/          # Services et conteneurs
│   ├── logs/              # Lecteur de journaux
│   ├── monitoring/        # Surveillance
│   ├── activity/          # Activité et alertes
│   └── settings/          # Paramètres
├── expo/                  # Configuration Expo
├── src/
│   ├── components/        # Composants React Native
│   │   └── ui/           # Composants d'interface (Button, Card, etc.)
│   ├── hooks/             # Hooks personnalisés
│   ├── lib/               # Logique métier
│   │   └── sdk-client.ts # Wrapper du SDK pour Mobile
│   ├── providers/        # Fournisseurs de contexte
│   ├── services/          # Services (storage, authentification, etc.)
│   ├── stores/            # Gestion d'état (future)
│   ├── styles/           # Styles globaux
│   ├── types/             # Types TypeScript
│   └── utils/             # Utilitaires
├── assets/               # Images, polices, etc.
├── app.json              # Configuration Expo
├── package.json          # Dépendances
├── tsconfig.json         # Configuration TypeScript
├── babel.config.js       # Configuration Babel
├── tailwind.config.js    # Configuration Tailwind
└── biome.json            # Configuration Biome
```

## 🎨 Design System

Voyager utilise un design system basé sur :

- **Tailwind CSS** (via NativeWind) pour les styles
- **Thème Notploy** : Palette de couleurs cohérente avec Notploy Desktop et Web
- **Composants réutilisables** : Boutons, cartes, inputs, etc.

### Couleurs

```typescript
{
  primary: '#2563eb',      // Bleu primaire
  surface: '#ffffff',     // Surface (clair) / '#1e293b' (sombre)
  background: '#f8fafc',   // Arrière-plan (clair) / '#0f172a' (sombre)
  foreground: '#0f172a',   // Premier plan (clair) / '#f8fafc' (sombre)
  success: '#22c55e',      // Succès (vert)
  warning: '#f59e0b',      // Avertissement (orange)
  error: '#ef4444',        // Erreur (rouge)
}
```

## 📡 API et SDK

### SDK Partagé

Voyager utilise le SDK `@notploy/sdk` pour communiquer avec l'API Notploy. Le SDK est généré à partir du fichier `openapi.json` et fournit des types TypeScript complets.

### Gestion des instances

Le service `InstanceStorageService` gère :

- Le stockage des métadonnées des instances (AsyncStorage)
- Le stockage sécurisé des tokens API (expo-secure-store)
- La gestion de l'instance active

### Authentification

Le fournisseur `AuthProvider` gère :

- L'état de connexion
- La validation des tokens
- La gestion des sessions
- Le basculement entre instances

## 🔒 Sécurité

### Stockage des identifiants

- **Tokens API** : Stockés dans `expo-secure-store` (chiffrés par le périphérique)
- **Métadonnées** : Stockées dans AsyncStorage (non chiffrées, mais non sensibles)

### Validation TLS

- La validation TLS est **activée par défaut**
- Peut être désactivée pour le développement avec des certificats auto-signés
- **Ne désactivez jamais en production !**

### Bonnes pratiques

- ❌ Ne stockez jamais les identifiants dans le code source
- ❌ N'affichez jamais les tokens dans les logs
- ❌ Ne désactivez pas la validation TLS en production
- ✅ Validez toujours les URLs saisies par l'utilisateur
- ✅ Utilisez le stockage sécurisé pour les données sensibles
- ✅ Nettoyez les données sensibles lors de la déconnexion

## 🧪 Tests

```bash
# Vérification TypeScript
pnpm typecheck

# Linting
pnpm lint

# Tests (à implémenter)
pnpm test
```

## 📦 Build

### Build pour iOS

```bash
# Avec EAS
pnpm eas:build:ios

# Ou avec Expo
npx expo prebuild --platform ios
```

### Build pour Android

```bash
# Avec EAS
pnpm eas:build:android

# Ou avec Expo
npx expo prebuild --platform android
```

## 🎯 Fonctionnalités implémentées

- [x] Structure de base de l'application Expo
- [x] Configuration TypeScript et Tailwind CSS
- [x] Design system avec composants réutilisables
- [x] Gestion des instances Notploy
- [x] Authentification par token API
- [x] Navigation par onglets
- [x] Écran d'accueil (dashboard)
- [x] Écran de connexion
- [x] Écran de gestion des instances
- [ ] Écran des projets
- [ ] Écran des déploiements
- [ ] Écran des services/containers
- [ ] Lecteur de journaux
- [ ] Surveillance (monitoring)
- [ ] Activité et alertes
- [ ] Paramètres

## 📝 Fonctionnalités à implémenter

- [ ] Notifications push
- [ ] Authentification par email/mot de passe
- [ ] Authentification biométrique
- [ ] Synchronisation des données en arrière-plan
- [ ] Tests unitaires et d'intégration
- [ ] Documentation utilisateur

## 🤝 Contribution

1. Forkez le dépôt
2. Créez une branche de fonctionnalité (`git checkout -b feature/amazing-feature`)
3. Faites vos modifications
4. Lancez les vérifications (`pnpm typecheck`, `pnpm lint`)
5. Créez un commit (`git commit -m 'feat: add amazing feature'`)
6. Poussez vers la branche (`git push origin feature/amazing-feature`)
7. Ouvrez une Pull Request

## 📜 Licence

Notploy Voyager est distribué sous la licence **ISC**. Voir le fichier [LICENSE](../../LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Expo](https://expo.dev/) - Plateforme de développement mobile
- [React Native](https://reactnative.dev/) - Framework mobile
- [Notploy Team](https://notploy.com) - L'équipe derrière Notploy

---

**Notploy Voyager** - Votre compagnon mobile pour la gestion d'infrastructure.
