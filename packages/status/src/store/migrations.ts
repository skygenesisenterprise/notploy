/**
 * Schema migrations.
 *
 * The status database is a dedicated SQLite file owned by this platform —
 * never the Notploy control-plane database. Migrations are applied in order,
 * each inside its own transaction, and recorded in `schema_migrations`.
 * Where technically possible a `down` is provided so the schema change can be
 * reversed before restoring a backup.
 */
import type { DatabaseSync } from "node:sqlite";

export interface Migration {
	version: number;
	name: string;
	up: string;
	down?: string;
}

export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		name: "initial-schema",
		up: `
CREATE TABLE status_pages (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	settings_json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE components (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	category TEXT NOT NULL DEFAULT 'other',
	group_name TEXT,
	position INTEGER NOT NULL DEFAULT 0,
	visibility TEXT NOT NULL DEFAULT 'public',
	parent_id TEXT REFERENCES components(id) ON DELETE SET NULL,
	source TEXT NOT NULL DEFAULT 'manual',
	observed_status TEXT NOT NULL DEFAULT 'unknown',
	observed_at TEXT,
	last_published_status TEXT,
	last_published_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX components_page_idx ON components(page_id);

CREATE TABLE incidents (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	severity TEXT NOT NULL DEFAULT 'minor',
	state TEXT NOT NULL DEFAULT 'investigating',
	visibility TEXT NOT NULL DEFAULT 'private',
	published INTEGER NOT NULL DEFAULT 0,
	published_at TEXT,
	correlation_key TEXT,
	started_at TEXT NOT NULL,
	resolved_at TEXT,
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX incidents_page_idx ON incidents(page_id, started_at DESC);
-- One open incident per correlation key: repeated alerts of the same problem
-- attach to it instead of creating duplicates.
CREATE UNIQUE INDEX incidents_open_correlation_idx
	ON incidents(page_id, correlation_key)
	WHERE correlation_key IS NOT NULL AND state != 'resolved';

CREATE TABLE incident_components (
	incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
	component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
	PRIMARY KEY (incident_id, component_id)
);

CREATE TABLE maintenances (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	state TEXT NOT NULL DEFAULT 'scheduled',
	visibility TEXT NOT NULL DEFAULT 'private',
	published INTEGER NOT NULL DEFAULT 0,
	published_at TEXT,
	start_at TEXT NOT NULL,
	end_at TEXT NOT NULL,
	time_zone TEXT NOT NULL DEFAULT 'UTC',
	created_by TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX maintenances_page_idx ON maintenances(page_id, start_at DESC);

CREATE TABLE maintenance_components (
	maintenance_id TEXT NOT NULL REFERENCES maintenances(id) ON DELETE CASCADE,
	component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
	PRIMARY KEY (maintenance_id, component_id)
);

CREATE TABLE events (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
	subject_type TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	type TEXT NOT NULL,
	visibility TEXT NOT NULL DEFAULT 'internal',
	message TEXT NOT NULL DEFAULT '',
	state TEXT,
	severity TEXT,
	actor_type TEXT NOT NULL DEFAULT 'system',
	actor_id TEXT,
	actor_label TEXT NOT NULL DEFAULT '',
	metadata_json TEXT,
	created_at TEXT NOT NULL
);
CREATE INDEX events_subject_idx ON events(page_id, subject_type, subject_id, created_at DESC);
CREATE INDEX events_page_public_idx ON events(page_id, visibility, created_at DESC);

CREATE TABLE api_tokens (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	prefix TEXT NOT NULL UNIQUE,
	hash TEXT NOT NULL,
	scopes_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	last_used_at TEXT,
	revoked_at TEXT
);

CREATE TABLE audit_log (
	id TEXT PRIMARY KEY,
	at TEXT NOT NULL,
	actor_type TEXT NOT NULL,
	actor_id TEXT,
	actor_label TEXT NOT NULL,
	action TEXT NOT NULL,
	subject_type TEXT NOT NULL,
	subject_id TEXT,
	detail_json TEXT,
	request_id TEXT
);
CREATE INDEX audit_log_at_idx ON audit_log(at DESC);

CREATE TABLE idempotency_keys (
	key TEXT NOT NULL,
	scope TEXT NOT NULL,
	request_hash TEXT NOT NULL,
	status_code INTEGER NOT NULL,
	response_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (key, scope)
);

CREATE TABLE ingest_log (
	id TEXT PRIMARY KEY,
	event_id TEXT,
	dedup_hash TEXT NOT NULL UNIQUE,
	source TEXT NOT NULL,
	received_at TEXT NOT NULL,
	result TEXT NOT NULL,
	incident_id TEXT,
	payload_json TEXT NOT NULL
);

CREATE TABLE notification_outbox (
	id TEXT PRIMARY KEY,
	channel TEXT NOT NULL,
	dedup_key TEXT NOT NULL UNIQUE,
	payload_json TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	attempts INTEGER NOT NULL DEFAULT 0,
	next_attempt_at TEXT NOT NULL,
	last_error TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	sent_at TEXT
);
CREATE INDEX notification_outbox_due_idx ON notification_outbox(status, next_attempt_at);

CREATE TABLE webhook_subscriptions (
	id TEXT PRIMARY KEY,
	url TEXT NOT NULL,
	events_json TEXT NOT NULL DEFAULT '[]',
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL
);
`,
		down: `
DROP TABLE webhook_subscriptions;
DROP TABLE notification_outbox;
DROP TABLE ingest_log;
DROP TABLE idempotency_keys;
DROP TABLE audit_log;
DROP TABLE api_tokens;
DROP TABLE events;
DROP TABLE maintenance_components;
DROP TABLE maintenances;
DROP TABLE incident_components;
DROP TABLE incidents;
DROP TABLE components;
DROP TABLE status_pages;
`,
	},
	{
		version: 2,
		name: "daily-uptime-rollup",
		up: `
-- One row per component per UTC day: status is the worst public state
-- observed during that day, samples counts the observations and
-- operational_samples the subset observed as operational, so the daily
-- availability ratio is computed without keeping every raw sample.
-- A missing row means "no data": it is never rendered as healthy.
CREATE TABLE component_uptime_daily (
	page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
	component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
	day TEXT NOT NULL,
	status TEXT NOT NULL,
	samples INTEGER NOT NULL DEFAULT 0,
	operational_samples INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (component_id, day)
);
CREATE INDEX component_uptime_daily_page_idx
	ON component_uptime_daily(page_id, day DESC);
`,
		down: `
DROP TABLE component_uptime_daily;
`,
	},
];

