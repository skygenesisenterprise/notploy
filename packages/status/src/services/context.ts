/**
 * Service context — the dependency bundle every service function receives.
 *
 * Building it once (see `createStatusPlatform`) keeps services free of
 * singletons and makes every operation trivially testable against an
 * in-memory database and a frozen clock.
 */
import {
	appendFileSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { StatusConfig } from "../config";
import { loadConfig } from "../config";
import type { PublicPageDto } from "../core/dto";
import { newId } from "../core/ids";
import { computePageStatus } from "../core/status-engine";
import { nowIso } from "../core/time";
import { openDatabase } from "../store/db";
import { createRepositories, type Repositories } from "../store/repositories";
import { buildAllPublicPages } from "./public";
import { recordDailyUptime } from "./uptime";

export type ActorType = "user" | "token" | "system" | "integration";

export interface Actor {
	type: ActorType;
	id: string | null;
	label: string;
	/** Scopes of the presenting token (empty for CLI/system actors). */
	scopes?: string[];
	/** Correlates audit entries with request logs. */
	requestId?: string | null;
}

export const systemActor = (label = "system"): Actor => ({
	type: "system",
	id: null,
	label,
});

export interface AuditInput {
	action: string;
	subjectType: string;
	subjectId?: string | null;
	detail?: Record<string, unknown> | null;
}

export interface EnqueueInput {
	/** Stable event name, e.g. `incident.published`. */
	event: string;
	/** Unique per logical occurrence — repeated enqueues are ignored. */
	dedupKey: string;
	payload: Record<string, unknown>;
}

export interface Logger {
	debug: (message: string, data?: Record<string, unknown>) => void;
	info: (message: string, data?: Record<string, unknown>) => void;
	warn: (message: string, data?: Record<string, unknown>) => void;
	error: (message: string, data?: Record<string, unknown>) => void;
}

export const createLogger = (level: StatusConfig["logLevel"]): Logger => {
	const order = { debug: 10, info: 20, warn: 30, error: 40 };
	const threshold = order[level];
	const emit =
		(severity: "debug" | "info" | "warn" | "error") =>
		(message: string, data?: Record<string, unknown>) => {
			if (order[severity] < threshold) {
				return;
			}
			const line = JSON.stringify({
				level: severity,
				time: new Date().toISOString(),
				msg: message,
				...data,
			});
			if (severity === "error" || severity === "warn") {
				process.stderr.write(`${line}\n`);
			} else {
				process.stdout.write(`${line}\n`);
			}
		};
	return {
		debug: emit("debug"),
		info: emit("info"),
		warn: emit("warn"),
		error: emit("error"),
	};
};

export interface StatusContext {
	db: DatabaseSync;
	repos: Repositories;
	config: StatusConfig;
	now: () => string;
	log: Logger;
	/** Append an audit entry for a sensitive operation. */
	audit: (actor: Actor, input: AuditInput) => void;
	/** Queue a notification (deduplicated) for the outbox worker. */
	enqueue: (input: EnqueueInput) => void;
	/**
	 * Recompute the public state of a page, persist it on the components
	 * (last-known-public-state fallback) and refresh the snapshot file.
	 */
	publishState: (pageId: string) => void;
	/** Recompute and snapshot every page (used by ops tasks and tests). */
	publishAllStates: () => void;
}

export interface CreateContextOptions {
	config?: StatusConfig;
	db?: DatabaseSync;
	now?: () => string;
	logger?: Logger;
}

/** Write a file atomically (temp file + rename) so readers never see partial data. */
export const writeFileAtomic = (path: string, contents: string): void => {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, contents, "utf8");
	renameSync(tmp, path);
};

/** JSON-lines append used for the audit trail durability (best effort). */
export const appendJsonLine = (path: string, value: unknown): void => {
	mkdirSync(dirname(path), { recursive: true });
	appendFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
};

