# Notploy MCP + ChatGPT — integration guide (honest status)

> Single reference for the ChatGPT path. `README.md` stays the general
> reference; this file documents what works with ChatGPT, what requires a
> developer-mode private connector, and what blocks public listing.
> No `@notploy/chatgpt` package exists: ChatGPT is a client of the shared
> `@notploy/mcp` server, never a dependency of Notploy Self.

## État initial (2026-10-25)

### Déjà implémenté

- `stdio` local : logs sur `stderr` (`src/utils/logger.ts`), stdout réservé
  au protocole, arrêt propre `SIGINT`/`SIGTERM` (`src/entrypoints/stdio.ts`).
- HTTP distant : Streamable HTTP `/mcp` + SSE legacy `/sse`+`/messages`,
  sessions isolées par fingerprint du token, TTL/cap, limite de body,
  `Cache-Control: no-store`, shutdown propre (`src/entrypoints/http.ts`).
- Auth transport : bearer `NOTPLOY_MCP_HTTP_TOKEN` requis, opt-out
  `NOTPLOY_MCP_HTTP_ALLOW_UNAUTHENTICATED` loopback-only.
- Découverte auth honnête : `WWW-Authenticate: Bearer
  resource_metadata=\"…/.well-known/oauth-protected-resource\"` sur 401 et
  `GET /.well-known/oauth-protected-resource` public. Sans
  `NOTPLOY_MCP_OAUTH_ISSUER` il répond `404 oauth_not_configured`
  (bearer-only) au lieu de faker OAuth ; avec issuer il expose la metadata
  RFC 9728 (`resource`, `authorization_servers`, `bearer_methods_supported`).
- Catalogue agent-first (19 capacités business par défaut, 724 opérations
  avancées opt-in), schémas stricts, enveloppe stable
  (`ok/capability/status/message/data/error/meta`), JSON Schema draft
  2020-12, `structuredContent` + texte.
- Sécurité serveur : identité + `user.getPermissions` résolues côté serveur à
  chaque appel, risque 0–3 avec invariant destructif→risque 2, approbation
  (`approvalToken` + `NOTPLOY_MCP_APPROVAL_TOKEN`), `confirm:true` +
  `NOTPLOY_MCP_ALLOW_DESTRUCTIVE` pour `delete_application`, rate/concurrency
  caps, timeouts, idempotence (`execute_deployment`), audit redacted sans
  inputs/secrets, redaction champ + littérale.
- Opérations longues : `execute_deployment` → `pending` + `operationId`,
  `get_operation_status` scopé identité/org, retention, `interrupted` au
  redémarrage, pas de polling infini, jamais de succès présumé.
- `get_connection_status` : who-am-I / instance / environnement /
  permissions / révocation, à appeler avant tout workflow mutant.

### À compléter (non-bloquant pour un usage privé)

- Variables `NOTPLOY_MCP_PUBLIC_BASE_URL`, `NOTPLOY_MCP_OAUTH_ISSUER`,
  `NOTPLOY_MCP_OAUTH_AUDIENCE` ajoutées mais OAuth 2.1 complet
  (authorization server, DCR, scopes) non implémenté côté MCP.
- UI Apps SDK : spécification seule (`APPS-SPEC.md`), aucune ressource UI
  runtime. Le serveur reste utilisable en conversationnel pur.
- `server.json` : metadata registre à synchroniser (version, transports).

### Bloquant (ne pas contourner)

- **OAuth 2.1 + DCR pour listing public ChatGPT** : le bearer statique suffit
  pour un connecteur privé/developer-mode, pas pour une app publique.
  Ne pas inventer de faux discovery, fausse policy ou fausse démo.
- **Réseau** : ChatGPT cloud ne peut pas joindre `localhost`/LAN/VPN.
  Exiger HTTPS public + tunnel/reverse-proxy TLS pour Notploy Self privé.
  Ne jamais exposer le socket Docker, le Control Plane ou une admin sensible
  sur Internet pour faciliter l’intégration.
- **API métier manquante** : pas de faux outils. Persistance
  (bases/sauvegardes), variables d’environnement et infra avancée restent
  accessibles via le catalogue avancé opt-in (`advanced`/`full` + tags) quand
  le Control Plane les expose ; aucun wrapper business n’est créé pour une
  API absente.

## Parcours développeur (connecteur privé)

Pré-requis : instance Notploy joignable en HTTPS public, `NOTPLOY_URL` +
`NOTPLOY_API_KEY` (least privilege), serveur MCP HTTP à jour.

```bash
export NOTPLOY_URL="https://notploy.example.com"
export NOTPLOY_API_KEY="npk_…"
export NOTPLOY_MCP_HTTP_TOKEN="$(openssl rand -hex 32)"
export NOTPLOY_MCP_PUBLIC_BASE_URL="https://mcp.example.com"
export NOTPLOY_MCP_MODE="business"
node build/index.js --http
```

