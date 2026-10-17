import type { Command } from "commander";
import { collectSecretValues, resolveAuth, resolveTimeout } from "../config.js";
import { normalizeError } from "../errors.js";
import { GENERATED_COMMAND_COUNT, SPEC_VERSION } from "../generated/meta.js";
import { apiGet } from "../http.js";
import { configureOutput, printLine, printResult } from "../output.js";
import { handleCommandError } from "./run.js";

function timeoutValue(value: unknown): string | number | undefined {
	return typeof value === "string" || typeof value === "number"
		? value
		: undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/**
 * Adds `server info` next to the generated server commands. The extra command
 * lives in hand-written code so generated output stays a pure API mapping.
 */
export function registerServerInfoCommand(program: Command): void {
	const server =
		program.commands.find((command) => command.name() === "server") ??
		program.command("server").description("server commands");

	if (server.commands.some((command) => command.name() === "info")) return;

	server
		.command("info")
		.description("Show server identity, latency and clock information")
		.option("--profile <name>", "Profile to use")
		.option("--json", "Output machine-readable JSON")
		.action(async (_options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const auth = resolveAuth({
					profile:
						typeof merged.profile === "string" ? merged.profile : undefined,
					url:
						typeof merged.notployUrl === "string"
							? merged.notployUrl
							: undefined,
					token:
						typeof merged.notployToken === "string"
							? merged.notployToken
							: undefined,
				});
				const timeout = resolveTimeout(timeoutValue(merged.timeout));
				const started = Date.now();
				const user = await apiGet("user.get", undefined, {
					auth,
					timeout,
				});
				const latencyMs = Date.now() - started;

				let serverTime: unknown = null;
				let serverTimeError: string | undefined;
				try {
					serverTime = await apiGet("server.getServerTime", undefined, {
						auth,
						timeout,
					});
				} catch (error) {
					serverTimeError = normalizeError(
						error,
						collectSecretValues(),
					).message;
				}

				const report = {
					profile: auth.profile ?? null,
					url: auth.url,
					latencyMs,
					apiSpecVersion: SPEC_VERSION,
					commandCount: GENERATED_COMMAND_COUNT,
					user,
					serverTime,
					serverTimeError: serverTimeError ?? null,
				};

				if (json) {
					printResult(report);
				} else {
					const userRecord = asRecord(user);
					printLine(`Profile: ${report.profile ?? "(environment)"}`);
					printLine(`URL: ${auth.url}`);
					printLine(`Latency: ${latencyMs}ms`);
					printLine(
						`API spec: ${report.apiSpecVersion} (${report.commandCount} commands)`,
					);
					if (userRecord) {
						if (userRecord.email) {
							printLine(`User: ${String(userRecord.email)}`);
						} else if (userRecord.id) {
							printLine(`User: ${String(userRecord.id)}`);
						}
					}
					if (serverTime !== null) {
						printLine(
							`Server time: ${
								typeof serverTime === "string"
									? serverTime
									: JSON.stringify(serverTime)
							}`,
						);
					} else if (serverTimeError) {
						printLine(`Server time: unavailable (${serverTimeError})`);
					}
				}
			} catch (error) {
				handleCommandError(error, { json });
			}
		});
}
