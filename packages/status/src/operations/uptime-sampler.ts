/**
 * Uptime sampler — keeps the daily rollup moving on a quiet platform.
 *
 * Mutations already fold a sample into today's bucket (see `publishState`),
 * but a status page whose components change rarely would otherwise record
 * almost no observation. The sampler recomputes the engine on an interval and
 * records one sample per component; it deliberately does *not* publish, so a
 * quiet platform never sees `updated_at` churn or snapshot rewrites.
 *
 * Started by the host application (see `apps/status/lib/engine.ts`).
 */
import type { StatusContext } from "../services/context";
import { sampleUptime } from "../services/uptime";

export interface UptimeSamplerHandle {
	stop: () => void;
	/** Run one sampling cycle immediately (also used by tests). */
	tick: () => void;
}

export const startUptimeSampler = (
	ctx: StatusContext,
): UptimeSamplerHandle | null => {
	if (ctx.config.uptimeIntervalMs <= 0) {
		return null;
	}
	const tick = (): void => {
		try {
			sampleUptime(ctx);
		} catch (error) {
			ctx.log.warn("uptime_sample_failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
	const timer = setInterval(tick, ctx.config.uptimeIntervalMs);
	// Never keep the process alive just for sampling.
	timer.unref?.();
	return {
		stop: () => clearInterval(timer),
		tick,
	};
};
