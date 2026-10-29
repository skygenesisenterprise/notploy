/**
 * Platform bootstrap.
 *
 * `createStatusPlatform` wires configuration, storage, services and the HTTP
 * application into a single object owned by the host application (the Next.js
 * status app). It also implements the degradation path: when the database
 * cannot be opened, the platform switches to *snapshot mode* and keeps
 * serving the last known public state read-only instead of going dark — the
 * admin and integration APIs answer 503, the public page stays up.
 */
import type { Hono } from "hono";
import { createStatusApi } from "./api/app";
import type { Variables } from "./api/middleware";
import { createSnapshotApi } from "./api/snapshot-api";
import type { StatusConfig } from "./config";
import { loadConfig } from "./config";
import type { PublicPageDto } from "./core/dto";
import {
	type OutboxWorkerHandle,
	startOutboxWorker,
} from "./operations/outbox-worker";
import { startUptimeSampler } from "./operations/uptime-sampler";
import {
	createStatusContext,
	readSnapshot,
	type StatusContext,
} from "./services/context";

export interface StatusPlatform {
	config: StatusConfig;
	/** `read-write` in normal operation, `snapshot` during storage failure. */
	mode: "read-write" | "snapshot";
	/** Last known public pages (also the source of the snapshot API). */
	snapshot: PublicPageDto[];
	/** Present in read-write mode; a throwing stub in snapshot mode. */
	ctx: StatusContext | null;
	api: Hono<{ Variables: Variables }>;
	/**
	 * Start the background workers (notification outbox + uptime sampler).
	 * Returns `null` in snapshot mode or when both are disabled.
	 */
	startWorkers: () => OutboxWorkerHandle | null;
	close: () => void;
}

export interface CreatePlatformOptions {
	config?: StatusConfig;
	/** Injected for tests (in-memory database, frozen clock). */
	now?: () => string;
}

export const createStatusPlatform = (
	options: CreatePlatformOptions = {},
): StatusPlatform => {
	const config = options.config ?? loadConfig();
	const snapshot = readSnapshot(config.snapshotFile)?.pages ?? [];

	try {
		const ctx = createStatusContext({
			config,
			...(options.now ? { now: options.now } : {}),
		});
		return {
			config,
			mode: "read-write",
			snapshot,
			ctx,
			api: createStatusApi(ctx),
			startWorkers: () => {
				const outbox = startOutboxWorker(ctx);
				const sampler = startUptimeSampler(ctx);
				if (!outbox && !sampler) {
					return null;
				}
				return {
					stop: () => {
						outbox?.stop();
						sampler?.stop();
					},
					tick: () => outbox?.tick() ?? Promise.resolve(),
				};
			},
			close: () => {
				try {
					ctx.db.close();
				} catch {
					// Already closed.
				}
			},
		};
	} catch (error) {
		// Storage unavailable: serve the last known public state read-only.
		process.stderr.write(
			`${JSON.stringify({
				level: "error",
				time: new Date().toISOString(),
				msg: "status_storage_unavailable_switching_to_snapshot",
				error: error instanceof Error ? error.message : String(error),
			})}\n`,
		);
		return {
			config,
			mode: "snapshot",
			snapshot,
			ctx: null,
			api: createSnapshotApi(snapshot, config),
			startWorkers: () => null,
			close: () => undefined,
		};
	}
};
