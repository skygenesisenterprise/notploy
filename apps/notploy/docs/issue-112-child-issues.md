# Issue #112 — propositions d'issues filles

Ce document prépare les issues dédiées demandées par #112. Il ne remplace pas
une décision d'architecture : chaque proposition devra être créée sur GitHub,
validée puis implémentée séparément. Aucune migration destructive n'est incluse
dans la PR de durcissement.

## A. Quotas CPU/mémoire au niveau projet/workspace

**Priorité :** P2 — contrôle d'accès et gouvernance.

**Statut :** implémenté comme **limite logique** (voir
`project-resource-quotas.md`). Restent hors périmètre : garantie runtime
agrégée, limites par service dans les stacks Compose, et sanction d'un service
hérité qui dépasse déjà le quota (il reste en fonctionnement, mais ne peut plus
augmenter ses limites).

**Contexte**

Aujourd'hui les limites `cpuLimit`, `memoryLimit`, `cpuReservation` et
`memoryReservation` sont définies **par service** et transmises à Docker. Il
n'existe aucun quota agrégé au niveau projet ou workspace.

**Décision à prendre**

1. Portée : projet, environnement ou workspace ?
2. Mécanisme : limite logique Notploy (refus de création/déploiement) ou
   garantie runtime réellement appliquée par Docker/Swarm ?
3. Comportement au dépassement : refus explicite de la nouvelle ressource,
   refus de déploiement, ou état « quota dépassé » visible. Jamais de
   suppression silencieuse de ressources existantes.
4. Que faire des services existants qui dépassent déjà le quota ?

**Critères d'acceptation**

- Un quota annoncé est soit appliqué par le runtime, soit clairement libellé
  comme limite logique indicative dans l'API et l'interface.
- Le calcul inclut les réservations et les limites de tous les types de
  services (applications, Compose, bases de données, workers).
- Les tests couvrent création, mise à jour, déploiement, dépassement et
  ressources préexistantes.
- Un audit log est émis lors d'un refus pour quota.
- La documentation opérateur décrit précisément la différence entre quota
  Notploy et isolation Docker/Swarm/Kubernetes.

**Hors périmètre**

- Facturation ou limitation commerciale.
- Application d'un quota par namespace Kubernetes sans décision produit.

## B. Déplacement logique d'un service entre projets/environnements

**Priorité :** P2.

**Statut :** implémenté (`service.movePreview` + `assertServiceMoveAllowed` +
dialogue « Move service ») : refus cross-org, accès `service:create` au projet
cible, contrôle du quota cible, aperçu sans écriture, ressources conservées
(identité, `appName`, volumes, domaines, réseaux) et aucun redéploiement. Seul
le rollback applicatif reste à cadrer.

**Contexte**

Le transfert physique serveur → serveur existe déjà
(`packages/server/src/services/transfer.ts`). Le déplacement **logique** entre
projets/environnements n'existe pas. Il ne doit pas être confondu avec une
migration de serveur.

**Critères d'acceptation**

- Le service conserve son identité, ses volumes, son `appName` et ses domaines,
  ou la migration de ces éléments est explicitement affichée dans un aperçu.
- Les permissions du projet cible s'appliquent après le déplacement ; les
  permissions du projet source ne fuient pas.
- Un aperçu des changements (projet, environnement, domaines, réseaux,
  permissions) est présenté avant confirmation.
- L'opération est refusée si le projet cible appartient à une autre
  organisation.
- Des tests couvrent le succès, le refus cross-org, la révocation d'accès et le
  rollback logique.
- Aucune interruption runtime n'est promise si le déplacement implique un
  redéploiement.

## C. Adoption/import de stacks et services Docker/Swarm existants

**Priorité :** P2.

**Contexte**

Seul l'import des réseaux Docker est disponible (`importDockerNetworks`). Les
services et stacks existants ne peuvent pas être adoptés sans les recréer.

**Critères d'acceptation**

