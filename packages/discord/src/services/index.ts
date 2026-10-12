import type { BotConfig, BotServices } from "../types/index.js";
import type { Logger } from "../utils/logger.js";
import { createLogger } from "../utils/logger.js";
import { GitHubIntegration } from "../integrations/github/index.js";
import { NotployIntegration } from "../integrations/notploy/index.js";
import { CommunityService } from "./community.js";
import { NotificationService } from "./notifications.js";
import { RoleService } from "./roles.js";
import type { Client } from "discord.js";

/**
 * Builds the service container injected into commands and events.
 *
 * This is the single place where concrete integrations are wired together,
 * which keeps command handling decoupled from their implementations.
 */
export function createServices(
	config: BotConfig,
	client: Client,
	logger: Logger = createLogger("services"),
): BotServices {
	const github = new GitHubIntegration({
		repository: config.resources.githubRepository,
		token: process.env.GITHUB_TOKEN ?? null,
		logger,
	});

	const notploy = new NotployIntegration(config, logger);

	return {
		config,
		logger,
		community: new CommunityService(config),
		notploy,
		github,
		notifications: new NotificationService(client, config, github, logger),
		roles: new RoleService(client, config, logger),
	};
}
