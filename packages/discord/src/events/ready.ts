import { ActivityType, type Client } from "discord.js";
import type { BotServices } from "../types/index.js";

/** Runs once when the gateway connection is ready. */
export function handleReady(client: Client<true>, services: BotServices): void {
	const { logger, config } = services;

	logger.info("Bot connected", {
		user: client.user.tag,
		guilds: client.guilds.cache.size,
	});

	client.user.setActivity({ name: "Notploy | /help", type: ActivityType.Watching });

	logger.info("Community resources loaded", {
		repository: config.resources.githubRepository,
		docs: config.resources.docs,
		releaseNotifications: config.notifications.enabledEvents,
	});
}
