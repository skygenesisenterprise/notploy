/**
 * Product the instance runs as, as seen by the UI. Mirrors the server's
 * `NotployProduct` without importing the server barrel (which is server-only).
 */
export type AppProduct = "self" | "cloud" | "console";

/**
 * Branded names for the three Notploy environments:
 *   self    → "Notploy"
 *   cloud   → "Notploy Cloud"
 *   console → "Notploy Console"
 */
export const PRODUCT_BRAND_NAMES: Record<AppProduct, string> = {
	self: "Notploy",
	cloud: "Notploy Cloud",
	console: "Notploy Console",
};

/** Brand name of a product; falls back to self-hosted while loading/unknown. */
export const productBrandName = (
	product: AppProduct | null | undefined,
): string =>
	(product ? PRODUCT_BRAND_NAMES[product] : undefined) ??
	PRODUCT_BRAND_NAMES.self;

/**
 * Environment a client surface must compose itself for.
 *
 * Cloud and Console both report `isCloud`, so only the product tells the two
 * operator surfaces apart. While the product is still loading, `isCloud` keeps
 * a cloud/console instance from flashing the self-hosted composition before
 * settling. Single source of truth shared by the sidebar, the page titles and
 * the homepage so the three can never drift apart.
 */
export const resolveAppEnvironment = ({
	product,
	isCloud,
}: {
	product: AppProduct | null | undefined;
	isCloud: boolean | undefined;
}): AppProduct => {
	if (product === "console") return "console";
	if (product === "cloud" || (product === undefined && isCloud)) return "cloud";
	return "self";
};
