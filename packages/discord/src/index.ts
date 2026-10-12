/**
 * Public surface of `@notploy/discord`.
 *
 * The package is primarily an official deployed integration, but exposing the
 * building blocks makes it testable and keeps command registration scripts and
 * future tooling on a stable API.
 */
export {
	loadConfig,
	optional,
	resolveNotifications,
	resolveOnboarding,
	resolveNotployApi,
	resolveResources,
	SUPPORTED_NOTIFICATION_EVENTS,
} from "./config/env.js";
export { NotployClient, createClient } from "./bot/client.js";
export { NotployBot } from "./bot/lifecycle.js";
export { createIntents } from "./bot/intents.js";
export { createCommands, baseCommands, serializeCommands } from "./commands/index.js";
export { createServices } from "./services/index.js";
export { CommunityService } from "./services/community.js";
export { NotificationService } from "./services/notifications.js";
export { RoleService } from "./services/roles.js";
export { NotployIntegration, extractVersion } from "./integrations/notploy/index.js";
export { GitHubIntegration } from "./integrations/github/index.js";
export {
	type GitHubEvent,
	buildGitHubNotificationEmbed,
	eventType,
	truncate,
} from "./integrations/github/events.js";
export {
	COLORS,
	baseEmbed,
	infoEmbed,
	successEmbed,
	warningEmbed,
	errorEmbed,
	linksEmbed,
	formatLinks,
} from "./utils/embeds.js";
export { createLogger } from "./utils/logger.js";
export type { Logger, LogLevel } from "./utils/logger.js";
export { ConfigurationError, CommandError, toErrorMessage } from "./utils/errors.js";
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
