"use client";

import * as React from "react";
import { Header } from "@skygenesisenterprise/react-sds/Header";
import { SkipLinks } from "@skygenesisenterprise/react-sds/SkipLinks";
import type { HeaderProps } from "@skygenesisenterprise/react-sds/Header";
import type { MainNavigationProps } from "@skygenesisenterprise/react-sds/MainNavigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { headerActions, pageAnchors, primaryNavigation } from "@/lib/site-structure";

/** Whether the current pathname corresponds to a navigation href. */
const isNavItemActive = (href: string, pathname: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Header of the Notploy website.
 *
 * It follows the display convention shared by the Sky Genesis Enterprise
 * portals, built on the SDS `Header` shell, which arranges three zones on a
 * single row:
 *
 *     ┌────────────┬──────────────────────┬────────────────┐
 *     │   logo     │      navigation      │  Se connecter  │
 *     └────────────┴──────────────────────┴────────────────┘
 *
 *  - **Logo** — the brand zone holds the logotype alone. It already carries the
 *    product name, so no `serviceTitle`/`serviceTagline` block is rendered next
 *    to it and the `identity.institution` slot stays empty: nothing is
 *    displayed twice. The light-background variant is used because the website
 *    forces the light colour scheme.
 *  - **Navigation** — the product structure of the platform (Platform,
 *    Developers, Cloud, Self-hosted, Security) plus the external documentation,
 *    driven by `primaryNavigation` (`lib/site-structure.ts`) and labelled from
 *    `nav.primary`. The header contains no hard-coded label or destination.
 *  - **Se connecter** — the single transversal action of `headerActions`,
 *    rendered to the right, separately from the navigation: the way into the
 *    hosted application. The language selector is deliberately absent from the
 *    header; it lives in the footer bottom bar, next to the secondary links.
 *
 * Below the `lg` breakpoint the navigation and the action collapse into a panel
 * opened by the SDS menu button; the behaviour comes from the SDS runtime
 * (`StartDsfrOnHydration`), not from this component. There is no search field:
 * the website has no search index of its own, and documentation search lives on
 * docs.notploy.com.
 */
export function SiteHeader() {
  const t = useTranslations();
  const tNav = useTranslations("nav.primary");
  const tBrand = useTranslations("brand");
  const pathname = usePathname();

  const navigationItems: MainNavigationProps.Item[] = primaryNavigation.map((item) => ({
    isActive: !item.external && isNavItemActive(item.href, pathname),
    text: tNav(item.key),
    linkProps: item.external
      ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
      : { href: item.href },
  }));

  const quickAccessItems: HeaderProps["quickAccessItems"] = [
    {
      iconId: "fr-icon-account-circle-line",
      text: t(`header.${headerActions.signIn.labelKey}`),
      linkProps: {
        href: headerActions.signIn.href,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    },
  ];

  return (
    <>
      <SkipLinks
        links={[
          { label: t("common.skipToContent"), anchor: `#${pageAnchors.content}` },
          { label: t("common.skipToFooter"), anchor: `#${pageAnchors.footer}` },
        ]}
      />
      <Header
        className="gov-header"
        identity={{
          imgUrl: "/icon-light.svg",
          alt: tBrand("name"),
          // The logotype carries the product name: no institution line is
          // rendered under it. SDS requires the field, hence the empty string.
          institution: "",
        }}
        homeLinkProps={{
          href: "/",
          title: t("header.homeTitle"),
        }}
        navigation={navigationItems}
        quickAccessItems={quickAccessItems}
      />
    </>
  );
}
