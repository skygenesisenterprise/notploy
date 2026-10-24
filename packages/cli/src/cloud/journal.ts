import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CliError, ExitCode, usageError } from "../errors.js";

/**
 * Maintenance state for Cloud operations.
 *
 * Two files matter:
 *
 * - `maintenance.lock` prevents two operators (or a CI job and a human) from
 *   mutating the same installation concurrently.
 * - `operations/*.json` is an append-only-by-rewrite journal. Every step is
 *   persisted before and after it runs, so an interrupted process can be
 *   diagnosed and resumed deliberately instead of guessing what happened.
 */

export type OperationKind = "update" | "rollback";
export type OperationStatus =
	| "running"
	| "succeeded"
	| "failed"
	| "interrupted";
export type StepStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "skipped";

export interface OperationStep {
	name: string;
	status: StepStatus;
	startedAt?: string;
	finishedAt?: string;
	detail?: string;
}

export interface OperationRecord {
	version: 1;
	id: string;
	kind: OperationKind;
	status: OperationStatus;
	startedAt: string;
	finishedAt?: string;
	host: string;
	operator: string;
	fromVersion: string | null;
	toVersion: string | null;
	toTag: string | null;
	toDigest: string | null;
	previousImage: string | null;
	previousTag: string | null;
	backupPath: string | null;
	appliedMigrationsBefore: number | null;
	appliedMigrationsAfter: number | null;
	steps: OperationStep[];
	error?: string;
}

export interface MaintenanceLock {
	pid: number;
	host: string;
	operation: string;
	startedAt: string;
}

const LOCK_NAME = "maintenance.lock";
const OPERATIONS_DIR = "operations";
const BACKUPS_DIR = "backups";
const STALE_LOCK_MS = 6 * 60 * 60 * 1000;

export function getCloudStateDir(env: NodeJS.ProcessEnv = process.env): string {
	const override = env.NOTPLOY_CLOUD_STATE_DIR?.trim();
	if (override) return path.resolve(override);
	const installDir =
		env.NOTPLOY_CONFIG_PATH?.trim() ||
		env.NOTPLOY_INSTALL_DIR?.trim() ||
		"/etc/notploy";
	return path.join(path.resolve(installDir), "cli");
}

export function ensurePrivateDir(dir: string, mode = 0o700): void {
	fs.mkdirSync(dir, { recursive: true, mode });
	try {
		fs.chmodSync(dir, mode);
	} catch {
		// Windows and some filesystems do not support POSIX modes.
	}
}

export function getBackupDir(stateDir: string): string {
	return path.join(stateDir, BACKUPS_DIR);
}

function writeJsonAtomic(file: string, value: unknown): void {
	ensurePrivateDir(path.dirname(file));
	const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
	fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
	try {
		fs.renameSync(temp, file);
	} catch {
		fs.rmSync(file, { force: true });
		fs.renameSync(temp, file);
	}
	try {
		fs.chmodSync(file, 0o600);
	} catch {
		// Best effort.
	}
}

function readJson<T>(file: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8")) as T;
	} catch {
		return null;
	}
}

export function lockPath(stateDir: string): string {
	return path.join(stateDir, LOCK_NAME);
}

export function readLock(stateDir: string): MaintenanceLock | null {
	const parsed = readJson<MaintenanceLock>(lockPath(stateDir));
	if (!parsed || typeof parsed.pid !== "number") return null;
	return parsed;
}

