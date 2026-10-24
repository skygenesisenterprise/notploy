import * as path from "node:path";
import { CliError, ExitCode, redactSecrets, usageError } from "../errors.js";
import { clearInterruptHandler, setInterruptHandler } from "../interrupt.js";
import type { CommandRunner } from "./docker.js";
import { Docker } from "./docker.js";
import type { Installation, ServiceStatus } from "./environment.js";
import {
	acquireLock,
	assessLock,
	ensurePrivateDir,
	findUnfinishedOperation,
	getBackupDir,
	getCloudStateDir,
	OperationJournal,
	type OperationRecord,
	releaseLock,
} from "./journal.js";
import {
	checkDiskSpace,
	createDatabaseBackup,
	detectMigrations,
	findPostgresContainer,
	imageIsLocal,
	type MigrationState,
	probeHealth,
	recentServiceTasks,
	requireBackupCapability,
	waitForServiceConvergence,
} from "./preflight.js";
import {
	DEFAULT_CLOUD_IMAGE,
	parseImageReference,
	resolveImageManifest,
} from "./registry.js";
import {
	type CloudRelease,
	checkCloudCompatibility,
	type FetchLike,
	fetchCloudReleases,
	normalizeCloudVersion,
	resolveCloudTarget,
} from "./release.js";

/**
 * Cloud update orchestration.
 *
 * The installation is a Docker Swarm service. The CLI reuses the mechanisms
 * already shipped by the repository: the `notploy-cloud` image published by
 * docker-publish.yml, its cosign signature, Swarm rolling updates, and the
 * container entrypoint's Drizzle migrations. It does not duplicate any of them.
 */

export const UPDATE_STEPS = [
	"preflight",
	"backup",
	"pull",
	"verify-artifact",
	"migrations",
	"switch",
	"converge",
	"health",
	"verify-version",
] as const;

export const ROLLBACK_STEPS = [
	"preflight",
	"verify-artifact",
	"switch",
	"converge",
	"health",
	"verify-version",
] as const;

export const COSIGN_IDENTITY_REGEXP =
	"^https://github\\.com/skygenesisenterprise/notploy/\\.github/workflows/docker-publish\\.yml@refs/tags/v.*$";
export const COSIGN_OIDC_ISSUER = "https://token.actions.githubusercontent.com";

export interface PlanCheck {
	id: string;
	ok: boolean;
	detail: string;
	hint?: string;
}

export interface UpdatePlan {
	mode: "check" | "dry-run" | "apply";
	updateAvailable: boolean;
	cliVersion: string;
	installation: {
		product: string;
		deployment: string;
		configDir: string;
		healthUrl: string;
	};
	currentVersion: string | null;
	currentTag: string | null;
	currentImage: string | null;
	targetVersion: string;
	targetTag: string;
	releaseUrl: string | null;
	publishedAt: string | null;
	image: string;
	reference: string | null;
	digest: string | null;
	sizeBytes: number | null;
	platform: string | null;
	compatibility: {
		compatible: boolean;
		blockers: string[];
		warnings: string[];
	};
	checks: PlanCheck[];
	migrations: MigrationState | null;
	operations: string[];
	risks: string[];
	blockers: string[];
	unverified: string[];
	backupDir: string;
	lock: { active: boolean; stale: boolean; detail: string | null };
	canProceed: boolean;
}

export interface PlanOptions {
	installation: Installation;
	runner: CommandRunner;
	cliVersion: string;
	mode?: "check" | "dry-run" | "apply";
	stateDir?: string;
	requestedVersion?: string;
	image?: string;
	allowMajor?: boolean;
	minFreeBytes?: number;
	offline?: boolean;
	fetchImpl?: FetchLike;
	env?: NodeJS.ProcessEnv;
	platform?: string;
	statfs?: Parameters<typeof checkDiskSpace>[0]["statfs"];
	now?: () => Date;
}

function assertUsableInstallation(installation: Installation): void {
	if (!installation.detected) {
		throw usageError(
			"No Notploy installation was found on this host.",
			installation.issues[0] ??
				"Run 'notploy cloud doctor' on the Cloud host, or verify Docker access.",
		);
	}
	if (installation.deployment !== "swarm") {
		throw usageError(
			`This installation uses the '${installation.deployment}' deployment mode, which this command does not update.`,
			"Compose stacks are updated with 'docker compose pull && docker compose up -d'. See the Cloud administration runbook.",
		);
	}
	if (installation.product !== "cloud") {
		throw usageError(
			`This command only manages Notploy Cloud installations (detected: ${installation.product}).`,
			"Notploy Self and Console are intentionally excluded from the automated Cloud update path.",
		);
	}
	if (!installation.capabilities.update) {
		throw usageError(
			installation.capabilities.reasons.update ??
				"This installation cannot be updated by the CLI.",
		);
	}
}

