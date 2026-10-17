import * as fs from "node:fs";
import chalk from "chalk";
import type { Command } from "commander";
import {
	configPermissionWarning,
	getConfigPath,
	readConfigFile,
	resolveAuth,
	resolveTimeout,
} from "../config.js";
import { ExitCode, normalizeError } from "../errors.js";
import { GENERATED_COMMAND_COUNT, SPEC_VERSION } from "../generated/meta.js";
import { verifyCredentials } from "../http.js";
import {
	configureOutput,
	isColorEnabled,
	printLine,
	printResult,
} from "../output.js";
import { loadProjectConfig } from "../project-config.js";
import { VERSION } from "../version.js";
import { handleCommandError } from "./run.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
	id: string;
	status: CheckStatus;
	message: string;
	hint?: string;
}

export interface DoctorReport {
	ok: boolean;
	exitCode: number;
	version: string;
	apiSpecVersion: string;
	commandCount: number;
	node: string;
	platform: string;
	profile: string | null;
	url: string | null;
	configPath: string;
	timeoutMs: number | null;
	offline: boolean;
	checks: DoctorCheck[];
}

export interface DoctorOptions {
	offline?: boolean;
	profile?: string;
	url?: string;
	token?: string;
	timeout?: string | number;
	env?: NodeJS.ProcessEnv;
	cwd?: string;
}

function parseNodeVersion(version: string): [number, number, number] {
	const [major = 0, minor = 0, patch = 0] = version
		.replace(/^v/, "")
		.split(".")
		.map((part) => Number.parseInt(part, 10) || 0);
	return [major, minor, patch];
}

function nodeIsSupported(version: string): boolean {
	const [major, minor] = parseNodeVersion(version);
	return major > 20 || (major === 20 && minor >= 19);
}

function timeoutValue(value: unknown): string | number | undefined {
	return typeof value === "string" || typeof value === "number"
		? value
		: undefined;
}

function checkLabel(status: CheckStatus): string {
	if (!isColorEnabled()) return `[${status}]`;
	if (status === "ok") return chalk.green("[ok]");
	if (status === "warn") return chalk.yellow("[warn]");
	return chalk.red("[fail]");
}

/**
 * Performs all diagnostics and returns a structured report. Never prints
 * credentials; auth failures are represented by their stable exit code.
 */