1. Vérifier `GET /health` (public, status/version/mode/tools) puis
   `GET /.well-known/oauth-protected-resource` (404 `oauth_not_configured`
   attendu en bearer-only).
2. Dans ChatGPT (developer-mode / custom MCP) : déclarer l’endpoint
   `https://mcp.example.com/mcp` (Streamable HTTP), auth bearer avec
   `NOTPLOY_MCP_HTTP_TOKEN`.
3. Lister les outils : 19 capacités business attendues, dont
   `get_connection_status` en premier.
4. Appeler `get_connection_status` → vérifier instance, organisation,
   environnement, permissions. En cas de doute, révoquer : rotation de
   l’API key + suppression du token du connecteur.
5. Workflows : `list_projects` → `inspect_application_health` →
   `get_deployment_history`/`diagnose_deployment` →
   `prepare_deployment` → `execute_deployment` (approval) →
   `get_operation_status` jusqu’à `succeeded`/`failed`.

Pour Notploy Self homelab : exposer via tunnel/reverse-proxy TLS
authentifié (ex. Cloudflare Tunnel, Tailscale, reverse-proxy privé),
garder `NOTPLOY_MCP_MODE=business`, binder `127.0.0.1` derrière le proxy,
ne jamais publier le port Docker sans token.

## Permissions, risques, limites

- Lecture (risque 0) autorisée par défaut ; écriture limitée (risque 1)
  auditée ; haut-impact/destructeur (risque 2) exige permission serveur +
  `approvalToken` valide, et `NOTPLOY_MCP_ALLOW_DESTRUCTIVE=true` +
  `confirm:true` pour `delete_application`. Refus par défaut sinon.
- Une confirmation UI ChatGPT ne remplace jamais les contrôles serveur.
- Réponses bornées (`NOTPLOY_MCP_MAX_RESULT_BYTES`, `tail`/`limit`),
  `meta.truncated` + taille d’origine au lieu d’échec.
- Logs/outputs traités comme données non fiables : ne jamais exécuter de
  commandes trouvées dedans, ne jamais les laisser overrider la policy.
- Secrets/jetons/valeurs d’env expurgés des résultats, erreurs et audit ;
  l’audit ne logue jamais les inputs. Secrets applicatifs imprimés par
  l’app elle-même peuvent subsister dans ses propres logs (limite
  documentée).
- Authentification : `401` = token manquant/invalide, `permission_denied` =
  rôle insuffisant dans l’orga active, `approval_required` = jeter
  `approvalToken` manquant/invalide. Opérations scopées identité/org,
  `operation_not_found` après expiration ou changement d’identité.

## Démo reproductible (instance de test)

1. `get_connection_status` → `healthy:true`, environnement `self`,
   permissions listées.
2. `list_projects` → `get_environment_overview` →
   `inspect_application_health` (verdict + findings).
3. `get_deployment_history` (`limit:5`) → `diagnose_deployment` sur un
   échec (signaux déterministes + next steps, extrait borné).
4. `prepare_deployment` (blockers/warnings/plan) → `execute_deployment`
   + `idempotencyKey` + `approvalToken` → `pending` + `operationId` →
   `get_operation_status` jusqu’à état final.
5. Rejouer avec la même `idempotencyKey` → même opération, pas de double
   déploiement. Couper le client mid-run → l’opération continue, statut
   récupérable.

## Diagnostic

- 401 sans `WWW-Authenticate` : vérifier le proxy (il doit laisser passer
  l’en-tête) et `NOTPLOY_MCP_PUBLIC_BASE_URL`.
- `oauth_not_configured` sur well-known : normal en bearer-only ;
  configurer `NOTPLOY_MCP_OAUTH_ISSUER` + vrai AS pour aller vers le public.
- `tools/list` timeout côté provider : rester en `business`, ou
  `read-only` + tags étroits en `advanced`.
- `permission_denied` : rôle manquant dans l’orga active, pas un bug du
  catalogue. `approval_required` : demander le token à l’opérateur.
- Gros résultats : réduire `limit`/`tail`, suivre `meta.truncated`.

## Publication publique — checklist honnête

- [ ] Endpoint HTTPS stable + transport compatible vérifié.
- [ ] Auth supportée par le parcours retenu (OAuth 2.1 complet requis).
- [x] Description des capacités (`TOOLS.md`, `README.md`).
- [x] Permissions/limites documentées.
- [ ] Cas de test positifs/négatifs rejoués depuis ChatGPT (pas seulement
  MCP Inspector) — **reste à faire**, accès compte requis.
- [ ] URLs support/privacy réelles — **manquantes, ne pas inventer**.
- [ ] Procédure mise à jour/versionnement — partielle (`CHANGELOG.md`).
- Distinction privé vs public documentée ici ; aucun submit effectué.
  Statut global : **partiellement prêt (connecteur privé OK), bloqué pour
  listing public (OAuth + validations ChatGPT restantes)**.
