"use client";

import { useTranslations } from "next-intl";
import {
  SDSContainer,
  SDSGrid,
  SDSSection,
  SDSTeaserCard,
  SDSText,
} from "@skygenesisenterprise/react-sds/sds";
import { externalLinks } from "@/lib/site-structure";

/**
 * Community band of the website: the real, existing places where the project
 * lives — the GitHub repository, its issue tracker and discussions, the Discord
 * server and the template gallery. No newsletter form is shipped: the platform
 * exposes no public subscription endpoint, so inventing one would promise a
 * service that does not exist.
 *
 * Every destination comes from `externalLinks` (`lib/site-structure.ts`), so
 * the band and the footer can never point at different places.
 */
const COMMUNITY_LINKS = [
  { key: "github", href: externalLinks.github },
  { key: "issues", href: externalLinks.issues },
  { key: "discussions", href: externalLinks.discussions },
  { key: "discord", href: externalLinks.discord },
  { key: "templates", href: externalLinks.templates },
] as const;

export function Community() {
  const t = useTranslations("community");

  return (
    <SDSSection tone="subtle" title={t("title")} subtitle={t("lead")}>
      <SDSContainer>
        <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={5}>
          {COMMUNITY_LINKS.map((link) => (
            <SDSTeaserCard
              key={link.key}
              href={link.href}
              title={t(`items.${link.key}.title`)}
              description={t(`items.${link.key}.desc`)}
            />
          ))}
        </SDSGrid>
        <SDSText as="p" size="sm" color="muted" margin="top">
          {t("note")}
        </SDSText>
      </SDSContainer>
    </SDSSection>
  );
}
