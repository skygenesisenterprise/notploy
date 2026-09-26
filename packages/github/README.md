# @notploy/github

**`@notploy/github` fournit la couche d'intégration GitHub de Notploy. Il ne contient pas le moteur de déploiement de Notploy.**

Bibliothèque TypeScript typée et testable qui permet à Notploy de communiquer avec GitHub : authentification GitHub App, installations, repositories, branches, commits, pull requests, deployments, deployment statuses, checks, releases et webhooks.

C'est la fondation sur laquelle sera construite la future GitHub App officielle de Notploy (`integrations/github`).

## Installation

```bash
pnpm add @notploy/github
```

## Création du client

```ts
import { createGitHubClient } from "@notploy/github";

const github = createGitHubClient({
  auth: {
    app: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    },
    installationId: 12345678,
  },
});
```

Ou avec un token d'installation déjà obtenu / un PAT :

```ts
const github = createGitHubClient({
  auth: { token: process.env.GITHUB_TOKEN },
});
```

Pour une instance GitHub Enterprise Server ou un tenant ghe.com :

```ts
const github = createGitHubClient({
  auth: {
    app: { appId, privateKey },
    installationId,
    baseUrl: "https://github.acmecorp.com/api/v3",
  },
});
```

## Authentification GitHub App

Le package implémente la chaîne complète :

```text
App authentication (JWT)
  → Installation authentication
    → Installation access token
      → GitHub API
```

```ts
import {
  createGitHubAppAuth,
  createInstallationAuth,
} from "@notploy/github";

// 1. Authentification App (JWT court, opérations au niveau App)
const appAuth = await createGitHubAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
});

// 2. Authentification Installation (token d'accès d'installation)
const installationAuth = await createInstallationAuth({
  credentials: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
  },
  installationId: 12345678,
});

console.log(installationAuth.token); // à utiliser immédiatement, jamais stocké
```

> **Secrets** : les credentials (App ID, private key) sont fournis uniquement au runtime (variables d'environnement, secret manager). Ils ne sont jamais loggés, jamais inclus dans les messages d'erreur, et jamais stockés par ce package.

## Installations

```ts
// Métadonnées d'une installation
const installation = await github.installations.get({
  installationId: 12345678,
});

// Repositories accessibles à l'installation
const repositories =
  await github.installations.listRepositories();

// Gestion des repositories d'une installation (JWT App requis)
await github.installations.addRepository({
  installationId: 12345678,
  repositoryId: 503873119,
});
await github.installations.removeRepository({
  installationId: 12345678,
  repositoryId: 503873119,
});
```

## Repositories

```ts
const repository = await github.repositories.get({
  owner: "skygenesisenterprise",
  repository: "notploy",
});

console.log(repository.defaultBranch, repository.visibility);

// Permissions d'un utilisateur sur un repository
const { permission } = await github.repositories.getPermissions({
  owner: "skygenesisenterprise",
  repository: "notploy",
  username: "alice",
});
```

## Branches et commits

```ts
const branches = await github.branches.list({
  owner: "skygenesisenterprise",
  repository: "notploy",
});

// Résoudre un ref (branche, tag ou SHA) en commit exact
const { sha } = await github.branches.resolve({
  owner: "skygenesisenterprise",
  repository: "notploy",
  ref: "main",
});

const comparison = await github.commits.compare({
  owner: "skygenesisenterprise",
  repository: "notploy",
  base: "v1.0.0",
  head: "main",
});
```

## Pull Requests

```ts
const pullRequests = await github.pullRequests.list({
  owner: "skygenesisenterprise",
  repository: "notploy",
  state: "open",
});

const files = await github.pullRequests.listFiles({
  owner: "skygenesisenterprise",
  repository: "notploy",
  pullNumber: 42,
});

// Commentaire de preview deployment
await github.pullRequests.createComment({
  owner: "skygenesisenterprise",
  repository: "notploy",
  pullNumber: 42,
  body: "🚀 Preview deployment ready: https://pr-42.notploy.app",
});
```

## Deployments et Deployment Statuses

```ts
const deployment = await github.deployments.create({
  owner: "skygenesisenterprise",
  repository: "notploy",
  ref: "main",
  environment: "production",
  description: "Deployed by Notploy",
});

await github.deployments.createStatus({
  owner: "skygenesisenterprise",
  repository: "notploy",
  deploymentId: deployment.id,
  state: "success",
  environmentUrl: "https://notploy.app",
});
```

Les états sont fortement typés : `"queued" | "in_progress" | "success" | "failure" | "error" | "inactive"`.

## Checks

```ts
const check = await github.checks.create({
  owner: "skygenesisenterprise",
  repository: "notploy",
  name: "Notploy Build",
  headSha: commitSha,
  status: "queued",
});

await github.checks.update({
  owner: "skygenesisenterprise",
  repository: "notploy",
  checkRunId: check.id,
  status: "in_progress",
});

await github.checks.update({
  owner: "skygenesisenterprise",
  repository: "notploy",
  checkRunId: check.id,
  status: "completed",
  conclusion: "success",
});
```

## Webhooks

La vérification de signature se fait **toujours** côté serveur avant de considérer une livraison comme fiable :

```ts
import { createGitHubClient } from "@notploy/github";

const github = createGitHubClient({
  auth: { token: process.env.GITHUB_TOKEN },
  // ...ou toute autre auth ; le namespace webhooks a besoin du secret :
});

// Alternative directe sans client complet :
// new WebhooksNamespace({ secret })
```

Via le client :

```ts
const result = await github.webhooks.verifyAndParse({
  payload: rawBody,            // corps brut de la requête
  signature: signatureHeader,  // X-Hub-Signature-256
  eventName: eventHeader,      // X-GitHub-Event
  deliveryId: deliveryHeader,  // X-GitHub-Delivery
});

switch (result.event.type) {
  case "push":
    console.log(`Push sur ${result.event.repository.fullName} (${result.event.after})`);
    break;
  case "pull_request":
    console.log(`PR #${result.event.number} ${result.event.action}`);
    break;
  case "installation":
    console.log(`Installation ${result.event.action}`);
    break;
  default:
    // narrowing exhaustif sur les types supportés
    break;
}
```

Ou en deux étapes :

```ts
const isValid = await github.webhooks.verify({ payload, signature });
if (!isValid) return new Response("Invalid signature", { status: 401 });

