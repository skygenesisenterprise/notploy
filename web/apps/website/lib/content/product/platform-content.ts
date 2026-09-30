import type { ArticleContent } from "@/lib/theme-localize";
import { productPaths } from "@/lib/site-structure";
import { productRelatedDestinations } from "@/lib/content/product/product-related";

/**
 * Content configuration of the platform page (`/platform`).
 *
 * Structure only: every display string is resolved from the message catalogs
 * (`pages.product.platform.*` and `pages.product.related.*`) by
 * `lib/theme-localize.ts`. Hrefs come from the site structure, so the page can
 * never point somewhere the navigation does not expose.
 */
export const platformContent: ArticleContent = {
  hero: {
    kickerKey: "hero.kicker",
    titleKey: "hero.title",
    leadKey: "hero.lead",
    ctaKey: "hero.cta",
    ctaHref: productPaths.selfHosted,
  },
  sections: [
    {
      key: "applications",
      id: "applications",
      lead: true,
      paragraphCount: 1,
      cards: [
        { key: "docker", iconId: "fr-icon-code-box-line" },
        { key: "nixpacks", iconId: "fr-icon-stack-line" },
        { key: "railpack", iconId: "fr-icon-road-map-line" },
        { key: "buildpacks", iconId: "fr-icon-cpu-line" },
      ],
    },
    {
      key: "compose",
      id: "docker-compose",
      subtle: true,
      lead: true,
      paragraphCount: 1,
      bulletCount: 4,
    },
    {
      key: "databases",
      id: "databases",
      lead: true,
      cards: [
        { key: "postgresql", iconId: "fr-icon-database-line" },
        { key: "mysql", iconId: "fr-icon-database-line" },
        { key: "mariadb", iconId: "fr-icon-database-line" },
        { key: "mongodb", iconId: "fr-icon-database-line" },
        { key: "redis", iconId: "fr-icon-flashlight-line" },
      ],
    },
    {
      key: "routing",
      id: "routing",
      subtle: true,
      lead: true,
      bulletCount: 4,
    },
    {
      key: "monitoring",
      id: "monitoring",
      lead: true,
      bulletCount: 3,
    },
    {
      key: "servers",
      id: "servers",
      subtle: true,
      lead: true,
      cards: [
        { key: "local", iconId: "fr-icon-server-line" },
        { key: "remote", iconId: "fr-icon-cloud-line" },
        { key: "swarm", iconId: "fr-icon-stack-line" },
      ],
      cta: { href: productPaths.selfHosted },
    },
  ],
  related: productRelatedDestinations(),
} as const;
