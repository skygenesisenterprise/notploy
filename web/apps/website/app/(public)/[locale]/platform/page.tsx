import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { platformContent } from "@/lib/content/product/platform-content";
import { localizeArticle } from "@/lib/theme-localize";
import { ThemeArticle } from "@/components/public/content/theme-page";

const PAGE_PATH = "/platform";
const PAGE_NAMESPACE = "pages.product.platform";

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
 * Platform page (`/platform`): what Notploy deploys and operates — applications
 * and build strategies, Docker Compose projects, databases, routing and
 * certificates, monitoring, and the servers the workloads run on.
 *
 * Content is fully driven by the message catalogs (`pages.product.platform.*`
 * and `pages.product.related.*`) through `lib/theme-localize.ts`.
 */
export default async function PlatformPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });
  const tRelated = await getTranslations({ locale, namespace: "pages.product.related" });

  return (
    <ThemeArticle
      content={localizeArticle(platformContent, t, tRelated)}
      currentHref={PAGE_PATH}
    />
  );
}
