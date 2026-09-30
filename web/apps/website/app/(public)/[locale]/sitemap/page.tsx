import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SDSGrid, SDSLinkList, SDSStack } from "@skygenesisenterprise/react-sds/sds";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { footerNavigation, primaryNavigation } from "@/lib/site-structure";
import { sitemapTransversalLinks } from "@/lib/content/sitemap/sitemap-content";
import { ThemeHero, ThemeSection } from "@/components/public/content/theme-page";

const PAGE_PATH = "/sitemap";
const PAGE_NAMESPACE = "pages.sitemap";

type PageProps = { params: Promise<{ locale: string }> };

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
 * Sitemap of the website (`/sitemap`).
 *
 * The page mirrors the information architecture: the product navigation of the
 * header, then the footer columns, then the transversal pages. It is fully
 * driven by `primaryNavigation` and `footerNavigation`
 * (`lib/site-structure.ts`) and the message catalogs (`pages.sitemap.*`,
 * `nav.primary`, `footer.columns`, `footer.links`), so the sitemap, the header
 * and the footer can never drift apart. The layout is composed from SDS
 * primitives (`SDSGrid`, `SDSStack`, `SDSLinkList`).
 */
export default async function SitemapPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });
  const tNav = await getTranslations({ locale, namespace: "nav.primary" });
  const tColumns = await getTranslations({ locale, namespace: "footer.columns" });
  const tLinks = await getTranslations({ locale, namespace: "footer.links" });

  return (
    <>
      <ThemeHero kicker={t("hero.kicker")} title={t("hero.title")} lead={t("hero.lead")} />

      <ThemeSection
        id="sitemap-navigation"
        kicker={t("sections.navigation.kicker")}
        title={t("sections.navigation.title")}
        lead={t("sections.navigation.lead")}
      >
        <SDSLinkList
          items={primaryNavigation.map((item) => ({
            label: tNav(item.key),
            href: item.href,
          }))}
        />
      </ThemeSection>

      <ThemeSection
        id="sitemap-sections"
        kicker={t("sections.directory.kicker")}
        title={t("sections.directory.title")}
        lead={t("sections.directory.lead")}
        subtle
      >
        <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={6}>
          {footerNavigation.map((column) => (
            <SDSStack key={column.key} gap={3}>
              <SDSLinkList
                title={tColumns(column.key)}
                items={column.links.map((link) => ({
                  label: tLinks(link.key),
                  href: link.href,
                }))}
              />
            </SDSStack>
          ))}
        </SDSGrid>
      </ThemeSection>

      <ThemeSection
        id="sitemap-transversal"
        kicker={t("sections.transversal.kicker")}
        title={t("sections.transversal.title")}
        lead={t("sections.transversal.lead")}
      >
        <SDSLinkList
          items={sitemapTransversalLinks.map((link) => ({
            label: t(`sections.transversal.links.${link.key}`),
            href: link.href,
          }))}
        />
      </ThemeSection>
    </>
  );
}