const event = github.webhooks.parse({ payload, eventName });
```

Événements typés supportés : `push`, `pull_request`, `installation`, `installation_repositories`, `repository`, `release`, `workflow_run`.

## Erreurs

Toutes les erreurs héritent de `GitHubError` et n'exposent jamais de credentials :

| Erreur | Signification |
| --- | --- |
| `GitHubAuthenticationError` | Credentials invalides/expirés (401) ou échec d'auth App |
| `GitHubAuthorizationError` | Permissions insuffisantes (403) |
| `GitHubNotFoundError` | Ressource introuvable ou non accessible par l'installation (404) |
| `GitHubRateLimitError` | Limite d'API atteinte (403/429), avec `rateLimit.remaining` / `resetAt` |
| `GitHubApiError` | Autre échec API, avec `status`, `code`, `requestId` |
| `GitHubWebhookError` | Signature invalide, payload malformé ou événement non supporté |
| `GitHubConfigurationError` | Configuration du client manquante ou invalide |

```ts
import { GitHubNotFoundError, GitHubRateLimitError } from "@notploy/github";

try {
  await github.repositories.get({ owner: "acme", repository: "missing" });
} catch (error) {
  if (error instanceof GitHubRateLimitError) {
    console.log(`Rate limit — reset à ${error.rateLimit?.resetAt}`);
  } else if (error instanceof GitHubNotFoundError) {
    console.log(`Introuvable (request id: ${error.requestId})`);
  }
}
```

## Rate limits

```ts
const rateLimit = await github.rateLimit();
console.log(rateLimit.limit, rateLimit.remaining, rateLimit.resetAt);
```

Le package expose les informations ; la politique de retry/queue applicative appartient au niveau supérieur (Notploy core). Des retries automatiques limités et prévisibles sont appliqués pour les erreurs transitoires.

## Permissions GitHub App requises (moindre privilège)

| Permission | Accès | Pourquoi |
| --- | --- | --- |
| `Contents` | Read | Cloner/lire les repositories à déployer, lire commits/branches |
| `Metadata` | Read | Obligatoire (automatique) pour toute utilisation de l'API |
| `Pull requests` | Read & write | Lire les PR, publier les commentaires de preview deployment |
| `Deployments` | Read & write | Créer GitHub Deployments et leurs statuses |
| `Checks` | Read & write | Publier l'état des builds Notploy (Check Runs) |
| `Administration` (collaborators) | Read | Vérifier les permissions d'un utilisateur sur une PR |

Aucune permission d'écriture sur le code, aucune gestion d'org/members, aucun webhook write : la GitHub App Notploy ne demande que ce dont l'intégration a réellement besoin.

## Périmètre

Ce package contient uniquement la couche d'intégration GitHub. Il ne contient **pas** :

- le moteur de déploiement de Notploy (Docker, Kubernetes, Traefik, etc.) ;
- la logique de build ou de files d'attente ;
- la GitHub App complète (qui vivra dans `integrations/github` et utilisera ce package).

## Développement

```bash
pnpm install          # à la racine du monorepo
pnpm --filter @notploy/github build
pnpm --filter @notploy/github test
pnpm --filter @notploy/github lint
pnpm --filter @notploy/github typecheck
```

Ou, depuis `packages/github`, la cible `check` du Makefile :

```bash
make check
```

## Docker / GitHub App

Le service GitHub App de Notploy (récepteur de webhooks + synchronisation des installations) est packagé dans une image dédiée, déjà référencée par le workflow `docker-publish.yml` (image `notploy-github`).

```bash
# depuis packages/github
cp .env.example .env        # renseigner GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET

make docker-build           # construire l'image (contexte = racine du monorepo)
make docker-up              # démarrer le service via docker-compose
make docker-logs            # suivre les logs
make docker-down            # arrêter
```

Principes de sécurité appliqués :

- **aucun secret dans l'image** : les credentials (App ID, private key, webhook secret) sont injectés au runtime via l'environnement (`docker-compose.yml`, `.env` non commité ou secret manager) ;
- **`.env.example` documente chaque variable** sans contenir de valeur réelle ;
- le conteneur tourne avec l'utilisateur non-root `node` ;
- le `HEALTHCHECK` interroge `/health` en local, sans exposer de données.

Variables requises au runtime : `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`. Optionnelles : `GITHUB_INSTALLATION_ID`, `GITHUB_BASE_URL`, `NOTPLOY_API_URL`, `EXTERNAL_PORT`.

## License

MIT — voir [LICENSE](./LICENSE).