export async function runDoctor(
	options: DoctorOptions = {},
): Promise<DoctorReport> {
	const env = options.env ?? process.env;
	const cwd = options.cwd ?? process.cwd();
	const configPath = getConfigPath(env);
	const checks: DoctorCheck[] = [];
	let exitCode: number = ExitCode.Success;
	let resolvedUrl: string | null = null;
	let profile: string | null = null;
	let timeoutMs: number | null = null;

	const recordFailure = (code: number) => {
		const priority: Record<number, number> = {
			[ExitCode.General]: 1,
			[ExitCode.Usage]: 2,
			[ExitCode.Auth]: 3,
			[ExitCode.Api]: 4,
			[ExitCode.Timeout]: 5,
		};
		if ((priority[code] ?? 0) > (priority[exitCode] ?? 0)) {
			exitCode = code;
		}
	};

	const [major, minor, patch] = parseNodeVersion(process.versions.node);
	checks.push({
		id: "node",
		status: nodeIsSupported(process.versions.node) ? "ok" : "warn",
		message: `Node.js ${major}.${minor}.${patch} (CLI ${VERSION} requires >=20.19.0)`,
		hint: nodeIsSupported(process.versions.node)
			? undefined
			: "Upgrade Node.js to a supported LTS release.",
	});

	let loaded: ReturnType<typeof readConfigFile> | undefined;
	try {
		loaded = readConfigFile({ env });
	} catch (error) {
		const normalized = normalizeError(error);
		checks.push({
			id: "config",
			status: "fail",
			message: normalized.message,
			hint: normalized.hint,
		});
		recordFailure(normalized.code);
	}

	if (loaded) {
		const exists = fs.existsSync(loaded.path);
		if (exists) {
			checks.push({
				id: "config",
				status: "ok",
				message: loaded.path,
			});
			const warning = configPermissionWarning(loaded.path);
			if (warning) {
				checks.push({
					id: "config-permissions",
					status: "warn",
					message: warning,
				});
			}
		} else if (
			env.NOTPLOY_URL &&
			(env.NOTPLOY_API_KEY || env.NOTPLOY_AUTH_TOKEN)
		) {
			checks.push({
				id: "config",
				status: "warn",
				message: "No config file; using NOTPLOY_URL and NOTPLOY_API_KEY.",
				hint: "Run 'notploy auth' if you want credentials stored for future sessions.",
			});
		} else {
			checks.push({
				id: "config",
				status: "fail",
				message: `No configuration file at ${loaded.path}.`,
				hint: "Run 'notploy auth' or set NOTPLOY_URL and NOTPLOY_API_KEY.",
			});
			recordFailure(ExitCode.Usage);
		}
		if (loaded.legacyPath) {
			checks.push({
				id: "config-legacy",
				status: "warn",
				message: `Legacy config found at ${loaded.legacyPath}.`,
				hint: "Run 'notploy auth' to write credentials to the user config directory.",
			});
		}
	}

	try {
		timeoutMs = resolveTimeout(timeoutValue(options.timeout), env);
		checks.push({
			id: "timeout",
			status: "ok",
			message: `${timeoutMs}ms`,
		});
	} catch (error) {
		const normalized = normalizeError(error);
		checks.push({
			id: "timeout",
			status: "fail",
			message: normalized.message,
			hint: normalized.hint,
		});
		recordFailure(normalized.code);
	}

	let auth: ReturnType<typeof resolveAuth> | undefined;
	try {
		auth = resolveAuth({
			profile: options.profile,
			url: options.url,
			token: options.token,
			env,
			cwd,
		});
		resolvedUrl = auth.url;
		profile = auth.profile ?? null;
		checks.push({
			id: "auth",
			status: "ok",
			message: `Profile "${auth.profile ?? "(environment)"}" resolves to ${auth.url} (source: ${auth.source}).`,
		});
	} catch (error) {
		const normalized = normalizeError(error);
		checks.push({
			id: "auth",
			status: "fail",
			message: normalized.message,
			hint: normalized.hint,
		});
		recordFailure(normalized.code);
	}

	try {
		const project = loadProjectConfig({ cwd, env });
		if (!project) {
			checks.push({
				id: "project",
				status: "ok",
				message: "No notploy.yaml (optional).",
			});
		} else {
			const selected = project.config.environment
				? ` (environment: ${project.config.environment})`
				: "";
			checks.push({
				id: "project",
				status: "ok",
				message: `${project.path}${selected}`,
			});
		}
	} catch (error) {
		const normalized = normalizeError(error);
		checks.push({
			id: "project",
			status: "fail",
			message: normalized.message,
			hint: normalized.hint,
		});
		recordFailure(normalized.code);
	}

	if (options.offline) {
		checks.push({
			id: "connectivity",
			status: "warn",
			message: "Skipped network checks (--offline).",
		});
	} else if (auth) {
		const started = Date.now();
		try {
			await verifyCredentials(auth.url, auth.token, timeoutMs ?? undefined);
			checks.push({
				id: "connectivity",
				status: "ok",
				message: `Connected and authenticated in ${Date.now() - started}ms.`,
			});
		} catch (error) {
			const normalized = normalizeError(error, [auth.token]);
			checks.push({
				id: "connectivity",
				status: "fail",
				message: normalized.message,
				hint: normalized.hint,
			});
			recordFailure(normalized.code);
		}
	} else {
		checks.push({
			id: "connectivity",
			status: "warn",
			message: "Skipped because credentials could not be resolved.",
		});
	}

	const finalTimeout = timeoutMs ?? null;
	return {
		ok: !checks.some((check) => check.status === "fail"),
		exitCode,
		version: VERSION,
		apiSpecVersion: SPEC_VERSION,
		commandCount: GENERATED_COMMAND_COUNT,
		node: process.versions.node,
		platform: `${process.platform}/${process.arch}`,
		profile,
		url: resolvedUrl,
		configPath,
		timeoutMs: finalTimeout,
		offline: Boolean(options.offline),
		checks,
	};
}

export function registerDoctorCommand(program: Command): void {
	program
		.command("doctor")
		.description("Diagnose configuration, connectivity and authentication")
		.option("--offline", "Skip network checks")
		.option("--profile <name>", "Profile to diagnose")
		.option("--json", "Output machine-readable JSON")
		.action(async (_options, command: Command) => {
			const merged = command.optsWithGlobals() as Record<string, unknown>;
			const json = merged.json === true;
			configureOutput({ json, color: merged.ansi !== false });

			try {
				const report = await runDoctor({
					offline: merged.offline === true,
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
					timeout: timeoutValue(merged.timeout),
				});

				if (json) {
					printResult(report);
				} else {
					printLine(`Notploy CLI ${report.version} doctor`);
					printLine(
						`API spec ${report.apiSpecVersion} (${report.commandCount} generated commands)`,
					);
					for (const check of report.checks) {
						printLine(
							`${checkLabel(check.status)} ${check.id}: ${check.message}`,
						);
						if (check.hint) {
							printLine(`      ${check.hint}`);
						}
					}
					const failures = report.checks.filter(
						(check) => check.status === "fail",
					).length;
					const warnings = report.checks.filter(
						(check) => check.status === "warn",
					).length;
					printLine(
						`Result: ${report.checks.length - failures - warnings} ok, ${warnings} warning(s), ${failures} failure(s).`,
					);
				}

				process.exitCode = report.exitCode;
			} catch (error) {
				handleCommandError(error, { json });
			}
		});
}
