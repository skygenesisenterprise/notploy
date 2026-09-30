/**
 * Information architecture of the official Notploy website — the single source
 * of truth of the header navigation, the product surfaces and the footer.
 *
 * Editorial rule: everything structural lives here, never in the pages. The
 * header, the footer and the sitemap all derive their markup from this file, so
 * adding or renaming an entry never requires rewriting a component. Labels are
 * never stored here — they come from the message catalogs through the `key` of
 * each entry (`messages/{fr,en}.json`).
 *
 * Grounding rule: a surface is only advertised when the monorepo actually ships
 * it — `apps/notploy` (web dashboard, API and application server),
 * `packages/server` (platform logic), `apps/api`, `apps/schedules`,
 * `apps/desktop`, `apps/mobile`, `apps/monitoring`, `packages/cli`,
 * `packages/sdk`, `packages/mcp`, `packages/github`, `packages/vscode`,
 * `web/apps/docs` and `templates`. Nothing is invented to fill a page.
 *
 * The navigation is validated at module load (`validateSiteStructure`), so a
 * malformed entry fails the build instead of shipping a broken header.
 */

/** Public identity of the product. */
export const SITE = {
  name: "Notploy",
  company: "Sky Genesis Enterprise",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://notploy.com",
  license: "MIT",
  repository: "https://github.com/skygenesisenterprise/notploy",
} as const;

/** External destinations of the ecosystem. */
export const externalLinks = {
  docs: "https://docs.notploy.com",
  templates: "https://templates.notploy.com",
  app: "https://app.notploy.com",
  github: SITE.repository,
  issues: `${SITE.repository}/issues`,
  discussions: `${SITE.repository}/discussions`,
  releases: `${SITE.repository}/releases`,
  security: `${SITE.repository}/blob/main/SECURITY.md`,
  license: `${SITE.repository}/blob/main/LICENSE`,
  discord: "https://discord.gg/2tBnJ3jDJc",
} as const;

/**
 * A destination of the public website: an internal route (locale-agnostic
 * pathname, prefixed by next-intl) or a cross-origin destination.
 */
export type SiteLink = {
  /** Message key, resolved from the matching `nav.*` / `footer.*` namespace. */
  key: string;
  href: string;
  /** Absolute / cross-origin destination, opened in a new tab. */
  external?: boolean;
};

/** Route prefix of each product section of the website. */
export const productPaths = {
  platform: "/platform",
  developers: "/developers",
  cloud: "/cloud",
  selfHosted: "/self-hosted",
  security: "/security",
} as const;

/**
 * Primary navigation of the header — the five product entries plus the external
 * documentation. Labels resolve from `nav.primary`.
 */
export const primaryNavigation: readonly SiteLink[] = [
  { key: "platform", href: productPaths.platform },
  { key: "developers", href: productPaths.developers },
  { key: "cloud", href: productPaths.cloud },
  { key: "selfHosted", href: productPaths.selfHosted },
  { key: "security", href: productPaths.security },
  { key: "docs", href: externalLinks.docs, external: true },
] as const;

export type EcosystemSurface = SiteLink & {
  /** SDS / DSFR icon class (`fr-icon-*`). */
  iconId: string;
};

/**
 * The surfaces of the Notploy ecosystem, each one grounded in a workspace of the
 * monorepo. Labels resolve from `ecosystem.surfaces`.
 */
export const ecosystemSurfaces: readonly EcosystemSurface[] = [
  { key: "dashboard", href: externalLinks.app, iconId: "fr-icon-window-line", external: true },
  { key: "desktop", href: productPaths.developers, iconId: "fr-icon-computer-line" },
  { key: "mobile", href: productPaths.developers, iconId: "fr-icon-smartphone-line" },
  { key: "cli", href: productPaths.developers, iconId: "fr-icon-terminal-box-line" },
  { key: "sdk", href: productPaths.developers, iconId: "fr-icon-npmjs-line" },
  { key: "api", href: productPaths.developers, iconId: "fr-icon-code-s-slash-line" },
  { key: "githubActions", href: externalLinks.github, iconId: "fr-icon-git-branch-line", external: true },
  { key: "vscode", href: productPaths.developers, iconId: "fr-icon-window-2-line" },
  { key: "mcp", href: productPaths.developers, iconId: "fr-icon-cpu-line" },
] as const;

export type FooterColumn = {
  /** Message key of the column title, resolved from `footer.columns`. */
  key: string;
  links: readonly SiteLink[];
};

/**
 * Section anchors of the product pages. They mirror the `id` of the matching
 * section in `lib/content/product/*-content.ts` and let a secondary footer link
 * target the exact section that answers it instead of a generic landing page.
 */
export const sectionAnchors = {
  platform: {
    applications: "applications",
    compose: "docker-compose",
    databases: "databases",
    routing: "routing",
    monitoring: "monitoring",
    servers: "servers",
  },
  developers: {
    api: "api",
    sdk: "sdk",
    cli: "cli",
    mcp: "mcp",
    integrations: "integrations",
  },
} as const;

/**
 * Footer columns — grouped by audience (platform, developers, resources,
 * product, legal), never by internal organisation of the monorepo.
 */
