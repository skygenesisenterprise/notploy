import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { baseEmbed, COLORS } from "../utils/embeds.js";

export const statusCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("status")
		.setDescription("Public Notploy project and platform status"),

	async execute(interaction, { notploy, github, config, logger }) {
		await interaction.deferReply();

		const [status, release] = await Promise.all([notploy.getStatus(), github.getLatestRelease()]);

		const embed = baseEmbed().setTitle("Notploy status");
		embed.setColor(status.reachable ? COLORS.success : COLORS.neutral);

		if (!status.configured) {
			embed.addFields({
				name: "Instance",
				value: "No Notploy instance is configured for this bot.",
			});
		} else {
			embed.addFields(
				{
					name: "Instance",
					value: status.reachable ? "Operational" : "Unavailable",
					inline: true,
				},
				{ name: "Version", value: status.version ?? "unknown", inline: true },
			);
		}

		embed.addFields({
			name: "Latest release",
			value: release ? `[${release.name}](${release.url})` : "No public release info",
		});
		embed.addFields({
			name: "Status page",
			value: `[${config.resources.status}](${config.resources.status})`,
		});

		logger.debug("Status command completed", {
			reachable: status.reachable,
			hasRelease: Boolean(release),
		});

		await interaction.editReply({ embeds: [embed] });
	},
};
