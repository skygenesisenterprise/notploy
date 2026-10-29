import type { Client, GuildMember } from "discord.js";
import type { BotConfig } from "../types/index.js";
import { infoEmbed } from "../utils/embeds.js";
import type { Logger } from "../utils/logger.js";

/**
 * Community onboarding: grants the configured member role and posts a welcome
 * message when a user joins the guild.
 *
 * Both actions are optional and best-effort — a failure never propagates to
 * the gateway event handler.
 */
export class RoleService {
	constructor(
		private readonly client: Client,
		private readonly config: BotConfig,
		private readonly logger: Logger,
	) {}

	/** Whether any onboarding behaviour is configured. */
	get enabled(): boolean {
		const { welcomeChannelId, memberRoleId } = this.config.onboarding;
		return Boolean(welcomeChannelId || memberRoleId);
	}

	/** Applies role assignment and welcome message for a new member. */
	async onboard(member: GuildMember): Promise<void> {
		await Promise.all([this.assignMemberRole(member), this.sendWelcome(member)]);
	}

	private async assignMemberRole(member: GuildMember): Promise<void> {
		const roleId = this.config.onboarding.memberRoleId;
		if (!roleId) return;
		try {
			await member.roles.add(roleId);
			this.logger.info("Assigned member role", { userId: member.id, roleId });
		} catch (error) {
			this.logger.warn("Failed to assign member role", {
				userId: member.id,
				roleId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async sendWelcome(member: GuildMember): Promise<void> {
		const channelId = this.config.onboarding.welcomeChannelId;
		if (!channelId) return;
		try {
			const channel = await this.client.channels.fetch(channelId);
			if (!channel || typeof (channel as { send?: unknown }).send !== "function") return;
			const sendable = channel as {
				send: (options: unknown) => Promise<unknown>;
				toString: () => string;
			};
			await sendable.send({
				content: `Welcome <@${member.id}>!`,
				embeds: [
					infoEmbed(
						"Welcome to Notploy",
						`Glad to have you here, ${member.user.username}.\n\n` +
							"• Read the docs with `/docs`\n" +
							"• Discover official resources with `/links`\n" +
							"• Learn about the project with `/about`",
					),
				],
			});
			this.logger.info("Sent welcome message", { userId: member.id, channelId });
		} catch (error) {
			this.logger.warn("Failed to send welcome message", {
				userId: member.id,
				channelId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
