import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { errorEmbed } from "./embeds.js";

/** Whether the invoking member has the Administrator permission. */
export function isAdministrator(interaction: ChatInputCommandInteraction): boolean {
	return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

/** Whether the invoking member can manage the guild. */
export function canManageGuild(interaction: ChatInputCommandInteraction): boolean {
	return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

/**
 * Guards a command behind a permission check. Returns `true` when the member
 * is allowed to proceed; otherwise it replies with an ephemeral refusal and
 * returns `false`.
 */
export async function requirePermission(
	interaction: ChatInputCommandInteraction,
	permission: bigint,
	label = "this command",
): Promise<boolean> {
	if (interaction.memberPermissions?.has(permission)) {
		return true;
	}

	await interaction.reply({
		embeds: [
			errorEmbed("Missing permission", `You need the **${label}** permission to run this command.`),
		],
		flags: MessageFlags.Ephemeral,
	});
	return false;
}
