/**
 * Absolute URL helpers for metadata.
 *
 * The static export cannot render a per-slug PNG at request time, so on Pages
 * every page points at the single card in `public/og.png`. Under the Node
 * deployment (web/Dockerfile.website) the dynamic /api/og route is used and
 * still takes a slug/template query parameter.
 *
 * NEXT_BASE_PATH is set by actions/configure-pages when Pages is served from
 * https://<org>.github.io/<repo>/ rather than a custom domain root.
 */
const isStaticExport = process.env.NEXT_OUTPUT === "export";

const basePath = process.env.NEXT_BASE_PATH ?? "";

function siteOrigin(): string {
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return process.env.NEXT_PUBLIC_APP_URL;
	}

	if (isStaticExport) {
		return `https://${process.env.NEXT_PAGES_ORIGIN ?? "notploy.github.io"}`;
	}

	return process.env.NODE_ENV === "production"
		? "https://notploy.com"
		: "http://localhost:3001";
}

export const SITE_URL = siteOrigin();

/** Absolute URL for a static asset, honouring the Pages base path. */
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
