import * as fs from "node:fs";
import * as path from "node:path";
import { CliError, ExitCode, redactSecrets, usageError } from "../errors.js";
import type { Docker } from "./docker.js";
import { ensurePrivateDir, getBackupDir } from "./journal.js";
import type { FetchLike } from "./release.js";

/**
 * Local preflight checks and runtime probes.
 *
 * Nothing in this module mutates an installation. The backup helpers write only
 * into the CLI state directory, which is why they are called explicitly by the
 * update orchestration and never by diagnostics.
 */

const GIB = 1024 * 1024 * 1024;
export const DEFAULT_MIN_FREE_BYTES = 2 * GIB;
export const BACKUP_MAGIC = "PGDMP";
const DEFAULT_BACKUP_TIMEOUT_MS = 30 * 60_000;

export interface DiskCheck {
	path: string;
	freeBytes: number;
	requiredBytes: number;
	ok: boolean;
	hint?: string;
}

export interface StatFsLike {
	bavail: number;
	bsize: number;
}

export type StatFs = (path: string) => StatFsLike;

const defaultStatFs: StatFs = (target) => {
	const stats = fs.statfsSync(target) as unknown as {
		bavail: number | bigint;
		bsize: number | bigint;
	};
	return {
		bavail: Number(stats.bavail),
		bsize: Number(stats.bsize),
	};
};

/**
 * Requires enough room for the image layers (compressed + extracted) and the
 * pre-update database backup. When the artifact size is not known, the caller
 * passes a conservative minimum instead.
 */
