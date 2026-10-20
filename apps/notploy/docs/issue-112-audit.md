# Audit #112 — sécurité, fiabilité et orchestration

Référence : [Notploy #112](https://github.com/skygenesisenterprise/notploy/issues/112)

Périmètre exécuté : `apps/notploy` et les modules partagés `packages/server` qu'il
consomme (process, notifications, backups, monitoring, WSS, réseau, permissions).

Méthode : chaque piste amont a été confrontée au code réel, puis classée
**lacune confirmée et corrigée**, **déjà couvert**, **non applicable** ou
**à planifier dans une issue dédiée**. Aucun comportement de Dokploy n'a été
recopié.

## 1. Synthèse

| Référence amont | État Notploy | Action |
| --- | --- | --- |
| Dokploy #5519 (identifiants S3 journalisés) | Lacune confirmée sur les erreurs `ExecError`, les notifications de backup et les logs de déploiement | Corrigé : politique centrale de masquage + application aux frontières |
| Dokploy #4621 (fuite S3 dans les logs) | Partiellement couvert (rclone uniquement) | Corrigé : le helper rclone délègue à la politique centrale |
| Dokploy #5557 (clé SSH dans une notification de build) | Lacune confirmée | Corrigé : notifications build/database/volume/notploy redactées |
| Dokploy #5518 (processus `tail`/logs orphelins) | Lacune confirmée | Corrigé : cleanup idempotent des timers, streams, SSH et PTY |
| Dokploy #5504 (collecteur de stats après fermeture du WS) | Lacune confirmée | Corrigé : arrêt du timer + garde sur les ticks en vol |
| Dokploy #5524 (backup dépendant de gzip/shell) | Lacune confirmée | Corrigé : dump natif dans le conteneur, compression/décompression sur l'hôte |
| Dokploy #5555 (permissions projet → services) | Lacune confirmée | Corrigé : héritage projet → services et environnements |
| Dokploy #5550 (quotas CPU/mémoire par projet) | Quatre quotas projet nullables, refus explicite au dépassement, audit `quotaExceeded`, endpoint `project.quota` et UI | Implémenté (limite logique, documentée dans `project-resource-quotas.md`) |
| Dokploy #5509 (port cible écrasé) | Lacune confirmée sur les doublons de port publié | Corrigé : validation API + normalisation runtime |
| Dokploy #5174 (attachement réseau d'une base) | Non applicable : l'attachement réseau n'existe que pour les applications | À documenter si la fonctionnalité est étendue |
| Dokploy #4987 (déplacement entre projets) | Déplacement logique durci : refus cross-org, accès au projet cible, quota cible, aperçu et UI de confirmation | Implémenté ; rollback applicatif à cadrer (§B) |
| Dokploy #3679 (adoption de stacks Swarm) | Import des réseaux Docker uniquement | Cadré dans une issue fille (§C) |
| Dokploy #2260 (migration de service entre serveurs) | Transfert existant ; nettoyage source désormais différé après déploiement cible, rollback ownership/runtime en cas d'échec | Durci (§D) ; plan/health check et tests d'intégration restants |
| Dokploy #4008 (`apply -f`) | Non implémenté | Cadré dans une issue fille (§E) |
| Dokploy #2028 (preview pour Compose) | Non supporté : les previews ciblent les applications | Cadré dans une issue fille (§F) |
| Dokploy/templates #506, Notploy #108/#74 | Sujets catalogue/registry distincts | Aucun changement ici, pour éviter les doublons |

## 2. Secrets et notifications (P0)

### Défaut reproduit

- `ExecError` conservait la commande complète, `stdout`, `stderr` et l'erreur
  d'origine. Les erreurs `exec` de Node embarquent la ligne de commande, donc
  les clés `--s3-access-key-id` / `--s3-secret-access-key` pouvaient sortir par
  `error.message`, puis être envoyées par les notifications de backup.
- Les notifications de build, de backup de base de données, de volume et de
  backup Notploy rendaient le message d'erreur brut.
- Les logs de déploiement étaient renvoyés tels quels par l'API et le WebSocket
  `listen-deployment`.
- Le logger Pino n'avait aucun formateur de masquage.

### Correction

- Nouveau module central `packages/server/src/utils/security/redact.ts` :
  - clés sensibles (mots de passe, secrets, tokens, clés d'accès, clés privées,
    credentials, autorisation) dans les formes `--flag=valeur`, `--flag valeur`,
    `KEY=valeur`, JSON et YAML ;
  - credentials d'URL (`scheme://user:pass@host`), en-têtes d'autorisation,
    blocs de clé privée PEM, JWT et tokens fournisseurs reconnaissables ;
  - `redactSecretValues()` pour masquer des valeurs connues collectées à
    l'exécution ;
  - `redactObject()` pour les contextes structurés, sans muter l'objet source ;
  - `createRedactingLineBuffer()` pour les flux de logs, y compris un secret
    coupé entre deux chunks.
- `ExecError` redacte le message, la commande, `stdout`, `stderr` et l'erreur
  d'origine dès sa construction.
- `redactBackupError()` masque en plus littéralement `accessKey`/
  `secretAccessKey` de la destination, même si le fournisseur n'écho que la
  valeur sans son nom de clé.
- Le logger Pino redacte à la fois le contexte structuré et le message.
- Les notifications build, database, volume et notploy redactent leur
  `errorMessage`, y compris pour les canaux personnalisés.
- `readDeploymentLogs()` et les WebSockets de logs renvoient une vue masquée.
  Le fichier de log sur disque reste intact pour l'opérateur.
- Les erreurs non `ExecError` écrites dans les logs de build sont redactées
  avant écriture.

### Preuves

`apps/notploy/__test__/security/redact.test.ts` (12 tests) utilise des secrets
sentinelles (clé S3, secret, mot de passe, token GitHub, JWT, clé privée) et
vérifie qu'aucun n'apparaît dans le texte, les objets, `ExecError`, les erreurs
de backup ou les messages d'erreur, tout en conservant les informations de
diagnostic non sensibles.

## 3. Cycle de vie des streams et du monitoring (P0)

### Défauts reproduits

- `docker-container-logs.ts` créait un `setInterval` de ping avant plusieurs
  retours anticipés (organisation différente, absence de clé SSH, mode cloud)
  qui ne le nettoyaient pas. Le stream SSH n'était pas fermé à la fermeture du
  WebSocket, seul le client l'était.
- `docker-stats.ts` pouvait encore écrire les fichiers de monitoring après la
  fermeture du socket si un tick était en cours, et autorisait le chevauchement
  de deux ticks sur un hôte lent.
- `listen-deployment.ts` ne libérait ni le timer de `SIGKILL` ni le channel SSH
  de façon centralisée.
- `terminal.ts` laissait la connexion SSH ouverte si le navigateur se fermait
  avant l'ouverture du shell ; une erreur dans le callback `conn.shell` faisait
  un `throw` non capturé.

### Correction

- Helper `apps/notploy/server/wss/cleanup.ts` : cleanup idempotent, exécute tous
  les disposers même si l'un échoue.
- Logs conteneur : timer de ping, channel SSH, client SSH et PTY passent par ce
  cleanup sur `close`, `error`, fin de stream et toutes les sorties anticipées.
- Stats : `closed` + `inFlight`, arrêt du timer, envoi uniquement si le socket
  est `OPEN`, et `recordAdvancedStats` reçoit un signal d'abandon qui interrompt
  l'écriture des fichiers restants dès que le socket est fermé.
- Logs de déploiement : cleanup idempotent, flush du buffer de logs, fermeture
  du process `tail` avec escalade `SIGTERM` → `SIGKILL`.
- Terminal : fermeture de la connexion SSH même sans shell ouvert, plus de
  `throw` dans un callback asynchrone.

### Preuves

`apps/notploy/__test__/wss/cleanup.test.ts` vérifie l'exécution unique et la
continuité du cleanup malgré un disposer en erreur. Les chemins de fermeture
sont revus dans les quatre serveurs WSS concernés.

## 4. Sauvegardes indépendantes des images (P1)

### Défaut reproduit

Les commandes de dump exécutaient `bash -c '... | gzip'` **dans le conteneur**
pour PostgreSQL, MySQL, MariaDB, MongoDB et libSQL. Une image minimale sans
shell ou sans gzip rendait la sauvegarde impossible.

### Correction

- Les commandes n'utilisent plus `bash`/`sh -c` ni `gzip` dans le conteneur :
  seuls les binaires natifs (`pg_dump`, `mysqldump`, `mariadb-dump`,
  `mongodump`, `tar`) sont invoqués, avec des arguments passés via `shell-quote`.
- La compression est faite sur l'hôte (`| gzip`) pour les formats non compressés.
  MongoDB conserve `--gzip` et n'est pas recompressé.
- Les mots de passe MySQL/MariaDB passent par `MYSQL_PWD` dans l'environnement
  du conteneur au lieu d'être visibles dans l'argv du client.
- Les restaurations ont été alignées : `pg_restore`, `mariadb`, `mysql`,
  `mongorestore` et `tar xf` sont appelés directement. libSQL est décompressé
  sur l'hôte (`gunzip`) avant `tar xf`.
- Les erreurs de dump/upload restent nettoyées côté notification, et
  `rclone deletefile` supprime l'objet distant partiel en cas d'échec.

### Limites documentées

- L'hôte (local ou serveur de déploiement) doit fournir `gzip`/`gunzip` et
  `tar` pour les formats concernés. C'est une dépendance de l'hôte, plus de
  l'image applicative.
- Les sauvegardes existantes (`.sql.gz`, `.bson.gz`) restent restaurables : les
  formats de fichier et les commandes de restauration sont inchangés.
- La validation réelle sur chaque image hardened n'est pas automatisable dans
  cet environnement (pas de moteurs Docker disponibles). Les tests couvrent la
  forme des commandes, l'absence de shell interne et la non-régression
  d'injection.

### Preuves

- `__test__/backups/db-backup-restore-injection.test.ts` (12 tests) : payloads
  d'injection sur backup et restauration, plus vérification qu'aucune commande
  ne contient `bash -c`/`sh -c` ni `| gzip`.
- `__test__/backups/backup-command.test.ts` (3 tests) : compression sur l'hôte,
  pas de double compression Mongo, `pipefail` et suppression de l'objet distant
  en échec.

## 5. Ports, permissions et quotas (P1/P2)

### Ports — corrigé

- `findPortConflict()` refuse : port hors `1..65535`, doublon
  `publishedPort`/`protocol`, mapping identique.
- La création et la mise à jour d'un port chargent les mappings existants de
  l'application et rejettent le conflit avec un message explicite.
- `normalizePortMappings()` protège aussi le builder runtime : une ligne
  invalide ou dupliquée ne peut plus écraser silencieusement une autre.
- Tests : `__test__/network/ports.test.ts` (15 tests).

### Permissions — corrigé

Auparavant, un membre non owner/admin accédait à un service uniquement via
`member.accessedServices`. `addNewService()` n'ajoutait le service qu'au membre
créateur : une permission de projet ne s'appliquait donc ni aux services
existants ni aux services futurs créés par un autre membre.

La résolution d'accès est maintenant hiérarchique :

1. owner/admin : accès complet ;
2. accès explicite au service (`accessedServices`) : accès conservé ;
3. sinon, le projet propriétaire du service est résolu par une requête
   `UNION` unique (applications, Compose, PostgreSQL, MySQL, MariaDB, MongoDB,
   libSQL, Redis) ; si `accessedProjects` contient ce projet, l'accès est
   accordé.

Les environnements suivent la même règle : `accessedEnvironments` reste une
grant explicite, avec repli sur le projet de l'environnement. La création de
service reste contrôlée par l'accès au projet (`checkServiceAccess(...,
"create")` reçoit explicitement un `projectId`).

Conséquences :

- une permission projet s'applique aux services existants et futurs ;
- révoquer l'accès projet retire l'accès hérité immédiatement ;
- une grant explicite de service reste additive et survit à la révocation du
  projet ; c'est l'exception auditable actuelle ;
- les routes API et les WebSockets partagent la même fonction de résolution.

Tests : `__test__/permissions/service-access.test.ts` (17 tests) couvre
service explicite, héritage projet, mauvais projet, révocation, création,
environnement et absence d'appel de résolution lorsque l'accès est déjà
explicite. Le rôle
`member` doit toujours disposer de `canCreateServices` pour créer un service.

### Quotas — implémentés comme limites logiques

Le projet porte désormais `cpuLimit`, `cpuReservation`, `memoryLimit` et
`memoryReservation` (migration `0214_project_resource_quotas.sql`). Le calcul
agrège les limites déclarées des applications et de toutes les bases
(app, Compose sans colonnes de limite, PostgreSQL, MySQL, MariaDB, MongoDB,
libSQL, Redis). Une mise à jour qui dépasserait un quota, une baisse de quota
sous l'usage existant et une réservation supérieure à sa limite sont refusées
par `ProjectQuotaExceededError` (`PRECONDITION_FAILED`) avant toute écriture,
avec un audit `quotaExceeded`. L'API et l'UI qualifient explicitement ces
quotas de **limites logiques** : Docker/Swarm continuent d'appliquer les
limites par service, les services sans limite déclarée comptent pour zéro et
les stacks Compose ne sont pas comptées. Détails opérateur :
`project-resource-quotas.md`.

## 6. Migration, adoption, déclaratif et previews

Les propositions d'issues filles prêtes à être créées sont détaillées dans
`apps/notploy/docs/issue-112-child-issues.md`.

- **Migration Dokploy → Notploy** : `install.sh` fournit déjà une évaluation
  en lecture seule (`--dry-run`/`--json`), n'annonce une ressource migrable que
  si elle est attribuée, et conserve la compatibilité de déchiffrement des
  valeurs Dokploy. Aucune migration destructive n'a été ajoutée ici.
- **Transfert serveur → serveur** : `packages/server/src/services/transfer.ts`
  copie volumes, répertoires, configuration Traefik, puis bascule le service.
  La suppression de la source (et de ses volumes avec `removeSourceData`) est
  maintenant différée **après** le succès du déploiement sur la cible. Si ce
  déploiement échoue, l'ownership, les réseaux et le runtime sont ramenés sur
  la source, qui n'a pas été nettoyée. Restent à cadrer : plan de migration
  affiché avant exécution, health check explicite avant suppression, et tests
  d'intégration avec deux serveurs réels.
- **Déplacement entre projets** : les mutations `move` existantes ne
  changeaient que `environmentId`, sans vérifier l'organisation ni l'accès au
  projet cible. Elles passent désormais par `assertServiceMoveAllowed` :
  résolution du service et de l'environnement cible, refus cross-org,
  vérification de `service:create` sur le projet cible et contrôle du quota
  cible. `service.movePreview` expose source, cible, ressources conservées
  (`appName`, volumes, domaines, réseaux), recalcul des permissions et état du
  quota, sans écriture ni redéploiement. La boîte de dialogue « Move service »
  des pages application, Compose et bases de données utilise cet aperçu, bloque
  la confirmation si le quota cible est dépassé et affiche les ressources
  conservées. Compose participe aux contrôles cross-org et d'accès, mais pas au
  quota (aucune colonne de limite). Le rollback applicatif reste à cadrer.
- **Adoption de ressources Docker/Swarm existantes** : seul l'import des réseaux
  Docker est disponible (`importDockerNetworks`). Aucun import de stack/service
  n'est proposé. Une phase de découverte en lecture seule et un rapport de
  compatibilité sont requis avant toute adoption.
- **`notploy apply -f`** : aucune interface déclarative n'existe. Décision
  proposée : plan/diff séparé de l'application, idempotence, sortie structurée,
  secrets jamais sérialisés dans le plan ou les logs.
- **Preview Deployments Compose** : non supporté ; le modèle actuel lie une
  preview à une application. À planifier avec nommage stable, routage temporaire,
  quotas et nettoyage automatique.
- **Templates/Registry** : aucun nouveau catalogue ou registre n'a été créé.
  Le travail reste coordonné avec #108 et #74.

## 7. Vérification exécutée

Commandes lancées dans `apps/notploy` :

```bash
pnpm exec vitest run --config __test__/vitest.config.ts \
  __test__/security/redact.test.ts \
  __test__/network/ports.test.ts \
  __test__/backups/db-backup-restore-injection.test.ts \
  __test__/backups/redact-credentials.test.ts \
  __test__/backups/backup-command.test.ts \
  __test__/wss/cleanup.test.ts \
  __test__/permissions/service-access.test.ts \
  __test__/permissions/check-permission.test.ts \
  __test__/permissions/resolve-permissions.test.ts