export interface MigrationRecord {
	version: number;
	name: string;
	applied_at: string;
}

/** Read the list of already-applied migration versions. */
export const appliedVersions = (db: DatabaseSync): Set<number> => {
	const rows = db.prepare("SELECT version FROM schema_migrations").all() as {
		version: number;
	}[];
	return new Set(rows.map((row) => row.version));
};

/** Apply every pending migration inside a transaction. */
export const runMigrations = (db: DatabaseSync): number[] => {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at TEXT NOT NULL
	)`);
	const already = appliedVersions(db);
	const applied: number[] = [];
	for (const migration of MIGRATIONS) {
		if (already.has(migration.version)) {
			continue;
		}
		db.exec("BEGIN");
		try {
			db.exec(migration.up);
			db.prepare(
				"INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
			).run(migration.version, migration.name, new Date().toISOString());
			db.exec("COMMIT");
			applied.push(migration.version);
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	}
	return applied;
};

/** Current schema version (0 when the database is empty). */
export const schemaVersion = (db: DatabaseSync): number => {
	try {
		const rows = db
			.prepare("SELECT MAX(version) AS version FROM schema_migrations")
			.all() as { version: number | null }[];
		return rows[0]?.version ?? 0;
	} catch {
		return 0;
	}
};

/** Reverse the most recent applied migration, when it provides a `down`. */
export const rollbackLastMigration = (db: DatabaseSync): number | null => {
	const rows = db
		.prepare(
			"SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
		)
		.all() as { version: number }[];
	const current = rows[0]?.version;
	if (!current) {
		return null;
	}
	const migration = MIGRATIONS.find((entry) => entry.version === current);
	if (!migration?.down) {
		return null;
	}
	db.exec("BEGIN");
	try {
		db.exec(migration.down);
		db.prepare("DELETE FROM schema_migrations WHERE version = ?").run(
			migration.version,
		);
		db.exec("COMMIT");
		return migration.version;
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
};