export function checkDiskSpace(options: {
	path: string;
	requiredBytes?: number;
	minFreeBytes?: number;
	statfs?: StatFs;
}): DiskCheck {
	const statfs = options.statfs ?? defaultStatFs;
	const minFree = options.minFreeBytes ?? DEFAULT_MIN_FREE_BYTES;
	const required = Math.max(options.requiredBytes ?? 0, 0) + minFree;

	let freeBytes: number;
	try {
		// Never create the directory during a read-only check: measure the
		// nearest existing ancestor instead.
		let target = path.resolve(options.path);
		while (!fs.existsSync(target) && path.dirname(target) !== target) {
			target = path.dirname(target);
		}
		const stats = statfs(target);
		freeBytes = stats.bavail * stats.bsize;
	} catch (error) {
		return {
			path: options.path,
			freeBytes: 0,
			requiredBytes: required,
			ok: false,
			hint: `Cannot determine free space for ${options.path}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	}

	const ok = freeBytes >= required;
	return {
		path: options.path,
		freeBytes,
		requiredBytes: required,
		ok,
		hint: ok
			? undefined
			: `Free ${(required / GIB).toFixed(1)} GiB before updating (available: ${(freeBytes / GIB).toFixed(1)} GiB). The backup and the new image are kept next to the installation.`,
	};
}

export interface PostgresContainer {
	id: string;
	name: string;
	state: string;
	image: string | null;
}

/**
 * Finds the running PostgreSQL task. Swarm task names are suffixed, so the
 * match is anchored to the `notploy-postgres` prefix instead of an exact name.
 */
export async function findPostgresContainer(
	docker: Docker,
): Promise<PostgresContainer | null> {
	const result = await docker.run(
		[
			"ps",
			"--filter",
			"name=notploy-postgres",
			"--format",
			"{{.ID}}|{{.Names}}|{{.State}}|{{.Image}}",
		],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	if (result.code !== 0) return null;
	for (const line of result.stdout.split("\n")) {
		const [id, name, state, image] = line.trim().split("|");
		if (!id || !name) continue;
		if (!/notploy-postgres/.test(name)) continue;
		return { id, name, state: state ?? "unknown", image: image ?? null };
	}
	return null;
}

export interface DatabaseBackup {
	path: string;
	sizeBytes: number;
	createdAt: string;
	container: string;
}

/**
 * Creates a custom-format `pg_dump` inside the PostgreSQL container and streams
 * it into the CLI state directory. The dump never passes through the terminal,
 * so no credential is printed.
 */
export async function createDatabaseBackup(options: {
	docker: Docker;
	stateDir: string;
	container: PostgresContainer;
	now?: () => Date;
	timeoutMs?: number;
}): Promise<DatabaseBackup> {
	const now = options.now ?? (() => new Date());
	const dir = getBackupDir(options.stateDir);
	ensurePrivateDir(dir);
	const stamp = now()
		.toISOString()
		.replace(/[-:.TZ]/g, "");
	const target = path.join(dir, `notploy-${stamp}.dump`);

	await options.docker.runToFile(
		[
			"exec",
			options.container.id,
			"pg_dump",
			"--format=custom",
			"--no-owner",
			"--no-acl",
			"-U",
			"notploy",
			"-d",
			"notploy",
		],
		target,
		{ timeoutMs: options.timeoutMs ?? DEFAULT_BACKUP_TIMEOUT_MS },
	);

	const verification = verifyDatabaseBackup(target);
	if (!verification.valid) {
		fs.rmSync(target, { force: true });
		throw new CliError(
			`The database backup is not usable: ${verification.reason}`,
			{
				code: ExitCode.General,
				hint: "The update was aborted before changing any service. Check free space and the PostgreSQL container, then retry.",
			},
		);
	}

	return {
		path: target,
		sizeBytes: verification.sizeBytes,
		createdAt: now().toISOString(),
		container: options.container.name,
	};
}

export interface BackupVerification {
	valid: boolean;
	sizeBytes: number;
	reason?: string;
}

/**
 * Verifies the backup is a non-empty PostgreSQL custom-format archive. This
 * proves the dump completed and has a valid header; it does not prove every
 * table is restorable, which is why the runbook documents a restore drill.
 */
export function verifyDatabaseBackup(filePath: string): BackupVerification {
	let stats: fs.Stats;
	try {
		stats = fs.statSync(filePath);
	} catch {
		return {
			valid: false,
			sizeBytes: 0,
			reason: `backup file ${filePath} does not exist`,
		};
	}
	if (!stats.isFile()) {
		return {
			valid: false,
			sizeBytes: 0,
			reason: `${filePath} is not a regular file`,
		};
	}
	if (stats.size < 16) {
		return { valid: false, sizeBytes: stats.size, reason: "the dump is empty" };
	}
	let header: Buffer;
	try {
		const fd = fs.openSync(filePath, "r");
		header = Buffer.alloc(5);
		fs.readSync(fd, header, 0, 5, 0);
		fs.closeSync(fd);
	} catch (error) {
		return {
			valid: false,
			sizeBytes: stats.size,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
	if (header.toString("ascii") !== BACKUP_MAGIC) {
		return {
			valid: false,
			sizeBytes: stats.size,
			reason: "the file is not a PostgreSQL custom-format archive",
		};
	}
	return { valid: true, sizeBytes: stats.size };
}

export function listDatabaseBackups(stateDir: string): DatabaseBackup[] {
	// Kept deliberately free of side effects: doctor uses it on a read-only host.
	const dir = getBackupDir(stateDir);
	let entries: string[] = [];
	try {
		entries = fs.readdirSync(dir).filter((name) => name.endsWith(".dump"));
	} catch {
		return [];
	}
	return entries
		.map((name) => {
			const file = path.join(dir, name);
			const verification = verifyDatabaseBackup(file);
			const stats = fs.statSync(file);
			return {
				path: file,
				sizeBytes: verification.sizeBytes,
				createdAt: stats.mtime.toISOString(),
				container: "unknown",
			};
		})
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const JOURNAL_SCRIPT =
	'const fs=require("fs");const p="/app/drizzle/meta/_journal.json";' +
	'const j=JSON.parse(fs.readFileSync(p,"utf8"));' +
	"process.stdout.write(JSON.stringify({count:Array.isArray(j.entries)?j.entries.length:0,last:Array.isArray(j.entries)&&j.entries.length?j.entries[j.entries.length-1].tag:null}));";

export interface MigrationState {
	/** Status is `known` only when both the image journal and the DB were read. */
	status: "known" | "unknown";
	imageMigrations: number | null;
	appliedMigrations: number | null;
	pendingMigrations: number | null;
	latestTag: string | null;
	detail?: string;
}

/**
 * Best-effort detection of pending migrations.
 *
 * The new image's journal is read from the image itself, and the applied count
 * comes from Drizzle's own bookkeeping table. When either is unavailable the
 * result is explicitly `unknown`; the CLI never reports "no migrations" from
 * missing information.
 */
export async function detectMigrations(options: {
	docker: Docker;
	imageReference: string;
	postgres: PostgresContainer | null;
	imageAvailable: boolean;
}): Promise<MigrationState> {
	if (!options.imageAvailable) {
		return {
			status: "unknown",
			imageMigrations: null,
			appliedMigrations: null,
			pendingMigrations: null,
			latestTag: null,
			detail:
				"The target image is not present locally, so its migration journal cannot be read without downloading it. --dry-run does not download artifacts.",
		};
	}

	let imageMigrations: number | null = null;
	let latestTag: string | null = null;
	try {
		const result = await options.docker.run(
			[
				"run",
				"--rm",
				"--network",
				"none",
				"--entrypoint",
				"node",
				options.imageReference,
				"-e",
				JOURNAL_SCRIPT,
			],
			{ allowFailure: true, timeoutMs: 60_000 },
		);
		if (result.code === 0) {
			const parsed = JSON.parse(result.stdout) as {
				count?: number;
				last?: string | null;
			};
			imageMigrations = typeof parsed.count === "number" ? parsed.count : null;
			latestTag = parsed.last ?? null;
		}
	} catch {
		imageMigrations = null;
	}

	let appliedMigrations: number | null = null;
	if (options.postgres) {
		try {
			const result = await options.docker.run(
				[
					"exec",
					options.postgres.id,
					"psql",
					"-U",
					"notploy",
					"-d",
					"notploy",
					"-tAc",
					"select count(*) from drizzle.__drizzle_migrations",
				],
				{ allowFailure: true, timeoutMs: 30_000 },
			);
			if (result.code === 0) {
				const count = Number(result.stdout.trim());
				appliedMigrations = Number.isFinite(count) ? count : null;
			}
		} catch {
			appliedMigrations = null;
		}
	}

	if (imageMigrations === null || appliedMigrations === null) {
		const missing = [
			imageMigrations === null ? "the image migration journal" : null,
			appliedMigrations === null ? "the applied migration count" : null,
		].filter(Boolean);
		return {
			status: "unknown",
			imageMigrations,
			appliedMigrations,
			pendingMigrations: null,
			latestTag,
			detail: `Could not read ${missing.join(" and ")}. The update can still proceed, but migration compatibility cannot be pre-verified.`,
		};
	}

	return {
		status: "known",
		imageMigrations,
		appliedMigrations,
		pendingMigrations: Math.max(imageMigrations - appliedMigrations, 0),
		latestTag,
	};
}

export interface ConvergenceResult {
	converged: boolean;
	attempts: number;
	lastState: string;
	message?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for a Swarm service to reach a stable running state. Rollback or a
 * paused update is reported as failure immediately instead of waiting out the
 * full timeout.
 */
export async function waitForServiceConvergence(options: {
	docker: Docker;
	service: string;
	timeoutMs?: number;
	intervalMs?: number;
	sleepImpl?: (ms: number) => Promise<void>;
}): Promise<ConvergenceResult> {
	const timeoutMs = options.timeoutMs ?? 300_000;
	const intervalMs = options.intervalMs ?? 5_000;
	const wait = options.sleepImpl ?? sleep;
	const deadline = Date.now() + timeoutMs;
	let attempts = 0;
	let lastState = "unknown";

	while (Date.now() <= deadline) {
		attempts += 1;
		const inspect = await options.docker.run(
			[
				"service",
				"inspect",
				options.service,
				"--format",
				"{{.UpdateStatus.State}}|{{.Spec.Mode.Replicated.Replicas}}",
			],
			{ allowFailure: true, timeoutMs: 20_000 },
		);
		if (inspect.code !== 0) {
			lastState = "service-not-found";
			return {
				converged: false,
				attempts,
				lastState,
				message: `The '${options.service}' service disappeared during the update.`,
			};
		}
		const [updateState = "", desiredRaw = "1"] = inspect.stdout
			.trim()
			.split("|");
		const desired = Number(desiredRaw) || 1;
		const tasks = await options.docker.run(
			[
				"service",
				"ps",
				options.service,
				"--filter",
				"desired-state=running",
				"--format",
				"{{.CurrentState}}",
			],
			{ allowFailure: true, timeoutMs: 20_000 },
		);
		const states = tasks.stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const running = states.filter((state) =>
			state.startsWith("Running"),
		).length;
		lastState = `${running}/${desired} running${
			updateState ? `, update: ${updateState}` : ""
		}`;

		if (updateState.startsWith("rollback") || updateState === "paused") {
			return {
				converged: false,
				attempts,
				lastState,
				message: `Docker reported '${updateState}' for '${options.service}'.`,
			};
		}
		if (
			tasks.code === 0 &&
			desired > 0 &&
			running >= desired &&
			updateState !== "updating"
		) {
			return { converged: true, attempts, lastState };
		}
		await wait(intervalMs);
	}

	return {
		converged: false,
		attempts,
		lastState,
		message: `The '${options.service}' service did not converge within ${Math.round(
			timeoutMs / 1000,
		)}s (last state: ${lastState}).`,
	};
}

export interface HealthResult {
	ok: boolean;
	status: number | null;
	latencyMs: number;
	attempts: number;
	message?: string;
}

/**
 * Probes the application health endpoint through the host-published port. A
 * failed probe is never treated as success just because the container runs.
 */
export async function probeHealth(options: {
	url: string;
	fetchImpl?: FetchLike;
	timeoutMs?: number;
	attempts?: number;
	intervalMs?: number;
	sleepImpl?: (ms: number) => Promise<void>;
}): Promise<HealthResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? 5_000;
	const attempts = options.attempts ?? 1;
	const intervalMs = options.intervalMs ?? 3_000;
	const wait = options.sleepImpl ?? sleep;
	const url = `${options.url.replace(/\/$/, "")}/api/trpc/settings.health`;
	let lastStatus: number | null = null;
	let lastError: string | undefined;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const started = Date.now();
		try {
			const response = await fetchImpl(url, {
				method: "GET",
				headers: { "User-Agent": "notploy-cli" },
				signal: AbortSignal.timeout(timeoutMs),
			});
			lastStatus = response.status;
			if (response.ok) {
				return {
					ok: true,
					status: response.status,
					latencyMs: Date.now() - started,
					attempts: attempt,
				};
			}
			lastError = `HTTP ${response.status}`;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
		if (attempt < attempts) await wait(intervalMs);
	}

	return {
		ok: false,
		status: lastStatus,
		latencyMs: 0,
		attempts,
		message: `Health check ${url} failed${lastError ? ` (${redactSecrets(lastError)})` : ""}.`,
	};
}

/** Whether the image is already present locally under any tag or digest. */
export async function imageIsLocal(
	docker: Docker,
	reference: string,
): Promise<boolean> {
	const result = await docker.run(["image", "inspect", reference], {
		allowFailure: true,
		timeoutMs: 20_000,
	});
	return result.code === 0;
}

export interface ServiceTask {
	name: string;
	currentState: string;
	desiredState: string;
	error: string | null;
}

export async function recentServiceTasks(
	docker: Docker,
	service: string,
	limit = 5,
): Promise<ServiceTask[]> {
	const result = await docker.run(
		[
			"service",
			"ps",
			service,
			"--no-trunc",
			"--format",
			"{{.Name}}|{{.CurrentState}}|{{.DesiredState}}|{{.Error}}",
		],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	if (result.code !== 0) return [];
	return result.stdout
		.split("\n")
		.slice(0, limit)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [name = "", currentState = "", desiredState = "", error = ""] =
				line.split("|");
			return {
				name,
				currentState,
				desiredState,
				error: error.trim() ? redactSecrets(error.trim()) : null,
			};
		});
}

export function requireBackupCapability(
	postgres: PostgresContainer | null,
): PostgresContainer {
	if (!postgres) {
		throw usageError(
			"The PostgreSQL container for this installation was not found, so a pre-update backup cannot be taken.",
			"Verify 'docker ps --filter name=notploy-postgres' on the Swarm manager. The update is aborted: it never runs without a verified backup.",
		);
	}
	return postgres;
}
