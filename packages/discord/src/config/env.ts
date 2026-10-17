import type {
	BotConfig,
	CommunityResources,
	NotificationConfig,
	NotificationEventType,
	OnboardingConfig,
	NotployApiConfig,
} from "../types/index.js";
import { ConfigurationError } from "../utils/errors.js";

export const SUPPORTED_NOTIFICATION_EVENTS: readonly NotificationEventType[] = [
	"releases",
	"issues",
	"pullRequests",
	"discussions",
	"security",
];

const DEFAULT_RESOURCES: Omit<CommunityResources, "githubUrl"> = {
	website: "https://notploy.com",
	docs: "https://docs.notploy.com",
	status: "https://status.notploy.com",
	templates: "https://templates.notploy.com",
	cloud: "https://app.notploy.com",
	discordInvite: "https://discord.gg/GUkDugVh34",
	githubRepository: "skygenesisenterprise/notploy",
};

const CHANNEL_ENV_BY_EVENT: Record<NotificationEventType, string> = {
	releases: "DISCORD_RELEASES_CHANNEL_ID",
	issues: "DISCORD_ISSUES_CHANNEL_ID",
	pullRequests: "DISCORD_PULL_REQUESTS_CHANNEL_ID",
	discussions: "DISCORD_DISCUSSIONS_CHANNEL_ID",
	security: "DISCORD_SECURITY_CHANNEL_ID",
};

/** Returns the trimmed value, or `null` when empty/undefined. */
export function optional(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Reads an environment value falling back to a default. */
function withDefault(value: string | undefined, fallback: string): string {
	return optional(value) ?? fallback;
}

/** Resolves the official resource URLs, allowing env overrides. */
export function resolveResources(env: NodeJS.ProcessEnv): CommunityResources {
	const githubRepository = withDefault(
		env.GITHUB_REPOSITORY,
		DEFAULT_RESOURCES.githubRepository,
	);
	return {
		website: withDefault(env.NOTPLOY_WEBSITE_URL, DEFAULT_RESOURCES.website),
		docs: withDefault(env.NOTPLOY_DOCS_URL, DEFAULT_RESOURCES.docs),
		status: withDefault(env.NOTPLOY_STATUS_URL, DEFAULT_RESOURCES.status),
		templates: withDefault(env.NOTPLOY_TEMPLATES_URL, DEFAULT_RESOURCES.templates),
		cloud: withDefault(env.NOTPLOY_CLOUD_URL, DEFAULT_RESOURCES.cloud),
		discordInvite: withDefault(
			env.NOTPLOY_DISCORD_INVITE,
			DEFAULT_RESOURCES.discordInvite,
		),
		githubRepository,
		githubUrl: `https://github.com/${githubRepository}`,
	};
}

/** Resolves onboarding settings from the environment. */
export function resolveOnboarding(env: NodeJS.ProcessEnv): OnboardingConfig {
	return {
		welcomeChannelId: optional(env.DISCORD_WELCOME_CHANNEL_ID),
		memberRoleId: optional(env.DISCORD_MEMBER_ROLE_ID),
	};
}

/** Resolves the optional read-only Notploy API credentials. */
export function resolveNotployApi(env: NodeJS.ProcessEnv): NotployApiConfig {
	return {
		baseUrl: optional(env.NOTPLOY_URL),
		apiKey: optional(env.NOTPLOY_API_KEY),
	};
}

/**
 * Resolves GitHub → Discord notification routing.
 *
 * When `DISCORD_NOTIFICATION_EVENTS` is unset, every event that has a channel
 * configured is enabled. When it is set, only the listed (and supported)
 * events are enabled.
 */
export function resolveNotifications(env: NodeJS.ProcessEnv): NotificationConfig {
	const configuredChannels = {} as NotificationConfig["channels"];
	for (const event of SUPPORTED_NOTIFICATION_EVENTS) {
		const channel = optional(env[CHANNEL_ENV_BY_EVENT[event]]);
		if (channel) configuredChannels[event] = channel;
	}

	const explicit = optional(env.DISCORD_NOTIFICATION_EVENTS);
	const enabledEvents =
		explicit === null
			? SUPPORTED_NOTIFICATION_EVENTS.filter((event) => event in configuredChannels)
			: explicit
					.split(",")
					.map((value) => value.trim())
					.filter((value): value is NotificationEventType =>
						SUPPORTED_NOTIFICATION_EVENTS.includes(value as NotificationEventType),
					);

	return { enabledEvents: [...new Set(enabledEvents)], channels: configuredChannels };
}

/**
 * Loads and validates the bot configuration.
 *
 * @throws {ConfigurationError} when a required variable is missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
	const discordToken = optional(env.DISCORD_TOKEN);
	if (!discordToken) {
		throw new ConfigurationError("DISCORD_TOKEN environment variable is required");
	}

	const clientId = optional(env.DISCORD_CLIENT_ID);
	if (!clientId) {
		throw new ConfigurationError("DISCORD_CLIENT_ID environment variable is required");
	}

	return {
		discordToken,
		clientId,
		guildId: optional(env.DISCORD_GUILD_ID),
		resources: resolveResources(env),
		onboarding: resolveOnboarding(env),
		notifications: resolveNotifications(env),
		notployApi: resolveNotployApi(env),
	};
}