export const createStatusContext = (
	options: CreateContextOptions = {},
): StatusContext => {
	const config = options.config ?? loadConfig();
	const db = options.db ?? openDatabase({ file: config.databaseFile });
	const repos = createRepositories(db);
	const now = options.now ?? nowIso;
	const log = options.logger ?? createLogger(config.logLevel);

	const audit = (actor: Actor, input: AuditInput): void => {
		repos.audit.insert({
			id: newId("aud"),
			at: now(),
			actor_type: actor.type,
			actor_id: actor.id,
			actor_label: actor.label,
			action: input.action,
			subject_type: input.subjectType,
			subject_id: input.subjectId ?? null,
			detail_json: input.detail ? JSON.stringify(input.detail) : null,
			request_id: actor.requestId ?? null,
		});
	};

	const enqueue = (input: EnqueueInput): void => {
		const existing = repos.outbox.findByDedupKey(input.dedupKey);
		if (existing) {
			return;
		}
		const timestamp = now();
		repos.outbox.insert({
			id: newId("out"),
			channel: "webhook",
			dedup_key: input.dedupKey,
			payload_json: JSON.stringify({ event: input.event, ...input.payload }),
			status: "pending",
			attempts: 0,
			next_attempt_at: timestamp,
			last_error: null,
			created_at: timestamp,
			updated_at: timestamp,
			sent_at: null,
		});
	};

	const writeSnapshot = (): void => {
		try {
			const pages = buildAllPublicPages(ctx);
			writeFileAtomic(
				config.snapshotFile,
				JSON.stringify({ version: 1, generatedAt: now(), pages }, null, 2),
			);
		} catch (error) {
			log.warn("snapshot_write_failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const publishState = (pageId: string): void => {
		const page = repos.pages.findById(pageId);
		if (!page) {
			return;
		}
		const components = repos.components.listByPage(pageId);
		const incidents = repos.incidents.listByPage(pageId);
		const maintenances = repos.maintenances.listByPage(pageId);
		const settings = JSON.parse(page.settings_json) as {
			staleAfterSeconds?: number;
			severityToStatus?: Record<string, string>;
		};
		const result = computePageStatus({
			components: components.map((component) => ({
				id: component.id,
				visibility: component.visibility === "private" ? "private" : "public",
				parentId: component.parent_id,
				observedStatus: component.observed_status as never,
				observedAt: component.observed_at,
				lastPublishedStatus: component.last_published_status as never,
				position: component.position,
			})),
			incidents: incidents.map((incident) => ({
				id: incident.id,
				severity: incident.severity as never,
				state: incident.state as never,
				published: incident.published === 1,
				visibility: incident.visibility === "private" ? "private" : "public",
				componentIds: repos.incidents.componentIds(incident.id),
			})),
			maintenances: maintenances.map((maintenance) => ({
				id: maintenance.id,
				state: maintenance.state as never,
				published: maintenance.published === 1,
				visibility: maintenance.visibility === "private" ? "private" : "public",
				componentIds: repos.maintenances.componentIds(maintenance.id),
			})),
			staleAfterSeconds: settings.staleAfterSeconds,
			severityToStatus: settings.severityToStatus as never,
			now: now(),
		});
		const timestamp = now();
		for (const status of result.componentStatuses) {
			repos.components.setPublishedStatus(
				status.componentId,
				status.status,
				timestamp,
			);
		}
		// Fold the recomputation into today's uptime bucket before snapshotting.
		recordDailyUptime(ctx, pageId, result.componentStatuses, timestamp);
		repos.pages.touch(pageId, timestamp);
		writeSnapshot();
	};

	const ctx: StatusContext = {
		db,
		repos,
		config,
		now,
		log,
		audit,
		enqueue,
		publishState,
		publishAllStates: () => {
			for (const page of repos.pages.list()) {
				publishState(page.id);
			}
		},
	};

	return ctx;
};

/** Read the snapshot file written by `publishState` (used for recovery). */
export const readSnapshot = (
	path: string,
): { generatedAt: string; pages: PublicPageDto[] } | null => {
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw) as {
			generatedAt?: string;
			pages?: PublicPageDto[];
		};
		if (!parsed.generatedAt || !Array.isArray(parsed.pages)) {
			return null;
		}
		return { generatedAt: parsed.generatedAt, pages: parsed.pages };
	} catch {
		return null;
	}
};
