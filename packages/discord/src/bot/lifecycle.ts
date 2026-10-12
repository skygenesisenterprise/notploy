import { Events } from "discord.js";
import type { BotConfig, BotServices } from "../types/index.js";
import { type Logger, createLogger } from "../utils/logger.js";
import { handleGuildMemberAdd } from "../events/guild-member-add.js";
import { handleInteractionCreate } from "../events/interaction-create.js";
import { handleReady } from "../events/ready.js";
import { createServices } from "../services/index.js";
import { type NotployClient, createClient } from "./client.js";

/**
 * Top-level bot orchestrator: owns the Discord client, the service container
 * and the process lifecycle (start / graceful shutdown).
 */
export class NotployBot {
	readonly client: NotployClient;
	readonly services: BotServices;
	private readonly logger: Logger;
	private stopReleaseWatcher: (() => void) | null = null;

	constructor(readonly config: BotConfig) {
		this.logger = createLogger("bot");
		this.client = createClient(config);
		this.services = createServices(config, this.client, this.logger);
		this.registerEventHandlers();
	}

	private registerEventHandlers(): void {
		this.client.once(Events.ClientReady, (client) => handleReady(client, this.services));
		this.client.on(Events.InteractionCreate, (interaction) => {
			void handleInteractionCreate(interaction, this.services, this.client.commands);
		});
		this.client.on(Events.GuildMemberAdd, (member) => {
			void handleGuildMemberAdd(member, this.services);
		});
	}

	/** Logs the bot in and starts background jobs. */
	async start(): Promise<NotployClient> {
		this.logger.info("Starting Notploy Community bot");
		this.stopReleaseWatcher = this.services.notifications.startReleaseWatcher();
		await this.client.login(this.config.discordToken);
		return this.client;
	}

	/** Stops background jobs and disconnects the client. */
	async stop(): Promise<void> {
		this.stopReleaseWatcher?.();
		this.stopReleaseWatcher = null;
		this.logger.info("Shutting down Notploy Community bot");
		await this.client.destroy();
	}
}
