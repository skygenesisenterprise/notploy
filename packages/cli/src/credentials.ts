import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadEnvFile, normalizeServerUrl, saveProfile } from "./config.js";
import { CliError, ExitCode, usageError } from "./errors.js";
import { verifyCredentials } from "./http.js";
import { printInfo } from "./output.js";

/**
 * Interactive input is opt-in: never prompt when stdin/stdout is not a TTY or
 * when CI/NOTPLOY_NO_INPUT is set.
 */
export function isInteractive(env: NodeJS.ProcessEnv = process.env): boolean {
	return (
		Boolean(stdin.isTTY && stdout.isTTY) &&
		env.CI !== "true" &&
		env.NOTPLOY_NO_INPUT !== "1"
	);
}

export async function promptText(question: string): Promise<string> {
	if (!stdin.isTTY) {
		throw usageError(
			"Cannot prompt for input in a non-interactive environment.",
		);
	}
	const readline = createInterface({ input: stdin, output: process.stderr });
	try {
		return (await readline.question(question)).trim();
	} finally {
		readline.close();
	}
}

/**
 * Reads a secret without echoing it to the terminal. Falls back to a normal
 * prompt only when raw mode is unavailable.
 */
export async function promptSecret(question: string): Promise<string> {
	if (!stdin.isTTY) {
		throw usageError(
			"Cannot prompt for a secret in a non-interactive environment.",
		);
	}
	if (typeof stdin.setRawMode !== "function") {
		return promptText(question);
	}

	process.stderr.write(question);
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding("utf8");

	return new Promise<string>((resolve, reject) => {
		let value = "";

		const cleanup = () => {
			stdin.setRawMode?.(false);
			stdin.pause();
			stdin.off("data", onData);
		};

		const onData = (chunk: string) => {
			for (const char of chunk) {
				if (char === "\r" || char === "\n") {
					cleanup();
					process.stderr.write("\n");
					resolve(value);
					return;
				}
				if (char === "\u0003") {
					cleanup();
					process.stderr.write("\n");
					reject(
						new CliError("Cancelled.", {
							code: ExitCode.Interrupted,
						}),
					);
					return;
				}
				if (char === "\u007f" || char === "\b") {
					value = value.slice(0, -1);
					continue;
				}
				value += char;
			}
		};

		stdin.on("data", onData);
	});
}

export interface LoginInputOptions {
	url?: string;
	token?: string;
	allowInput: boolean;
	env?: NodeJS.ProcessEnv;
}

/**
 * Resolves login input with flags/env first, then interactive prompts.
 */
export async function collectLoginInput(
	options: LoginInputOptions,
): Promise<{ url: string; token: string }> {
	const env = options.env ?? process.env;
	loadEnvFile(process.cwd(), env);
	let url = options.url?.trim() || env.NOTPLOY_URL?.trim();
	let token =
		options.token?.trim() ||
		env.NOTPLOY_API_KEY?.trim() ||
		env.NOTPLOY_AUTH_TOKEN?.trim();

	if (!url) {
		if (!options.allowInput) {
			throw usageError(
				"Missing server URL.",
				"Pass --url, set NOTPLOY_URL, or run interactively.",
			);
		}
		url = await promptText("Notploy server URL: ");
	}
	if (!token) {
		if (!options.allowInput) {
			throw usageError(
				"Missing API key.",
				"Pass --token, set NOTPLOY_API_KEY, or run interactively.",
			);
		}
		token = await promptSecret("API key: ");
	}

	return {
		url: normalizeServerUrl(url),
		token: token.trim(),
	};
}

export interface SaveProfileOptions {
	profile: string;
	url: string;
	token: string;
	verify: boolean;
	timeout: number;
}

export async function saveVerifiedProfile(
	options: SaveProfileOptions,
): Promise<{ url: string; profile: string; configPath: string }> {
	const url = normalizeServerUrl(options.url);
	if (!options.token.trim()) {
		throw usageError("API key cannot be empty.");
	}

	if (options.verify) {
		printInfo("Validating credentials...");
		await verifyCredentials(url, options.token, options.timeout);
	}

	const configPath = saveProfile(options.profile, url, options.token);
	return { url, profile: options.profile, configPath };
}
