import type { ArticleContent } from "@/lib/theme-localize";
import { externalLinks } from "@/lib/site-structure";
import { productRelatedDestinations } from "@/lib/content/product/product-related";

/**
 * Content configuration of the security page (`/security`).
 *
 * Structure only: every display string is resolved from the message catalogs
 * (`pages.product.security.*` and `pages.product.related.*`) by
 * `lib/theme-localize.ts`. The page states the platform's actual security model
 * (privileged Docker socket access, authentication and TLS handled by the
 * operator) and points at the private disclosure process defined in
 * `SECURITY.md` — vulnerabilities are never reported in public issues.
 */
export const securityContent: ArticleContent = {
  hero: {
    kickerKey: "hero.kicker",
    titleKey: "hero.title",
    leadKey: "hero.lead",
  },
  sections: [
    {
      key: "model",
      id: "model",
      lead: true,
      paragraphCount: 2,
    },
    {
      key: "privileges",
      id: "privileges",
      subtle: true,
      lead: true,
      bulletCount: 3,
    },
    {
      key: "reporting",
      id: "reporting",
      lead: true,
      paragraphCount: 1,
      bulletCount: 2,
      cta: { href: externalLinks.security },
    },
    {
      key: "practices",
      id: "practices",
      subtle: true,
      lead: true,
      cards: [
        { key: "secrets", iconId: "fr-icon-lock-line" },
        { key: "transport", iconId: "fr-icon-shield-line" },
        { key: "updates", iconId: "fr-icon-refresh-line" },
      ],
    },
  ],
  related: productRelatedDestinations(),
} as const;