- Phase de découverte en lecture seule : inventaire des stacks, services,
  conteneurs, volumes, réseaux, ports et labels.
- Rapport de compatibilité avec le modèle canonique Notploy, incluant les
  éléments non représentables.
- Aperçu des changements avant toute écriture ; aucune recréation destructive
  implicite.
- Confirmation explicite obligatoire pour toute opération qui touche au
  routage, aux volumes ou à la disponibilité.
- Idempotence : réimporter une ressource déjà adoptée ne crée pas de doublon.
- Tests d'intégration avec un Swarm de test et rollback documenté.

**Hors périmètre**

- Adoption automatique de secrets non exportables.
- Reprise d'un cluster Kubernetes.

## D. Durcissement de la migration serveur → serveur (#2260)

**Priorité :** P1 lorsqu'une migration est demandée.

**Statut :** durci partiellement. Le nettoyage de la source est différé après
le déploiement réussi sur la cible ; en cas d'échec du déploiement, ownership,
réseaux et runtime sont ramenés sur la source intacte. Restent : plan de
migration affiché avant exécution, health check avant nettoyage, transfert
explicite des secrets/vault, et test d'intégration deux serveurs.

**Contexte**

`transferService` transfère déjà volumes, répertoires, configuration Traefik et
redéploie le service. L'installateur fournit déjà une évaluation Dokploy →
Notploy en lecture seule et la compatibilité de déchiffrement des valeurs
existantes. Les points suivants restent à cadrer pour le transfert physique :

- confirmation explicite avant interruption ;
- stratégie de retour arrière si le redéploiement cible échoue ;
- transfert des secrets et des références de vault ;
- vérification de santé avant bascule du trafic ;
- nettoyage de la source uniquement après validation.

**Critères d'acceptation**

- Un plan de migration est affiché avant exécution.
- Chaque étape produit un statut et un log consultables.
- Un échec ne supprime jamais la source sans confirmation.
- Un test d'intégration couvre source, cible, volumes, health check et rollback.
- La documentation précise qu'une migration sans interruption dépend du
  runtime, du stockage et du réseau.

## E. Configuration déclarative `notploy apply -f`

**Priorité :** P2 — nécessite une décision d'architecture.

**Contexte**

Aucune interface déclarative versionnable n'existe. Le modèle canonique
Notploy doit rester la source de vérité, sans imposer Docker Compose comme
format métier universel.

**Critères d'acceptation**

- Format documenté, versionné et validable hors ligne.
- Commandes séparées : validation, plan/diff, application.
- `--dry-run` par défaut pour toute opération destructive.
- Idempotence et sortie structurée (JSON) pour les agents/CI.
- Les secrets ne sont jamais sérialisés dans les fichiers d'exemple, les diffs,
  les plans ou les logs.
- Les ressources non gérées ne sont jamais supprimées sans `--prune` explicite.
- Tests : création, mise à jour, suppression, collision, rollback, secrets.

**Hors périmètre**

- Un langage propriétaire complet.
- Le couplage prématuré de la CLI, de l'API et de l'interface web.

## F. Preview Deployments pour Docker Compose

**Priorité :** P2.

**Contexte**

Les previews sont liées au modèle `application` et ne couvrent pas Compose.

**Critères d'acceptation**

- Nommage stable et isolé par pull request/environnement.
- Routage temporaire et nettoyage automatique à la fermeture de la PR.
- Protection contre les collisions de noms, de domaines et de réseaux.
- Limites de ressources, permissions et règles de rétention définies.
- Aucun secret de production injecté par défaut dans une preview.
- Tests : création, mise à jour, collision, suppression, nettoyage et accès.

## G. Coordination Templates/Registry (#108, #74)

Aucun travail parallèle n'est lancé ici. Les évolutions de format, de
provenance, de validation et de compatibilité offline-first doivent être
décidées dans #108/#74, puis consommées par les Templates via des adaptateurs.