function previousServiceStatus(
	services: ServiceStatus[],
): ServiceStatus | undefined {
	return services.find((service) => service.name === "notploy");
}

export async function buildUpdatePlan(
	options: PlanOptions,
): Promise<UpdatePlan> {
	const installation = options.installation;
	assertUsableInstallation(installation);
	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const docker = new Docker(options.runner, installation.docker);
	const imageInput = options.image?.trim() || DEFAULT_CLOUD_IMAGE;
	if (imageInput.includes("@")) {
		throw usageError(
			"--image must name a repository, not a digest. The CLI resolves and pins the digest itself.",
		);
	}

	const releases = await fetchCloudReleases({
		fetchImpl: options.fetchImpl,
		env,
	});
	const { release, reason } = resolveCloudTarget({
		currentVersion: installation.installedVersion,
		releases,
		requested: options.requestedVersion,
	});
	const upToDate = reason === "already up to date";
	const target = release ?? newestReleaseForReport(releases, upToDate);

	if (!target) {
		throw usageError(
			`No Cloud update is available: ${reason}.`,
			"The installation is already on the newest published Cloud release.",
		);
	}

	const compatibilityReport = checkCloudCompatibility({
		currentVersion: installation.installedVersion,
		targetVersion: target.version,
		allowMajor: options.allowMajor,
	});
	// "Already installed" is a normal outcome of a read-only check, not a
	// blocked update. Applying an update still refuses it below because the
	// target resolution returns no target when the version is current.
	const compatibility = upToDate
		? {
				compatible: true,
				blockers: [],
				warnings: compatibilityReport.warnings,
			}
		: compatibilityReport;

	const referenceInput = parseImageReference(`${imageInput}:${target.tag}`);
	const image = `${referenceInput.registry}/${referenceInput.repository}`;
	const manifest = await resolveImageManifest(`${image}:${target.tag}`, {
		fetchImpl: options.fetchImpl,
		env,
		platform: options.platform,
	});

	const checks: PlanCheck[] = [];
	const blockers = [...compatibility.blockers];
	const risks = [...compatibility.warnings];
	const unverified: string[] = [];

	// Disk space: the layers are downloaded and extracted, and a database dump
	// is written next to the installation.
	const requiredDisk = (manifest.sizeBytes ?? 0) * 2;
	const disk = checkDiskSpace({
		path: stateDir,
		requiredBytes: requiredDisk,
		minFreeBytes: options.minFreeBytes,
		statfs: options.statfs,
	});
	checks.push({
		id: "disk",
		ok: disk.ok,
		detail: disk.ok
			? `${(disk.freeBytes / 1024 ** 3).toFixed(1)} GiB free at ${disk.path}.`
			: (disk.hint ?? "Insufficient free disk space."),
		hint: disk.hint,
	});
	if (!disk.ok) blockers.push(disk.hint ?? "Insufficient free disk space.");

	const postgres = await findPostgresContainer(docker);
	checks.push({
		id: "backup-capability",
		ok: Boolean(postgres),
		detail: postgres
			? `PostgreSQL container '${postgres.name}' is reachable.`
			: "The PostgreSQL container was not found.",
		hint: postgres
			? undefined
			: "A verified database backup is mandatory before an update.",
	});
	if (!postgres) {
		blockers.push(
			"A verified database backup cannot be taken because the PostgreSQL container is missing.",
		);
	}

	const lock = assessLock(stateDir, {
		now: (options.now ?? (() => new Date()))().getTime(),
	});
	checks.push({
		id: "lock",
		ok: !lock.lock || lock.stale,
		detail: lock.lock
			? `Maintenance lock held by pid ${lock.lock.pid} on ${lock.lock.host}${
					lock.stale ? ` (stale: ${lock.reason})` : ""
				}.`
			: "No maintenance operation is running.",
		hint: lock.lock && !lock.stale ? "Wait for it to finish." : undefined,
	});
	if (lock.lock && !lock.stale) {
		blockers.push(
			`Another maintenance operation is running (pid ${lock.lock.pid} on ${lock.lock.host}).`,
		);
	}

	const imageBefore = await imageIsLocal(docker, manifest.reference);
	const planMode = options.mode ?? "check";
	const migrations =
		planMode === "check" && !imageBefore
			? null
			: await detectMigrations({
					docker,
					imageReference: manifest.reference,
					postgres,
					imageAvailable: imageBefore,
				});
	if (migrations?.status === "unknown" && migrations.detail) {
		unverified.push(migrations.detail);
	}

	// Service readiness is a precondition: updating a broken installation can
	// hide the original failure behind the new one.
	const notployService = previousServiceStatus(installation.services);
	if (!notployService) {
		blockers.push("The 'notploy' Swarm service was not found.");
	} else if (!notployService.healthy) {
		risks.push(
			`The current 'notploy' service is not healthy (${notployService.runningReplicas ?? "?"}/${notployService.desiredReplicas ?? "?"} running). Consider running 'notploy cloud doctor' before updating.`,
		);
	}

	const unfinished = findUnfinishedOperation(stateDir);
	if (unfinished) {
		risks.push(
			`A previous ${unfinished.kind} operation ${unfinished.id} is ${unfinished.status}. Inspect it with 'notploy cloud logs --operation ${unfinished.id}' before updating.`,
		);
	}

	const operations = [
		`Take and verify a PostgreSQL backup in ${path.join(stateDir, "backups")}.`,
		`Download ${manifest.reference} (compressed size: ${
			manifest.sizeBytes
				? `${(manifest.sizeBytes / 1024 ** 2).toFixed(0)} MiB`
				: "unknown"
		}).`,
		"Verify the image digest and its cosign keyless signature.",
		migrations
			? migrations.status === "known"
				? `Apply ${migrations.pendingMigrations ?? "unknown"} pending migration(s) through the existing container entrypoint.`
				: "Apply pending migrations through the container entrypoint (count could not be pre-verified)."
			: "Apply pending migrations through the container entrypoint (not inspected in --check mode).",
		`Update the 'notploy' service to ${target.tag} with RELEASE_TAG set, leaving PostgreSQL and Traefik untouched.`,
		"Wait for Swarm convergence and probe /api/trpc/settings.health.",
		"Verify the running image digest and recorded release tag.",
	];

	const uniqueBlockers = [...new Set(blockers)];
	const plan: UpdatePlan = {
		mode: planMode,
		updateAvailable: !upToDate,
		cliVersion: options.cliVersion,
		installation: {
			product: installation.product,
			deployment: installation.deployment,
			configDir: installation.configDir,
			healthUrl: installation.healthUrl,
		},
		currentVersion: installation.installedVersion,
		currentTag: installation.releaseTag,
		currentImage: installation.image,
		targetVersion: target.version,
		targetTag: target.tag,
		releaseUrl: target.releaseUrl,
		publishedAt: target.publishedAt,
		image,
		reference: manifest.reference,
		digest: manifest.digest,
		sizeBytes: manifest.sizeBytes,
		platform: manifest.platform,
		compatibility,
		checks,
		migrations,
		operations,
		risks,
		blockers: uniqueBlockers,
		unverified,
		backupDir: getBackupDir(stateDir),
		lock: {
			active: Boolean(lock.lock && !lock.stale),
			stale: Boolean(lock.lock && lock.stale),
			detail: lock.lock
				? `pid ${lock.lock.pid} on ${lock.lock.host}, started ${lock.lock.startedAt}`
				: null,
		},
		canProceed: uniqueBlockers.length === 0,
	};
	return plan;
}

