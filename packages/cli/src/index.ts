#!/usr/bin/env node

import { CommanderError, program } from "commander";
import { registerAuthCommand } from "./commands/auth.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerProfileCommand } from "./commands/profile.js";
import { registerServerInfoCommand } from "./commands/server-info.js";
import { collectSecretValues } from "./config.js";
import { CliError, ExitCode, normalizeError, redactSecrets } from "./errors.js";
import { registerGeneratedCommands } from "./generated/commands.js";
import {
	configureOutput,
	printError,
	printLine,
	wantsJson,
	writeStderr,
	writeStdout,
} from "./output.js";
import { VERSION } from "./version.js";

program
	.name("notploy")
	.version(VERSION)
	.description(
		"Notploy CLI - manage a Notploy instance from the terminal or CI",
	)
	.option("--profile <name>", "Configuration profile to use")
	.option("--notploy-url <url>", "Server URL override (prefer NOTPLOY_URL)")
	.option(
		"--notploy-token <key>",
		"API key override (prefer NOTPLOY_API_KEY; flags are visible to other processes)",
	)
	.option("--timeout <ms>", "Request timeout in milliseconds")
	.option("--json", "Output machine-readable JSON on stdout")
	.option("--no-ansi", "Disable ANSI colors")
	.showHelpAfterError("(add --help for more information)")
	.showSuggestionAfterError()
	.action(() => {
		program.help();
	});

program.configureOutput({
	writeOut: (text) => writeStdout(text),
	writeErr: (text) => writeStderr(text),
	outputError: (text, write) =>
		write(redactSecrets(text, collectSecretValues())),
});

program.exitOverride((error: CommanderError) => {
	throw error;
});

registerAuthCommand(program);
registerProfileCommand(program);
registerDoctorCommand(program);
registerGeneratedCommands(program);
registerServerInfoCommand(program);

function isHelpOrVersion(error: CommanderError): boolean {
	return (
		error.code === "commander.helpDisplayed" ||
		error.code === "commander.version" ||
		error.exitCode === 0
	);
}

async function main(): Promise<void> {
	const argv = process.argv.filter((argument) => argument !== "--");
	const json = wantsJson(argv);
	configureOutput({ json, color: !argv.includes("--no-ansi") });

	try {
		await program.parseAsync(argv);
	} catch (error) {
		if (error instanceof CommanderError) {
			if (isHelpOrVersion(error)) {
				process.exitCode = ExitCode.Success;
				return;
			}
			// Commander already wrote a redacted human message to stderr. In
			// JSON mode we additionally emit a parseable document on stdout.
			if (json) {
				printError(
					new CliError(redactSecrets(error.message, collectSecretValues()), {
						code: ExitCode.Usage,
					}),
				);
			}
			process.exitCode = ExitCode.Usage;
			return;
		}

		const normalized = normalizeError(error, collectSecretValues());
		printError(normalized);
		process.exitCode = normalized.code;
	}
}

process.on("SIGINT", () => {
	printLine("");
	writeStderr("Interrupted.\n");
	process.exit(ExitCode.Interrupted);
});

void main();
