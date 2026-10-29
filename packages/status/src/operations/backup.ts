/**
 * Backups.
 *
 * The whole state is one SQLite file, so a backup is a consistent copy taken
 * with `VACUUM INTO` (safe while the platform is running, WAL included).
 * Backups land in `<dataDir>/backups/` with an UTC timestamp in the name;
 * retention keeps the most recent `STATUS_BACKUP_RETENTION` files.
 * Restore is deliberately a documented manual step (stop the app, copy the
 * file back) — see README.md.
 */
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { StatusConfig } from "../config";
import { openDatabase } from "../store/db";

export interface BackupResult {
	file: string;
	bytes: number;
	createdAt: string;
}

const BACKUP_PATTERN = /^status-\d{8}T\d{6}Z\.db$/;

export const listBackups = (config: StatusConfig): string[] => {
	try {
		return readdirSync(config.backupDir)
			.filter((name) => BACKUP_PATTERN.test(name))
			.sort()
			.reverse();
	} catch {
		return [];
	}
};

export const createBackup = (config: StatusConfig): BackupResult => {
	mkdirSync(config.backupDir, { recursive: true });
	const timestamp = new Date();
	const name = `status-${timestamp
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d+Z$/, "Z")}.db`;
	const destination = join(config.backupDir, name);
	// VACUUM INTO produces a defragmented, transactionally consistent copy.
	const db = openDatabase({
		file: config.databaseFile,
		readOnly: true,
		migrate: false,
	});
	try {
		db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
	} finally {
		db.close();
	}
	pruneBackups(config);
	return {
		file: destination,
		bytes: statSync(destination).size,
		createdAt: timestamp.toISOString(),
	};
};

/** Restore a backup over the live database file (manual operator step). */
export const restoreBackup = (
	config: StatusConfig,
	backupName: string,
): string => {
	if (!BACKUP_PATTERN.test(backupName)) {
		throw new Error(`Invalid backup name: ${backupName}`);
	}
	const source = join(config.backupDir, backupName);
	const live = `${config.databaseFile}.restored`;
	copyFileSync(source, live);
	return live;
};

const pruneBackups = (config: StatusConfig): void => {
	const names = listBackups(config);
	const excess = names.slice(config.backupRetention);
	for (const name of excess) {
		rmSync(join(config.backupDir, name), { force: true });
	}
};

export const backupDirPath = (config: StatusConfig): string =>
	resolve(config.backupDir);
