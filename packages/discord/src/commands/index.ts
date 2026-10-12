import { Collection } from "discord.js";
import type { Command } from "../types/index.js";
import { aboutCommand } from "./about.js";
import { docsCommand } from "./docs.js";
import { createHelpCommand } from "./help.js";
import { linksCommand } from "./links.js";
import { statusCommand } from "./status.js";
import { versionCommand } from "./version.js";

/** Every non-derived command, in display order. */
export const baseCommands: readonly Command[] = [
	aboutCommand,
	docsCommand,
	linksCommand,
	statusCommand,
	versionCommand,
];

/**
 * Builds the command registry.
 *
 * `/help` is derived from the full list, including itself, so the registry is
 * always self-documenting.
 */
export function createCommands(): Collection<string, Command> {
	const all: Command[] = [...baseCommands];
	all.push(createHelpCommand(all));

	const registry = new Collection<string, Command>();
	for (const command of all) {
		registry.set(command.data.name, command);
	}
	return registry;
}

/** Serializes commands for Discord's slash command registration REST call. */
export function serializeCommands(commands: Iterable<Command>) {
	return [...commands].map((command) => command.data.toJSON());
}
