import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { developersContent } from "@/lib/content/product/developers-content";
import { localizeArticle } from "@/lib/theme-localize";
import { ThemeArticle } from "@/components/public/content/theme-page";

const PAGE_PATH = "/developers";
const PAGE_NAMESPACE = "pages.product.developers";

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
 * Developers page (`/developers`): every way to automate and integrate with
 * Notploy — the REST API, the TypeScript SDK, the CLI, the MCP server, the
 * GitHub Actions and the editor and desktop clients.
 *
 * Content is fully driven by the message catalogs (`pages.product.developers.*`
 * and `pages.product.related.*`) through `lib/theme-localize.ts`.
 */
export default async function DevelopersPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: PAGE_NAMESPACE });
  const tRelated = await getTranslations({ locale, namespace: "pages.product.related" });

  return (
    <ThemeArticle
      content={localizeArticle(developersContent, t, tRelated)}
      currentHref={PAGE_PATH}
    />
  );
}
