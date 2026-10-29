/**
 * Repository layer — the only place raw SQL lives.
 *
 * Rows use snake_case exactly like the schema; conversion to camelCase
 * domain objects happens in the service layer, never here. Statements are
 * prepared once per database handle.
 */
import type { DatabaseSync, StatementSync } from "node:sqlite";

/* ------------------------------- row types ------------------------------- */

export interface PageRow {
	id: string;
	slug: string;
	name: string;
	description: string;
	settings_json: string;
	created_at: string;
	updated_at: string;
}

export interface ComponentRow {
	id: string;
	page_id: string;
	name: string;
	description: string;
	category: string;
	group_name: string | null;
	position: number;
	visibility: string;
	parent_id: string | null;
	source: string;
	observed_status: string;
	observed_at: string | null;
	last_published_status: string | null;
	last_published_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface IncidentRow {
	id: string;
	page_id: string;
	title: string;
	description: string;
	severity: string;
	state: string;
	visibility: string;
	published: number;
	published_at: string | null;
	correlation_key: string | null;
	started_at: string;
	resolved_at: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface MaintenanceRow {
	id: string;
	page_id: string;
	title: string;
	description: string;
	state: string;
	visibility: string;
	published: number;
	published_at: string | null;
	start_at: string;
	end_at: string;
	time_zone: string;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface EventRow {
	id: string;
	page_id: string;
	subject_type: string;
	subject_id: string;
	type: string;
	visibility: string;
	message: string;
	state: string | null;
	severity: string | null;
	actor_type: string;
	actor_id: string | null;
	actor_label: string;
	metadata_json: string | null;
	created_at: string;
}

export interface TokenRow {
	id: string;
	name: string;
	prefix: string;
	hash: string;
	scopes_json: string;
	created_at: string;
	last_used_at: string | null;
	revoked_at: string | null;
}

export interface AuditRow {
	id: string;
	at: string;
	actor_type: string;
	actor_id: string | null;
	actor_label: string;
	action: string;
	subject_type: string;
	subject_id: string | null;
	detail_json: string | null;
	request_id: string | null;
}

export interface IdempotencyRow {
	key: string;
	scope: string;
	request_hash: string;
	status_code: number;
	response_json: string;
	created_at: string;
}

export interface IngestLogRow {
	id: string;
	event_id: string | null;
	dedup_hash: string;
	source: string;
	received_at: string;
	result: string;
	incident_id: string | null;
	payload_json: string;
}

export interface OutboxRow {
	id: string;
	channel: string;
	dedup_key: string;
	payload_json: string;
	status: string;
	attempts: number;
	next_attempt_at: string;
	last_error: string | null;
	created_at: string;
	updated_at: string;
	sent_at: string | null;
}

export interface WebhookSubscriptionRow {
	id: string;
	url: string;
	events_json: string;
	active: number;
	created_at: string;
}

export interface UptimeDailyRow {
	page_id: string;
	component_id: string;
	/** UTC calendar day, `YYYY-MM-DD`. */
	day: string;
	/** Worst public status observed during the day. */
	status: string;
	/** Number of observations recorded during the day. */
	samples: number;
	/** Subset of observations whose status was `operational`. */
	operational_samples: number;
	updated_at: string;
}

export interface EventInput {
	id: string;
	page_id: string;
	subject_type: string;
	subject_id: string;
	type: string;
	visibility: string;
	message: string;
	state?: string | null;
	severity?: string | null;
	actor_type: string;
	actor_id?: string | null;
	actor_label: string;
	metadata_json?: string | null;
	created_at: string;
}

export interface PageCursor {
	createdAt: string;
	id: string;
}

/** Encode/decode opaque list cursors (timestamp + id pairs). */
export const encodeCursor = (cursor: PageCursor): string =>
	Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString("base64url");

export const decodeCursor = (value: string | undefined): PageCursor | null => {
	if (!value) {
		return null;
	}
	try {
		const decoded = Buffer.from(value, "base64url").toString("utf8");
		const separator = decoded.indexOf("|");
		if (separator <= 0) {
			return null;
		}
		return {
			createdAt: decoded.slice(0, separator),
			id: decoded.slice(separator + 1),
		};
	} catch {
		return null;
	}
};

/* ----------------------------- repositories ------------------------------ */

export const createRepositories = (db: DatabaseSync) => {
	const cache = new Map<string, StatementSync>();
	const prep = (sql: string): StatementSync => {
		const existing = cache.get(sql);
		if (existing) {
			return existing;
		}
		const statement = db.prepare(sql);
		cache.set(sql, statement);
		return statement;
	};

	const one = <T>(sql: string, ...params: unknown[]): T | null => {
		const rows = prep(sql).all(...(params as never[])) as T[];
		return rows[0] ?? null;
	};

	const many = <T>(sql: string, ...params: unknown[]): T[] =>
		prep(sql).all(...(params as never[])) as T[];

	const run = (sql: string, ...params: unknown[]): void => {
		prep(sql).run(...(params as never[]));
	};

	/* -------------------------------- pages -------------------------------- */

	const pages = {
		insert: (row: PageRow) => {
			run(
				`INSERT INTO status_pages (id, slug, name, description, settings_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.slug,
				row.name,
				row.description,
				row.settings_json,
				row.created_at,
				row.updated_at,
			);
		},
		findById: (id: string) =>
			one<PageRow>("SELECT * FROM status_pages WHERE id = ?", id),
		findBySlug: (slug: string) =>
			one<PageRow>("SELECT * FROM status_pages WHERE slug = ?", slug),
		list: (): PageRow[] =>
			many<PageRow>("SELECT * FROM status_pages ORDER BY created_at ASC"),
		update: (
			id: string,
			fields: { name?: string; description?: string; settings_json?: string },
			now: string,
		) => {
			const sets: string[] = [];
			const params: unknown[] = [];
			if (fields.name !== undefined) {
				sets.push("name = ?");
				params.push(fields.name);
			}
			if (fields.description !== undefined) {
				sets.push("description = ?");
				params.push(fields.description);
			}
			if (fields.settings_json !== undefined) {
				sets.push("settings_json = ?");
				params.push(fields.settings_json);
			}
			sets.push("updated_at = ?");
			params.push(now, id);
			run(`UPDATE status_pages SET ${sets.join(", ")} WHERE id = ?`, ...params);
		},
		touch: (id: string, now: string) => {
			run("UPDATE status_pages SET updated_at = ? WHERE id = ?", now, id);
		},
	};

	/* ------------------------------ components ----------------------------- */

	const components = {
		insert: (row: ComponentRow) => {
			run(
				`INSERT INTO components (id, page_id, name, description, category, group_name, position, visibility, parent_id, source, observed_status, observed_at, last_published_status, last_published_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.page_id,
				row.name,
				row.description,
				row.category,
				row.group_name,
				row.position,
				row.visibility,
				row.parent_id,
				row.source,
				row.observed_status,
				row.observed_at,
				row.last_published_status,
				row.last_published_at,
				row.created_at,
				row.updated_at,
			);
		},
		findById: (id: string) =>
			one<ComponentRow>("SELECT * FROM components WHERE id = ?", id),
		listByPage: (pageId: string): ComponentRow[] =>
			many<ComponentRow>(
				"SELECT * FROM components WHERE page_id = ? ORDER BY position ASC, created_at ASC",
				pageId,
			),
		update: (
			id: string,
			fields: Partial<
				Pick<
					ComponentRow,
					| "name"
					| "description"
					| "category"
					| "group_name"
					| "position"
					| "visibility"
					| "parent_id"
					| "observed_status"
					| "observed_at"
				>
			>,
			now: string,
		) => {
			const entries = Object.entries(fields).filter(
				([, value]) => value !== undefined,
			);
			const sets = entries.map(([key]) => `${key} = ?`);
			sets.push("updated_at = ?");
			run(
				`UPDATE components SET ${sets.join(", ")} WHERE id = ?`,
				...entries.map(([, value]) => value),
				now,
				id,
			);
		},
		setPublishedStatus: (id: string, status: string, now: string) => {
			run(
				"UPDATE components SET last_published_status = ?, last_published_at = ? WHERE id = ?",
				status,
				now,
				id,
			);
		},
		delete: (id: string) => {
			run("DELETE FROM components WHERE id = ?", id);
		},
	};

	/* ------------------------------ incidents ------------------------------ */

	const incidents = {
		insert: (row: IncidentRow) => {
			run(
				`INSERT INTO incidents (id, page_id, title, description, severity, state, visibility, published, published_at, correlation_key, started_at, resolved_at, created_by, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.page_id,
				row.title,
				row.description,
				row.severity,
				row.state,
				row.visibility,
				row.published,
				row.published_at,
				row.correlation_key,
				row.started_at,
				row.resolved_at,
				row.created_by,
				row.created_at,
				row.updated_at,
			);
		},
		findById: (id: string) =>
			one<IncidentRow>("SELECT * FROM incidents WHERE id = ?", id),
		listByPage: (pageId: string): IncidentRow[] =>
			many<IncidentRow>(
				"SELECT * FROM incidents WHERE page_id = ? ORDER BY started_at DESC, id DESC",
				pageId,
			),
		update: (
			id: string,
			fields: Partial<
				Pick<
					IncidentRow,
					| "title"
					| "description"
					| "severity"
					| "state"
					| "visibility"
					| "published"
					| "published_at"
					| "resolved_at"
				>
			>,
			now: string,
		) => {
			const entries = Object.entries(fields).filter(
				([, value]) => value !== undefined,
			);
			const sets = entries.map(([key]) => `${key} = ?`);
			sets.push("updated_at = ?");
			run(
				`UPDATE incidents SET ${sets.join(", ")} WHERE id = ?`,
				...entries.map(([, value]) => value),
				now,
				id,
			);
		},
		replaceComponents: (incidentId: string, componentIds: string[]) => {
			run("DELETE FROM incident_components WHERE incident_id = ?", incidentId);
			for (const componentId of componentIds) {
				run(
					"INSERT INTO incident_components (incident_id, component_id) VALUES (?, ?)",
					incidentId,
					componentId,
				);
			}
		},
		componentIds: (incidentId: string): string[] =>
			many<{ component_id: string }>(
				"SELECT component_id FROM incident_components WHERE incident_id = ?",
				incidentId,
			).map((row) => row.component_id),
		findOpenByCorrelation: (pageId: string, correlationKey: string) =>
			one<IncidentRow>(
				`SELECT * FROM incidents WHERE page_id = ? AND correlation_key = ? AND state != 'resolved'`,
				pageId,
				correlationKey,
			),
		findRecentByCorrelation: (
			pageId: string,
			correlationKey: string,
			since: string,
		) =>
			one<IncidentRow>(
				"SELECT * FROM incidents WHERE page_id = ? AND correlation_key = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1",
				pageId,
				correlationKey,
				since,
			),
		delete: (id: string) => {
			run("DELETE FROM incidents WHERE id = ?", id);
		},
	};

	/* ----------------------------- maintenances ---------------------------- */

	const maintenances = {
		insert: (row: MaintenanceRow) => {
			run(
				`INSERT INTO maintenances (id, page_id, title, description, state, visibility, published, published_at, start_at, end_at, time_zone, created_by, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.page_id,
				row.title,
				row.description,
				row.state,
				row.visibility,
				row.published,
				row.published_at,
				row.start_at,
				row.end_at,
				row.time_zone,
				row.created_by,
				row.created_at,
				row.updated_at,
			);
		},
		findById: (id: string) =>
			one<MaintenanceRow>("SELECT * FROM maintenances WHERE id = ?", id),
		listByPage: (pageId: string): MaintenanceRow[] =>
			many<MaintenanceRow>(
				"SELECT * FROM maintenances WHERE page_id = ? ORDER BY start_at DESC, id DESC",
				pageId,
			),
		update: (
			id: string,
			fields: Partial<
				Pick<
					MaintenanceRow,
					| "title"
					| "description"
					| "state"
					| "visibility"
					| "published"
					| "published_at"
					| "start_at"
					| "end_at"
					| "time_zone"
				>
			>,
			now: string,
		) => {
			const entries = Object.entries(fields).filter(
				([, value]) => value !== undefined,
			);
			const sets = entries.map(([key]) => `${key} = ?`);
			sets.push("updated_at = ?");
			run(
				`UPDATE maintenances SET ${sets.join(", ")} WHERE id = ?`,
				...entries.map(([, value]) => value),
				now,
				id,
			);
		},
		replaceComponents: (maintenanceId: string, componentIds: string[]) => {
			run(
				"DELETE FROM maintenance_components WHERE maintenance_id = ?",
				maintenanceId,
			);
			for (const componentId of componentIds) {
				run(
					"INSERT INTO maintenance_components (maintenance_id, component_id) VALUES (?, ?)",
					maintenanceId,
					componentId,
				);
			}
		},
		componentIds: (maintenanceId: string): string[] =>
			many<{ component_id: string }>(
				"SELECT component_id FROM maintenance_components WHERE maintenance_id = ?",
				maintenanceId,
			).map((row) => row.component_id),
		delete: (id: string) => {
			run("DELETE FROM maintenances WHERE id = ?", id);
		},
	};

	/* -------------------------------- events ------------------------------- */

	const events = {
		insert: (row: EventInput) => {
			run(
				`INSERT INTO events (id, page_id, subject_type, subject_id, type, visibility, message, state, severity, actor_type, actor_id, actor_label, metadata_json, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.page_id,
				row.subject_type,
				row.subject_id,
				row.type,
				row.visibility,
				row.message,
				row.state ?? null,
				row.severity ?? null,
				row.actor_type,
				row.actor_id ?? null,
				row.actor_label,
				row.metadata_json ?? null,
				row.created_at,
			);
		},
		listBySubject: (
			pageId: string,
			subjectType: string,
			subjectId: string,
			limit = 100,
			offset = 0,
		): EventRow[] =>
			many<EventRow>(
				"SELECT * FROM events WHERE page_id = ? AND subject_type = ? AND subject_id = ? ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?",
				pageId,
				subjectType,
				subjectId,
				limit,
				offset,
			),
		countPublicByPage: (pageId: string, subjectIds: string[]): number => {
			if (subjectIds.length === 0) {
				return 0;
			}
			const placeholders = subjectIds.map(() => "?").join(", ");
			const rows = many<{ total: number }>(
				`SELECT COUNT(*) AS total FROM events WHERE page_id = ? AND visibility = 'public' AND subject_id IN (${placeholders})`,
				pageId,
				...subjectIds,
			);
			return rows[0]?.total ?? 0;
		},
		listPublicByPage: (
			pageId: string,
			subjectIds: string[],
			options: {
				limit: number;
				cursor: PageCursor | null;
				from?: string;
				to?: string;
			},
		): EventRow[] => {
			if (subjectIds.length === 0) {
				return [];
			}
			const placeholders = subjectIds.map(() => "?").join(", ");
			const conditions = [
				"page_id = ?",
				"visibility = 'public'",
				`subject_id IN (${placeholders})`,
			];
			const params: unknown[] = [pageId, ...subjectIds];
			if (options.from) {
				conditions.push("created_at >= ?");
				params.push(options.from);
			}
			if (options.to) {
				conditions.push("created_at <= ?");
				params.push(options.to);
			}
			if (options.cursor) {
				conditions.push("(created_at, id) < (?, ?)");
				params.push(options.cursor.createdAt, options.cursor.id);
			}
			return many<EventRow>(
				`SELECT * FROM events WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
				...params,
				options.limit,
			);
		},
		deleteBySubject: (subjectType: string, subjectId: string) => {
			run(
				"DELETE FROM events WHERE subject_type = ? AND subject_id = ?",
				subjectType,
				subjectId,
			);
		},
	};

	/* -------------------------------- tokens ------------------------------- */

	const tokens = {
		insert: (row: TokenRow) => {
			run(
				`INSERT INTO api_tokens (id, name, prefix, hash, scopes_json, created_at, last_used_at, revoked_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.name,
				row.prefix,
				row.hash,
				row.scopes_json,
				row.created_at,
				row.last_used_at,
				row.revoked_at,
			);
		},
		findById: (id: string) =>
			one<TokenRow>("SELECT * FROM api_tokens WHERE id = ?", id),
		list: (): TokenRow[] =>
			many<TokenRow>("SELECT * FROM api_tokens ORDER BY created_at DESC"),
		revoke: (id: string, now: string) => {
			run(
				"UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
				now,
				id,
			);
		},
		touch: (id: string, now: string) => {
			run("UPDATE api_tokens SET last_used_at = ? WHERE id = ?", now, id);
		},
	};

	/* -------------------------------- audit -------------------------------- */

	const audit = {
		insert: (row: AuditRow) => {
			run(
				`INSERT INTO audit_log (id, at, actor_type, actor_id, actor_label, action, subject_type, subject_id, detail_json, request_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.at,
				row.actor_type,
				row.actor_id,
				row.actor_label,
				row.action,
				row.subject_type,
				row.subject_id,
				row.detail_json,
				row.request_id,
			);
		},
		list: (limit: number, offset: number): AuditRow[] =>
			many<AuditRow>(
				"SELECT * FROM audit_log ORDER BY at DESC, id DESC LIMIT ? OFFSET ?",
				limit,
				offset,
			),
	};

	/* ----------------------------- idempotency ----------------------------- */

	const idempotency = {
		find: (key: string, scope: string) =>
			one<IdempotencyRow>(
				"SELECT * FROM idempotency_keys WHERE key = ? AND scope = ?",
				key,
				scope,
			),
		insert: (row: IdempotencyRow) => {
			run(
				"INSERT INTO idempotency_keys (key, scope, request_hash, status_code, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
				row.key,
				row.scope,
				row.request_hash,
				row.status_code,
				row.response_json,
				row.created_at,
			);
		},
	};

	/* ------------------------------- ingest log ---------------------------- */

	const ingestLog = {
		findByDedupHash: (dedupHash: string) =>
			one<IngestLogRow>(
				"SELECT * FROM ingest_log WHERE dedup_hash = ?",
				dedupHash,
			),
		insert: (row: IngestLogRow) => {
			run(
				"INSERT INTO ingest_log (id, event_id, dedup_hash, source, received_at, result, incident_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				row.id,
				row.event_id,
				row.dedup_hash,
				row.source,
				row.received_at,
				row.result,
				row.incident_id,
				row.payload_json,
			);
		},
	};

	/* -------------------------------- outbox ------------------------------- */

	const outbox = {
		insert: (row: OutboxRow) => {
			run(
				`INSERT INTO notification_outbox (id, channel, dedup_key, payload_json, status, attempts, next_attempt_at, last_error, created_at, updated_at, sent_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				row.id,
				row.channel,
				row.dedup_key,
				row.payload_json,
				row.status,
				row.attempts,
				row.next_attempt_at,
				row.last_error,
				row.created_at,
				row.updated_at,
				row.sent_at,
			);
		},
		findByDedupKey: (dedupKey: string) =>
			one<OutboxRow>(
				"SELECT * FROM notification_outbox WHERE dedup_key = ?",
				dedupKey,
			),
		listDue: (now: string, limit: number): OutboxRow[] =>
			many<OutboxRow>(
				`SELECT * FROM notification_outbox WHERE status IN ('pending', 'retry') AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?`,
				now,
				limit,
			),
		markSent: (id: string, now: string) => {
			run(
				`UPDATE notification_outbox SET status = 'sent', sent_at = ?, updated_at = ?, last_error = NULL WHERE id = ?`,
				now,
				now,
				id,
			);
		},
		markRetry: (
			id: string,
			attempts: number,
			nextAttemptAt: string,
			error: string,
			now: string,
		) => {
			run(
				`UPDATE notification_outbox SET status = 'retry', attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?`,
				attempts,
				nextAttemptAt,
				error.slice(0, 500),
				now,
				id,
			);
		},
		markDead: (id: string, attempts: number, error: string, now: string) => {
			run(
				`UPDATE notification_outbox SET status = 'dead', attempts = ?, last_error = ?, updated_at = ? WHERE id = ?`,
				attempts,
				error.slice(0, 500),
				now,
				id,
			);
		},
	};

	/* -------------------------- webhook subscriptions ---------------------- */

	/* --------------------------- daily uptime rollup ----------------------- */

	const uptimeDaily = {
		find: (componentId: string, day: string) =>
			one<UptimeDailyRow>(
				"SELECT * FROM component_uptime_daily WHERE component_id = ? AND day = ?",
				componentId,
				day,
			),
		upsert: (row: UptimeDailyRow) => {
			run(
				`INSERT INTO component_uptime_daily (page_id, component_id, day, status, samples, operational_samples, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(component_id, day) DO UPDATE SET
					status = excluded.status,
					samples = excluded.samples,
					operational_samples = excluded.operational_samples,
					updated_at = excluded.updated_at`,
				row.page_id,
				row.component_id,
				row.day,
				row.status,
				row.samples,
				row.operational_samples,
				row.updated_at,
			);
		},
		listForComponent: (
			componentId: string,
			fromDay: string,
			toDay: string,
		): UptimeDailyRow[] =>
			many<UptimeDailyRow>(
				"SELECT * FROM component_uptime_daily WHERE component_id = ? AND day >= ? AND day <= ? ORDER BY day ASC",
				componentId,
				fromDay,
				toDay,
			),
		listForPage: (
			pageId: string,
			fromDay: string,
			toDay: string,
		): UptimeDailyRow[] =>
			many<UptimeDailyRow>(
				"SELECT * FROM component_uptime_daily WHERE page_id = ? AND day >= ? AND day <= ? ORDER BY day ASC",
				pageId,
				fromDay,
				toDay,
			),
	};

	const webhookSubscriptions = {
		insert: (row: WebhookSubscriptionRow) => {
			run(
				"INSERT INTO webhook_subscriptions (id, url, events_json, active, created_at) VALUES (?, ?, ?, ?, ?)",
				row.id,
				row.url,
				row.events_json,
				row.active,
				row.created_at,
			);
		},
		listActive: (): WebhookSubscriptionRow[] =>
			many<WebhookSubscriptionRow>(
				"SELECT * FROM webhook_subscriptions WHERE active = 1",
			),
	};

	return {
		db,
		pages,
		components,
		incidents,
		maintenances,
		events,
		tokens,
		audit,
		idempotency,
		ingestLog,
		outbox,
		uptimeDaily,
		webhookSubscriptions,
	};
};

export type Repositories = ReturnType<typeof createRepositories>;
