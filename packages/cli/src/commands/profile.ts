import chalk from "chalk";
import type { Command } from "commander";
import {
	getProfile,
	listProfiles,
	readConfigFile,
	redactedProfile,
	removeProfile,
	resolveTimeout,
	setCurrentProfile,
} from "../config.js";
import {
	collectLoginInput,
	isInteractive,
	saveVerifiedProfile,
} from "../credentials.js";
import { usageError } from "../errors.js";
import {
	configureOutput,
	isColorEnabled,
	printLine,
	printResult,
} from "../output.js";
import { handleCommandError } from "./run.js";

function optionString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function timeoutValue(value: unknown): string | number | undefined {
	return typeof value === "string" || typeof value === "number"
		? value
		: undefined;
}

function label(text: string): string {
	return isColorEnabled() ? chalk.gray(`${text}:`) : `${text}:`;
}

export function registerProfileCommand(program: Command): void {
	const profile = program
		.command("profile")
		.description("Manage named Notploy connection profiles");

	profile
		.command("add <name>")
		.description("Create or update a profile")
		.option("-u, --url <url>", "Server URL")
		.option("-t, --token <token>", "API key")
		.option("--no-verify", "Save credentials without validating them")
		.option(
			"--no-input",
			"Never prompt; require flags or environment variables",
		)
		.option("--json", "Output machine-readable JSON")
		.action(async (name: string, _options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const input = await collectLoginInput({
					url: optionString(merged.url),
					token:
						optionString(merged.token) ?? optionString(merged.notployToken),
					allowInput: merged.input !== false && isInteractive(),
				});
				const result = await saveVerifiedProfile({
					profile: name,
					url: input.url,
					token: input.token,
					verify: merged.verify !== false,
					timeout: resolveTimeout(timeoutValue(merged.timeout)),
				});

				if (json) {
					printResult({
						created: true,
						profile: result.profile,
						url: result.url,
						configPath: result.configPath,
					});
				} else {
					printLine(
						`Profile "${result.profile}" saved to ${result.configPath}.`,
					);
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});

	profile
		.command("list")
		.description("List profiles without printing secrets")
		.option("--json", "Output machine-readable JSON")
		.action(async (_options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const loaded = readConfigFile();
				const data = listProfiles();
				const report = {
					configPath: loaded.path,
					legacyConfigPath: loaded.legacyPath ?? null,
					currentProfile: data.currentProfile ?? null,
					profiles: data.profiles.map((entry) => ({
						name: entry.name,
						...redactedProfile(entry),
						current: entry.name === data.currentProfile,
					})),
				};

				if (json) {
					printResult(report);
				} else if (report.profiles.length === 0) {
					printLine("No profiles configured. Run 'notploy auth' to add one.");
				} else {
					for (const entry of report.profiles) {
						const marker = entry.current ? "*" : " ";
						printLine(
							`${marker} ${entry.name}  ${entry.url}  ${label("token")} ${entry.token}`,
						);
					}
					printLine(`Config: ${report.configPath}`);
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});

	profile
		.command("show [name]")
		.description("Show one profile with secrets redacted")
		.option("--json", "Output machine-readable JSON")
		.action(async (name: string | undefined, _options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const loaded = readConfigFile();
				const profileName = name ?? loaded.config.currentProfile;
				if (!profileName) {
					throw usageError(
						"No profile selected.",
						"Pass a profile name or run 'notploy profile use <name>'.",
					);
				}
				const stored = getProfile(profileName);
				if (!stored) {
					throw usageError(
						`Profile "${profileName}" does not exist.`,
						"Run 'notploy profile list' to see available profiles.",
					);
				}

				const report = {
					name: profileName,
					...redactedProfile(stored),
					current: profileName === loaded.config.currentProfile,
					configPath: loaded.path,
				};
				if (json) {
					printResult(report);
				} else {
					printLine(`${label("Profile")} ${report.name}`);
					printLine(`${label("URL")} ${report.url}`);
					printLine(`${label("Token")} ${report.token}`);
					printLine(`${label("Current")} ${report.current ? "yes" : "no"}`);
					printLine(`${label("Config")} ${report.configPath}`);
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});

	profile
		.command("use <name>")
		.description("Select the default profile")
		.option("--json", "Output machine-readable JSON")
		.action(async (name: string, _options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				setCurrentProfile(name);
				if (json) {
					printResult({ currentProfile: name });
				} else {
					printLine(`Current profile is now "${name}".`);
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});

	profile
		.command("remove <name>")
		.description("Remove a stored profile")
		.option("--json", "Output machine-readable JSON")
		.action(async (name: string, _options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const result = removeProfile(name);
				if (!result.removed) {
					throw usageError(
						`Profile "${name}" does not exist.`,
						"Run 'notploy profile list' to see available profiles.",
					);
				}
				if (json) {
					printResult({
						removed: true,
						profile: name,
						currentProfile: result.currentProfile ?? null,
					});
				} else {
					printLine(`Removed profile "${name}".`);
					if (result.currentProfile) {
						printLine(`Current profile is now "${result.currentProfile}".`);
					} else {
						printLine("No profiles remain. Run 'notploy auth' to add one.");
					}
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});
}
