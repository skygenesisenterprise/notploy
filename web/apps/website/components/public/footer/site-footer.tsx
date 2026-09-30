"use client";

import { Footer } from "@skygenesisenterprise/react-sds/Footer";
import type { FooterProps } from "@skygenesisenterprise/react-sds/Footer";
import { useTranslations } from "next-intl";
import { Community } from "@/components/public/content/community";
import { LocaleSwitcher } from "@/components/public/locale-switcher";
import {
  SITE,
  footerBottomLinks,
  footerNavigation,
  legalPaths,
  pageAnchors,
} from "@/lib/site-structure";

/**
 * Footer of the Notploy website — the secondary navigation zone, distinct from
 * the product navigation of the header.
 *
 * It follows the display convention shared by the Sky Genesis Enterprise
 * portals:
 *  - the community band (`Community`) is rendered *above* the footer, so it
 *    belongs to the secondary zone of every page and never competes with the
 *    product pages;
 *  - the SDS `Footer` renders the brand block, the link columns, the bottom bar
 *    and the licence line, and provides the responsive behaviour;
 *  - the link columns come from `footerNavigation` and the labels from the
 *    message catalogs (`footer.*`), so the footer contains no hard-coded
 *    destination and adding an entry only means editing `lib/site-structure.ts`;
 *  - the language selector, kept out of the header, sits in the bottom bar next
 *    to the secondary links.
 *
 * The SDS column type is a fixed-length tuple; the config-driven array is cast
 * to it here (the same pattern as the other portals), so the design system
 * keeps enforcing its own column/row limits.
 */
export function SiteFooter() {
  const t = useTranslations();
  const tBrand = useTranslations("brand");
  const tColumns = useTranslations("footer.columns");
  const tLinks = useTranslations("footer.links");

  const columns = footerNavigation.map((column) => ({
    categoryName: tColumns(column.key),
    links: column.links.map((link) => ({
      text: tLinks(link.key),
      linkProps: link.external
        ? { href: link.href, target: "_blank", rel: "noopener noreferrer" }
        : { href: link.href },
    })),
  })) as unknown as FooterProps.LinkList.List;

  return (
    <>
      <Community />
      <Footer
        id={pageAnchors.footer}
        className="gov-footer"
        accessibility="partially compliant"
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
        contentDescription={t("footer.contentDescription")}
        linkList={columns}
        linkListTitle={t("footer.columnsTitle")}
        websiteMapLinkProps={{ href: legalPaths.sitemap }}
        accessibilityLinkProps={{ href: legalPaths.accessibility }}
        termsLinkProps={{ href: legalPaths.terms }}
        bottomItems={[
          ...footerBottomLinks.map((link) => ({
            text: t(`footer.bottom.${link.key}`),
            linkProps: { href: link.href },
          })),
          // Language selector — an action, not a link of the information
          // architecture, hence a node rather than a `BottomItem`.
          <LocaleSwitcher key="locale" />,
        ]}
        license={t.rich("footer.license", {
          link: (chunks) => (
            <a href={SITE.repository} target="_blank" rel="noopener noreferrer">
              {chunks}
            </a>
          ),
        })}
      />
    </>
  );
}
