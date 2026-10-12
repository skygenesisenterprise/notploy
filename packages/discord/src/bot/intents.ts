import { GatewayIntentBits } from "discord.js";
import type { BotConfig } from "../types/index.js";

/**
 * Resolves the gateway intents required by the bot.
 *
 * `GuildMembers` is a privileged intent and is therefore only requested when
 * onboarding (role assignment / welcome messages) is configured, so operators
 * can run the bot with the least privilege needed.
 */
export function createIntents(config: BotConfig): GatewayIntentBits[] {
	const intents: GatewayIntentBits[] = [GatewayIntentBits.Guilds];
	if (config.onboarding.welcomeChannelId || config.onboarding.memberRoleId) {
		intents.push(GatewayIntentBits.GuildMembers);
	}
	return intents;
}
