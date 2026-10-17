import chalk from "chalk";
import type { Command } from "commander";
import {
	configPermissionWarning,
	readConfigFile,
	removeProfile,
	resolveAuth,
	resolveTimeout,
} from "../config.js";
import {
	collectLoginInput,
	isInteractive,
	saveVerifiedProfile,
} from "../credentials.js";
import { usageError } from "../errors.js";
import { verifyCredentials } from "../http.js";
import {
	configureOutput,
	isColorEnabled,
	printInfo,
	printLine,
	printResult,
} from "../output.js";
import { handleCommandError } from "./run.js";

function optionString(value: unknown, fallback?: string): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function timeoutValue(value: unknown): string | number | undefined {
	return typeof value === "string" || typeof value === "number"
		? value
		: undefined;
}

function writeHumanLine(label: string, value: string): void {
	const prefix = isColorEnabled() ? chalk.gray(`${label}:`) : `${label}:`;
	printLine(`${prefix} ${value}`);
}

export function registerAuthCommand(program: Command): void {
	const auth = program
		.command("auth")
		.description("Authenticate with a Notploy instance")
		.option("-u, --url <url>", "Server URL (e.g. https://panel.notploy.com)")
		.option("-t, --token <token>", "API key from the Notploy dashboard")
		.option(
			"-p, --profile <name>",
			"Profile to create or update (defaults to the current profile)",
		)
		.option("--no-verify", "Save credentials without validating them")
		.option(
			"--no-input",
			"Never prompt; require flags or environment variables",
		)
		.option("--json", "Output machine-readable JSON");

	auth.action(async (_options, command: Command) => {
		const merged = command.optsWithGlobals() as Record<string, unknown>;
		const json = merged.json === true;
		configureOutput({ json, color: merged.ansi !== false });

		try {
			const loaded = readConfigFile();
			const profileName =
				optionString(merged.profile) ??
				loaded.config.currentProfile ??
				"default";
			const allowInput = merged.input !== false && isInteractive();
			const input = await collectLoginInput({
				url: optionString(merged.url),
				token: optionString(merged.token) ?? optionString(merged.notployToken),
				allowInput,
			});
			const timeout = resolveTimeout(timeoutValue(merged.timeout));

			const result = await saveVerifiedProfile({
				profile: profileName,
				url: input.url,
				token: input.token,
				verify: merged.verify !== false,
				timeout,
			});

			if (json) {
				printResult({
					authenticated: true,
					profile: result.profile,
					url: result.url,
					configPath: result.configPath,
				});
			} else {
				printLine(
					`Authenticated. Profile "${result.profile}" saved to ${result.configPath}.`,
				);
			}
		} catch (error) {
			handleCommandError(error, { json });
		}
	});

	const status = auth
		.command("status")
		.description("Show the resolved profile and credentials (redacted)")
		.option("--profile <name>", "Profile to inspect")
		.option("--verify", "Validate credentials against the server")
		.option("--json", "Output machine-readable JSON");

	status.action(async (_options, command: Command) => {
		const merged = command.optsWithGlobals() as Record<string, unknown>;
		const json = merged.json === true;
		configureOutput({ json, color: merged.ansi !== false });

		try {
			const authInfo = resolveAuth({
				profile: optionString(merged.profile),
				url: optionString(merged.notployUrl),
				token: optionString(merged.notployToken),
			});
			const loaded = readConfigFile();
			const report: Record<string, unknown> = {
				profile: authInfo.profile ?? null,
				url: authInfo.url,
				token: "[REDACTED]",
				source: authInfo.source,
				configPath: loaded.path,
			};
			if (loaded.config.currentProfile) {
				report.currentProfile = loaded.config.currentProfile;
			}
			if (loaded.legacyPath) {
				report.legacyConfigPath = loaded.legacyPath;
			}

			if (merged.verify === true) {
				printInfo("Validating credentials...");
				await verifyCredentials(
					authInfo.url,
					authInfo.token,
					resolveTimeout(timeoutValue(merged.timeout)),
				);
				report.authenticated = true;
			}

			if (json) {
				printResult(report);
			} else {
				writeHumanLine("Profile", String(report.profile ?? "(none)"));
				writeHumanLine("URL", authInfo.url);
				writeHumanLine("Credential", "[REDACTED]");
				writeHumanLine("Source", authInfo.source);
				writeHumanLine("Config", loaded.path);
				if (loaded.legacyPath) {
					writeHumanLine("Legacy config", loaded.legacyPath);
				}
				if (report.authenticated === true) {
					printLine("Credentials are valid.");
				}
			}

			const warning = configPermissionWarning(loaded.path);
			if (warning) printInfo(warning);
		} catch (error) {
			handleCommandError(error, { json });
		}
	});

	const logout = auth
		.command("logout")
		.description("Remove a stored profile")
		.option("--profile <name>", "Profile to remove")
		.option("--json", "Output machine-readable JSON");

	logout.action(async (_options, command: Command) => {
		const merged = command.optsWithGlobals() as Record<string, unknown>;
		const json = merged.json === true;
		configureOutput({ json, color: merged.ansi !== false });

		try {
			const loaded = readConfigFile();
			const profileName =
				optionString(merged.profile) ??
				loaded.config.currentProfile ??
				"default";
			const result = removeProfile(profileName);
			if (!result.removed) {
				throw usageError(
					`Profile "${profileName}" does not exist.`,
					"Run 'notploy profile list' to see available profiles.",
				);
			}

			if (json) {
				printResult({
					removed: true,
					profile: profileName,
					currentProfile: result.currentProfile ?? null,
				});
			} else {
				printLine(`Removed profile "${profileName}".`);
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
