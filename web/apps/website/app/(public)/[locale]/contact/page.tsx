import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SDSGrid } from "@skygenesisenterprise/react-sds/sds";
import type { FrIconClassName } from "@skygenesisenterprise/react-sds/fr";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { externalLinks } from "@/lib/site-structure";
import { LinkTile } from "@/components/public/content/sds-fragments";
import { ThemeHero, ThemeSection } from "@/components/public/content/theme-page";

const PAGE_PATH = "/contact";
const PAGE_NAMESPACE = "pages.contact";

type PageProps = { params: Promise<{ locale: string }> };

/**
 * The places where the project actually answers. Every destination is an
 * existing one: a support inbox or a contact form would have to invent a
 * recipient the project does not have, so the page routes each need to the
 * channel that really handles it.
 */
const CHANNELS: ReadonlyArray<{ key: string; href: string; iconId: FrIconClassName }> = [
  { key: "issues", href: externalLinks.issues, iconId: "fr-icon-bug-line" },
  { key: "discussions", href: externalLinks.discussions, iconId: "fr-icon-chat-3-line" },
  { key: "discord", href: externalLinks.discord, iconId: "fr-icon-chat-3-line" },
  { key: "security", href: externalLinks.security, iconId: "fr-icon-shield-line" },
];

const RESOURCES: ReadonlyArray<{ key: string; href: string; iconId: FrIconClassName }> = [
  { key: "documentation", href: externalLinks.docs, iconId: "fr-icon-book-2-line" },
  { key: "templates", href: externalLinks.templates, iconId: "fr-icon-stack-line" },
  { key: "repository", href: externalLinks.github, iconId: "fr-icon-github-fill" },
  { key: "releases", href: externalLinks.releases, iconId: "fr-icon-refresh-line" },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    ...localizedAlternates(locale, PAGE_PATH),
  };
}

/**
 * Contact page (`/contact`): where to report a bug, ask a question, chat with
 * the maintainers or disclose a vulnerability — plus the project resources.
 *
 * Every display string lives in the message catalogs (`pages.contact.*`).
 */
export default async function ContactPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });

  return (
    <>
      <ThemeHero kicker={t("hero.kicker")} title={t("hero.title")} lead={t("hero.lead")} />

      <ThemeSection
        id="contact-channels"
        kicker={t("channels.kicker")}
        title={t("channels.title")}
        lead={t("channels.lead")}
      >
        <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 2 }} gap={5}>
          {CHANNELS.map((channel) => (
            <LinkTile
              key={channel.key}
              title={t(`channels.items.${channel.key}.title`)}
              desc={t(`channels.items.${channel.key}.desc`)}
              href={channel.href}
              iconId={channel.iconId}
            />
          ))}
        </SDSGrid>
      </ThemeSection>

      <ThemeSection
        id="contact-resources"
        kicker={t("resources.kicker")}
        title={t("resources.title")}
        lead={t("resources.lead")}
        subtle
      >
        <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap={5}>
          {RESOURCES.map((resource) => (
            <LinkTile
              key={resource.key}
              title={t(`resources.items.${resource.key}.title`)}
              desc={t(`resources.items.${resource.key}.desc`)}
              href={resource.href}
              iconId={resource.iconId}
            />
          ))}
        </SDSGrid>
      </ThemeSection>
    </>
  );
}
