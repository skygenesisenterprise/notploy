# Notploy Cloud — domaines générés (issue #113)

Hôte public automatique `<application>.notploy.app` pour les applications
déployées sur Notploy Cloud. Le libre-service et la console ne sont pas
concernés : `getCloudDomainBase()` retourne `null` hors Cloud managé.

## Modèle

| Couche | Fichier | Rôle |
| --- | --- | --- |
| Ledger | `packages/server/src/db/schema/cloud-domain.ts` | Propriété, unicité, statut, port cible, tombstone |
| Allocation | `packages/server/src/services/cloud-domain.ts` | Slug, candidats, réservation atomique, provisioning, release |
| DNS | `packages/server/src/services/cloud-domain-dns.ts` | Wildcard Cloudflare `*.<zone>` |
| Routage | Ligne `domain` avec `cloudManaged = true` | Config Traefik par application |
| API | `apps/notploy/server/api/routers/cloud-domain.ts` | `byApplicationId`, `ensure`, `release` |
| UI | `apps/notploy/components/dashboard/application/domains/cloud-domain-card.tsx` | URL, copie, ouverture, statut, retry |
| Hook | `packages/server/src/services/application.ts` | `ensureCloudDomainAfterDeploy()` après succès |

Deux index garantissent l'atomicité sans verrou applicatif :

- `cloud_domain_hostname_unique` sur `hostname` : l'insertion utilise
  `ON CONFLICT DO NOTHING`, donc deux déploiements simultanés qui visent le même
  nom ne peuvent pas le réserver tous les deux ; le perdant essaie `-2`, `-3`, …
- `cloud_domain_application_live_unique` (partiel, `status <> 'released'`) :
  une seule réservation vivante par application.

Une réservation existante est toujours renvoyée telle quelle : le hostname ne
change ni au redéploiement, ni au rebuild, ni lors d'un transfert de serveur.

## Nommage

- normalisation NFKD, accents retirés, minuscules, caractères non alphanumériques
  remplacés par `-`, label limité à 48 caractères ;
- libellés réservés (`www`, `api`, `app`, `admin`, `console`, `dashboard`,
  `docs`, `mail`, `status`, `support`) suffixés en `-app` ;
- candidats déterministes : `label`, `label-2` … `label-20` ;
- échec explicite `CONFLICT` après 20 collisions.

## Cycle de vie

`pending` → `active` (routage Traefik écrit) ou `error` (message assaini, retry
possible). `release` supprime la ligne de routage et marque la réservation
`released` ; la ligne est conservée pour empêcher toute réattribution à un autre
tenant. La suppression de l'application met `applicationId` à `null` (FK
`set null`) au lieu de supprimer la réservation.

Les mutations génériques `domain.update` / `toggleEnable` / `delete` refusent une
ligne `cloudManaged` ; le hostname n'est donc pas modifiable depuis la liste des
domaines personnalisés. `findDomainsByApplicationId` exclut ces lignes.

## Cloudflare

`ensureCloudWildcardRecord()` :

- exige `CLOUDFLARE_API_TOKEN` et `NOTPLOY_CLOUD_INGRESS_TARGET` ; sinon
  `skipped` (le wildcard est supposé géré hors Notploy) ;
- résout la zone par le suffixe le plus long, ou utilise
  `NOTPLOY_CLOUD_DNS_ZONE_ID` ;
- crée/met à jour `*.<zone>` en A, AAAA ou CNAME selon la cible, `ttl=1`,
  `proxied` par défaut ;
- cache le succès 5 minutes (une seule paire d'appels API par fenêtre) ;
- masque le token dans les erreurs via `redactSecretValues`.

Le wildcard est la seule écriture DNS : Cloudflare ne devient jamais la source
de vérité de la propriété des applications.

## TLS

- `NOTPLOY_CLOUD_DNS_PROXIED=true` (défaut) : Cloudflare termine TLS à l'edge,
  le certificat wildcard couvre les hotes générés ;
- `false` : Traefik émet un certificat par hôte (`letsencrypt`) ;
- `NOTPLOY_CLOUD_CERT_RESOLVER` : résolveur Traefik d'un certificat wildcard
  pré-provisionné (`certificateType: custom`).

Aucun hôte inconnu n'atteint un service interne : sans règle `Host(...)`, Traefik
ne route pas la requête.

## API et permissions

- `cloudDomain.byApplicationId` : `domain:read` ;
- `cloudDomain.ensure` : `domain:create`, audit `create` ;
- `cloudDomain.release` : `domain:delete`, audit `delete` ;
- hors Cloud managé, `ensure`/`release` renvoient `PRECONDITION_FAILED`.

Le hook de déploiement n'échoue jamais le déploiement : une erreur de
provisioning est enregistrée en `error` sur le ledger et peut être relancée.

## Tests exécutés

`apps/notploy/__test__/cloud-domain/` (30 tests) :

- `cloud-domain.test.ts` (18) : slug et libellés réservés, candidats,
  normalisation de zone, activation/désactivation, réservation existante,
  collision puis suffixe, course entre deux déploiements de la même application,
  épuisement des candidats (`CONFLICT`), vue HTTPS, release et tombstone.
- `cloud-domain-dns.test.ts` (12) : configuration, sélection de zone, A/AAAA/CNAME,
  proxied, cache et `force`, zone introuvable, non-fuite du token.

Non testé dans cet environnement : appels Cloudflare réels, résolution DNS
publique, émission TLS, routage Traefik sur un vrai ingress, concurrence
PostgreSQL réelle (les index sont vérifiés par le schéma et la migration, pas par
une base).

## Limites

- Un seul wildcard et une seule cible d'ingress : le multi-région ou l'ingress
  par serveur nécessitent une décision d'architecture distincte.
- Preview deployments et domaines temporaires hors périmètre.
- Pas d'émission DNS-01 : le certificat wildcard est fourni par Cloudflare ou
  l'opérateur.
- Les tombstones `released` sont conservés sans purge ; une politique de
  rétention explicite serait nécessaire pour les nettoyer.
- Renommer une application ne renomme pas son hostname (stabilité volontaire) ;
  un changement passe par `release` puis une nouvelle allocation.
