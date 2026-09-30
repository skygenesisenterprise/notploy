import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { SDSMain, SDSPage } from "@skygenesisenterprise/react-sds/sds";
import { routing, type Locale } from "@/i18n/routing";
import { SITE, pageAnchors } from "@/lib/site-structure";
import { SdsProvider } from "@/components/public/sds/sds-provider";
import { SiteHeader } from "@/components/public/header/site-header";
import { SiteFooter } from "@/components/public/footer/site-footer";
import { BackToTopButton } from "@/components/common/back-to-top-button";
import { PopUp } from "@/components/common/pop-up";

// The official SDS stylesheet: design tokens (`--sds-*`), reset, base,
// typography, themes, accessibility, the `gov-*` layout primitives and the
// `sds-*` component styles. Imported once at the root of the public website so
// every route inherits the same foundation — the website no longer maintains a
// global stylesheet of its own.
import "@skygenesisenterprise/react-sds/main.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale;

  const tMeta = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: tMeta("defaultTitle"),
      template: `%s | ${tMeta("suffix")}`,
    },
    description: tMeta("description"),
    applicationName: SITE.name,
    authors: [{ name: SITE.company }],
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: "/icon.svg",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;

  if (!routing.locales.includes(localeParam as Locale)) {
    return null;
  }

  const locale = localeParam as Locale;
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="select-none">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SdsProvider lang={locale}>
            {/* SDS page shell — a full-height flex column that pins the footer
                to the bottom, wrapping the semantic <main> landmark. */}
            <SDSPage>
              <SiteHeader />
              <SDSMain id={pageAnchors.content}>{children}</SDSMain>
              <SiteFooter />
              <BackToTopButton />
              <PopUp />
            </SDSPage>
          </SdsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
