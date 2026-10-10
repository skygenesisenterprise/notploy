import { Command } from "commander";
import { registerAuthCommand } from "./src/commands/auth.js";
import { registerGeneratedCommands } from "./src/generated/commands.js";

const program = new Command();
program.name("notploy").version("0.0.0");

registerAuthCommand(program);
registerGeneratedCommands(program);

// Option.mandatory is "must be passed"; Option.required means "needs a value".
const dump = program.commands.map((group) => ({
	group: group.name(),
	options: group.options.map((o) => ({ flags: o.flags, mandatory: !!o.mandatory })),
	commands: group.commands.map((command) => ({
		name: command.name(),
		options: command.options.map((o) => ({
			flags: o.flags,
			mandatory: !!o.mandatory,
			takesValue: !!o.required,
			description: o.description,
		})),
	})),
}));

console.log(JSON.stringify(dump));
