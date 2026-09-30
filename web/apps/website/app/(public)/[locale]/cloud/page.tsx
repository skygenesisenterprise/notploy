import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { cloudContent } from "@/lib/content/product/cloud-content";
import { localizeArticle } from "@/lib/theme-localize";
import { ThemeArticle } from "@/components/public/content/theme-page";

const PAGE_PATH = "/cloud";
const PAGE_NAMESPACE = "pages.product.cloud";

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
 * Cloud page (`/cloud`): the hosted Notploy offering, reachable at
 * `app.notploy.com`, and how it relates to a self-hosted installation.
 *
 * Content is fully driven by the message catalogs (`pages.product.cloud.*` and
 * `pages.product.related.*`) through `lib/theme-localize.ts`.
 */
export default async function CloudPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });
  const tRelated = await getTranslations({ locale, namespace: "pages.product.related" });

  return (
    <ThemeArticle content={localizeArticle(cloudContent, t, tRelated)} currentHref={PAGE_PATH} />
  );
}
