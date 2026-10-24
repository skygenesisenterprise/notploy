import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { CliError, ExitCode, redactSecrets, usageError } from "../errors.js";

/**
 * Thin, injection-safe Docker CLI layer.
 *
 * Every command is executed with an argument array (never a shell string), with
 * an explicit timeout, and through `sudo -n` only when the current account
 * cannot reach the daemon and passwordless sudo is available.
 */

export interface CommandResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface CommandOptions {
	timeoutMs?: number;
	/** When false (default), a non-zero exit throws a CliError. */
	allowFailure?: boolean;
	input?: string;
}

export interface FileCommandOptions {
	timeoutMs?: number;
}

export interface CommandRunner {
	run(
		command: string,
		args: string[],
		options?: CommandOptions,
	): Promise<CommandResult>;
	/** Streams stdout into `filePath`; used for database dumps. */
	runToFile(
		command: string,
		args: string[],
		filePath: string,
		options?: FileCommandOptions,
	): Promise<CommandResult>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const PULL_TIMEOUT_MS = 15 * 60_000;

function timeoutError(command: string, args: string[], timeoutMs: number) {
	const label = [command, ...args].join(" ");
	return new CliError(
		`'${label}' did not finish within ${Math.round(timeoutMs / 1000)}s.`,
		{
			code: ExitCode.Timeout,
			hint: "Check the host and Docker daemon state, then retry. Increase the timeout with --timeout if the operation legitimately needs longer.",
		},
	);
}

function spawnFailed(error: NodeJS.ErrnoException, command: string): CliError {
	if (error.code === "ENOENT") {
		return new CliError(`'${command}' is not installed or is not on PATH.`, {
			code: ExitCode.Usage,
			hint:
				command === "docker"
					? "Install Docker Engine and ensure the CLI runs on the host that hosts Notploy Cloud."
					: `Install '${command}' and retry.`,
		});
	}
	return new CliError(`Cannot execute '${command}': ${error.message}`, {
		code: ExitCode.General,
	});
}

export class ProcessCommandRunner implements CommandRunner {
	constructor(
		private readonly options: {
			env?: NodeJS.ProcessEnv;
			defaultTimeoutMs?: number;
		} = {},
	) {}

	private env(): NodeJS.ProcessEnv {
		return this.options.env ?? process.env;
	}

	private defaultTimeout(): number {
		return this.options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	run(
		command: string,
		args: string[],
		options: CommandOptions = {},
	): Promise<CommandResult> {
		const timeoutMs = options.timeoutMs ?? this.defaultTimeout();
		return new Promise<CommandResult>((resolve, reject) => {
			let settled = false;
			const child = spawn(command, args, {
				env: this.env(),
				stdio: [
					options.input === undefined ? "ignore" : "pipe",
					"pipe",
					"pipe",
				],
			});
			let stdout = "";
			let stderr = "";
			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				stdout += chunk;
			});
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
			});
			if (options.input !== undefined && child.stdin) {
				child.stdin.end(options.input);
			}

			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				child.kill("SIGKILL");
				reject(timeoutError(command, args, timeoutMs));
			}, timeoutMs);

			child.on("error", (error: NodeJS.ErrnoException) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(spawnFailed(error, command));
			});
			child.on("close", (code) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				const result = { code: code ?? -1, stdout, stderr };
				if (result.code !== 0 && !options.allowFailure) {
					reject(
						new CliError(
							`'${[command, ...args].join(" ")}' failed with exit code ${result.code}.`,
							{
								code: ExitCode.General,
								hint: stderr.trim()
									? redactSecrets(
											stderr.trim().split("\n").slice(-5).join("\n"),
										)
									: undefined,
							},
						),
					);
					return;
				}
				resolve(result);
			});
		});
	}

	runToFile(
		command: string,
		args: string[],
		filePath: string,
		options: FileCommandOptions = {},
	): Promise<CommandResult> {
		const timeoutMs = options.timeoutMs ?? this.defaultTimeout();
		return new Promise<CommandResult>((resolve, reject) => {
			let settled = false;
			const child = spawn(command, args, {
				env: this.env(),
				stdio: ["ignore", "pipe", "pipe"],
			});
			const output = fs.createWriteStream(filePath, { mode: 0o600 });
			let stderr = "";
			child.stderr.setEncoding("utf8");
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.stdout.pipe(output);

			const fail = (error: Error) => {
				if (settled) return;
				settled = true;
				child.kill("SIGKILL");
				output.destroy();
				reject(error);
			};

			const timer = setTimeout(() => {
				fail(timeoutError(command, args, timeoutMs));
			}, timeoutMs);

			child.on("error", (error: NodeJS.ErrnoException) => {
				clearTimeout(timer);
				fail(spawnFailed(error, command));
			});
			child.on("close", (code) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				output.end(() => {
					const result = { code: code ?? -1, stdout: "", stderr };
					if (result.code !== 0) {
						reject(
							new CliError(
								`'${[command, ...args].join(" ")}' failed with exit code ${result.code}.`,
								{
									code: ExitCode.General,
									hint: stderr.trim()
										? redactSecrets(
												stderr.trim().split("\n").slice(-5).join("\n"),
											)
										: undefined,
								},
							),
						);
						return;
					}
					resolve(result);
				});
			});
		});
	}
}

