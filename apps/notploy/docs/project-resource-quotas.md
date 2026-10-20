# Quotas CPU/mémoire par projet

Les quotas de projet sont des **limites logiques Notploy**. Ils plafonnent la
somme des limites que les services d'un projet **déclarent**. Ce ne sont pas
une couche d'isolation supplémentaire : Docker/Swarm continue d'appliquer la
limite de chaque service.

## Modèle

Quatre colonnes nullables sur `project` (migration
`0214_project_resource_quotas.sql`) :

| Colonne | Unité | Sens |
| --- | --- | --- |
| `cpuLimit` | nanocpus (1 CPU = 1e9) | plafond de la somme des `cpuLimit` des services |
| `cpuReservation` | nanocpus | plafond de la somme des `cpuReservation` |
| `memoryLimit` | octets | plafond de la somme des `memoryLimit` |
| `memoryReservation` | octets | plafond de la somme des `memoryReservation` |

`null` (ou champ absent) signifie « aucun quota ». Chaque compteur est
indépendant : une limite n'est pas comparée à une réservation.

Sont comptés : applications, Compose (aucune colonne de limite aujourd'hui,
contribution nulle), PostgreSQL, MySQL, MariaDB, MongoDB, libSQL et Redis.
Les services sans limite déclarée comptent pour `0` : le quota borne les
limites configurées, pas la consommation réelle.

## Refus explicite

Une écriture est refusée avec `PRECONDITION_FAILED` lorsque :

1. la mise à jour des limites d'un service ferait dépasser un quota du projet
   (les valeurs actuelles du service sont exclues du calcul puis remplacées par
   les nouvelles) ;
2. la baisse d'un quota de projet passerait sous l'usage déjà déclaré ;
3. une réservation de projet dépasse sa limite correspondante ;
4. un service est déplacé vers un autre projet dont le quota n'a pas la place
   pour ses limites déclarées (un déplacement dans le même projet reste
   autorisé).

Le message indique le compteur, le quota, l'usage déjà déclaré et le total
projeté. Aucune ressource existante n'est supprimée ou modifiée par un refus.
Le refus est journalisé dans `audit_log` avec l'action `quotaExceeded`, le
projet, le service concerné et le détail des dépassements. Les erreurs de
journalisation ne masquent pas le refus.

Seul un rôle autorisé à `project:update` (owner, admin, ou rôle personnalisé)
peut modifier les quotas. Un membre qui a accès au projet ne peut pas les
changer.

## Déploiement et ressources préexistantes

Les limites d'un service sont validées au moment où elles sont écrites. Un
déploiement ne modifie pas ces valeurs, il ne peut donc pas contourner le
quota. Un service hérité ou modifié hors API qui dépasse déjà le quota reste
en fonctionnement, mais toute augmentation de ses limites est refusée et la
baisse du quota sous cet usage est refusée.

## API et interface

- `project.update` accepte `cpuLimit`, `cpuReservation`, `memoryLimit`,
  `memoryReservation` (chaînes d'entiers positifs ou `null`).
- `project.quota` renvoie `{ quota, usage }` pour l'affichage.
- L'écran d'édition d'un projet expose les valeurs en cœurs et MiB, les
  convertit en nanocpus/octets, et affiche l'usage déclaré avec la mention
  « logical limits ».

## Limites connues

- Pas de garantie runtime agrégée : le quota ne remplace pas les limites
  Docker/Swarm par service ni un namespace Kubernetes.
- Les stacks Compose n'exposent pas de limites par service dans le modèle
  actuel ; elles ne sont donc pas comptées.
- Les services sans limite déclarée ne consomment pas de quota.
- La duplication de projet ne copie pas les limites de ressources : les
  services dupliqués démarrent sans limite (donc à zéro dans le quota) et
  doivent être configurés via une mise à jour, elle-même soumise au quota.
- L'application est un contrôle « vérifier puis écrire » sans verrou de
  projet : deux mises à jour simultanées peuvent dépasser brièvement le quota.
  La mise à jour suivante est refusée et aucun service n'est supprimé.
- Le dépassement est refusé à l'écriture ; aucun déploiement n'est tué
  rétroactivement.
