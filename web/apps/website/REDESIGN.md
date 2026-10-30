# Refonte du site notploy.com — plan à valider

Document de cadrage. **Aucune implémentation n'a été faite** : ce plan doit être validé (et les
questions de la section 12 tranchées) avant d'attaquer l'issue.

---

## 1. Audit de l'existant

### 1.1 Stack et build

| Élément | État |
| --- | --- |
| Framework | Next.js 16.3 (App Router), React 19, TypeScript |
| Styles | Tailwind **v3** (`tailwind.config.ts`) + tokens oklch copiés du thème sombre de l'app (`styles/tailwind.css`) |
| Polices | Inter (corps) + Lexend (`font-display`), via `next/font/google` |
| Composants | shadcn-like maison (`components/ui/*`), Radix, Headless UI, Tabler + Lucide, framer-motion |
| Build serveur | `next build --webpack` (`pnpm web:build`) — routes API contact / OG / GitHub actives |
| Build statique | `scripts/build-static.mjs` → `NEXT_OUTPUT=export` (GitHub Pages / Cloudflare Pages), routes API écartées, blueprints copiés dans `public/` |
| Déploiement | image Docker `notploy-website` (`web/Dockerfile.website`, workflow `docker-publish.yml`) + export statique |
| Redirects | un seul : `/dokploy-vs-:slug` → `/notploy-vs-:slug` (config serveur uniquement — **pas d'effet en export statique**) |
| Qualité | `typecheck` = `tsc --noEmit` ; **pas de script `lint`** dans le package ; `next.config.js` contient `typescript.ignoreBuildErrors: true` |

Conséquence : le `typecheck` est le seul vrai garde-fou TypeScript, et toute nouvelle route doit
rester compatible avec l'export statique (pas de `redirects()`, pas de route handler).

### 1.2 Routes existantes (≈ 35 pages)

- **Cœur** : `/`, `/self`, `/cloud`, `/platform`, `/pricing`, `/enterprise`, `/comparison`, `/integrations`, `/community`, `/contact`, `/partners`, `/jobs`
- **Capacités** : 9 pages `/features/*` (application deployment, application management, databases, monitoring, security, RBAC, SSO, audit logs, white labeling)
- **Comparaisons** : `/notploy-vs-{coolify,portainer,caprover,dokku,render,vercel}`
- **Secteurs** : `/industries` + 8 pages (agencies, finance-banking, government, healthcare, higher-education, manufacturing, pharmaceuticals)
- **Landings** : `/deploy-ai`, `/sandbox-software`, `/self-hosted-paas`, `/lp/deployment-platform`
- **Catalogue** : `/templates`, `/templates/[id]`
- **Légal** : `/privacy`, `/terms`, `/terms-of-service`
- **Technique** : `/api/{contact,github-stars,github-contributors,og}`, `sitemap.ts`, `robots.ts`, `not-found.tsx`

### 1.3 Navigation actuelle

4 menus déroulants (**Editions**, **Capabilities**, **Solutions**, **Support**) + 2 liens directs
(Platform, Pricing) + GitHub stars + « Sign in » + « Get started ».
Le footer a 5 colonnes (Product, Capabilities, Developers, Resources, Company).

Problèmes : 23 destinations dans le header, « Editions » mélange Self / Cloud / **Enterprise** /
comparaison, « Solutions » contient des landings verticales (`Deploy AI`, `Sandbox software`,
`By industry`) et « Support » mélange docs, Discord, issues, contact et community.

### 1.4 Design system

Points solides, à conserver : tokens partagés avec l'app, grille à filets fins (`border-border/40`),
`Reveal` avec `prefers-reduced-motion`, focus visible global, primitives de page réutilisables
(`PageHero`, `SectionHeading`, `CellGrid`, `SplitFeatureList`, `ProcessRail`, `ChoicePanels`,
`PageFaq`, `ProductFrame`).

Points qui vont à l'encontre de la direction demandée (site « SaaS/AI » générique) :

- fond animé `AnimatedGridPattern` dans le hero et les `PageHero`
- soulignement manuscrit SVG sous le mot en couleur primaire
- `Marquee` de contributions sur la home
- cartes de stats en dégradé + `NumberTicker`
- 16 FAQ sur la home, 8 sections empilées
- `Testimonials` et `ComparisonStats` sur les pages de comparaison (preuve sociale non vérifiable)

### 1.5 Composants hérités non importés (vérifié par recherche d'imports)

`Hero.tsx`, `SecondaryFeatures.tsx`, `first-features.tsx`, `secondary-features.tsx`,
`features-second.tsx`, `pricing-legacy.tsx`, `self-vs-cloud.tsx`, `what-is-notploy.tsx`,
`who-is-it-for.tsx`, `ways-of-working.tsx`, `how-it-works.tsx`, `problem-section.tsx`,
`sponsors.tsx`, `NotployLogo*` s'il en reste.

À l'inverse, `Testimonials`, `stats`, `comparison-stats`, `EnterpriseLanding`,
`industries/IndustryPage`, `PartnerForm`, `ContactFormModal`, `NotployTraffic` sont bien utilisés.

### 1.6 Écarts entre le site actuel et l'issue

| # | Constat factuel | Attendu par l'issue |
| --- | --- | --- |
| 1 | Le hero parle « Deploy and operate **applications** on infrastructure you control » ; l'eyebrow est « Open source · Apache-2.0 / Self-hosted or managed » | Vision plateforme large (services, infra, contrôle) + origine européenne dès le premier écran |
| 2 | **Aucune mention de l'Europe** sur le site en dehors des pages légales (le mot n'apparaît nulle part dans les pages marketing) | Axe européen porté par la home et une page de confiance |
| 3 | Trois « éditions » présentées au même niveau (Self, Cloud, Enterprise) ; le composant `self-vs-cloud` dit « Notploy Enterprise operates it for you » pour Cloud | Self et Cloud = deux façons d'utiliser la plateforme ; Enterprise = offre commerciale, pas une troisième plateforme |
| 4 | Toutes les capacités sont présentées comme disponibles, sans statut ; `content.ts` inclut Vault, air-gapped, MCP, desktop, VS Code | Matrice Available / In development / Planned, aucune fonctionnalité de roadmap présentée comme livrée |
| 5 | Le CTA Cloud (`app.notploy.com/register`) est utilisé dans ~20 fichiers, y compris le header | CTA Cloud vers une inscription réellement fonctionnelle, sinon page produit / contact |
| 6 | Aucune page « cas d'usage » générique ; le parcours public passe par `/industries` (8 verticales) et 3 landings | 5 cas d'usage comme exemples d'une plateforme générale, secteur non structurant |
| 7 | Aucune page capacités consolidée, aucune page de confiance, aucun lien statut | `/capabilities`, `/trust`, liens docs/install/GitHub/statut |
| 8 | Le header ne contient ni Docs ni GitHub en clair (GitHub est une pastille d'étoiles) | Choix rapide entre Self, Cloud, docs, code source |
| 9 | Le site n'explique nulle part le passage mono-nœud → multi-nœuds → cluster, ni ce qui n'est **pas** garanti (pas de HA automatique) | Schéma d'architecture mono/multi + limites explicites |
| 10 | Affirmations à vérifier : « complete data sovereignty », « 99.9% uptime » (entre crochets `[99.9%]` dans les CGU), « designed to support SOC 2 / GDPR », « air-gapped », SLA Enterprise | Formulations factuelles, pas de label non étayé |

### 1.7 Incohérences factuelles à corriger dans tous les cas

- `web/apps/website/package.json` déclare `"license": "MIT"` alors que le site annonce Apache-2.0
  (le `LICENSE` racine est bien Apache-2.0) → corriger le champ du package.
- `sitemap.ts` omet `/features/container-server-monitoring`, et ne liste ni `/jobs` ni
  `/lp/deployment-platform` (à décider : exclusion volontaire ou oubli).
- La home n'a pas de `alternates.canonical` ; la plupart des pages non plus.
- Les onglets maison (`ProductShowcase`, `PlatformDomains`) utilisent `role="tablist"` sans
  gestion des flèches ni `tabIndex` → remplacer par le composant `ui/tabs` (Radix) déjà présent.
- `layout.tsx` n'a pas de lien d'évitement (« Aller au contenu »).

---

## 2. Décisions de cadrage proposées

| # | Décision | Proposition | Pourquoi |
| --- | --- | --- | --- |
| D1 | Langue du site | **Anglais uniquement** pour cette itération, pas de hreflang | Le site est déjà EN ; l'i18n est un chantier séparé (routing, contenus, SEO) |
| D2 | Baseline de marque | Conserver **« European PaaS tools for people & businesses »** comme signature (footer + page trust + OG), mais **pas** comme H1 : le H1 reste orienté bénéfice | « PaaS tools » est plus étroit que la vision ; la baseline fonctionne comme signature, pas comme promesse d'accueil — *sauf avis contraire, voir Q1* |
| D3 | Modèle d'offre | **Self** et **Cloud** = deux modes d'exploitation de la même plateforme ; **Enterprise** = offre commerciale (support, SLA, SSO/RBAC avancés) adossée aux deux ; **Console** = surface interne, jamais citée | Aligné sur l'issue (« Console ne doit pas être marketée ») |
| D4 | URL « Produit » | Garder `/platform` et le retitrer « Platform » (pas de nouvelle route `/product`) | Préserve le SEO et les liens existants |
| D5 | Capacités | Nouvelle page `/capabilities` (matrice) ; les 9 pages `/features/*` restent les pages de détail | Évite de casser 9 pages indexées, ajoute le niveau de synthèse manquant |
| D6 | Cas d'usage | Nouvelle page `/use-cases` avec 5 cas **en sections ancrées** (pas 5 pages) ; `/industries/*` conservées mais **retirées de la nav principale** (footer + renvoi depuis `/use-cases`) | Contenu non dupliqué, pas de pages minces, SEO conservé |
| D7 | CTA Cloud | Vérifier `app.notploy.com/register` ; si l'inscription publique n'est pas ouverte → CTA vers `/cloud` + formulaire de contact, jamais un faux bouton | Critère d'acceptation explicite de l'issue |
| D8 | Design | Rester **sombre par défaut** (cohérence produit), mais retirer les effets décoratifs : grille animée, soulignement manuscrit, marquee, cartes dégradées, tickers. Grille éditoriale à filets, un seul accent, typographie resserrée | « European public-service-inspired clarity » sans renier l'UI produit |
| D9 | Preuves produit | Captures d'écran réelles uniquement (`public/*.png` existants) ; aucun chiffre inventé ; pas de témoignages non sourcés | Évite les fausses preuves de capacités |
| D10 | Périmètre technique | Aucune dépendance externe nouvelle ; aucune dépendance à un service tiers pour que le site fonctionne (analytics et formulaires restent optionnels, comme aujourd'hui) | Non-goal de l'issue |

---

## 3. Sitemap cible

### Conservé sans changement d'URL

`/`, `/self`, `/cloud`, `/platform`, `/pricing`, `/enterprise`, `/comparison`,
`/comparison` + 6 `/notploy-vs-*`, 9 `/features/*`, `/integrations`, `/templates`,
`/templates/[id]`, `/community`, `/contact`, `/partners`, `/jobs`, `/industries` + 8,
`/deploy-ai`, `/sandbox-software`, `/self-hosted-paas`, `/lp/deployment-platform`,
`/privacy`, `/terms`, `/terms-of-service`.

**Aucune redirection ajoutée** : toutes les URL publiques restent valides, ce qui est aussi la
seule option compatible avec l'export statique.

### Nouvelles pages

| Route | Rôle | Sections |
| --- | --- | --- |
| `/capabilities` | Matrice capacités + statuts | 6 domaines (Workloads, Infrastructure, Operations, Platform services, Integrations, Governance) avec badges Available / In development / Planned ; renvoi vers `/features/*` |
| `/use-cases` | 5 cas d'usage | Personal apps & websites · Homelab services · Developer tools & internal services · Team & business apps · Data services, game servers & specialised workloads — chacun avec valeur opérationnelle + prérequis/limites |
| `/trust` | Confiance, principes, Europe | Développement européen (fait vérifié) · autonomie & contrôle · code ouvert et dépendances · télémétrie (site vs produit) · hébergement Cloud (si vérifié) · signalement sécurité · ce que nous **n'affirmons pas** |

### Non créées (volontairement)

- `/docs` interne → les liens pointent vers `docs.notploy.com` (évite un doublon et un redirect
  inopérant en statique).
- `/status` → lien externe **uniquement si** `status.notploy.com` répond (voir Q5).
- `/console` → jamais publique.

### Navigation cible

**Header** : Self · Cloud · Platform · Use cases · Docs ↗ · GitHub ↗ · [Install Notploy] · Sign in
(dans l'ordre : produit, modes d'usage, docs, code, action).

**Footer** : Product (Platform, Capabilities, Self, Cloud, Enterprise, Pricing) · Use cases
(Personal & homelab, Developers & teams, Businesses → ancres de `/use-cases`) · Resources (Docs,
Installation, Templates, Integrations, Comparisons, Release notes) · Community (GitHub,
Discussions, Discord, Contributing, Status si disponible) · Company & legal (Trust, Privacy,
Terms, Security report, Contact).

---

## 4. Architecture contenu / présentation

Objectif : sortir le contenu des `.tsx` pour que la phase 1 se limite à de la revue de texte.

```
lib/content/
  links.ts            # source unique : docs, installation, github, app, status, security, social
  editions.ts         # Self, Cloud, Enterprise (responsabilités, CTA)
  audiences.ts        # Personal & homelab / Developers & teams / Businesses
  capabilities.ts     # domaines + items + status: "available" | "in-development" | "planned"
  use-cases.ts        # 5 cas + prérequis + limites
  trust.ts            # principes + affirmations factuelles + non-claims
  faqs.ts             # FAQ par page (8 max sur la home)
components/marketing/
  Hero.tsx            # eyebrow, H1, sous-titre, 2 CTA, bandeau liens secondaires
  InstallStrip.tsx    # réutilise le bloc install existant (Linux / Windows)
  Lifecycle.tsx       # infra → plateforme → services
  AudiencePaths.tsx
  EditionPaths.tsx
  CapabilityOverview.tsx
  Topology.tsx        # SVG mono-nœud / multi-nœuds + mention « pas de HA automatique »
  StatusBadge.tsx     # Available / In development / Planned (texte + icône, pas que la couleur)
  ResourceLinks.tsx
  FinalCta.tsx
```

Réutilisation des primitives existantes : `PageHero` (ajout d'un `eyebrow`), `SectionHeading`,
`CellGrid`, `ChoicePanels`, `PageFaq`, `ProductFrame`, `Reveal`, `Container`, `ui/tabs`.

Suppressions : composants listés en 1.5 (uniquement après confirmation du grep, déjà fait), +
`Testimonials`/`ComparisonStats` retirés des pages de comparaison (contenu non vérifiable).

---

## 5. Direction design & UX

- **Grille** : 12 colonnes, `max-w-6xl`, gouttières larges, filets fins — on garde l'ADN actuel,
  on retire le bruit.
- **Typo** : H1 40→64 px max (au lieu de 72), pas de `whitespace-nowrap` sur le surlignage,
  interlignage 1.1, corps 17–18 px, mesure ≤ 68 caractères.
- **Couleur** : tokens existants inchangés ; un seul accent (`primary`). Nouveau token sémantique
  pour les statuts (available = primary, in-development = neutre + icône, planned = contour) avec
  contraste ≥ 4.5:1 vérifié.
- **Mouvement** : `Reveal` uniquement (déjà `reduced-motion`), plus aucune animation en boucle
  (marquee, grille, ticker, ripple).
- **Imagerie** : captures réelles déjà présentes (`dashboard.png`, `compose.png`, `remote.png`,
  `logs.png`, `backups.png`), plus 2 schémas SVG maison (cycle de vie, topologie).
- **Diagrammes** : mono-nœud (1 serveur, Docker, Traefik, volume) vs multi-nœuds (3 nœuds Swarm,
  répartition des tâches) avec légende « multi-nœuds ≠ haute disponibilité automatique ».
- **Accessibilité** : skip link, un seul `h1` par page, `aria-labelledby` sur chaque section
  (déjà fait), onglets Radix pour le clavier, focus visible conservé, statuts non portés par la
  couleur seule, `aria-live` sur les changements de panneau, contrastes vérifiés.
- **Responsive** : une seule rupture majeure (768 px) + ajustements à 1024 px ; blocs de code
  scrollables, diagrammes en `overflow-x-auto`, CTA empilés.

---

## 6. Contenu page par page

### 6.1 Home (`/`) — wireframe proposé

1. **Hero**
   - Eyebrow : `European application infrastructure`
   - H1 : **Your services. Your infrastructure. Your control.**
   - Sous-titre : « Notploy is the platform to deploy, operate and control the services you
     depend on — on a server you already own, in a homelab, or across a growing infrastructure.
     Start with Self on infrastructure you control, or choose Cloud for a managed experience. »
   - CTA principal : **Install Notploy** → `/self#install` · CTA secondaire : **Explore Notploy
     Cloud** → `/cloud`
   - Liens tertiaires : Read the docs ↗ · View source ↗ · **Notploy for teams** → `/enterprise`
   - Bandeau install (Linux / Windows Server, copie en un clic) — conserve la commande
     `https://notploy.com/install.sh` (le fichier existe dans `public/`)
2. **Cycle de vie** — Infrastructure → Platform services → Applications & workloads (3 colonnes
   + renvoi `/platform`)
3. **Parcours par audience** — Personal & homelab / Developers & small teams / Businesses
   (3 cartes, une ligne de valeur + lien)
4. **Self ou Cloud** — 2 cartes symétriques, responsabilités explicites, pas de « édition
   réduite » ni de « Enterprise » dans le titre
5. **Capacités** — 6 groupes, 1 ligne chacun, badge de statut, lien `/capabilities`
6. **Architecture** — schéma mono/multi + phrase de limite
7. **Principes & confiance** — self-hosting, contrôle, code ouvert, développement européen,
   dépendances transparentes → `/trust`
8. **Ressources** — Docs, Installation, GitHub, Templates, Communauté, Statut (si dispo)
9. **FAQ** — 8 questions max (fusion des 16 actuelles)
10. **CTA final** — une action principale, trois chemins secondaires

### 6.2 Platform (`/platform`)

Capacités par domaine plutôt que par secteur : Workloads · Infrastructure · Operations ·
Platform services · Integrations. Chaque bloc liste ce qui est supporté **et** ce qui ne l'est
pas, avec renvoi vers `/capabilities` pour la matrice complète.

### 6.3 Notploy Self (`/self`)

Conservé et densifié : installation en une commande (ancre `#install`), point de départ
mono-serveur, montée vers homelab puis multi-nœuds, ce qui fonctionne hors ligne et ce qui exige
un fournisseur externe (DNS, S3, Git, IdP), liens installation / prérequis / environnements
supportés / mise à jour / sauvegarde / restauration / dépannage. CTA primaire **Install Notploy**,
secondaire **Documentation**.

### 6.4 Notploy Cloud (`/cloud`)

Ce que l'utilisateur n'a plus à exploiter (control plane hébergé, mises à jour, supervision),
ce qui reste chez lui (workloads, serveurs, accès), limites de ressources/plans **uniquement si
disponibles**, distinction explicite avec Self, CTA vers l'onboarding réel ou `/contact`.

### 6.5 Enterprise (`/enterprise`)

Repositionnée : « Notploy for teams and organisations » — SSO/RBAC/audit/support comme
compléments, sans laisser entendre une plateforme différente. Les mentions SLA/compliance
restent **conditionnées à validation** (voir Q5).

### 6.6 Use cases (`/use-cases`)

5 sections ancrées, chacune : valeur opérationnelle, ce que Notploy prend en charge, prérequis,
limites. Aucune promesse « production-ready » fondée sur le seul fait qu'un conteneur démarre.

### 6.7 Trust (`/trust`)

Développement européen (entité, équipe) · autonomie et contrôle · licence et dépendances ·
télémétrie du site (GA4 / OpenPanel / NotployTraffic, à décrire factuellement) vs télémétrie
produit (à vérifier) · hébergement Cloud (si confirmé) · signalement de sécurité · section
« Ce que nous n'affirmons pas » (pas de « fully sovereign », pas de « GDPR compliant » générique,
pas de « 100% European infrastructure » sans preuve).

### 6.8 Docs & communauté

Bloc ressources sur la home + footer : documentation, getting started, GitHub et guide de
contribution, release notes, canaux communautaires, statut (si disponible).

---

## 7. Matrice de capacités — méthode

Aucun statut ne sera inventé. Règle de traçabilité : une ligne est **Available** seulement si elle
est attestée par (a) une page de `docs.notploy.com`, (b) une route de
`apps/notploy/server/api/routers`, ou (c) un écran de l'app ; sinon **In development** ou
**Planned**, ou la ligne est retirée.

Domaines et lignes à statuer (statut à remplir avec toi, Q4) :

- **Workloads** : applications Git, images Docker, Docker Compose, tâches planifiées, bases
  (Postgres, MySQL, MariaDB, MongoDB, Redis), templates
- **Infrastructure** : serveur local, serveurs distants SSH, Docker Swarm, volumes, registries,
  build servers
- **Operations** : historique de déploiement, rollback, preview deployments, logs, métriques,
  sauvegardes de bases, sauvegardes de volumes, maintenance
- **Platform services** : domaines, Traefik/ingress, certificats TLS, secrets (dont Vault),
  stockage objet S3
- **Integrations** : GitHub, GitLab, Gitea, Bitbucket, OIDC/SSO, SCIM, fournisseurs DNS, API,
  CLI, SDK, MCP, desktop, VS Code
- **Governance** : organisations, rôles/permissions, clés API, journal d'audit, SSO, white-label

---

## 8. SEO & métadonnées

- Titre home : `Notploy — European PaaS tools for people & businesses` (≈ 58 car.), description
  ≈ 155 car. avec la promesse Self/Cloud.
- `alternates.canonical` sur **toutes** les pages ; OG/Twitter par page (image `/og.png`
  aujourd'hui) ; `openGraph.locale` + `siteName` ; `robots` inchangé.
- JSON-LD : `Organization` (nom, URL, logo, contact) + `SoftwareApplication` (Self, gratuit,
  licence Apache-2.0) sur la home et `/self` ; `FAQPage` sur les FAQ.
- `sitemap.ts` : ajouter `/capabilities`, `/use-cases`, `/trust`, corriger l'oubli
  `/features/container-server-monitoring`, statuer sur `/jobs` et `/lp/deployment-platform`.
- Conserver : toutes les URL existantes, le redirect `/dokploy-vs-*`, `llms.txt`, `robots.txt`.

---

## 9. Découpage en lots (PR)

| Lot | Contenu | Fichiers principaux |
| --- | --- | --- |
| **0. Cadrage** | Réponses aux Q1–Q9, matrice de capacités validée, vérification des CTA et des liens externes | ce document |
| **1. Socle** | `lib/content/*`, `lib/site-navigation.ts` (nav + footer + liens), `StatusBadge`, skip link, `PageHero` avec eyebrow, suppression des composants morts, `license` du package | `lib/`, `components/ui`, `components/pages/PageHero.tsx`, `app/layout.tsx` |
| **2. Home** | Nouveaux blocs marketing, FAQ réduite, métadonnées + JSON-LD | `app/page.tsx`, `components/marketing/*` |
| **3. Produit** | `/platform`, `/capabilities`, `/self`, `/cloud`, `/enterprise`, `/integrations` | pages + contenu |
| **4. Confiance & cas d'usage** | `/use-cases`, `/trust`, footer, liens docs/statut, sitemap | pages + `app/sitemap.ts` |
| **5. Validation** | build serveur + build statique, typecheck, audit de liens, revue a11y/responsive, contrôles SEO | — |

Ordre imposé : 1 → 2 → 3 → 4 → 5. Chaque lot est livrable et mergable seul ; aucun lot ne
supprime d'URL publique.

---

## 10. Vérifications prévues

1. `pnpm --filter=@notploy/website run typecheck`
2. `pnpm --filter=@notploy/website run build` (serveur, routes API incluses)
3. `pnpm --filter=@notploy/website run build:static` (export, vérifie qu'aucune nouvelle page ne
   casse l'export)
4. `pnpm --filter=@notploy/website exec biome check <fichiers modifiés>` (le package n'a pas de
   script lint)
5. Audit de liens : script one-off sur `out/` (cibles internes) + `curl -I` sur docs, GitHub,
   Discord, `app.notploy.com/register`, statut
6. Revue statique a11y : hiérarchie de titres, skip link, `aria-*` des onglets, contrastes des
   badges, `reduced-motion`
7. Contrôle visuel mobile/desktop — **limite** : aucun navigateur (Chrome) n'est disponible dans
   cet environnement ; la passe visuelle devra être faite par toi ou en CI, sauf si tu autorises
   l'installation d'un navigateur headless.

---

## 11. Correspondance avec les critères d'acceptation

| Critère | Preuve attendue |
| --- | --- |
| Vision large dès le premier écran | Hero : eyebrow européen + H1 « services / infrastructure / contrôle » + sous-titre services |
| Baseline intégrée ou alternative justifiée | Footer, `/trust`, OG + Q1 |
| Choix rapide Self / Cloud / docs / code | Header (Self, Cloud, Docs ↗, GitHub ↗) + bandeau hero |
| Pages Self et Cloud distinctes et exactes | Section 6.3 / 6.4, responsabilités explicites |
| Progression mono-serveur → infra plus large sans surpromesse | Bloc topologie + phrase de limite, page Self |
| Fonctionnalités actuelles vs roadmap | `/capabilities` avec statuts + badges sur la home |
| Message européen factuel | `/trust` + section « Ce que nous n'affirmons pas » |
| Cas d'usage larges | `/use-cases` (5 cas, prérequis et limites) |
| Liens install/docs/statut fonctionnels | Audit de liens (étape 5) |
| Responsive, a11y, SEO | Étape 6 + métadonnées/canonicals/sitemap |
| Build et checks OK | Étape 1–5 |

---

## 12. Questions à trancher avant implémentation

1. **Baseline** : on garde « European PaaS tools for people & businesses » telle quelle (signature,
   pas H1) ou tu préfères une formulation plus large du type « European tools to deploy, operate
   and control your services » ?
2. **Cloud** : l'inscription publique sur `app.notploy.com/register` est-elle ouverte ? Sinon,
   quel CTA pour Cloud (contact, liste d'attente, page produit seule) ?
3. **Enterprise** : on conserve une offre Enterprise distincte (page + entrée de nav) ou on la
   fond dans « Cloud for teams » / support Self ?
4. **Capacités** : tu fournis la liste validée des statuts, ou je propose une matrice à partir des
   docs + du code, que tu corriges ensuite ? (Les points sensibles : SSO/SAML/SCIM, audit logs,
   Vault, air-gapped, multi-nœuds, desktop, VS Code, MCP, templates, SLA.)
5. **Europe / confiance** : quelles affirmations sont vérifiables aujourd'hui — entité légale et
   pays, localisation d'hébergement du control plane Cloud, télémétrie du produit, existence de
   `status.notploy.com`, contact sécurité ? Je n'écrirai que ce qui est confirmé.
6. **Thème** : on reste en sombre uniquement (recommandé, cohérent avec l'app) ou tu veux des
   sections claires façon site institutionnel ?
7. **Langue** : anglais seul pour cette itération (recommandé) ou version FR + hreflang dès
   maintenant ?
8. **Secteurs** : `/industries/*` conservées hors nav principale (recommandé) ou suppression ?
9. **Périmètre** : je m'en tiens au site marketing — pas de retouche de l'app, de la doc, des
   templates, des routes API ni du texte légal (les `[99.9%]` et `[10%]` des CGU restent à
   arbitrer avec le juridique).

---

## 13. Décisions validées et état d'avancement

Décisions prises (30/10), conformes aux recommandations de la section 2 :

| # | Décision |
| --- | --- |
| Q1 | Baseline **« European PaaS tools for people & businesses »** conservée comme signature (hero, footer, JSON-LD) ; le H1 reste orienté bénéfice. |
| Q2 | **CTA Cloud → `/cloud`** dans tout le marketing. `app.notploy.com` ne répond pas depuis l'environnement de build : aucun bouton d'inscription directe n'est exposé. `app.notploy.com` reste utilisé pour « Sign in » uniquement. |
| Q3 | **Enterprise** conservée comme offre commerciale (« For teams & organisations »), pas comme troisième plateforme. |
| Q4 | Statuts de capacités **non publiés** tant qu'ils ne sont pas tracés (docs + code). La home renvoie vers la feature matrix de la doc ; `/capabilities` arrive au lot 3 avec les statuts validés. |
| Q5 | Aucune affirmation d'hébergement, de souveraineté ou de conformité ajoutée. « European development » est formulé comme un fait sur l'équipe, avec la mention de ce que cela ne garantit pas. `/trust` au lot 4. |
| Q6 | **Sombre uniquement**, effets décoratifs retirés. |
| Q7 | **Anglais seul**, pas de hreflang. |
| Q8 | `/industries/*` conservées, hors nav principale (entrée « Use cases » + footer). |
| Q9 | Périmètre limité au site marketing. |

État des lots :

- **Lot 1 — socle : fait.** `lib/content/links.ts` (source unique), navigation réécrite
  (`navGroups`, `primaryNav`, `resourceNav`, `cta`, footer), header compact
  (Platform / Use cases / Self / Cloud / Docs / GitHub / Install / Sign in), footer aligné,
  skip link + `#main-content`, `PageHero` avec `eyebrow`, `StatusBadge`, licence du package
  corrigée en Apache-2.0, 14 composants morts supprimés (dont `GithubStars`, retiré du header).
- **Lot 2 — home : fait.** Nouvelle page composée de `components/marketing/*` et de
  `lib/content/home.ts` : hero européen + installation, cycle de vie, audiences, Self/Cloud,
  capacités, topologie mono/multi avec limite explicite, principes, ressources, 8 FAQ, CTA final.
  Anciens blocs supprimés (`HeroBoard`, `FeatureGrid`, `ProductShowcase`, `EditionsCompact`,
  `CommunityMarquee`, `Faqs`). Métadonnées, canonical, Open Graph et JSON-LD ajoutés.
- **Lots 3 à 5 : à faire** — `/capabilities`, `/use-cases`, `/trust`, reprise des pages produit,
  puis validation (build statique, liens, a11y, SEO).

Points restant à confirmer côté produit : statuts de la matrice de capacités, disponibilité de
l'inscription Cloud publique, affirmations vérifiables pour `/trust` (entité, hébergement,
télémétrie), et arbitrage juridique des `[99.9%]` / `[10%]` des CGU.

---

## 13. Arbitrages retenus (lot 0 exécuté)

| Question | Décision |
| --- | --- |
| Q1 Baseline | Conservée **« European PaaS tools for people & businesses »** comme signature (footer, OG, `/trust`) ; le H1 reste « Your services. Your infrastructure. Your control. » |
| Q2 Cloud | `app.notploy.com` n'a pas répondu depuis l'environnement de build (échec de connexion) ; l'inscription publique n'est donc pas vérifiable. **Tous les CTA Cloud pointent vers `/cloud`**, jamais vers `/register`. « Sign in » reste le seul lien vers `app.notploy.com` (sessions existantes). |
| Q3 Enterprise | Offre commerciale distincte conservée (`/enterprise`), présentée comme complément de Self et Cloud, jamais comme une troisième plateforme. |
| Q4 Capacités | Statuts établis depuis `docs.notploy.com` (`feature-matrix`, `limitations`) + le code ; aucune ligne sans source. À remplir au lot 3. |
| Q5 Europe | Seules les affirmations vérifiables sont publiées : licence Apache-2.0, développement par Sky Genesis Enterprise, auto-hébergement, dépendances (Docker, Compose, Traefik, Swarm). Aucune localisation d'hébergement ni conformité générique. |
| Q6 Thème | Sombre uniquement, cohérent avec l'UI produit. |
| Q7 Langue | Anglais uniquement, pas de hreflang. |
| Q8 Secteurs | `/industries/*` conservées, hors navigation principale. |
| Q9 Périmètre | Site marketing seulement. |

Vérifications d'infrastructure effectuées : `https://notploy.com/install.sh` et `install.ps1` → 200 ;
`https://status.notploy.com` → 200 ; docs `feature-matrix`, `limitations`,
`vulnerability-disclosure`, `comparison` présentes dans la navigation de la doc ;
`https://app.notploy.com` → échec de connexion (non vérifiable).

### Lot 1 — état

- [x] `lib/content/links.ts` : source unique des URLs (docs, GitHub, Discord, statut, installateurs).
- [x] `lib/site-navigation.ts` : navigation `Platform / Use cases / Self / Cloud / Docs / GitHub`, 5 colonnes de footer, `cta` centralisé.
- [x] `components/Header.tsx` : menu compact, Docs et GitHub en clair, CTA « Install Notploy » → `/self`, `aria-current`, bascule mobile à `lg`.
- [x] `components/Footer.tsx` : baseline européenne, colonnes Product / Use cases / Resources / Community / Company & legal, liens statut, matrice et limitations.
- [x] `components/marketing/StatusBadge.tsx` : `available` / `in-development` / `planned` (texte + icône).
- [x] `PageHero` : support de l'`eyebrow`.
- [x] Skip link + cible `#main-content` dans `app/layout.tsx`.
- [x] Suppression de 14 composants non importés (dont `GithubStars`, remplacé par le lien GitHub du header).
- [x] `package.json` du site : licence corrigée en Apache-2.0.

Restent pour le lot 2 : contenu `capabilities` / `audiences` / `editions` / `use-cases` / `trust`,
puis la home. Les entrées de nav `/capabilities`, `/use-cases` et `/trust` seront ajoutées en même
temps que les pages, pour ne jamais exposer de lien mort.
