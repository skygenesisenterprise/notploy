import { SlashCommandBuilder } from "discord.js";
import { baseEmbed } from "../utils/embeds.js";
import type { Command } from "../types/index.js";

export const aboutCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("about")
		.setDescription("Learn about Notploy and the official community bot"),

	async execute(interaction, { community, config }) {
		const about = community.about;
		const embed = baseEmbed()
			.setTitle(`About ${about.name}`)
			.setURL(config.resources.website)
			.setDescription(`**${about.tagline}**\n\n${about.description}`)
			.addFields(
				{ name: "Repository", value: `[${about.repository}](${config.resources.githubUrl})` },
				{ name: "License", value: about.license, inline: true },
				{ name: "Maintained by", value: about.maintainer, inline: true },
			);

		await interaction.reply({ embeds: [embed] });
	},
};
