# Intégration GitHub officielle (#115)

Référence : [Notploy #115](https://github.com/skygenesisenterprise/notploy/issues/115)

Périmètre : `packages/github` (couche partagée), `apps/notploy` (route webhook,
schéma, déduplication) et l'API CI/CD existante (`packages/server/src/services/cicd.ts`)
qui sert de contrat à `skygenesisenterprise/notploy-actions`.

Ce document remplace l'audit initial : il décrit ce qui existe, ce qui a été
corrigé dans cette passe (phases 0 et 1) et ce qui reste explicitement hors
périmètre pour l'instant.

## 1. Audit de l'existant

| Zone | État avant | Constat |
| --- | --- | --- |
| `packages/github` | Client Octokit typé, auth GitHub App, installations, deployments, checks, webhooks | Base saine, mais aucun modèle de contrat partagé entre la GitHub App et les Actions |
| Vérification de signature | `apps/notploy/pages/api/deploy/github.ts` vérifiait `JSON.stringify(req.body)` | **Faille confirmée** : la signature HMAC porte sur les octets bruts, pas sur un JSON re-sérialisé |
| Idempotence des livraisons | Aucune | Une redélivraison GitHub créait un second déploiement |
| Événements d'installation | `installation` et `installation_repositories` renvoyaient `400` | Suspension/révocation non suivies : une installation révoquée pouvait encore déclencher un déploiement |
| Cycle de vie PR | Ouverture/synchronisation/fermeture et limite de previews | Comportement conservé ; correctifs de sécurité collaborateur déjà en place |
| Anti-double déploiement | **Absent** : la GitHub App et `notploy-actions` peuvent déployer le même commit | Le chemin Actions possède déjà une clé d'idempotence (`cicd_deployment`), le chemin App non |
| Checks/statuses GitHub | Non publiés | Le retour d'état natif GitHub n'existe pas encore |
| Documentation | README du package (FR) | Aucune doc de configuration App, permissions, modes, self-host |

## 2. Contrat d'intégration partagé

Nouveau module `packages/github/src/contract/index.ts`, sans I/O, sans base de
données, sans politique de déploiement — uniquement du vocabulaire partagé.

- `GitHubRepositoryIdentity` : `id` numérique (stable malgré renommage/transfert)
  + `owner` + `name`.
- `GitHubInstallationIdentity` : `installationId` + `accountLogin`.
- `GitHubRef` / `parseGitRef` : classe `branch` / `tag` / `commit` ; les refs
  `refs/pull/42/merge` ne sont **pas** devinées en branche, elles valent `null`.
- `GitHubDeploymentTrigger` : origine, dépôt, installation, SHA, ref, numéro de
  PR, `X-GitHub-Delivery`, acteur, run de workflow, environnement.
- `DeploymentOrigin` : `github_app`, `github_actions`, `manual`, `api`, `schedule`.
- `buildDeploymentIdempotencyKey` : clé déterministe **purement fonctionnelle**.

### Politique d'idempotence

La clé inclut le discriminant de l'événement, ce qui donne le comportement voulu
sans bloquer les redeploiements légitimes :

| Situation | Clé | Effet |
| --- | --- | --- |
| Redélivraison du même événement (`X-GitHub-Delivery` identique) | identique | Ignorée |
| Nouveau push livré pour le même commit | différente | Déploie |
| Workflow relancé | différente (`run id` différent) | Déploie |
| Deux environnements pour le même commit | différente | Deux déploiements distincts |
| Déploiement manuel / API | aucune | Jamais dédupliqué |

`undefined` signifie « non idempotent » : le contrat n'invente pas de clé pour
les chemins manuels, pour ne pas casser un redéploiement volontaire.

Le contrat est **versionné** (`v1:` dans la clé) et additif : les consommateurs
doivent tolérer des champs inconnus et utiliser `isDeploymentOrigin` plutôt que
de comparer à une liste figée.

## 3. Sécurité des webhooks

### 3.1 Corps brut uniquement

La route exporte désormais :

```ts
export const config = { api: { bodyParser: false } };
```

`readRawWebhookBody` lit le flux, plafonne à 25 Mo et renvoie la chaîne UTF-8
exacte. La signature est vérifiée par `@octokit/webhooks` (comparaison à temps
constant) sur ces octets, via `verifyGithubSignature`. Aucun champ du payload
n'est utilisé pour une décision avant cette vérification : l'`installation.id`
sert uniquement à choisir le secret qui valide la livraison.

Conséquences vérifiées par les tests :

- un corps ré-sérialisé (`JSON.stringify(JSON.parse(body))`) est **refusé** ;
- un corps modifié après signature est refusé ;
- une signature absente, un `X-GitHub-Delivery` absent ou malformé renvoie `400` ;
- une installation inconnue renvoie `401`, comme une mauvaise signature, pour ne
  pas révéler quelles installations existent ;
- un corps vide renvoie `400`, un corps trop gros `413`.

### 3.2 Déduplication durable

Nouvelle table `github_webhook_delivery` (migration `0217_absent_argent.sql`) :

| Colonne | Rôle |
| --- | --- |
| `githubId`, `deliveryId` | Clé primaire composite : l'insertion est atomique |
| `event` | `X-GitHub-Event`, pour le diagnostic |
| `status` | `received`, `processed`, `ignored`, `failed` |
| `attempts` | Nombre de tentatives, pour borner les retries |
| `receivedAt`, `processedAt` | Fenêtre de reprise et rétention |
| `errorMessage` | Résumé sûr, jamais un payload ni un token |

Cycle d'une livraison :

1. `INSERT … ON CONFLICT DO NOTHING` : un seul gagne.
2. Si la ligne existe en `processed`/`ignored` : `200` « Duplicate delivery
   ignored », aucun travail.
3. Si elle existe en `received` et date de moins de 10 minutes : un worker la
   traite encore, `200` et aucun travail.
4. Si elle est `failed` (ou `received` périmée) et `attempts < 5` : reprise
   atomique, plafonnée à 5 tentatives.
5. Le résultat est enregistré avant l'envoi de la réponse (écriture attendue,
   pour qu'un runtime serverless ne gèle pas avant la comptabilité).

Les codes HTTP suivent la sémantique GitHub : `200` = accepté/ignoré,
`400` = requête invalide (pas de retry utile), `401` = signature/installation
invalide, `413` = payload trop gros, `500` = échec retryable.

### 3.3 Cycle de vie de l'installation

| Événement | Action |
| --- | --- |
| `installation.created` | Marque l'installation comme active |
| `installation.suspend` | Renseigne `githubInstallationSuspendedAt` |
| `installation.deleted` | Renseigne `githubInstallationSuspendedAt` (ligne conservée pour l'historique) |
| `installation.unsuspend`, `new_permissions_accepted` | Efface le marqueur |
| `installation_repositories.added/removed` | Accusé de réception ; l'ensemble accessible est relu depuis GitHub à chaque déploiement |

Tant que `githubInstallationSuspendedAt` est renseigné, tout `push` ou
`pull_request` est accusé puis ignoré : aucune installation révoquée ne peut
créer de déploiement. Les lignes ne sont pas supprimées car les providers Git et
les déploiements les référencent.

## 4. Permissions GitHub App (moindre privilège)

| Permission | Accès | Justification |
| --- | --- | --- |
| `Contents` | Read | Cloner le dépôt, lire commits/branches/tags |
| `Metadata` | Read | Obligatoire pour toute utilisation de l'API |
| `Pull requests` | Read & write | Lire les PR, commenter les previews |
| `Deployments` | Read & write | Statuts de déploiement GitHub |
| `Checks` | Read & write | Publication de l'état Notploy (à brancher) |
| `Administration` (collaborators) | Read | Vérifier les droits de l'auteur d'une PR |

Aucune permission d'écriture sur le code, aucune administration d'organisation.
Les événements souscrits sont limités à `push`, `pull_request`, `installation`,
`installation_repositories` (plus `ping`, toujours envoyé).

## 5. Modes de déploiement

| Mode | État | Comportement |
| --- | --- | --- |
| **Auto Deploy** (GitHub App) | Implémenté | `push`/tag pilotés par `applications.autoDeploy`, `triggerType`, `branch`, `owner`, `repository`, `githubId` |
| **Workflow-driven** (`notploy-actions`) | Implémenté | L'Action appelle l'API CI/CD (`/api/v1/cicd/deploy`) avec `source` et une `idempotencyKey` |
| **Hybride** | Manuel | Désactiver `autoDeploy` sur l'application et laisser le workflow déployer : aucun changement de code requis |
| **Preview** | Implémenté | `pull_request` + `isPreviewDeploymentsActive`, limite `previewLimit`, labels `previewLabels` |

### Garanties actuelles

- `push` : correspondance stricte branche + dépôt + owner + provider GitHub.
- Tags : `refs/tags/<nom>` avec `triggerType = "tag"`.
- `watchPaths` : un push sans chemin surveillé ne déploie pas.
- Mots-clés de saut : `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`,
  `[actions skip]` (comportement préexistant, conservé).
- Événements non supportés : accusés en `200` puis ignorés, pour ne pas
  provoquer de retries inutiles.

### Anti-double déploiement

Le chemin CI/CD possède déjà sa clé d'idempotence persistée
(`cicd_deployment.externalId`, unique par provider) : un workflow relancé ne
recrée pas de déploiement. Le chemin GitHub App possède désormais la sienne au
niveau de la livraison (`github_webhook_delivery`).

**Ce qui reste ouvert** : empêcher qu'un `push` (App) et un workflow (Actions)
produisent deux déploiements du même commit lorsqu'une application a les deux
actifs. La stratégie recommandée aujourd'hui est le mode hybride documenté
ci-dessus : `autoDeploy` désactivé quand un workflow déploie. Un marqueur de
source unique sur `deployment` reste à concevoir (section 10).

## 6. Previews et PR forks

Comportement actuel (conservé et documenté) :

- `opened` / `synchronize` / `reopened` créent ou mettent à jour la preview du
  head SHA courant ; `closed` supprime les previews associées.
- `previewLabels` filtre par label ; `previewLimit` (défaut 3) ne s'applique
  qu'aux nouvelles previews — une preview existante est redéployée même à la
  limite.
- `previewRequireCollaboratorPermissions` (actif par défaut) vérifie le niveau
  `write`/`maintain`/`admin` de l'auteur de la PR. Un auteur non collaborateur
  est bloqué et reçoit un commentaire explicatif, sans dépasser un commentaire
  par PR.

Politique forks : par défaut, un fork dont l'auteur n'a pas de droit d'écriture
sur le dépôt de base ne déclenche **aucune** preview. Le déploiement de code non
fiable doit rester une décision explicite (`previewRequireCollaboratorPermissions
= false`), et les previews ne doivent jamais recevoir de cible de production.

Limite connue : les previews ne sont pas encore publiées comme check GitHub et
la purge après fusion n'est pas couverte par un test de bout en bout.

## 7. Notploy Self et Cloud

### Configuration GitHub App (commune)

| Élément | Valeur |
| --- | --- |
| Callback URL | `https://<notploy>/api/auth/callback/github` |
| Setup URL | `https://<notploy>/dashboard/settings/git-providers` |
| Webhook URL | `https://<notploy>/api/deploy/github` |
| Webhook secret | un secret par provider, stocké dans `github.githubWebhookSecret` |
| Private key | `github.githubPrivateKey`, injectée au runtime |

L'URL de webhook doit être **publiquement joignable en HTTPS**. C'est la seule
contrainte d'infrastructure : aucun service tiers n'est requis.

### Différences Self / Cloud

- **Cloud** : l'App GitHub Notploy est partagée ; chaque installation est
  rattachée à une organisation Notploy via `githubInstallationId`.
- **Self** : l'opérateur crée sa propre GitHub App et renseigne App ID, clé
  privée et secret webhook dans l'UI ou via l'environnement. GitHub Enterprise
  Server et les tenants `*.ghe.com` sont supportés par la couche provider
  (`deriveGithubApiUrl`), mais ne sont pas testés de bout en bout.
- Les previews, checks et commentaires dépendent des permissions accordées à
  l'App : une App créée sans `Checks: write` ne peut pas publier de check.

### Rotation et compromission

1. Régénérer la clé privée dans les réglages de la GitHub App.
2. Mettre à jour `github.githubPrivateKey` (secret manager ou UI).
3. Faire tourner le secret webhook : l'ancien secret reste valide jusqu'à la
   mise à jour, puis les livraisons signées avec l'ancien sont refusées (`401`).
4. En cas de compromission, suspendre puis réinstaller l'App : les installations
   révoquées sont marquées et ne peuvent plus déployer.

## 8. Diagnostic et UX

Existant : statut de connexion provider, liste des dépôts accessibles
(`installations.listRepositories`), erreurs de permissions remontées par
`githubGitProviderAdapter`.

Ajouté : la table `github_webhook_delivery` donne la trace des livraisons
(event, statut, tentatives, horodatages) sans conserver le payload — support
suffisant pour une vue de diagnostic et pour expliquer pourquoi un push n'a pas
déployé.

Non couvert : vue UI dédiée, lien déploiement → commit/PR/run dans l'interface,
choix explicite du mode de déploiement dans les réglages de l'application.

### Rétention

Les lignes `github_webhook_delivery` sont conservées pour le diagnostic. Une
purge (par exemple 30 jours sur `receivedAt`) doit être planifiée comme tâche
récurrente ; aucune donnée de payload n'est stockée, donc la purge est peu
sensible.

## 9. Tests exécutés

`packages/github` (73 tests) :

- `tests/webhooks/receive.test.ts` — signature valide sur octets exacts, corps
  ré-sérialisé refusé, corps modifié refusé, entêtes manquants, delivery id
  malformé, payload trop gros, payload vide, JSON invalide, redélivrance.
- `tests/contract/contract.test.ts` — classification des refs, stabilité et
  portée de la clé d'idempotence.

`apps/notploy` (63 tests sur les fichiers GitHub) :

- `__test__/deploy/github-webhook-handler.test.ts` — signature invalide sans
  traitement, installation inconnue, doublon sans file d'attente, suspension,
  cycle de vie installation, événement non supporté, enregistrement du statut.
- `__test__/deploy/github-webhook-delivery.test.ts` — claim atomique, retry
  borné, reprise d'un worker mort, corps brut et limite de taille.

Commande :

```bash
pnpm --filter @notploy/github test
cd apps/notploy && npx vitest run --config __test__/vitest.config.ts \
  __test__/deploy/github-webhook-handler.test.ts \
  __test__/deploy/github-webhook-delivery.test.ts \
  __test__/deploy/github.test.ts
```

## 10. Reste à faire

- **Phase 2** : marqueur de source de déploiement sur `deployment` (origine +
  corrélation), garde anti-double déploiement App/Actions au niveau du service,
  file durable dédiée aux événements GitHub (aujourd'hui : traitement synchrone
  puis `myQueue` par application).
- **Phase 3** : publication des checks/status GitHub à partir du cycle de vie
  Notploy, lien vers le déploiement, previews en PR comment/check, tests de bout
  en bout de la purge.
- **Phase 4** : UI installation/permissions/diagnostic, choix explicite du mode,
  documentation publique et liens vérifiés.
- **Phase 5** : exécution contre une instance Notploy réelle et un dépôt GitHub
  de test, matrice de versions, politique de support.

## 11. Définition du support officiel

`@notploy/github` est aujourd'hui une bibliothèque **interne au monorepo**,
également publiable, mais sans garantie d'API stable : pas de semver public ni
 de politique de dépréciation avant une décision explicite. Le contrat exposé
 dans `src/contract` est versionné et additif ; les autres namespaces suivent
 les types GitHub et peuvent évoluer.

« Officiellement supporté » signifie, pour cette intégration : mainteneur unique
(`skygenesisenterprise`), tests de régression sur les chemins de sécurité
ci-dessus exécutés en CI, documentation de configuration Self/Cloud, et canal de
signalement via [SECURITY.md](../../../SECURITY.md).

## 12. Limites connues

- GitHub Enterprise Server non testé de bout en bout.
- Aucun check/status GitHub publié par Notploy à ce stade.
- Le mode hybride repose sur une convention (`autoDeploy = false`), pas encore
  sur une garde technique.
- Le traitement reste synchrone dans la route webhook : les déploiements sont
  bien mis en file (`myQueue`/`deploy`), mais la résolution des applications est
  faite dans la requête.
- La déduplication est par livraison : un même commit poussé deux fois (deux
  livraisons) produit deux déploiements, ce qui est le comportement voulu.
