import type { ArticleContent } from "@/lib/theme-localize";
import { externalLinks } from "@/lib/site-structure";
import { productRelatedDestinations } from "@/lib/content/product/product-related";

/**
 * Content configuration of the cloud page (`/cloud`).
 *
 * Structure only: every display string is resolved from the message catalogs
 * (`pages.product.cloud.*` and `pages.product.related.*`) by
 * `lib/theme-localize.ts`. The page describes what the hosted offering actually
 * is — the same application runtime, operated for you, reachable at
 * `app.notploy.com` — and never promises a service or a price the repository
 * does not ship.
 */
export const cloudContent: ArticleContent = {
  hero: {
    kickerKey: "hero.kicker",
    titleKey: "hero.title",
    leadKey: "hero.lead",
    ctaKey: "hero.cta",
    ctaHref: externalLinks.app,
  },
  sections: [
    {
      key: "what",
      id: "what",
      lead: true,
      paragraphCount: 2,
      bulletCount: 4,
    },
    {
      key: "differences",
      id: "differences",
      subtle: true,
      lead: true,
      cards: [
        { key: "runtime", iconId: "fr-icon-cpu-line" },
        { key: "tooling", iconId: "fr-icon-terminal-box-line" },
        { key: "updates", iconId: "fr-icon-refresh-line" },
      ],
    },
    {
      key: "start",
      id: "start",
      lead: true,
      steps: [{ key: "account" }, { key: "server" }, { key: "deploy" }],
      notice: true,
    },
    {
      key: "sovereignty",
      id: "sovereignty",
      subtle: true,
      lead: true,
      paragraphCount: 1,
      cta: { href: externalLinks.docs },
    },
  ],
  related: productRelatedDestinations(),
} as const;
