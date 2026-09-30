import type { ArticleContent } from "@/lib/theme-localize";
import { externalLinks } from "@/lib/site-structure";
import { productRelatedDestinations } from "@/lib/content/product/product-related";

/**
 * Content configuration of the self-hosted page (`/self-hosted`).
 *
 * Structure only: every display string is resolved from the message catalogs
 * (`pages.product.selfHosted.*` and `pages.product.related.*`) by
 * `lib/theme-localize.ts`. The requirements, the install steps and the
 * operating commands mirror the README and the installation documentation — the
 * page never describes an installation path the project does not document.
 */
export const selfHostedContent: ArticleContent = {
  hero: {
    kickerKey: "hero.kicker",
    titleKey: "hero.title",
    leadKey: "hero.lead",
    ctaKey: "hero.cta",
    ctaHref: externalLinks.docs,
  },
  sections: [
    {
      key: "requirements",
      id: "requirements",
      lead: true,
      bulletCount: 3,
    },
    {
      key: "install",
      id: "install",
      subtle: true,
      lead: true,
      steps: [{ key: "clone" }, { key: "configure" }, { key: "start" }, { key: "setup" }],
      notice: true,
    },
    {
      key: "operations",
      id: "operations",
      lead: true,
      paragraphCount: 1,
      bulletCount: 3,
    },
    {
      key: "production",
      id: "production",
      subtle: true,
      lead: true,
      cards: [
        { key: "https", iconId: "fr-icon-lock-line" },
        { key: "authentication", iconId: "fr-icon-shield-line" },
        { key: "updates", iconId: "fr-icon-refresh-line" },
      ],
      cta: { href: externalLinks.docs },
    },
  ],
  related: productRelatedDestinations(),
} as const;
