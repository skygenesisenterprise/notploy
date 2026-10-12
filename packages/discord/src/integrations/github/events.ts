import { EmbedBuilder } from "discord.js";
import { COLORS, baseEmbed } from "../../utils/embeds.js";
import type { NotificationEventType } from "../../types/index.js";
import type { GitHubRelease } from "./index.js";

export interface ReleaseEvent {
	type: "releases";
	release: GitHubRelease;
}

export interface IssueEvent {
	type: "issues";
	action: "opened" | "closed" | "reopened";
	number: number;
	title: string;
	url: string;
	author?: string;
}

export interface PullRequestEvent {
	type: "pullRequests";
	action: "opened" | "closed" | "merged" | "reopened";
	number: number;
	title: string;
	url: string;
	author?: string;
	draft?: boolean;
}

export interface DiscussionEvent {
	type: "discussions";
	action: "created" | "answered";
	title: string;
	url: string;
	author?: string;
}

export interface SecurityEvent {
	type: "security";
	title: string;
	url: string;
	severity?: "low" | "moderate" | "high" | "critical";
}

/**
 * Normalized GitHub events the bot is allowed to announce. Events never carry
 * sensitive information; security announcements are intentionally generic.
 */
export type GitHubEvent =
	| ReleaseEvent
	| IssueEvent
	| PullRequestEvent
	| DiscussionEvent
	| SecurityEvent;

const MAX_DESCRIPTION = 3500;

/** Truncates long text to a safe embed length. */
export function truncate(text: string, max = MAX_DESCRIPTION): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}

const ACTION_LABEL: Record<string, string> = {
	opened: "opened",
	closed: "closed",
	reopened: "reopened",
	merged: "merged",
	created: "created",
	answered: "answered",
};

/**
 * Maps a normalized GitHub event to a branded Discord embed.
 *
 * Pure function: no Discord client, no network. Safe to unit test.
 */
export function buildGitHubNotificationEmbed(event: GitHubEvent): EmbedBuilder {
	switch (event.type) {
		case "releases": {
			const { release } = event;
			const embed = baseEmbed()
				.setColor(release.prerelease ? COLORS.warning : COLORS.success)
				.setTitle(`New release: ${release.name}`)
				.setURL(release.url)
				.setDescription(truncate(release.body?.trim() || "See the release notes on GitHub."));
			if (release.publishedAt) embed.setTimestamp(new Date(release.publishedAt));
			return embed;
		}
		case "issues": {
			return baseEmbed()
				.setColor(COLORS.brand)
				.setTitle(`Issue ${ACTION_LABEL[event.action] ?? event.action}: #${event.number}`)
				.setURL(event.url)
				.setDescription(truncate(event.title))
				.addFields({
					name: "Author",
					value: event.author ? `@${event.author}` : "unknown",
					inline: true,
				});
		}
		case "pullRequests": {
			const embed = baseEmbed()
				.setColor(event.action === "merged" ? COLORS.success : COLORS.brand)
				.setTitle(
					`Pull request ${ACTION_LABEL[event.action] ?? event.action}: #${event.number}`,
				)
				.setURL(event.url)
				.setDescription(truncate(event.title))
				.addFields({
					name: "Author",
					value: event.author ? `@${event.author}` : "unknown",
					inline: true,
				});
			if (event.draft) embed.addFields({ name: "Draft", value: "yes", inline: true });
			return embed;
		}
		case "discussions": {
			return baseEmbed()
				.setColor(COLORS.brand)
				.setTitle(`Discussion ${ACTION_LABEL[event.action] ?? event.action}`)
				.setURL(event.url)
				.setDescription(truncate(event.title))
				.addFields({
					name: "Author",
					value: event.author ? `@${event.author}` : "unknown",
					inline: true,
				});
		}
		case "security": {
			const embed = baseEmbed()
				.setColor(COLORS.danger)
				.setTitle(`Security announcement: ${event.title}`)
				.setURL(event.url)
				.setDescription(
					"Please review the official advisory. Never disclose sensitive details publicly.",
				);
			if (event.severity) {
				embed.addFields({ name: "Severity", value: event.severity, inline: true });
			}
			return embed;
		}
	}
}

/** Event type carried by a normalized GitHub event. */
export function eventType(event: GitHubEvent): NotificationEventType {
	return event.type;
}
