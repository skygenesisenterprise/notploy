# Notploy MCP Apps (ChatGPT UI) — technical spec (not implemented)

> Statut : **spécification seule, aucune ressource UI runtime**.
> Le serveur `@notploy/mcp` fonctionne sans UI ; les résultats restent
> utiles en conversationnel pur. N’implémenter une UI que si elle apporte
> une valeur réelle avec les dépendances existantes (Hono static + MCP
> resources), sans dupliquer la logique métier et sans affaiblir l’auth.

## Objectif

Fournir une couche facultative d’interface ChatGPT (OpenAI Apps SDK / MCP
Apps : outils associés à des ressources UI, iframe + bridge) pour :

- tableau synthétique des applications (santé, dernier déploiement) ;
- états de déploiement + journaux bornés ;
- opérations récentes (`get_operation_status`) ;
- sélecteurs projet/environnement ;
- formulaires de configuration (préflight uniquement, jamais d’écriture
  directe) ;
- confirmations contextualisées (risque 2 / destructif).

## Non-objectifs

- Aucune écriture depuis l’iframe sans appel outil serveur validé.
- Aucune dépendance obligatoire : UI désactivée par défaut, serveur
  identique avec/sans UI.
- Aucune promesse d’acceptation store ; pas de faux assets.

## Architecture proposée

- `src/apps/` : gabarits HTML statiques servis par Hono (`/apps/*`,
  `Content-Security-Policy` stricte, pas de secrets injectés).
- Ressources MCP `notploy://apps/<view>` (`mimeType: text/html`) exposées
  uniquement si `NOTPLOY_MCP_UI_ENABLED=true`.
- Outils annotés `_meta["ui/resourceUri"]` : `inspect_application_health`
  → dashboard, `get_deployment_status`/`diagnose_deployment` → deployment,
  `get_operation_status` → operations, `prepare_deployment` → deploy-form.
- L’iframe ne parle qu’au host (postMessage bridge) ; toute action appelle
  l’outil MCP correspondant, re-validée par l’executor (permissions,
  risque, approbation, idempotence). L’UI n’est jamais une preuve
  d’autorisation.
- Auth cohérente : même identité/organisation/scopes que les outils ;
  aucun token dans l’URL, aucun secret dans le HTML.

## Mapping outils → vues (proposé)

| Vue | Outils sources | Contenu | Écriture |
| --- | --- | --- | --- |
| `dashboard` | `get_connection_status`, `list_projects`, `inspect_application_health` | instance, projets, verdicts, findings | non |
| `deployment` | `get_deployment_status`, `get_deployment_history`, `get_application_logs`, `diagnose_deployment` | statut, signaux, extrait borné | non |
| `operations` | `get_operation_status` | `pending/running/succeeded/failed`, vérification | non |
| `deploy-form` | `prepare_deployment`, `execute_deployment` | plan, blockers/warnings, `approvalToken` + `idempotencyKey` | via outils uniquement |

## Fallback conversationnel

Chaque vue a un équivalent texte structuré (déjà implémenté via
`structuredContent` + `content[]`). Si l’UI est absente ou rejetée par le
client, le workflow reste complet.

## Sécurité

- CSP `default-src 'none'; frame-ancestors` restreint au host ChatGPT ;
  pas de scripts inline avec secrets, pas de `eval`.
- Contenus Notploy (logs, metadata repo) rendus comme texte, jamais
  interprétés ; protection contre prompt-injection conservée.
- Redaction identique côté UI et API ; audit inchangé (décisions serveur).

## Étapes d’implémentation (si décidé)

1. `NOTPLOY_MCP_UI_ENABLED` + `GET /apps/<view>` statique + tests
   no-secret-leak.
2. `registerResource` conditionnel + `_meta ui/resourceUri` + tests
   Inspector.
3. Valider sur connecteur dev ChatGPT, puis consigner les écarts.
4. Docs `CHATGPT.md` mises à jour avec captures réelles uniquement.

## Références à vérifier avant de coder

- Docs officielles OpenAI Apps SDK / MCP Apps (resources, output
  templates, bridge `window.openai`) — vérifier la version exacte du SDK
  et du schéma `server.json`/widgets avant d’ajouter des dépendances.
- Compatibilité `Streamable HTTP` + OAuth du parcours ChatGPT retenu.
