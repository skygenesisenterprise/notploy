import { Client, Collection } from "discord.js";
import type { BotConfig, Command } from "../types/index.js";
import { createCommands } from "../commands/index.js";
import { createIntents } from "./intents.js";

/**
 * Discord client specialized for the Notploy community bot.
 *
 * The command registry lives on the client so the interaction handler stays a
 * thin dispatcher.
 */
export class NotployClient extends Client {
	readonly commands: Collection<string, Command>;

	constructor(readonly config: BotConfig) {
		super({ intents: createIntents(config) });
		this.commands = createCommands();
	}
}

export function createClient(config: BotConfig): NotployClient {
	return new NotployClient(config);
}
