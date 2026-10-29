import { SlashCommandBuilder } from "discord.js";
import { truncate } from "../integrations/github/events.js";
import type { Command } from "../types/index.js";
import { baseEmbed, warningEmbed } from "../utils/embeds.js";

export const versionCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("version")
		.setDescription("Show the current public Notploy release/version"),

	async execute(interaction, { github, notploy, config }) {
		await interaction.deferReply();

		const release = await github.getLatestRelease();
		if (release) {
			const embed = baseEmbed()
				.setTitle(`Notploy ${release.tagName}`)
				.setURL(release.url)
				.setDescription(truncate(release.body?.trim() || `Latest release: ${release.name}`))
				.addFields({ name: "Release", value: `[View on GitHub](${release.url})` });
			if (release.publishedAt) embed.setTimestamp(new Date(release.publishedAt));
			await interaction.editReply({ embeds: [embed] });
			return;
		}

		const instanceVersion = await notploy.getVersion();
		if (instanceVersion) {
			await interaction.editReply({
				embeds: [
					baseEmbed()
						.setTitle(`Notploy ${instanceVersion}`)
						.setDescription("Reported by the configured Notploy instance."),
				],
			});
			return;
		}

		await interaction.editReply({
			embeds: [
				warningEmbed(
					"Version unavailable",
					`Could not determine the current version. See the releases on [GitHub](${config.resources.githubUrl}/releases).`,
				),
			],
		});
	},
};
