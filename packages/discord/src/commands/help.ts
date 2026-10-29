import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { baseEmbed } from "../utils/embeds.js";

/**
 * Builds the `/help` command around the live command registry so new commands
 * are documented automatically.
 */
export function createHelpCommand(commands: Command[]): Command {
	return {
		data: new SlashCommandBuilder()
			.setName("help")
			.setDescription("List the available Notploy community bot commands"),

		async execute(interaction, { config }) {
			const lines = commands
				.filter((command) => !command.hidden)
				.map((command) => {
					const json = command.data.toJSON();
					return `• **/${json.name}** — ${json.description}`;
				});

			const embed = baseEmbed()
				.setTitle("Notploy bot commands")
				.setDescription(lines.join("\n") || "No commands are available.")
				.addFields(
					{ name: "Documentation", value: `[${config.resources.docs}](${config.resources.docs})` },
					{
						name: "Resources",
						value: `[All official links](${config.resources.website})`,
					},
				);

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		},
	};
}