/**
 * In `--check` mode, "already up to date" is a successful result: the report
 * still shows the newest release so an operator can see what is installed and
 * what is published. Applying an update returns no target instead.
 */
function newestReleaseForReport(
	releases: CloudRelease[],
	upToDate: boolean,
): CloudRelease | null {
	return upToDate ? (releases[0] ?? null) : null;
}

export interface ExecuteOptions {
	plan: UpdatePlan;
	runner: CommandRunner;
	installation: Installation;
	stateDir?: string;
	env?: NodeJS.ProcessEnv;
	allowUnsignedArtifact?: boolean;
	forceUnlock?: boolean;
	waitTimeoutMs?: number;
	healthTimeoutMs?: number;
	fetchImpl?: FetchLike;
	now?: () => Date;
	onProgress?: (message: string) => void;
	sleepImpl?: (ms: number) => Promise<void>;
}

export interface UpdateOutcome {
	status: "succeeded" | "failed" | "interrupted";
	operationId: string;
	journalPath: string;
	fromVersion: string | null;
	toVersion: string;
	backupPath: string | null;
	recovery?: string;
	durationMs: number;
}

function defaultSleeper(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyCosignSignature(options: {
	runner: CommandRunner;
	reference: string;
}): Promise<{ ok: boolean; detail: string; unavailable: boolean }> {
	// cosign is intentionally not shelled out through a shell: the reference is
	// validated by parseImageReference before it gets here.
	try {
		const result = await options.runner.run(
			"cosign",
			[
				"verify",
				"--certificate-identity-regexp",
				COSIGN_IDENTITY_REGEXP,
				"--certificate-oidc-issuer",
				COSIGN_OIDC_ISSUER,
				options.reference,
			],
			{ timeoutMs: 120_000, allowFailure: true },
		);
		if (result.code === 0) {
			return {
				ok: true,
				detail:
					"cosign verified the image signature against the Notploy release workflow identity.",
				unavailable: false,
			};
		}
		const text = redactSecrets(
			`${result.stdout}\n${result.stderr}`
				.trim()
				.split("\n")
				.slice(-6)
				.join("\n"),
		);
		return {
			ok: false,
			detail: text || `cosign exited with code ${result.code}.`,
			unavailable: result.code === 127,
		};
	} catch (error) {
		if (
			error instanceof CliError &&
			/cosign.*not installed|Cannot execute 'cosign'|ENOENT/i.test(
				error.message,
			)
		) {
			return {
				ok: false,
				detail: "cosign is not installed.",
				unavailable: true,
			};
		}
		return {
			ok: false,
			detail: redactSecrets(
				error instanceof Error ? error.message : String(error),
			),
			unavailable: false,
		};
	}
}

function nowMs(now: () => Date): number {
	return now().getTime();
}

/**
 * Executes a plan that passed its preflight. The order is fixed and every step
 * is journaled; a failure stops the process immediately and never reports
 * success for a partial rollout.
 */
export async function executeCloudUpdate(
	options: ExecuteOptions,
): Promise<UpdateOutcome> {
	const { plan, installation } = options;
	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const docker = new Docker(options.runner, installation.docker);
	const now = options.now ?? (() => new Date());
	const startedAt = nowMs(now);
	const progress = options.onProgress ?? (() => {});
	const sleepImpl = options.sleepImpl ?? defaultSleeper;

	if (!plan.canProceed) {
		throw usageError(
			"The update cannot proceed because blocking preconditions were reported.",
			`${plan.blockers.join(" ")} Resolve them and re-run 'notploy cloud update --dry-run'.`,
		);
	}
	if (!plan.reference || !plan.digest) {
		throw usageError(
			"The update plan has no verified artifact reference.",
			"Re-run 'notploy cloud update --check' to resolve the target release.",
		);
	}

	ensurePrivateDir(stateDir);
	let lockAcquired = false;
	const journal = OperationJournal.create(stateDir, {
		kind: "update",
		fromVersion: installation.installedVersion,
		toVersion: plan.targetVersion,
		toTag: plan.targetTag,
		toDigest: plan.digest,
		previousImage: installation.image,
		previousTag: installation.releaseTag,
		steps: [...UPDATE_STEPS],
		now,
		env,
	});

	const fail = (error: unknown): UpdateOutcome => {
		const message = redactSecrets(
			error instanceof Error ? error.message : String(error),
		);
		journal.markRunningStepsFailed(message);
		journal.finish("failed", message);
		clearInterruptHandler();
		if (lockAcquired) releaseLock(stateDir, { host: journal.record.host });
		const recovery = buildRecoveryGuidance({ record: journal.record });
		return {
			status: "failed",
			operationId: journal.record.id,
			journalPath: journal.file,
			fromVersion: installation.installedVersion,
			toVersion: plan.targetVersion,
			backupPath: journal.record.backupPath,
			recovery,
			durationMs: nowMs(now) - startedAt,
		};
	};

	// A second SIGINT: the process-wide handler still exits with 130, but the
	// journal and the lock are already consistent.
	setInterruptHandler(() => {
		journal.markRunningStepsFailed("interrupted by an operator");
		journal.finish("interrupted", "interrupted by SIGINT");
		if (lockAcquired) releaseLock(stateDir, { host: journal.record.host });
	});

	try {
		acquireLock(stateDir, {
			operation: `update ${plan.currentVersion ?? "unknown"} -> ${plan.targetVersion}`,
			now,
			force: options.forceUnlock,
		});
		lockAcquired = true;

		journal.stepStarted("preflight");
		journal.stepFinished(
			"preflight",
			"succeeded",
			`${plan.currentVersion ?? "unknown"} -> ${plan.targetVersion}; digest ${plan.digest ?? "unknown"}`,
		);
		progress(
			`Preflight passed: ${plan.currentVersion ?? "unknown"} -> ${plan.targetVersion}`,
		);

		journal.stepStarted("backup");
		const postgres = requireBackupCapability(
			await findPostgresContainer(docker),
		);
		const backup = await createDatabaseBackup({
			docker,
			stateDir,
			container: postgres,
			now,
		});
		journal.setBackup(backup.path);
		journal.stepFinished(
			"backup",
			"succeeded",
			`${backup.path} (${(backup.sizeBytes / 1024 ** 2).toFixed(1)} MiB)`,
		);
		progress(`Database backup verified: ${backup.path}`);

		journal.stepStarted("pull", plan.reference ?? undefined);
		await docker.run(["pull", plan.reference as string], {
			timeoutMs: 15 * 60_000,
		});
		journal.stepFinished("pull", "succeeded", plan.reference ?? undefined);
		progress("Image downloaded.");

		journal.stepStarted("verify-artifact");
		const repoDigests = await docker.json<string[]>(
			[
				"image",
				"inspect",
				plan.reference as string,
				"--format",
				"{{json .RepoDigests}}",
			],
			{ timeoutMs: 20_000 },
		);
		if (
			!plan.digest ||
			!repoDigests.some((digest) => digest.endsWith(`@${plan.digest}`))
		) {
			throw new CliError(
				"The pulled image does not carry the digest resolved from the registry.",
				{
					code: ExitCode.Api,
					hint: `Expected ${plan.digest}. The image was not applied to the service. Investigate the registry mirror before retrying.`,
				},
			);
		}

		const signature = await verifyCosignSignature({
			runner: options.runner,
			reference: plan.reference as string,
		});
		if (!signature.ok && !options.allowUnsignedArtifact) {
			throw new CliError(
				signature.unavailable
					? "Artifact signature verification is required but cosign is not installed."
					: "Artifact signature verification failed.",
				{
					code: ExitCode.Api,
					hint: signature.unavailable
						? "Install cosign (https://docs.sigstore.dev/cosign/installation/) so the keyless signature can be checked, or pass --allow-unsigned-artifact to explicitly accept digest-only verification. The service has not been changed."
						: `${signature.detail} The service has not been changed.`,
				},
			);
		}
		journal.stepFinished(
			"verify-artifact",
			"succeeded",
			signature.ok
				? signature.detail
				: `Signature not verified (explicitly allowed): ${signature.detail}`,
		);
		progress(
			signature.ok
				? "Artifact digest and signature verified."
				: "Artifact digest verified; signature verification was explicitly waived.",
		);

		journal.stepStarted("migrations");
		const migrationsBefore = await detectMigrations({
			docker,
			imageReference: plan.reference as string,
			postgres,
			imageAvailable: true,
		});
		journal.setMigrationCounts(migrationsBefore.appliedMigrations);
		if (
			migrationsBefore.status === "known" &&
			(migrationsBefore.pendingMigrations ?? 0) > 0
		) {
			journal.stepFinished(
				"migrations",
				"succeeded",
				`${migrationsBefore.pendingMigrations} pending migration(s); applied by the entrypoint during rollout.`,
			);
			progress(
				`${migrationsBefore.pendingMigrations} pending migration(s) will be applied by the new container's entrypoint.`,
			);
		} else {
			journal.stepFinished(
				"migrations",
				"succeeded",
				migrationsBefore.status === "known"
					? "No pending migrations were detected."
					: (migrationsBefore.detail ??
							"Migration state could not be pre-verified; the entrypoint applies any pending migration."),
			);
			progress(
				migrationsBefore.status === "known"
					? "No pending migrations detected."
					: "Migration state could not be fully pre-verified; the entrypoint remains the single migration path.",
			);
		}

		journal.stepStarted("switch", plan.targetTag);
		await docker.run(
			[
				"service",
				"update",
				"--image",
				plan.reference as string,
				"--env-add",
				`RELEASE_TAG=${plan.targetTag}`,
				"notploy",
			],
			{ timeoutMs: 120_000 },
		);
		journal.stepFinished("switch", "succeeded", `image ${plan.reference}`);

		journal.stepStarted("converge");
		const convergence = await waitForServiceConvergence({
			docker,
			service: "notploy",
			timeoutMs: options.waitTimeoutMs,
			sleepImpl,
		});
		if (!convergence.converged) {
			const tasks = await recentServiceTasks(docker, "notploy");
			throw new CliError(
				convergence.message ?? "The 'notploy' service did not converge.",
				{
					code: ExitCode.General,
					hint: tasks.length
						? `Recent tasks: ${tasks
								.map(
									(task) =>
										`${task.name} ${task.currentState}${task.error ? ` (${task.error})` : ""}`,
								)
								.join("; ")}. Inspect logs with 'docker service logs notploy'.`
						: "Inspect 'docker service ps notploy' and 'docker service logs notploy'.",
				},
			);
		}
		journal.stepFinished("converge", "succeeded", convergence.lastState);

		journal.stepStarted("health");
		const health = await probeHealth({
			url: installation.healthUrl,
			fetchImpl: options.fetchImpl,
			attempts: Math.max(
				1,
				Math.floor((options.healthTimeoutMs ?? 90_000) / 5_000),
			),
			intervalMs: 5_000,
			sleepImpl,
		});
		if (!health.ok) {
			throw new CliError(
				health.message ?? "The post-update health check failed.",
				{
					code: ExitCode.General,
					hint: `The new container is running but /api/trpc/settings.health did not answer successfully. Inspect 'docker service logs notploy'. The database backup is at ${journal.record.backupPath ?? "unknown"}.`,
				},
			);
		}
		journal.stepFinished(
			"health",
			"succeeded",
			`HTTP ${health.status} in ${health.latencyMs}ms`,
		);

		journal.stepStarted("verify-version");
		const service = await docker.run(
			[
				"service",
				"inspect",
				"notploy",
				"--format",
				"{{json .Spec.TaskTemplate.ContainerSpec.Image}}|{{json .Spec.TaskTemplate.ContainerSpec.Env}}",
			],
			{ timeoutMs: 20_000 },
		);
		const [imageJson, envJson] = service.stdout.trim().split("|");
		const runningImage = JSON.parse(imageJson) as string;
		const envEntries = JSON.parse(envJson ?? "[]") as string[];
		const releaseTag = envEntries
			.find((entry) => entry.startsWith("RELEASE_TAG="))
			?.slice("RELEASE_TAG=".length);
		if (!runningImage.includes(plan.digest ?? "\u0000")) {
			throw new CliError(
				"The service still references a different image than the verified digest.",
				{
					code: ExitCode.General,
					hint: `Expected ${plan.digest}. Inspect 'docker service inspect notploy'.`,
				},
			);
		}
		if (releaseTag !== plan.targetTag) {
			throw new CliError(
				`The service reports RELEASE_TAG=${releaseTag ?? "(unset)"} instead of ${plan.targetTag}.`,
				{
					code: ExitCode.General,
					hint: "The version metadata was not applied. Do not treat this update as complete; inspect the service specification.",
				},
			);
		}

		const migrationsAfter = await detectMigrations({
			docker,
			imageReference: plan.reference as string,
			postgres,
			imageAvailable: true,
		});
		journal.setMigrationCounts(
			migrationsBefore.appliedMigrations,
			migrationsAfter.appliedMigrations,
		);
		journal.stepFinished(
			"verify-version",
			"succeeded",
			`running ${plan.targetTag}, ${health.latencyMs}ms health latency`,
		);

		journal.finish("succeeded");
		clearInterruptHandler();
		releaseLock(stateDir, { host: journal.record.host });
		progress(
			`Update complete: ${plan.currentVersion ?? "unknown"} -> ${plan.targetVersion}.`,
		);

		return {
			status: "succeeded",
			operationId: journal.record.id,
			journalPath: journal.file,
			fromVersion: plan.currentVersion,
			toVersion: plan.targetVersion,
			backupPath: journal.record.backupPath,
			durationMs: nowMs(now) - startedAt,
		};
	} catch (error) {
		clearInterruptHandler();
		throw new UpdateFailure(fail(error), error);
	}
}

/**
 * Wraps a failed update so the command layer can print the journal-backed
 * recovery guidance while keeping a stable exit code.
 */
export class UpdateFailure extends Error {
	readonly outcome: UpdateOutcome;

	constructor(outcome: UpdateOutcome, cause: unknown) {
		super(cause instanceof Error ? cause.message : "The update failed.", {
			cause,
		});
		this.name = "UpdateFailure";
		this.outcome = outcome;
	}
}

export function buildRecoveryGuidance(options: {
	record: Pick<
		OperationRecord,
		"id" | "host" | "operator" | "toTag" | "previousImage" | "backupPath"
	>;
}): string {
	return [
		`Operation ${options.record.id} failed. The CLI did not report success and did not roll back automatically.`,
		`1. Inspect the journal: notploy cloud logs --operation ${options.record.id}`,
		"2. Inspect Swarm tasks: docker service ps notploy --no-trunc",
		"3. Inspect application logs: docker service logs --tail 200 notploy",
		options.record.previousImage
			? `4. Previous image recorded in the journal: ${options.record.previousImage}`
			: "4. No previous image was recorded.",
		options.record.backupPath
			? `5. Pre-update backup: ${options.record.backupPath} (a restore is destructive; see 'notploy cloud rollback --plan')`
			: "5. No backup was recorded for this operation.",
		"6. Automatic rollback is refused when database migrations may have been applied. Assess it with 'notploy cloud rollback --plan'.",
	].join("\n");
}

export interface RollbackPlan {
	possible: boolean;
	reason: string | null;
	currentVersion: string | null;
	previousVersion: string | null;
	previousImage: string | null;
	previousTag: string | null;
	migrationsSinceUpdate: number | null;
	backupPath: string | null;
	operations: string[];
	warnings: string[];
	journalId: string | null;
	manualRestore: string[];
}

export function planCloudRollback(options: {
	installation: Installation;
	stateDir?: string;
	env?: NodeJS.ProcessEnv;
}): RollbackPlan {
	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const latest = OperationJournal.list(stateDir).find(
		(record) => record.kind === "update" && record.status === "succeeded",
	);

	const base: RollbackPlan = {
		possible: false,
		reason: null,
		currentVersion: options.installation.installedVersion,
		previousVersion: null,
		previousImage: null,
		previousTag: null,
		migrationsSinceUpdate: null,
		backupPath: null,
		operations: [],
		warnings: [],
		journalId: null,
		manualRestore: [],
	};

	if (!latest) {
		return {
			...base,
			reason:
				"No successful update is recorded, so there is no last-known-good version to return to.",
		};
	}

	const previousVersion =
		normalizeCloudVersion(latest.previousTag) ??
		normalizeCloudVersion(latest.previousImage);
	const before = latest.appliedMigrationsBefore;
	const after = latest.appliedMigrationsAfter;
	const migrationsSince =
		before !== null && after !== null ? Math.max(after - before, 0) : null;

	const manualRestore = [
		"The CLI does not automate database restores: they are destructive and must be confirmed by an operator.",
		latest.backupPath
			? `Restore the pre-update dump only after the application is stopped:\n  docker exec -i <notploy-postgres-container> pg_restore -U notploy -d notploy --clean --if-exists --no-owner < ${latest.backupPath}\n  Then start the previous image and verify the health endpoint.`
			: "No pre-update backup is recorded for that operation.",
		"Re-run 'notploy cloud doctor' and 'notploy cloud rollback --plan' after any manual restore.",
	];

	const runningVersion = normalizeCloudVersion(
		options.installation.installedVersion,
	);
	if (
		latest.toVersion &&
		runningVersion &&
		latest.toVersion !== runningVersion
	) {
		return {
			...base,
			journalId: latest.id,
			previousVersion,
			previousImage: latest.previousImage,
			previousTag: latest.previousTag,
			backupPath: latest.backupPath,
			reason: `The last recorded update was to ${latest.toVersion}, but ${runningVersion} is running. The CLI cannot identify a reliable last-known-good version.`,
			manualRestore,
		};
	}

	if (!latest.previousImage) {
		return {
			...base,
			journalId: latest.id,
			reason:
				"The previous image reference was not recorded, so an image rollback cannot be performed.",
			migrationsSinceUpdate: migrationsSince,
			backupPath: latest.backupPath,
			manualRestore,
		};
	}
	if (migrationsSince === null) {
		return {
			...base,
			journalId: latest.id,
			previousVersion,
			previousImage: latest.previousImage,
			previousTag: latest.previousTag,
			backupPath: latest.backupPath,
			reason:
				"The migration counts around that update are unknown, so an image-only rollback could run older code against a newer schema.",
			manualRestore,
		};
	}
	if (migrationsSince > 0) {
		return {
			...base,
			journalId: latest.id,
			previousVersion,
			previousImage: latest.previousImage,
			previousTag: latest.previousTag,
			migrationsSinceUpdate: migrationsSince,
			backupPath: latest.backupPath,
			reason: `${migrationsSince} database migration(s) were applied by that update. An image-only rollback is refused because the previous code may no longer match the schema.`,
			manualRestore,
		};
	}

	return {
		...base,
		possible: true,
		previousVersion,
		previousImage: latest.previousImage,
		previousTag: latest.previousTag,
		migrationsSinceUpdate: 0,
		backupPath: latest.backupPath,
		journalId: latest.id,
		operations: [
			`Verify ${latest.previousImage} and its signature.`,
			"Update the 'notploy' service back to the previous image and RELEASE_TAG.",
			"Wait for convergence and probe the health endpoint.",
		],
		warnings: [
			"This reverses the image only. It does not undo data written by the newer version.",
			"A verified database backup is kept, but restoring it is a separate, explicitly confirmed manual operation.",
		],
		manualRestore,
	};
}

export interface RollbackOptions {
	installation: Installation;
	plan: RollbackPlan;
	runner: CommandRunner;
	confirmVersion: string;
	stateDir?: string;
	env?: NodeJS.ProcessEnv;
	waitTimeoutMs?: number;
	healthTimeoutMs?: number;
	allowUnsignedArtifact?: boolean;
	fetchImpl?: FetchLike;
	now?: () => Date;
	sleepImpl?: (ms: number) => Promise<void>;
	onProgress?: (message: string) => void;
	forceUnlock?: boolean;
}

export async function executeCloudRollback(
	options: RollbackOptions,
): Promise<UpdateOutcome> {
	const { plan, installation } = options;
	if (!plan.possible || !plan.previousImage || !plan.previousVersion) {
		throw usageError(
			"An image rollback is not possible for this installation.",
			plan.reason ??
				"Run 'notploy cloud rollback --plan' to see why. A database restore is a separate manual procedure.",
		);
	}
	if (options.confirmVersion !== plan.previousVersion) {
		throw usageError(
			`Rollback confirmation does not match the last-known-good version ${plan.previousVersion}.`,
			`Re-run with --confirm ${plan.previousVersion} after reading the rollback plan.`,
		);
	}

	const env = options.env ?? process.env;
	const stateDir = options.stateDir ?? getCloudStateDir(env);
	const docker = new Docker(options.runner, installation.docker);
	const now = options.now ?? (() => new Date());
	const startedAt = nowMs(now);
	const sleepImpl = options.sleepImpl ?? defaultSleeper;
	const progress = options.onProgress ?? (() => {});

	ensurePrivateDir(stateDir);
	const journal = OperationJournal.create(stateDir, {
		kind: "rollback",
		fromVersion: installation.installedVersion,
		toVersion: plan.previousVersion,
		toTag: plan.previousTag,
		toDigest: null,
		previousImage: installation.image,
		previousTag: installation.releaseTag,
		steps: [...ROLLBACK_STEPS],
		now,
		env,
	});

	let lockAcquired = false;
	setInterruptHandler(() => {
		journal.markRunningStepsFailed("interrupted by an operator");
		journal.finish("interrupted", "interrupted by SIGINT");
		if (lockAcquired) releaseLock(stateDir, { host: journal.record.host });
	});

	const fail = (error: unknown, step?: string): UpdateOutcome => {
		const message = redactSecrets(
			error instanceof Error ? error.message : String(error),
		);
		if (step) journal.stepFinished(step, "failed", message);
		journal.markRunningStepsFailed(message);
		journal.finish("failed", message);
		clearInterruptHandler();
		if (lockAcquired) releaseLock(stateDir, { host: journal.record.host });
		return {
			status: "failed",
			operationId: journal.record.id,
			journalPath: journal.file,
			fromVersion: installation.installedVersion,
			toVersion: plan.previousVersion as string,
			backupPath: plan.backupPath,
			recovery: plan.manualRestore.join("\n"),
			durationMs: nowMs(now) - startedAt,
		};
	};

	try {
		acquireLock(stateDir, {
			operation: `rollback to ${plan.previousVersion}`,
			now,
			force: options.forceUnlock,
		});
		lockAcquired = true;

		journal.stepStarted("preflight");
		journal.stepFinished(
			"preflight",
			"succeeded",
			`${plan.currentVersion ?? "unknown"} -> ${plan.previousVersion}; no migrations applied by the target update`,
		);

		journal.stepStarted("verify-artifact", plan.previousImage);
		const local = await imageIsLocal(docker, plan.previousImage);
		if (!local) {
			await docker.run(["pull", plan.previousImage], {
				timeoutMs: 15 * 60_000,
			});
		}
		const signature = await verifyCosignSignature({
			runner: options.runner,
			reference: plan.previousImage,
		});
		if (!signature.ok && !options.allowUnsignedArtifact) {
			throw new CliError(
				signature.unavailable
					? "Cannot verify the previous image signature because cosign is not installed."
					: "The previous image signature could not be verified.",
				{
					code: ExitCode.Api,
					hint: `${signature.detail} The service has not been changed. Pass --allow-unsigned-artifact only after verifying the digest independently.`,
				},
			);
		}
		journal.stepFinished("verify-artifact", "succeeded", signature.detail);

		journal.stepStarted("switch", plan.previousImage);
		await docker.run(
			[
				"service",
				"update",
				"--image",
				plan.previousImage,
				...(plan.previousTag
					? ["--env-add", `RELEASE_TAG=${plan.previousTag}`]
					: []),
				"notploy",
			],
			{ timeoutMs: 120_000 },
		);
		journal.stepFinished("switch", "succeeded");

		journal.stepStarted("converge");
		const convergence = await waitForServiceConvergence({
			docker,
			service: "notploy",
			timeoutMs: options.waitTimeoutMs,
			sleepImpl,
		});
		if (!convergence.converged) {
			throw new CliError(
				convergence.message ??
					"The service did not converge after the rollback.",
				{
					code: ExitCode.General,
					hint: "Inspect 'docker service ps notploy' and 'docker service logs notploy'.",
				},
			);
		}
		journal.stepFinished("converge", "succeeded", convergence.lastState);

		journal.stepStarted("health");
		const health = await probeHealth({
			url: installation.healthUrl,
			fetchImpl: options.fetchImpl,
			attempts: Math.max(
				1,
				Math.floor((options.healthTimeoutMs ?? 90_000) / 5_000),
			),
			intervalMs: 5_000,
			sleepImpl,
		});
		if (!health.ok) {
			throw new CliError(
				health.message ?? "The rollback health check failed.",
				{
					code: ExitCode.General,
					hint: "The previous image is running but unhealthy. Follow the recovery runbook; do not repeat migrations blindly.",
				},
			);
		}
		journal.stepFinished("health", "succeeded", `HTTP ${health.status}`);

		journal.stepStarted("verify-version");
		journal.stepFinished(
			"verify-version",
			"succeeded",
			`target ${plan.previousVersion}`,
		);
		journal.finish("succeeded");
		clearInterruptHandler();
		releaseLock(stateDir, { host: journal.record.host });
		progress(
			`Rollback complete: ${plan.currentVersion ?? "unknown"} -> ${plan.previousVersion}.`,
		);

		return {
			status: "succeeded",
			operationId: journal.record.id,
			journalPath: journal.file,
			fromVersion: plan.currentVersion,
			toVersion: plan.previousVersion,
			backupPath: plan.backupPath,
			durationMs: nowMs(now) - startedAt,
		};
	} catch (error) {
		const outcome = fail(error);
		clearInterruptHandler();
		throw new UpdateFailure(outcome, error);
	}
}