function processIsAlive(pid: number): boolean {
	if (!Number.isSafeInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

export interface LockAssessment {
	path: string;
	lock: MaintenanceLock | null;
	stale: boolean;
	reason?: string;
}

export interface AssessLockOptions {
	now?: number;
	host?: string;
	pid?: number;
}

export function assessLock(
	stateDir: string,
	options: AssessLockOptions = {},
): LockAssessment {
	const file = lockPath(stateDir);
	const lock = readLock(stateDir);
	if (!lock) {
		return { path: file, lock: null, stale: false };
	}
	const now = options.now ?? Date.now();
	const host = options.host ?? os.hostname();
	const started = Date.parse(lock.startedAt);
	const age = Number.isFinite(started)
		? now - started
		: Number.POSITIVE_INFINITY;

	if (lock.host === host && !processIsAlive(lock.pid)) {
		return {
			path: file,
			lock,
			stale: true,
			reason: `the process ${lock.pid} that held the lock is no longer running`,
		};
	}
	if (age > STALE_LOCK_MS) {
		return {
			path: file,
			lock,
			stale: true,
			reason: `the lock is older than ${Math.round(STALE_LOCK_MS / 3_600_000)} hours`,
		};
	}
	return { path: file, lock, stale: false };
}

export function acquireLock(
	stateDir: string,
	options: {
		operation: string;
		now?: () => Date;
		host?: string;
		pid?: number;
		force?: boolean;
	},
): MaintenanceLock {
	const now = options.now ?? (() => new Date());
	const host = options.host ?? os.hostname();
	const pid = options.pid ?? process.pid;
	const assessment = assessLock(stateDir, { now: now().getTime(), host, pid });

	if (assessment.lock && !assessment.stale) {
		throw usageError(
			`Another Notploy maintenance operation is already running (pid ${assessment.lock.pid} on ${assessment.lock.host}, started ${assessment.lock.startedAt}).`,
			"Wait for it to finish. If the process crashed, inspect 'notploy cloud logs' and clear it with 'notploy cloud update --force-unlock'.",
		);
	}
	if (assessment.lock && assessment.stale) {
		if (!options.force) {
			throw usageError(
				`A stale maintenance lock exists (${assessment.reason}).`,
				"Verify no update is running, then retry with --force-unlock. Use 'notploy cloud logs' to inspect the previous operation.",
			);
		}
		fs.rmSync(assessment.path, { force: true });
	}

	ensurePrivateDir(stateDir);
	const lock: MaintenanceLock = {
		pid,
		host,
		operation: options.operation,
		startedAt: now().toISOString(),
	};
	try {
		const fd = fs.openSync(lockPath(stateDir), "wx", 0o600);
		fs.writeFileSync(fd, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
		fs.closeSync(fd);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			throw usageError(
				"Another maintenance operation acquired the lock while this one was starting.",
				"Retry after it finishes.",
			);
		}
		throw new CliError(
			`Cannot create the maintenance lock in ${stateDir}: ${
				error instanceof Error ? error.message : String(error)
			}`,
			{
				code: ExitCode.Usage,
				hint: "Run the command with an account that can write to the Notploy state directory, or set NOTPLOY_CLOUD_STATE_DIR to a writable location.",
			},
		);
	}
	return lock;
}

export function releaseLock(
	stateDir: string,
	options: { pid?: number; host?: string } = {},
): void {
	const lock = readLock(stateDir);
	if (!lock) return;
	const pid = options.pid ?? process.pid;
	const host = options.host ?? os.hostname();
	if (lock.pid !== pid || lock.host !== host) return;
	fs.rmSync(lockPath(stateDir), { force: true });
}

export class OperationJournal {
	readonly file: string;
	readonly record: OperationRecord;

	private constructor(dir: string, record: OperationRecord) {
		this.file = path.join(dir, OPERATIONS_DIR, `${record.id}.json`);
		this.record = record;
	}

	static create(
		stateDir: string,
		input: {
			kind: OperationKind;
			fromVersion: string | null;
			toVersion: string | null;
			toTag: string | null;
			toDigest: string | null;
			previousImage?: string | null;
			previousTag?: string | null;
			steps: string[];
			now?: () => Date;
			env?: NodeJS.ProcessEnv;
		},
	): OperationJournal {
		const now = input.now ?? (() => new Date());
		const env = input.env ?? process.env;
		const startedAt = now();
		const id = `op-${startedAt.toISOString().replace(/[-:.TZ]/g, "")}-${process.pid}`;
		const record: OperationRecord = {
			version: 1,
			id,
			kind: input.kind,
			status: "running",
			startedAt: startedAt.toISOString(),
			host: os.hostname(),
			operator:
				env.NOTPLOY_OPERATOR?.trim() ||
				env.SUDO_USER?.trim() ||
				env.USER?.trim() ||
				"unknown",
			fromVersion: input.fromVersion,
			toVersion: input.toVersion,
			toTag: input.toTag,
			toDigest: input.toDigest,
			previousImage: input.previousImage ?? null,
			previousTag: input.previousTag ?? null,
			backupPath: null,
			appliedMigrationsBefore: null,
			appliedMigrationsAfter: null,
			steps: input.steps.map((name) => ({ name, status: "pending" })),
		};
		const journal = new OperationJournal(stateDir, record);
		journal.persist();
		return journal;
	}

	static load(file: string): OperationRecord | null {
		return readJson<OperationRecord>(file);
	}

	static list(stateDir: string): OperationRecord[] {
		const dir = path.join(stateDir, OPERATIONS_DIR);
		let entries: string[] = [];
		try {
			entries = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
		} catch {
			return [];
		}
		return entries
			.map((name) => OperationJournal.load(path.join(dir, name)))
			.filter((record): record is OperationRecord => record !== null)
			.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}

	static latest(
		stateDir: string,
		kind?: OperationKind,
	): OperationRecord | null {
		const records = OperationJournal.list(stateDir);
		return records.find((record) => !kind || record.kind === kind) ?? null;
	}

	static findById(stateDir: string, id: string): OperationRecord | null {
		const dir = path.join(stateDir, OPERATIONS_DIR);
		if (!/^op-[0-9]{14}-[0-9]+$/.test(id)) {
			throw usageError(`Invalid operation id "${id}".`);
		}
		return OperationJournal.load(path.join(dir, `${id}.json`));
	}

	private persist(): void {
		writeJsonAtomic(this.file, this.record);
	}

	stepStarted(name: string, detail?: string): void {
		const step = this.record.steps.find((candidate) => candidate.name === name);
		if (!step) throw new Error(`Unknown journal step ${name}`);
		step.status = "running";
		step.startedAt = new Date().toISOString();
		if (detail) step.detail = detail;
		this.persist();
	}

	stepFinished(
		name: string,
		status: Extract<StepStatus, "succeeded" | "failed" | "skipped">,
		detail?: string,
	): void {
		const step = this.record.steps.find((candidate) => candidate.name === name);
		if (!step) throw new Error(`Unknown journal step ${name}`);
		step.status = status;
		step.finishedAt = new Date().toISOString();
		if (detail) step.detail = detail;
		this.persist();
	}

	setBackup(filePath: string): void {
		this.record.backupPath = filePath;
		this.persist();
	}

	setMigrationCounts(before: number | null, after?: number | null): void {
		this.record.appliedMigrationsBefore = before;
		if (after !== undefined) this.record.appliedMigrationsAfter = after;
		this.persist();
	}

	finish(status: Exclude<OperationStatus, "running">, error?: string): void {
		this.record.status = status;
		this.record.finishedAt = new Date().toISOString();
		if (error) this.record.error = error;
		this.persist();
	}

	markRunningStepsFailed(detail: string): void {
		for (const step of this.record.steps) {
			if (step.status === "running") {
				step.status = "failed";
				step.finishedAt = new Date().toISOString();
				step.detail = detail;
			}
		}
		this.persist();
	}
}

/**
 * Returns the unfinished operation a new invocation may need to know about.
 */
export function findUnfinishedOperation(
	stateDir: string,
): OperationRecord | null {
	return (
		OperationJournal.list(stateDir).find(
			(record) =>
				record.status === "running" ||
				record.status === "failed" ||
				record.status === "interrupted",
		) ?? null
	);
}
