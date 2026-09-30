import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { selfHostedContent } from "@/lib/content/product/self-hosted-content";
import { localizeArticle } from "@/lib/theme-localize";
import { ThemeArticle } from "@/components/public/content/theme-page";

const PAGE_PATH = "/self-hosted";
const PAGE_NAMESPACE = "pages.product.selfHosted";

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
 * Self-hosted page (`/self-hosted`): the requirements, the Docker Compose
 * installation and the operating commands of a Notploy install you run yourself.
 *
 * Content is fully driven by the message catalogs
 * (`pages.product.selfHosted.*` and `pages.product.related.*`) through
 * `lib/theme-localize.ts`.
 */
export default async function SelfHostedPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });
  const tRelated = await getTranslations({ locale, namespace: "pages.product.related" });

  return (
    <ThemeArticle
      content={localizeArticle(selfHostedContent, t, tRelated)}
      currentHref={PAGE_PATH}
    />
  );
}
