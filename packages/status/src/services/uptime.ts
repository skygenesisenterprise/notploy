/**
 * Daily uptime rollup.
 *
 * The state engine is recomputed on every mutation and by a lightweight
 * sampler, and each recomputation folds the current public status of every
 * component into today's bucket. Buckets therefore hold the *worst* status
 * seen during the day plus two counters, which is enough to publish a daily
 * availability ratio for the last 90 days without retaining raw samples.
 *
 * Reads never fabricate data: a day with no observation is exposed with
 * `status: null` and excluded from the ratio, matching the engine's rule that
 * absence of data is never proof of health.
 */
import type { PublicComponentUptimeDto, PublicUptimeDayDto } from "../core/dto";
import type { ComponentStatusResult } from "../core/status-engine";
import { computePageStatus, worstStatus } from "../core/status-engine";
import type { PublicComponentStatus } from "../core/types";
import {
	availabilityPercent,
	dayWindow,
	isAvailable,
	UPTIME_WINDOW_DAYS,
	utcDay,
} from "../core/uptime";
import type { UptimeDailyRow } from "../store/repositories";
import type { StatusContext } from "./context";
import { toEngineInputs } from "./public";
import { resolveSettings } from "./settings";

const mergeBucket = (
	existing: UptimeDailyRow | null,
	pageId: string,
	componentId: string,
	day: string,
	status: PublicComponentStatus,
	now: string,
): UptimeDailyRow => ({
	page_id: pageId,
	component_id: componentId,
	day,
	status: existing
		? worstStatus(existing.status as PublicComponentStatus, status)
		: status,
	samples: (existing?.samples ?? 0) + 1,
	operational_samples:
		(existing?.operational_samples ?? 0) + (isAvailable(status) ? 1 : 0),
	updated_at: now,
});

/**
 * Fold one observation of every component into today's bucket.
 *
 * Called by `publishState` (so any mutation increases the sample count) and
 * by the uptime sampler (so a quiet platform still accumulates data).
 */
export const recordDailyUptime = (
	ctx: StatusContext,
	pageId: string,
	statuses: ComponentStatusResult[],
	now: string = ctx.now(),
): void => {
	if (statuses.length === 0) {
		return;
	}
	const day = utcDay(now);
	for (const status of statuses) {
		// `unknown` means the component never reported anything usable. The
		// engine still projects `lastPublishedStatus ?? operational` so the
		// page never goes blank, but that projection is not an observation:
		// the day must stay "no data" instead of being counted as available.
		if (status.observedStatus === "unknown") {
			continue;
		}
		const existing = ctx.repos.uptimeDaily.find(status.componentId, day);
		ctx.repos.uptimeDaily.upsert(
			mergeBucket(
				existing,
				pageId,
				status.componentId,
				day,
				status.status,
				now,
			),
		);
	}
};

const summarize = (
	days: string[],
	buckets: UptimeDailyRow[],
): PublicComponentUptimeDto => {
	const byDay = new Map(buckets.map((bucket) => [bucket.day, bucket]));
	let samples = 0;
	let operationalSamples = 0;
	const series: PublicUptimeDayDto[] = days.map((date) => {
		const bucket = byDay.get(date);
		if (bucket) {
			samples += bucket.samples;
			operationalSamples += bucket.operational_samples;
		}
		return {
			date,
			status: bucket ? (bucket.status as PublicComponentStatus) : null,
		};
	});
	return {
		windowDays: days.length,
		uptimePercent: availabilityPercent(operationalSamples, samples),
		days: series,
	};
};

/** Uptime DTO for a component — or a window — without any observation. */
export const emptyComponentUptime = (
	windowDays: number = UPTIME_WINDOW_DAYS,
): PublicComponentUptimeDto => ({
	windowDays,
	uptimePercent: null,
	days: [],
});

export interface UptimeQuery {
	windowDays?: number;
	now?: string;
}

/** Uptime of a single component over the window, oldest day first. */
export const getComponentUptime = (
	ctx: StatusContext,
	componentId: string,
	options: UptimeQuery = {},
): PublicComponentUptimeDto => {
	const windowDays = options.windowDays ?? UPTIME_WINDOW_DAYS;
	const now = options.now ?? ctx.now();
	const days = dayWindow(utcDay(now), windowDays);
	const from = days[0];
	if (!from) {
		return emptyComponentUptime(windowDays);
	}
	const buckets = ctx.repos.uptimeDaily.listForComponent(
		componentId,
		from,
		utcDay(now),
	);
	return summarize(days, buckets);
};

/**
 * Uptime of every requested component of a page, in a single query.
 * Components without any recorded day still receive an explicit DTO so the
 * caller does not have to special-case them.
 */
export const getUptimeForComponents = (
	ctx: StatusContext,
	pageId: string,
	componentIds: string[],
	options: UptimeQuery = {},
): Map<string, PublicComponentUptimeDto> => {
	const windowDays = options.windowDays ?? UPTIME_WINDOW_DAYS;
	const now = options.now ?? ctx.now();
	const days = dayWindow(utcDay(now), windowDays);
	const from = days[0];
	const result = new Map<string, PublicComponentUptimeDto>();
	if (!from) {
		for (const componentId of componentIds) {
			result.set(componentId, emptyComponentUptime(windowDays));
		}
		return result;
	}
	const buckets = ctx.repos.uptimeDaily.listForPage(pageId, from, utcDay(now));
	const bucketsByComponent = new Map<string, UptimeDailyRow[]>();
	for (const bucket of buckets) {
		const list = bucketsByComponent.get(bucket.component_id) ?? [];
		list.push(bucket);
		bucketsByComponent.set(bucket.component_id, list);
	}
	for (const componentId of componentIds) {
		result.set(
			componentId,
			summarize(days, bucketsByComponent.get(componentId) ?? []),
		);
	}
	return result;
};

/**
 * Record one observation per page without touching `updated_at` or the
 * snapshot: this is the sampler's entry point, not a publication.
 */
export const sampleUptime = (
	ctx: StatusContext,
	now: string = ctx.now(),
): void => {
	for (const page of ctx.repos.pages.list()) {
		const settings = resolveSettings(page);
		const result = computePageStatus({
			...toEngineInputs(ctx, page.id),
			staleAfterSeconds: settings.staleAfterSeconds,
			severityToStatus: settings.severityToStatus,
			now,
		});
		recordDailyUptime(ctx, page.id, result.componentStatuses, now);
	}
};
