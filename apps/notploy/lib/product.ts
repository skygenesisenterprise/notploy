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