export interface DockerAccess {
	available: boolean;
	useSudo: boolean;
	serverVersion?: string;
	error?: string;
}

export interface DockerDetectionOptions {
	uid?: number;
}

/**
 * Detects whether the Docker daemon is reachable, directly or through
 * passwordless sudo. Root is never required when the account can use Docker.
 */
export async function detectDockerAccess(
	runner: CommandRunner,
	options: DockerDetectionOptions = {},
): Promise<DockerAccess> {
	const uid = options.uid ?? process.getuid?.() ?? 0;

	let direct: CommandResult;
	try {
		direct = await runner.run(
			"docker",
			["info", "--format", "{{.ServerVersion}}"],
			{ timeoutMs: 15_000, allowFailure: true },
		);
	} catch (error) {
		return {
			available: false,
			useSudo: false,
			error:
				error instanceof Error
					? error.message
					: "The Docker CLI is not available.",
		};
	}
	if (direct.code === 0) {
		return {
			available: true,
			useSudo: false,
			serverVersion: direct.stdout.trim(),
		};
	}
	if (uid === 0) {
		return {
			available: false,
			useSudo: false,
			error:
				direct.stderr.trim() || "The Docker daemon is not reachable as root.",
		};
	}

	let sudo: CommandResult;
	try {
		sudo = await runner.run(
			"sudo",
			["-n", "docker", "info", "--format", "{{.ServerVersion}}"],
			{ timeoutMs: 15_000, allowFailure: true },
		);
	} catch (error) {
		return {
			available: false,
			useSudo: false,
			error: error instanceof Error ? error.message : "sudo is unavailable.",
		};
	}
	if (sudo.code === 0) {
		return {
			available: true,
			useSudo: true,
			serverVersion: sudo.stdout.trim(),
		};
	}

	return {
		available: false,
		useSudo: false,
		error:
			direct.stderr.trim() ||
			"The Docker daemon is not accessible to this account (tried 'docker' and 'sudo -n docker').",
	};
}

export class Docker {
	constructor(
		private readonly runner: CommandRunner,
		readonly access: DockerAccess,
	) {}

	requireAccess(): void {
		if (!this.access.available) {
			throw new CliError(
				"The Docker daemon is not reachable, so the Cloud installation cannot be inspected.",
				{
					code: ExitCode.Usage,
					hint: "Run the command on the Cloud host, start Docker, or grant the current account access to /var/run/docker.sock.",
				},
			);
		}
	}

	args(args: string[]): { command: string; args: string[] } {
		return this.access.useSudo
			? { command: "sudo", args: ["-n", "docker", ...args] }
			: { command: "docker", args };
	}

	run(args: string[], options: CommandOptions = {}): Promise<CommandResult> {
		this.requireAccess();
		const { command, args: finalArgs } = this.args(args);
		const timeoutMs =
			options.timeoutMs ??
			(args[0] === "pull" || args[0] === "push" ? PULL_TIMEOUT_MS : undefined);
		return this.runner.run(command, finalArgs, {
			...options,
			timeoutMs,
		});
	}

	async json<T = unknown>(
		args: string[],
		options: CommandOptions = {},
	): Promise<T> {
		const result = await this.run(args, { ...options, allowFailure: false });
		try {
			return JSON.parse(result.stdout) as T;
		} catch {
			throw new CliError(
				`Docker returned malformed JSON for 'docker ${args.join(" ")}'.`,
				{
					code: ExitCode.General,
					hint: "Check the Docker version and retry. If it persists, inspect the installation manually.",
				},
			);
		}
	}

	async optional<T = unknown>(
		args: string[],
		options: CommandOptions = {},
	): Promise<T | null> {
		const result = await this.run(args, {
			...options,
			allowFailure: true,
		});
		if (result.code !== 0) return null;
		try {
			return JSON.parse(result.stdout) as T;
		} catch {
			return null;
		}
	}

	async text(args: string[], options: CommandOptions = {}): Promise<string> {
		const result = await this.run(args, options);
		return result.stdout.trim();
	}

	async runToFile(
		args: string[],
		filePath: string,
		options: FileCommandOptions = {},
	): Promise<CommandResult> {
		this.requireAccess();
		const { command, args: finalArgs } = this.args(args);
		return this.runner.runToFile(command, finalArgs, filePath, {
			timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		});
	}
}

export function dockerFailure(action: string, error: unknown): CliError {
	if (error instanceof CliError) return error;
	return new CliError(
		`${action} failed: ${error instanceof Error ? error.message : String(error)}`,
		{ code: ExitCode.General },
	);
}

export function assertCloudProduct(product: string, action: string): void {
	if (product === "cloud") return;
	throw usageError(
		`${action} only manages Notploy Cloud installations (detected product: ${product}).`,
		"This command never modifies Notploy Self or Console. Use the existing CLI commands for application management.",
	);
}
