import { SlashCommandBuilder } from "discord.js";
import { linksEmbed } from "../utils/embeds.js";
import type { Command } from "../types/index.js";

export const linksCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("links")
		.setDescription("Official Notploy resources and community links"),

	async execute(interaction, { community, config }) {
		const embed = linksEmbed("Official Notploy resources", community.officialLinks()).setURL(
			config.resources.website,
		);
		await interaction.reply({ embeds: [embed] });
	},
};
