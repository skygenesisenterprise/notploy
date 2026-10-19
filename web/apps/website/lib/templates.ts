export const TEMPLATES_BASE_URL = "https://templates.notploy.com";

export interface TemplateLinks {
	github?: string;
	website?: string;
	docs?: string;
}

export interface Template {
	id: string;
	name: string;
	version: string;
	description: string;
	logo: string;
	links: TemplateLinks;
	tags: string[];
}

export interface TemplateFiles {
	dockerCompose: string | null;
	templateToml: string | null;
	instructions: string | null;
}

// Set by scripts/build-static.mjs for the static export, where the blueprint
// assets are copied into `public/blueprints`. It is a NEXT_PUBLIC_ variable so
// the server bundle and the client bundle resolve the exact same URL and the
// hydrated markup matches what was prerendered. Server builds leave it unset
// and keep pointing at the templates host.
const TEMPLATE_ASSET_BASE = process.env.NEXT_PUBLIC_TEMPLATE_ASSET_BASE;

export function getTemplateLogoUrl(template: Template): string {
	const base = TEMPLATE_ASSET_BASE ?? `${TEMPLATES_BASE_URL}/blueprints`;
	return `${base}/${template.id}/${template.logo}`;
}

// Same payload format the Notploy UI expects for Compose → Advanced → Base64 import
export function templateToBase64(
	dockerCompose: string | null,
	config: string | null,
): string {
	const jsonString = JSON.stringify(
		{ compose: dockerCompose ?? "", config: config ?? "" },
		null,
		2,
	);
	return Buffer.from(jsonString, "utf-8").toString("base64");
}

export function getRelatedTemplates(
	template: Template,
	allTemplates: Template[],
	limit = 6,
): Template[] {
	return allTemplates
		.filter((candidate) => candidate.id !== template.id)
		.map((candidate) => ({
			candidate,
			shared: candidate.tags.filter((tag) => template.tags.includes(tag))
				.length,
		}))
		.filter(({ shared }) => shared > 0)
		.sort(
			(a, b) =>
				b.shared - a.shared || a.candidate.name.localeCompare(b.candidate.name),
		)
		.slice(0, limit)
		.map(({ candidate }) => candidate);
}

export function getTopTags(templates: Template[], limit = 30): string[] {
	const counts = new Map<string, number>();
	for (const template of templates) {
		for (const tag of template.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([tag]) => tag);
}