export const footerNavigation: readonly FooterColumn[] = [
  {
    key: "platform",
    links: [
      { key: "applications", href: `${productPaths.platform}#${sectionAnchors.platform.applications}` },
      { key: "compose", href: `${productPaths.platform}#${sectionAnchors.platform.compose}` },
      { key: "databases", href: `${productPaths.platform}#${sectionAnchors.platform.databases}` },
      { key: "routing", href: `${productPaths.platform}#${sectionAnchors.platform.routing}` },
      { key: "monitoring", href: `${productPaths.platform}#${sectionAnchors.platform.monitoring}` },
      { key: "servers", href: `${productPaths.platform}#${sectionAnchors.platform.servers}` },
    ],
  },
  {
    key: "developers",
    links: [
      { key: "api", href: `${productPaths.developers}#${sectionAnchors.developers.api}` },
      { key: "sdk", href: `${productPaths.developers}#${sectionAnchors.developers.sdk}` },
      { key: "cli", href: `${productPaths.developers}#${sectionAnchors.developers.cli}` },
      { key: "mcp", href: `${productPaths.developers}#${sectionAnchors.developers.mcp}` },
      {
        key: "integrations",
        href: `${productPaths.developers}#${sectionAnchors.developers.integrations}`,
      },
    ],
  },
  {
    key: "resources",
    links: [
      { key: "documentation", href: externalLinks.docs, external: true },
      { key: "templates", href: externalLinks.templates, external: true },
      { key: "community", href: externalLinks.discord, external: true },
      { key: "github", href: externalLinks.github, external: true },
      { key: "releases", href: externalLinks.releases, external: true },
    ],
  },
  {
    key: "product",
    links: [
      { key: "cloud", href: productPaths.cloud },
      { key: "selfHosted", href: productPaths.selfHosted },
      { key: "security", href: productPaths.security },
      { key: "openSource", href: externalLinks.license, external: true },
    ],
  },
  {
    key: "legal",
    links: [
      { key: "accessibility", href: "/legal/accessibility" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "terms", href: "/legal/terms" },
      { key: "cookies", href: "/legal/cookies" },
    ],
  },
] as const;

/** Bottom bar of the footer — the secondary links, distinct from the columns. */
export const footerBottomLinks: readonly SiteLink[] = [
  { key: "contact", href: "/contact" },
  { key: "sitemap", href: "/sitemap" },
  { key: "security", href: productPaths.security },
] as const;

/** Sign-in entry — the hosted Notploy application. */
export const signInHref = `${externalLinks.app}/login`;

/**
 * Transversal actions of the header.
 *
 * Same convention as the other Sky Genesis Enterprise portals: these are never
 * entries of the information architecture — they are actions towards another
 * surface of the product, rendered on the right of the header, clearly
 * separated from the navigation. Keeping them here (and not in the component)
 * means the header holds no hard-coded destination.
 */
export const headerActions = {
  signIn: {
    /** Message key, resolved under `header.signIn`. */
    labelKey: "signIn",
    /** Destination of the hosted application (Notploy Cloud). */
    href: signInHref,
  },
} as const;

/** Legal routes, shared by the footer, the sitemap and the legal pages. */
export const legalPaths = {
  accessibility: "/legal/accessibility",
  privacy: "/legal/privacy",
  terms: "/legal/terms",
  cookies: "/legal/cookies",
  sitemap: "/sitemap",
} as const;

/** DOM ids used as skip-link targets. */
export const pageAnchors = {
  content: "main-content",
  footer: "main-footer",
} as const;

/** Structural guard: the footer must expose a stable set of columns. */
export const footerShape = {
  columns: footerNavigation.length,
} as const;

/**
 * Runtime validation of the information architecture. Returns the list of
 * problems found (empty when the structure is valid):
 *  - every link must carry a non-empty key;
 *  - every link must carry an absolute-path or absolute-URL destination;
 *  - no navigation may expose the same destination twice.
 */
export function validateSiteStructure(
  links: ReadonlyArray<ReadonlyArray<SiteLink>> = [
    primaryNavigation,
    footerBottomLinks,
    ...footerNavigation.map((column) => column.links),
  ]
): string[] {
  const problems: string[] = [];

  for (const group of links) {
    const seen = new Set<string>();

    for (const link of group) {
      if (!link.key) {
        problems.push("Un lien de la structure n'a pas de clé de message.");
      }

      if (!link.href || !/^(https?:\/\/|\/)/.test(link.href)) {
        problems.push(
          `Le lien « ${link.key} » n'a pas de destination valide : « ${link.href} ».`
        );
      }

      if (seen.has(link.href)) {
        problems.push(`La destination « ${link.href} » est exposée deux fois.`);
      }

      seen.add(link.href);
    }
  }

  return problems;
}

/**
 * Throws when the structure is malformed. Called at module load so a structural
 * error fails the build immediately instead of shipping a broken navigation.
 */
function assertSiteStructureValid(): void {
  const problems = validateSiteStructure();
  if (problems.length > 0) {
    throw new Error(`Structure du site invalide :\n- ${problems.join("\n- ")}`);
  }
}

assertSiteStructureValid();
