import { REST, Routes } from "discord.js";
import { createCommands, serializeCommands } from "../src/commands/index.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/utils/logger.js";

/**
 * Registers the bot's slash commands with Discord.
 *
 * When `DISCORD_GUILD_ID` is set the commands are registered to that guild
 * only (instant). Otherwise they are registered globally, which can take up
 * to about an hour to propagate.
 *
 * Usage: `pnpm commands:register`
 */
async function main(): Promise<void> {
	const logger = createLogger("register-commands");
	const config = loadConfig();
	const body = serializeCommands(createCommands().values());

	const rest = new REST({ version: "10" }).setToken(config.discordToken);
	const route = config.guildId
		? Routes.applicationGuildCommands(config.clientId, config.guildId)
		: Routes.applicationCommands(config.clientId);

	logger.info("Registering slash commands", {
		count: body.length,
		scope: config.guildId ? `guild:${config.guildId}` : "global",
	});

	const data = (await rest.put(route, { body })) as unknown[];

	logger.info("Slash commands registered", { count: data.length });
}

main().catch((error: unknown) => {
	console.error(
		JSON.stringify({
			level: "error",
			message: "Failed to register slash commands",
			error: error instanceof Error ? error.message : String(error),
		}),
	);
	process.exit(1);
});
