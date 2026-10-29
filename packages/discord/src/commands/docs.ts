import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { linksEmbed } from "../utils/embeds.js";

export const docsCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("docs")
		.setDescription("Links to the official Notploy documentation"),

	async execute(interaction, { community, config }) {
		const embed = linksEmbed("Notploy documentation", community.docsLinks()).setURL(
			config.resources.docs,
		);
		await interaction.reply({ embeds: [embed] });
	},
};
