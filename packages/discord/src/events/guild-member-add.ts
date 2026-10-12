import type { GuildMember } from "discord.js";
import type { BotServices } from "../types/index.js";

/** Applies community onboarding when a member joins the guild. */
export async function handleGuildMemberAdd(
	member: GuildMember,
	services: BotServices,
): Promise<void> {
	if (!services.roles.enabled) return;
	if (member.user.bot) return;
	await services.roles.onboard(member);
}
