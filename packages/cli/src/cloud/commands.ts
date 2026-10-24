import chalk from "chalk";
import type { Command } from "commander";
import { isInteractive, promptText } from "../credentials.js";
import { CliError, ExitCode, normalizeError, usageError } from "../errors.js";
import {
	configureOutput,
	isColorEnabled,
	printDiagnostic,
	printLine,
	printResult,
} from "../output.js";
import { VERSION } from "../version.js";
import { ProcessCommandRunner } from "./docker.js";
import {
	type CloudDoctorReport,
	getCloudStatus,
	runCloudDoctor,
} from "./doctor.js";
import { detectInstallation, type Installation } from "./environment.js";
import {
	getCloudStateDir,
	OperationJournal,
	type OperationRecord,
} from "./journal.js";
import {
	buildUpdatePlan,
	executeCloudRollback,
	executeCloudUpdate,
	planCloudRollback,
	UpdateFailure,
	type UpdatePlan,
} from "./update.js";

export interface CloudCommandContext {
	runner: ProcessCommandRunner;
	json: boolean;
	stateDir?: string;
	command: Command;
}

function globalOptions(command: Command): Record<string, unknown> {
	return command.optsWithGlobals() as Record<string, unknown>;
}

function contextFor(command: Command): CloudCommandContext {
	const merged = globalOptions(command);
	const json = merged.json === true;
	configureOutput({ json, color: merged.ansi !== false });
	const stateDir =
		typeof merged.stateDir === "string" && merged.stateDir.trim()
			? merged.stateDir.trim()
			: undefined;
	return {
		runner: new ProcessCommandRunner(),
		json,
		stateDir,
		command,
	};
}

async function discover(command: Command): Promise<{
	installation: Installation;
	stateDir: string;
	json: boolean;
	runner: ProcessCommandRunner;
}> {
	const context = contextFor(command);
	const env = process.env;
	return {
		installation: await detectInstallation({
			runner: context.runner,
			env,
		}),
		stateDir: context.stateDir ?? getCloudStateDir(env),
		json: context.json,
		runner: context.runner,
	};
}

function label(status: "ok" | "warn" | "fail"): string {
	if (!isColorEnabled()) return `[${status}]`;
	if (status === "ok") return chalk.green("[ok]");
	if (status === "warn") return chalk.yellow("[warn]");
	return chalk.red("[fail]");
}

function humanBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KiB", "MiB", "GiB", "TiB"];
	let value = bytes;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index += 1;
	}
	return `${value.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

function seconds(value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw usageError(
			`Invalid timeout "${value}". Use a positive number of seconds.`,
		);
	}
	return Math.round(parsed * 1000);
}

function gib(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw usageError(
			`Invalid --min-free-gb "${value}". Use a positive number.`,
		);
	}
	return Math.round(parsed * 1024 ** 3);
}

function printOperationSummary(record: OperationRecord): void {
	printLine(`Operation: ${record.id} (${record.kind}, ${record.status})`);
	printLine(
		`Started: ${record.startedAt}${record.finishedAt ? `, finished: ${record.finishedAt}` : ""}`,
	);
	printLine(`Operator: ${record.operator} on ${record.host}`);
	printLine(
		`Version: ${record.fromVersion ?? "unknown"} -> ${record.toVersion ?? "unknown"}${
			record.toTag ? ` (${record.toTag})` : ""
		}`,
	);
	if (record.toDigest) printLine(`Digest: ${record.toDigest}`);
	if (record.previousImage)
		printLine(`Previous image: ${record.previousImage}`);
	if (record.backupPath) printLine(`Backup: ${record.backupPath}`);
	if (
		record.appliedMigrationsBefore !== null ||
		record.appliedMigrationsAfter !== null
	) {
		printLine(
			`Applied migrations: ${record.appliedMigrationsBefore ?? "unknown"} -> ${record.appliedMigrationsAfter ?? "unknown"}`,
		);
	}
	for (const step of record.steps) {
		const detail = step.detail ? ` - ${step.detail}` : "";
		printLine(
			`${label(step.status === "failed" ? "fail" : step.status === "skipped" ? "warn" : step.status === "succeeded" ? "ok" : "warn")} ${step.name}${detail}`,
		);
	}
	if (record.error) printLine(`Error: ${record.error}`);
}

function printPlan(plan: UpdatePlan): void {
	printLine(`Notploy Cloud update plan (${plan.mode})`);
	printLine(`CLI: ${plan.cliVersion}`);
	printLine(
		`Installation: ${plan.installation.product}/${plan.installation.deployment} at ${plan.installation.configDir}`,
	);
	printLine(
		`Version: ${plan.currentVersion ?? "unknown"} -> ${
			plan.updateAvailable ? plan.targetVersion : "no update available"
		}`,
	);
	if (plan.updateAvailable) {
		printLine(
			`Target release: ${plan.targetTag}${plan.releaseUrl ? ` (${plan.releaseUrl})` : ""}`,
		);
		printLine(`Image: ${plan.image}`);
		printLine(`Digest: ${plan.digest ?? "unresolved"}`);
		printLine(
			`Artifact size: ${plan.sizeBytes ? humanBytes(plan.sizeBytes) : "unknown"}${
				plan.platform ? `, platform ${plan.platform}` : ""
			}`,
		);
	}
	printLine("");
	for (const check of plan.checks) {
		printLine(
			`${label(check.ok ? "ok" : "fail")} ${check.id}: ${check.detail}`,
		);
	}
	if (plan.compatibility.warnings.length > 0) {
		for (const warning of plan.compatibility.warnings) {
			printLine(`${label("warn")} ${warning}`);
		}
	}
	if (plan.migrations) {
		printLine(
			`${label(plan.migrations.status === "known" ? "ok" : "warn")} migrations: ${
				plan.migrations.status === "known"
					? `${plan.migrations.pendingMigrations} pending (${plan.migrations.appliedMigrations}/${plan.migrations.imageMigrations} applied)`
					: (plan.migrations.detail ?? "not determinable")
			}`,
		);
	}
	printLine("");
	if (plan.updateAvailable) {
		printLine("Planned operations:");
		for (const [index, operation] of plan.operations.entries()) {
			printLine(`  ${index + 1}. ${operation}`);
		}
	}
	if (plan.risks.length > 0) {
		printLine("");
		printLine("Risks:");
		for (const risk of plan.risks) printLine(`  - ${risk}`);
	}
	if (plan.blockers.length > 0) {
		printLine("");
		printLine("Blockers:");
		for (const blocker of plan.blockers) printLine(`  - ${blocker}`);
	}
	if (plan.unverified.length > 0) {
		printLine("");
		printLine("Not verifiable right now:");
		for (const item of plan.unverified) printLine(`  - ${item}`);
	}
	if (plan.mode !== "apply") {
		printLine("");
		printLine(
			`Result: ${plan.updateAvailable ? (plan.canProceed ? "ready to update" : "blocked") : "already up to date"}.`,
		);
		if (plan.updateAvailable) {
			printLine(
				"A dry run is not a guarantee: it reflects the state at check time and does not download the artifact unless it was already present.",
			);
		}
	}
}

async function confirmDestructive(options: {
	yes: boolean;
	expected: string;
	question: string;
	hint: string;
}): Promise<void> {
	if (options.yes) return;
	if (!isInteractive()) {
		throw usageError(
			"Confirmation is required in a non-interactive environment.",
			`${options.hint} Re-run with --yes to confirm explicitly.`,
		);
	}
	const answer = await promptText(
		`${options.question} Type "${options.expected}" to continue: `,
	);
	if (answer !== options.expected) {
		throw usageError(
			"Confirmation did not match; nothing was changed.",
			`Type exactly "${options.expected}" to proceed.`,
		);
	}
}

function printOutcome(
	outcome: {
		status: string;
		operationId: string;
		journalPath: string;
		fromVersion: string | null;
		toVersion: string;
		backupPath: string | null;
		recovery?: string;
		durationMs: number;
	},
	json: boolean,
): void {
	if (json) {
		printResult(outcome);
		return;
	}
	printLine("");
	printLine(
		outcome.status === "succeeded"
			? `Update succeeded: ${outcome.fromVersion ?? "unknown"} -> ${outcome.toVersion}.`
			: `Operation ${outcome.status}: ${outcome.operationId}.`,
	);
	printLine(`Journal: ${outcome.journalPath}`);
	if (outcome.backupPath) printLine(`Backup: ${outcome.backupPath}`);
	printLine(`Duration: ${Math.round(outcome.durationMs / 1000)}s`);
	if (outcome.recovery) {
		printLine("");
		printLine(outcome.recovery);
	}
}

function failUpdate(error: unknown, json: boolean): void {
	if (error instanceof UpdateFailure) {
		const outcome = error.outcome;
		const cause = error.cause;
		const code = cause instanceof CliError ? cause.code : ExitCode.General;
		if (json) {
			printResult({
				status: outcome.status,
				operationId: outcome.operationId,
				journalPath: outcome.journalPath,
				fromVersion: outcome.fromVersion,
				toVersion: outcome.toVersion,
				backupPath: outcome.backupPath,
				error: cause instanceof Error ? cause.message : String(cause),
				hint: cause instanceof CliError ? cause.hint : undefined,
				recovery: outcome.recovery,
			});
		} else {
			const normalized = normalizeError(cause);
			printDiagnostic(`${label("fail")} ${normalized.message}`);
			if (normalized.hint) printDiagnostic(normalized.hint);
			printLine("");
			printLine(outcome.recovery ?? "The update failed.");
			printLine(`Journal: ${outcome.journalPath}`);
		}
		process.exitCode = code;
		return;
	}

	const normalized = normalizeError(error);
	process.exitCode = normalized.code;
	if (json) {
		printResult({
			error: {
				code: normalized.code,
				message: normalized.message,
				hint: normalized.hint,
			},
		});
	} else {
		printDiagnostic(`error: ${normalized.message}`);
		if (normalized.hint) printDiagnostic(normalized.hint);
	}
}

function registerStatus(cloud: Command): void {
	cloud
		.command("status")
		.description("Show the Cloud installation, services and update state")
		.option("--check", "Also check the published Cloud release (network)")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json, runner } = await discover(command);
			const merged = globalOptions(command);
			try {
				const report = await getCloudStatus({
					installation,
					runner,
					cliVersion: VERSION,
					stateDir,
					check: merged.check === true,
					now: () => new Date(),
				});
				if (json) {
					printResult(report);
				} else {
					printLine(`Notploy Cloud status (CLI ${report.cliVersion})`);
					printLine(
						`Installation: ${report.product}/${report.deployment}${
							report.detected ? "" : " (not detected)"
						}`,
					);
					if (!report.detected) {
						for (const issue of report.issues) printLine(`  - ${issue}`);
						return;
					}
					printLine(
						`Installed: ${report.installedVersion ?? "unknown"} (${
							report.releaseTag ?? "tag unknown"
						})`,
					);
					if (report.image) printLine(`Image: ${report.image}`);
					printLine(
						`Config: ${report.configDir}${report.configDirWritable ? "" : " (not writable)"}`,
					);
					printLine(`Health URL: ${report.healthUrl}`);
					printLine("Services:");
					for (const service of report.services) {
						printLine(
							`  ${label(service.healthy ? "ok" : "fail")} ${service.name}: ${
								service.kind === "service"
									? `${service.runningReplicas ?? "?"}/${service.desiredReplicas ?? "?"} running`
									: service.state
							}${service.detail ? ` (${service.detail})` : ""}`,
						);
					}
					printLine(
						`Disk: ${humanBytes(report.disk.freeBytes)} free at ${report.disk.path}`,
					);
					printLine(
						`Maintenance lock: ${
							report.lock.active
								? `held (${report.lock.detail})`
								: report.lock.stale
									? `stale (${report.lock.detail})`
									: "free"
						}`,
					);
					if (report.lastOperation) {
						printLine(
							`Last operation: ${report.lastOperation.id} ${report.lastOperation.status} (${report.lastOperation.startedAt})`,
						);
					}
					if (report.updateCheckError) {
						printLine(`Update check: unavailable (${report.updateCheckError})`);
					} else if (report.latestRelease) {
						printLine(
							`Published: ${report.latestRelease.version} (${report.latestRelease.tag})${
								report.updateAvailable ? " - update available" : " - up to date"
							}`,
						);
					}
					if (report.issues.length > 0) {
						printLine("Issues:");
						for (const issue of report.issues) printLine(`  - ${issue}`);
					}
				}
			} catch (error) {
				failUpdate(error, json);
			}
		});
}

function registerVersion(cloud: Command): void {
	cloud
		.command("version")
		.description("Show the installed and available Cloud versions")
		.option("--check", "Check the published release index (network)")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json, runner } = await discover(command);
			const merged = globalOptions(command);
			try {
				if (!installation.detected) {
					throw usageError(
						"No Notploy installation was detected on this host.",
						installation.issues[0],
					);
				}
				const report = await getCloudStatus({
					installation,
					runner,
					cliVersion: VERSION,
					stateDir,
					check: merged.check === true,
					now: () => new Date(),
				});
				const payload = {
					cliVersion: report.cliVersion,
					installedVersion: report.installedVersion,
					installedTag: report.releaseTag,
					image: report.image,
					latestVersion: report.latestRelease?.version ?? null,
					latestTag: report.latestRelease?.tag ?? null,
					updateAvailable: report.updateAvailable,
					checkError: report.updateCheckError,
					checkedAt: report.checkedAt,
				};
				if (json) {
					printResult(payload);
				} else {
					printLine(`CLI: ${payload.cliVersion}`);
					printLine(
						`Installed Cloud: ${payload.installedVersion ?? "unknown"}${
							payload.installedTag ? ` (${payload.installedTag})` : ""
						}`,
					);
					if (payload.latestVersion) {
						printLine(
							`Published Cloud: ${payload.latestVersion} (${payload.latestTag})`,
						);
						printLine(
							payload.updateAvailable
								? "Update available. Run 'notploy cloud update --dry-run'."
								: "Already up to date.",
						);
					} else if (payload.checkError) {
						printLine(`Published Cloud: unavailable (${payload.checkError})`);
					} else if (!merged.check) {
						printLine("Published Cloud: not checked (pass --check)");
					}
				}
			} catch (error) {
				failUpdate(error, json);
			}
		});
}

function registerDoctor(cloud: Command): void {
	cloud
		.command("doctor")
		.description("Diagnose the Cloud installation without changing it")
		.option("--offline", "Skip release, registry and health checks")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json, runner } = await discover(command);
			const merged = globalOptions(command);
			try {
				const report: CloudDoctorReport = await runCloudDoctor({
					installation,
					runner,
					cliVersion: VERSION,
					stateDir,
					offline: merged.offline === true,
					now: () => new Date(),
				});
				if (json) {
					printResult(report);
				} else {
					printLine(`Notploy Cloud doctor (CLI ${report.cliVersion})`);
					for (const check of report.checks) {
						printLine(`${label(check.status)} ${check.id}: ${check.message}`);
						if (check.hint) printLine(`      ${check.hint}`);
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
				failUpdate(error, json);
			}
		});
}

function registerUpdate(cloud: Command): void {
	cloud
		.command("update")
		.description("Check, simulate or apply a Cloud update")
		.option("--check", "Show the resolved target and compatibility only")
		.option(
			"--dry-run",
			"Run all read-only preflight checks without changing anything",
		)
		.option("--to <version>", "Target a published Cloud version")
		.option("--image <reference>", "Cloud image repository (mirror)")
		.option("--yes", "Do not prompt for confirmation (non-interactive)")
		.option("--allow-major", "Allow a cross-major update")
		.option(
			"--allow-unsigned-artifact",
			"Accept digest verification without cosign",
		)
		.option("--min-free-gb <number>", "Extra free-space requirement in GiB")
		.option(
			"--wait-timeout <seconds>",
			"Swarm convergence timeout (default 300)",
		)
		.option(
			"--health-timeout <seconds>",
			"Post-update health timeout (default 90)",
		)
		.option("--force-unlock", "Clear a stale maintenance lock")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json, runner } = await discover(command);
			const merged = globalOptions(command);
			try {
				if (merged.check === true && merged.dryRun === true) {
					throw usageError("--check and --dry-run are mutually exclusive.");
				}
				const mode =
					merged.check === true
						? "check"
						: merged.dryRun === true
							? "dry-run"
							: "apply";
				const plan = await buildUpdatePlan({
					installation,
					runner,
					cliVersion: VERSION,
					stateDir,
					mode,
					requestedVersion:
						typeof merged.to === "string" ? merged.to : undefined,
					image: typeof merged.image === "string" ? merged.image : undefined,
					allowMajor: merged.allowMajor === true,
					minFreeBytes: gib(
						typeof merged.minFreeGb === "string" ? merged.minFreeGb : undefined,
					),
					now: () => new Date(),
				});

				if (mode !== "apply") {
					if (json) printResult(plan);
					else printPlan(plan);
					process.exitCode =
						plan.updateAvailable && plan.blockers.length > 0
							? ExitCode.Usage
							: ExitCode.Success;
					return;
				}

				if (!plan.canProceed) {
					if (json) printResult(plan);
					else printPlan(plan);
					process.exitCode = ExitCode.Usage;
					return;
				}

				await confirmDestructive({
					yes: merged.yes === true,
					expected: plan.targetVersion,
					question: `Update Notploy Cloud from ${plan.currentVersion ?? "unknown"} to ${plan.targetVersion}?`,
					hint: "This takes a database backup, downloads and verifies the image, then rolls the service.",
				});

				const outcome = await executeCloudUpdate({
					plan,
					runner,
					installation,
					stateDir,
					allowUnsignedArtifact: merged.allowUnsignedArtifact === true,
					forceUnlock: merged.forceUnlock === true,
					waitTimeoutMs: seconds(
						typeof merged.waitTimeout === "string"
							? merged.waitTimeout
							: undefined,
						300_000,
					),
					healthTimeoutMs: seconds(
						typeof merged.healthTimeout === "string"
							? merged.healthTimeout
							: undefined,
						90_000,
					),
					onProgress: (message) => printDiagnostic(message),
					now: () => new Date(),
				});
				printOutcome(outcome, json);
			} catch (error) {
				failUpdate(error, json);
			}
		});
}

function registerLogs(cloud: Command): void {
	cloud
		.command("logs")
		.description("Show the journal of update and rollback operations")
		.option("--operation <id>", "Show one operation by id")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const context = contextFor(command);
			const merged = globalOptions(command);
			const stateDir = context.stateDir ?? getCloudStateDir(process.env);
			try {
				let record: OperationRecord | null = null;
				if (typeof merged.operation === "string") {
					record = OperationJournal.findById(stateDir, merged.operation);
					if (!record) {
						throw usageError(
							`Operation ${merged.operation} was not found in ${stateDir}.`,
							"Run 'notploy cloud logs' to list recorded operations.",
						);
					}
				} else {
					record = OperationJournal.latest(stateDir);
				}

				if (!record) {
					if (context.json) {
						printResult({
							stateDir,
							operations: [],
							message: "No operation has been recorded on this host.",
						});
					} else {
						printLine(`No operation has been recorded in ${stateDir}.`);
					}
					return;
				}

				if (context.json) {
					printResult(record);
				} else {
					printOperationSummary(record);
					printLine(`Journal file: ${stateDir}/operations/${record.id}.json`);
				}
			} catch (error) {
				failUpdate(error, context.json);
			}
		});
}

function registerRecover(cloud: Command): void {
	cloud
		.command("recover")
		.description("Assess recovery options for the last operation (read-only)")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json } = await discover(command);
			try {
				const last = OperationJournal.latest(stateDir);
				const rollback = planCloudRollback({
					installation,
					stateDir,
				});
				const payload = {
					installation: {
						product: installation.product,
						deployment: installation.deployment,
						installedVersion: installation.installedVersion,
					},
					lastOperation: last,
					rollback,
					manualSteps: [
						`Inspect the journal: notploy cloud logs${last ? ` --operation ${last.id}` : ""}`,
						"Inspect Swarm tasks: docker service ps notploy --no-trunc",
						"Inspect application logs: docker service logs --tail 200 notploy",
						"A database restore is destructive and is never performed by a diagnostic command.",
					],
				};
				if (json) {
					printResult(payload);
					return;
				}
				printLine("Notploy Cloud recovery assessment (read-only)");
				printLine(
					`Installed: ${installation.installedVersion ?? "unknown"} (${installation.product}/${installation.deployment})`,
				);
				if (last) {
					printLine(
						`Last operation: ${last.id} ${last.status} (${last.kind}, ${last.startedAt})`,
					);
					if (last.error) printLine(`Error: ${last.error}`);
				} else {
					printLine("Last operation: none recorded");
				}
				printLine("");
				printLine(
					`Image rollback: ${rollback.possible ? `possible to ${rollback.previousVersion}` : `not possible - ${rollback.reason}`}`,
				);
				if (rollback.warnings.length > 0) {
					for (const warning of rollback.warnings) printLine(`  - ${warning}`);
				}
				printLine("");
				printLine("Manual steps:");
				for (const step of payload.manualSteps) printLine(`  - ${step}`);
				if (rollback.manualRestore.length > 0) {
					printLine("");
					printLine("Database restore (destructive, operator-confirmed only):");
					for (const step of rollback.manualRestore) printLine(`  ${step}`);
				}
			} catch (error) {
				failUpdate(error, json);
			}
		});
}

function registerRollback(cloud: Command): void {
	cloud
		.command("rollback")
		.description(
			"Assess or perform an image rollback to the last known-good version",
		)
		.option("--plan", "Only show the rollback feasibility (read-only)")
		.option("--confirm <version>", "Confirm the exact version to roll back to")
		.option("--yes", "Do not prompt for confirmation (non-interactive)")
		.option(
			"--allow-unsigned-artifact",
			"Accept digest verification without cosign",
		)
		.option(
			"--wait-timeout <seconds>",
			"Swarm convergence timeout (default 300)",
		)
		.option("--health-timeout <seconds>", "Health timeout (default 90)")
		.option("--force-unlock", "Clear a stale maintenance lock")
		.option("--state-dir <path>", "Maintenance state directory")
		.action(async (_options, command: Command) => {
			const { installation, stateDir, json, runner } = await discover(command);
			const merged = globalOptions(command);
			try {
				const plan = planCloudRollback({ installation, stateDir });
				if (merged.plan === true || merged.confirm === undefined) {
					if (json) {
						printResult(plan);
						return;
					}
					printLine("Notploy Cloud rollback plan (read-only)");
					printLine(
						`Current: ${plan.currentVersion ?? "unknown"}; last known-good: ${plan.previousVersion ?? "unknown"}`,
					);
					printLine(
						`Result: ${plan.possible ? "image rollback possible" : "not possible"}${
							plan.reason ? ` - ${plan.reason}` : ""
						}`,
					);
					if (plan.operations.length > 0) {
						printLine("Planned operations:");
						for (const operation of plan.operations)
							printLine(`  - ${operation}`);
					}
					for (const warning of plan.warnings) printLine(`warning: ${warning}`);
					if (plan.manualRestore.length > 0) {
						printLine("");
						printLine("Database restore (manual, destructive):");
						for (const step of plan.manualRestore) printLine(`  ${step}`);
					}
					process.exitCode = plan.possible ? ExitCode.Success : ExitCode.Usage;
					return;
				}

				if (!plan.possible || !plan.previousVersion) {
					throw usageError(
						"An image rollback is not possible for this installation.",
						plan.reason ??
							"Run 'notploy cloud rollback --plan' to see why. A database restore is a separate manual procedure.",
					);
				}
				await confirmDestructive({
					yes: merged.yes === true,
					expected: plan.previousVersion,
					question: `Roll Notploy Cloud back to ${plan.previousVersion}?`,
					hint:
						plan.reason ??
						"This changes the running image; data written by the newer version is not reverted.",
				});
				const outcome = await executeCloudRollback({
					installation,
					plan,
					runner,
					confirmVersion: String(merged.confirm),
					stateDir,
					allowUnsignedArtifact: merged.allowUnsignedArtifact === true,
					waitTimeoutMs: seconds(
						typeof merged.waitTimeout === "string"
							? merged.waitTimeout
							: undefined,
						300_000,
					),
					healthTimeoutMs: seconds(
						typeof merged.healthTimeout === "string"
							? merged.healthTimeout
							: undefined,
						90_000,
					),
					forceUnlock: merged.forceUnlock === true,
					onProgress: (message) => printDiagnostic(message),
					now: () => new Date(),
				});
				printOutcome(outcome, json);
			} catch (error) {
				failUpdate(error, json);
			}
		});
}

/**
 * Registers `notploy cloud`. Application/project/deployment commands are left
 * untouched: they are generated API operations and never manage the platform.
 */
export function registerCloudCommands(program: Command): void {
	if (program.commands.some((command) => command.name() === "cloud")) return;
	const cloud = program
		.command("cloud")
		.description(
			"Administer the Notploy Cloud installation that hosts this platform",
		)
		.action(() => {
			cloud.help();
		});

	registerStatus(cloud);
	registerVersion(cloud);
	registerDoctor(cloud);
	registerUpdate(cloud);
	registerLogs(cloud);
	registerRecover(cloud);
	registerRollback(cloud);
}
