import { EmbedBuilder } from "discord.js";
import type { LinkEntry } from "../types/index.js";

/** Notploy brand palette (mirrors the web control plane accent). */
export const COLORS = {
	brand: 0x3b82f6,
	success: 0x22c55e,
	warning: 0xf59e0b,
	danger: 0xef4444,
	neutral: 0x64748b,
} as const;

export const EMBED_FOOTER = "Notploy Community";

/** Base Notploy-branded embed with a consistent footer and timestamp. */
export function baseEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.brand)
		.setFooter({ text: EMBED_FOOTER })
		.setTimestamp(new Date());
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
	const embed = baseEmbed().setTitle(title);
	if (description) embed.setDescription(description);
	return embed;
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
	const embed = infoEmbed(title, description).setColor(COLORS.success);
	return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
	const embed = infoEmbed(title, description).setColor(COLORS.warning);
	return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
	const embed = infoEmbed(title, description).setColor(COLORS.danger);
	return embed;
}

/** Renders link entries as `[label](url) — description` lines. */
export function formatLinks(links: LinkEntry[]): string {
	return links.map((link) => `• **[${link.label}](${link.url})** — ${link.description}`).join("\n");
}

/** Builds a branded embed listing official resources. */
export function linksEmbed(title: string, links: LinkEntry[]): EmbedBuilder {
	return infoEmbed(title, formatLinks(links));
}
