import { productPaths } from "@/lib/site-structure";

/**
 * Cross-links between the product pages of the website, shared by every product
 * page and rendered at the bottom of each one by `ThemeArticle`.
 *
 * This module centralises the *structure* of that navigation (keys and hrefs) —
 * not its editorial content, which stays in the message catalogs
 * (`pages.product.related.<key>.*`) and is resolved by `lib/theme-localize.ts`.
 */
const productPages = [
  { key: "platform", href: productPaths.platform },
  { key: "developers", href: productPaths.developers },
  { key: "cloud", href: productPaths.cloud },
  { key: "selfHosted", href: productPaths.selfHosted },
  { key: "security", href: productPaths.security },
] as const;

export type ProductRelatedLink = (typeof productPages)[number];

/** The product pages of the website, as cross-links. */
export function productRelatedDestinations(): ReadonlyArray<ProductRelatedLink> {
  return productPages;
}
