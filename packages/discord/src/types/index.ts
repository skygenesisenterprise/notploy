import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { NotployIntegration } from "../integrations/notploy/index.js";
import type { GitHubIntegration } from "../integrations/github/index.js";
import type { CommunityService } from "../services/community.js";
import type { NotificationService } from "../services/notifications.js";
import type { RoleService } from "../services/roles.js";
import type { Logger } from "../utils/logger.js";

/**
 * Fully resolved bot configuration. Always created through {@link loadConfig}
 * so that defaults, validation and coercion live in a single place.
 */
export interface BotConfig {
	discordToken: string;
	clientId: string;
	/** When set, slash commands are registered to this guild only. */
	guildId: string | null;
	resources: CommunityResources;
	onboarding: OnboardingConfig;
	notifications: NotificationConfig;
	notployApi: NotployApiConfig;
}

/** Official Notploy resources surfaced by the community commands. */
export interface CommunityResources {
	website: string;
	docs: string;
	status: string;
	templates: string;
	cloud: string;
	discordInvite: string;
	githubRepository: string;
	githubUrl: string;
}

/** A labelled official resource surfaced in embeds. */
export interface LinkEntry {
	label: string;
	url: string;
	description: string;
}

/** Automatic onboarding applied when a member joins the guild. */
export interface OnboardingConfig {
	welcomeChannelId: string | null;
	memberRoleId: string | null;
}

export type NotificationEventType =
	| "releases"
	| "issues"
	| "pullRequests"
	| "discussions"
	| "security";

/** Configurable GitHub → Discord announcement routing. */
export interface NotificationConfig {
	enabledEvents: NotificationEventType[];
	channels: Partial<Record<NotificationEventType, string>>;
}

/** Optional read-only Notploy API access performed through `@notploy/sdk`. */
export interface NotployApiConfig {
	baseUrl: string | null;
	apiKey: string | null;
}

/**
 * Services container injected into commands, events and integrations.
 *
 * Discord command handlers only ever receive this container, which keeps
 * command handling isolated from the concrete service and integration
 * implementations (and from internal Notploy server/database details).
 */
export interface BotServices {
	config: BotConfig;
	logger: Logger;
	community: CommunityService;
	notploy: NotployIntegration;
	github: GitHubIntegration;
	notifications: NotificationService;
	roles: RoleService;
}

/** A registered slash command. */
export interface Command {
	data: SlashCommandBuilder;
	execute(interaction: ChatInputCommandInteraction, services: BotServices): Promise<void>;
	/** Hidden commands are still executable but omitted from `/help`. */
	hidden?: boolean;
}
