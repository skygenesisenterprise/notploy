import { type Collection, type Interaction, MessageFlags } from "discord.js";
import type { BotServices, Command } from "../types/index.js";
import { errorEmbed } from "../utils/embeds.js";
import { toErrorMessage } from "../utils/errors.js";

/**
 * Thin dispatcher for chat input commands.
 *
 * It resolves the command from the registry, delegates to its `execute` and
 * guarantees that a failure always produces a user-facing ephemeral error
 * instead of an unhandled rejection.
 */
export async function handleInteractionCreate(
	interaction: Interaction,
	services: BotServices,
	commands: Collection<string, Command>,
): Promise<void> {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);
	if (!command) {
		await interaction
			.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral })
			.catch(() => undefined);
		return;
	}

	try {
		await command.execute(interaction, services);
	} catch (error) {
		services.logger.error("Command execution failed", {
			command: interaction.commandName,
			user: interaction.user.id,
			error: toErrorMessage(error),
		});

		const payload = {
			embeds: [errorEmbed("Command failed", "Something went wrong while running this command.")],
			flags: MessageFlags.Ephemeral as const,
		};

		try {
			if (interaction.deferred || interaction.replied) {
				await interaction.followUp(payload);
			} else {
				await interaction.reply(payload);
			}
		} catch {
			// The interaction may have expired; nothing else we can do.
		}
	}
}
