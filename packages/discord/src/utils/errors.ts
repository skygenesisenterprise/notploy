import { type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";

/** Thrown when required environment configuration is missing or invalid. */
export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigurationError";
	}
}

/**
 * Error safe to surface to a Discord user. When `publicMessage` is set the
 * bot replies with it instead of the generic fallback.
 */
export class CommandError extends Error {
	constructor(
		message: string,
		public readonly publicMessage: string | null = null,
	) {
		super(message);
		this.name = "CommandError";
	}
}

/** Normalizes an unknown thrown value into a human-readable message. */
export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error";
}

/**
 * Replies to an interaction whether or not it was already deferred or
 * replied, swallowing secondary failures so a command never crashes the
 * event loop because of a transient Discord error.
 */
export async function safeReply(
	interaction: ChatInputCommandInteraction,
	options: InteractionReplyOptions,
): Promise<void> {
	try {
		if (interaction.deferred || interaction.replied) {
			const { flags: _flags, ...rest } = options;
			await interaction.editReply(rest);
		} else {
			await interaction.reply(options);
		}
	} catch {
		// Interaction may have expired or been acknowledged elsewhere.
	}
}
