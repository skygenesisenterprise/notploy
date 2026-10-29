/**
 * Outbox worker — drains the notification queue on an interval.
 *
 * Started by the host application (see `apps/status/lib/engine.ts`). Delivery
 * is resumable by construction: everything lives in the `notification_outbox`
 * table, so a restart simply continues from the pending entries.
 */
import type { StatusContext } from "../services/context";
import { dispatchOutbox } from "../services/outbox";

export interface OutboxWorkerHandle {
	stop: () => void;
	/** Run one dispatch cycle immediately (also used by tests). */
	tick: () => Promise<void>;
}

export const startOutboxWorker = (
	ctx: StatusContext,
): OutboxWorkerHandle | null => {
	if (ctx.config.outboxIntervalMs <= 0) {
		return null;
	}
	let running = false;
	const tick = async (): Promise<void> => {
		if (running) {
			return;
		}
		running = true;
		try {
			const summary = await dispatchOutbox(ctx);
			if (summary.due > 0) {
				ctx.log.debug(
					"outbox_cycle",
					summary as unknown as Record<string, unknown>,
				);
			}
		} catch (error) {
			ctx.log.warn("outbox_cycle_failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			running = false;
		}
	};
	const timer = setInterval(() => {
		void tick();
	}, ctx.config.outboxIntervalMs);
	// Never keep the process alive just for notifications.
	timer.unref?.();
	return {
		stop: () => clearInterval(timer),
		tick,
	};
};
