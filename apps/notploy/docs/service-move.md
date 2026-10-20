# Déplacement logique d'un service

Un déplacement logique change uniquement l'environnement (donc le projet) qui
possède un service. Il ne déplace ni volume, ni réseau, ni domaine, et ne
redémarre pas le conteneur. Il ne doit pas être confondu avec le transfert
physique serveur → serveur (`packages/server/src/services/transfer.ts`).

## Frontières vérifiées

Avant toute écriture, `assertServiceMoveAllowed` :

1. résout le service (application, libSQL, MariaDB, MongoDB, MySQL, PostgreSQL,
   Redis) et l'environnement cible ;
2. refuse le service ou la cible hors de l'organisation active avec `NOT_FOUND`
   (aucune indication sur l'existence d'une ressource d'une autre organisation) ;
3. exige `service:create` et l'accès au **projet cible** (`checkServiceAccess`).
   Un membre qui n'a pas accès au projet cible ne peut pas y déplacer un
   service, même s'il administre le service source ;
4. contrôle le quota du projet cible, en tenant compte des limites déclarées du
   service déplacé. Un déplacement dans le même projet ne consomme pas de quota
   supplémentaire et n'est pas rejeté.

Le refus de quota est un `PRECONDITION_FAILED` journalisé avec l'action
`quotaExceeded`, comme les autres contrôles de quota.

## Aperçu

La boîte de dialogue « Move service » des pages de service (application,
Compose et bases de données) appelle
`api.service.movePreview({ serviceType, serviceId, targetEnvironmentId })` et
retourne, sans écrire :

- `source` et `target` : projet et environnement (identifiants et noms) ;
- `sameProject` ;
- `preserved` : identité, `appName`, volumes, domaines et réseaux conservés ;
- `permissions.recalculatedFromTargetProject` : l'accès est recalculé depuis le
  projet cible après le déplacement ;
- `requiresRedeploy: false` ;
- `quota.withinQuota` et le détail des dépassements éventuels.

Les refus cross-org et d'accès au projet cible sont levés par l'aperçu lui-même.
Un dépassement de quota est **rapporté** dans l'aperçu (`withinQuota: false`)
pour permettre à l'UI de l'expliquer avant confirmation ; la mutation `move`
refuse ensuite l'écriture.

## Comportement après le déplacement

- Les permissions du projet source ne s'appliquent plus : l'accès est résolu
  depuis le projet cible (une grant explicite `accessedServices` reste
  additive).
- Les domaines, volumes et réseaux restent attachés au service et continuent de
  fonctionner, mais leur exposition dépend du routage du projet cible.
- Aucune interruption runtime n'est promise si un redéploiement est déclenché
  manuellement après le déplacement.

## Limites

- Le déplacement ne migre pas un service vers un autre serveur : utiliser le
  transfert physique.
- Le rollback applicatif (revenir à l'environnement source après un échec
  ultérieur) reste à cadrer.
- Les mutations `move` restent appelables directement ; l'aperçu est une aide à
  la décision, pas un jeton de confirmation obligatoire côté serveur.
