/**
 * Absolute URL helpers for metadata.
 *
 * A static export cannot render a per-slug PNG at request time, so every page
 * points at the single card in `public/og.png`. Under the Node deployment
 * (web/Dockerfile.website) the dynamic /api/og route renders per-page images.
 */
const isStaticExport = process.env.NEXT_OUTPUT === "export";

const basePath = process.env.NEXT_BASE_PATH ?? "";

function siteOrigin(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}

	return process.env.NODE_ENV === "production"
		? "https://notploy.com"
		: "http://localhost:3001";
}

export const SITE_URL = siteOrigin();

/** Absolute URL for a static asset, honouring the configured base path. */
export function assetUrl(path: string): string {
	return new URL(`${basePath}${path}`, SITE_URL).toString();
}

export interface OgImageParams {
	slug?: string;
	template?: string;
}

/** Absolute URL of the Open Graph card for a page. */
export function ogImageUrl(params: OgImageParams = {}): string {
	if (isStaticExport) {
		return assetUrl("/og.png");
	}

	const url = new URL("/api/og", siteOrigin());

	if (params.slug) {
		url.searchParams.set("slug", params.slug);
	}

	if (params.template) {
		url.searchParams.set("template", params.template);
	}

	return url.toString();
}