# 10 fichiers, 124 tests, tous verts
```

Quotas et déplacement logique :

```bash
pnpm exec vitest run --config __test__/vitest.config.ts \
  __test__/quotas __test__/permissions __test__/drop __test__/traefik
# 14 fichiers, 158 tests, tous verts
```

`pnpm typecheck` dans `packages/server` : **0 erreur**. Dans `apps/notploy` :
68 erreurs préexistantes, aucune dans les fichiers de quotas.

Suite complète (`pnpm exec vitest run --config __test__/vitest.config.ts`) :
**1554 tests verts**, 7 échecs sur la dernière exécution. Six sont les échecs
connus non liés (4 builds Docker réels dans `deploy/application.real.test.ts`,
un mock `db.select` dans `env/aws-parameter-store.test.ts`, une attente ACME
dans `compose/domain/labels.test.ts`). Le septième varie selon la charge :
timeout de 5 s dans `utils/remote-stream.test.ts` ou
`server/update-check.test.ts`, chacun passant seul (4/4 et 39/39).

`pnpm typecheck` reste en échec sur **68 erreurs préexistantes** hors périmètre
(par exemple `components/dashboard/settings/servers/handle-servers.tsx`,
`server/api/routers/cicd.ts`, `server/api/routers/git-provider.ts`). Aucune
erreur ne concerne les fichiers modifiés par cet audit.

## 8. Fichiers principaux modifiés

- `packages/server/src/utils/security/redact.ts` (nouveau)
- `packages/server/src/lib/logger.ts`
- `packages/server/src/utils/process/ExecError.ts`
- `packages/server/src/utils/notifications/{build-error,database-backup,volume-backup,notploy-backup}.ts`
- `packages/server/src/services/{application,compose,deployment,permission}.ts`
- `packages/server/src/services/{project-quota.ts,project,libsql,mariadb,mongo,mysql,postgres,redis}.ts`
- `packages/server/src/db/schema/{project,audit-log}.ts`
- `packages/server/src/lib/access-control.ts`
- `apps/notploy/server/api/utils/quota.ts` (nouveau)
- `apps/notploy/server/api/routers/{project,application,libsql,mariadb,mongo,mysql,postgres,redis}.ts`
- `apps/notploy/components/dashboard/projects/handle-project.tsx`
- `apps/notploy/drizzle/0214_project_resource_quotas.sql` (nouveau)
- `apps/notploy/docs/project-resource-quotas.md` (nouveau)
- `apps/notploy/__test__/quotas/*.test.ts` (nouveaux)
- `packages/server/src/monitoring/utils.ts`
- `packages/server/src/utils/backups/{utils,redact,postgres,mysql,mariadb,mongo,libsql,compose}.ts`
- `packages/server/src/utils/restore/{utils,libsql}.ts`
- `packages/server/src/utils/network/{ports.ts,index.ts}` (nouveau)
- `packages/server/src/db/schema/port.ts`
- `packages/server/src/services/port.ts`
- `apps/notploy/server/api/routers/port.ts`
- `apps/notploy/__test__/permissions/service-access.test.ts`
- `apps/notploy/docs/issue-112-child-issues.md` (propositions d'issues filles)
- `apps/notploy/server/wss/{cleanup.ts,docker-container-logs.ts,docker-stats.ts,listen-deployment.ts,terminal.ts}`
- `packages/server/src/utils/builders/index.ts`
- Tests listés au §7.
