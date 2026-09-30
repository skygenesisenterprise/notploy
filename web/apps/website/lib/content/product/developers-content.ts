import type { ArticleContent } from "@/lib/theme-localize";
import { externalLinks } from "@/lib/site-structure";
import { productRelatedDestinations } from "@/lib/content/product/product-related";

/**
 * Content configuration of the developers page (`/developers`).
 *
 * Structure only: every display string is resolved from the message catalogs
 * (`pages.product.developers.*` and `pages.product.related.*`) by
 * `lib/theme-localize.ts`. Every destination listed here ships in the monorepo
 * (`apps/api`, `packages/sdk`, `packages/cli`, `packages/mcp`,
 * `packages/github`, `packages/vscode`, `apps/desktop`, `apps/mobile`).
 */
export const developersContent: ArticleContent = {
  hero: {
    kickerKey: "hero.kicker",
    titleKey: "hero.title",
    leadKey: "hero.lead",
    ctaKey: "hero.cta",
    ctaHref: externalLinks.docs,
  },
  sections: [
    {
      key: "api",
      id: "api",
      lead: true,
      paragraphCount: 1,
      bulletCount: 3,
      cta: { href: externalLinks.docs },
    },
    {
      key: "sdk",
      id: "sdk",
      subtle: true,
      lead: true,
      paragraphCount: 1,
      bulletCount: 3,
    },
    {
      key: "cli",
      id: "cli",
      lead: true,
      paragraphCount: 1,
      bulletCount: 3,
    },
    {
      key: "mcp",
      id: "mcp",
      subtle: true,
      lead: true,
      paragraphCount: 1,
      bulletCount: 3,
    },
    {
      key: "integrations",
      id: "integrations",
      lead: true,
      cards: [
        { key: "githubActions", iconId: "fr-icon-git-branch-line" },
        { key: "vscode", iconId: "fr-icon-window-2-line" },
        { key: "clients", iconId: "fr-icon-computer-line" },
      ],
    },
    {
      key: "resources",
      id: "resources",
      subtle: true,
      lead: true,
      tiles: [
        { key: "documentation", href: externalLinks.docs, iconId: "fr-icon-book-2-line" },
        { key: "templates", href: externalLinks.templates, iconId: "fr-icon-stack-line" },
        { key: "repository", href: externalLinks.github, iconId: "fr-icon-github-fill" },
      ],
    },
  ],
  related: productRelatedDestinations(),
} as const;
