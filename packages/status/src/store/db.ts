/**
 * Database access.
 *
 * The platform stores its state in a dedicated SQLite file (node:sqlite, no
 * native dependency) placed wherever `STATUS_DATA_DIR` points — deliberately
 * outside the Notploy control-plane database so a control-plane outage cannot
 * take the status page down with it. WAL mode keeps concurrent reads cheap
 * while writes are serialized, which matches the low write volume of a status
 * platform.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations, schemaVersion } from "./migrations";

export interface OpenDatabaseOptions {
	file: string;
	/** Open without applying migrations (used for read-only recovery). */
	readOnly?: boolean;
	/** Apply pending migrations after opening. Default `true`. */
	migrate?: boolean;
}

export const openDatabase = ({
	file,
	readOnly = false,
	migrate = true,
}: OpenDatabaseOptions): DatabaseSync => {
	if (file !== ":memory:") {
		mkdirSync(dirname(file), { recursive: true });
	}
	const db = new DatabaseSync(file, { readOnly });
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec("PRAGMA busy_timeout = 5000");
	db.exec("PRAGMA synchronous = NORMAL");
	if (!readOnly && migrate) {
		runMigrations(db);
	}
	return db;
};

/** Current schema version, or `0` when the database is not initialized. */
export const getSchemaVersion = (db: DatabaseSync): number => schemaVersion(db);

/** Cheap liveness probe used by `/readyz`. */
export const pingDatabase = (db: DatabaseSync): boolean => {
	try {
		db.prepare("SELECT 1 AS ok").all();
		return true;
	} catch {
		return false;
	}
};
