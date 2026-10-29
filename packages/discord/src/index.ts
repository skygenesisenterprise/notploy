/**
 * Public surface of `@notploy/discord`.
 *
 * The package is primarily an official deployed integration, but exposing the
 * building blocks makes it testable and keeps command registration scripts and
 * future tooling on a stable API.
 */

export { createClient, NotployClient } from "./bot/client.js";
export { createIntents } from "./bot/intents.js";
export { NotployBot } from "./bot/lifecycle.js";
export { baseCommands, createCommands, serializeCommands } from "./commands/index.js";
export {
	loadConfig,
	optional,
	resolveNotifications,
	resolveNotployApi,
	resolveOnboarding,
	resolveResources,
	SUPPORTED_NOTIFICATION_EVENTS,
} from "./config/env.js";
export {
	buildGitHubNotificationEmbed,
	eventType,
	type GitHubEvent,
	truncate,
} from "./integrations/github/events.js";
export { GitHubIntegration } from "./integrations/github/index.js";
export { extractVersion, NotployIntegration } from "./integrations/notploy/index.js";
export { CommunityService } from "./services/community.js";
export { createServices } from "./services/index.js";
export { NotificationService } from "./services/notifications.js";
export { RoleService } from "./services/roles.js";
export type {
	BotConfig,
	BotServices,
	Command,
	CommunityResources,
	LinkEntry,
	NotificationConfig,
	NotificationEventType,
	NotployApiConfig,
	OnboardingConfig,
} from "./types/index.js";
export {
	baseEmbed,
	COLORS,
	errorEmbed,
	formatLinks,
	infoEmbed,
	linksEmbed,
	successEmbed,
	warningEmbed,
} from "./utils/embeds.js";
export { CommandError, ConfigurationError, toErrorMessage } from "./utils/errors.js";
export type { Logger, LogLevel } from "./utils/logger.js";
export { createLogger } from "./utils/logger.js";
