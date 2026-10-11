/**
 * Status Core — daily uptime rollup helpers.
 *
 * The rollup answers a single question per component and per UTC day: how
 * much of the time was it available? It is deliberately sample-based rather
 * than incident-based, so it stays meaningful even when monitoring only
 * reports a raw state (no incident is ever opened for a flapping probe).
 *
 * Design rules, aligned with the state engine:
 *
 * - A day without any observation is *unknown*, never healthy: `status` is
 *   `null` and the day is excluded from the ratio.
 * - Only `operational` counts as available. `under_maintenance` is planned
 *   downtime and stays visible as such instead of being silently forgiven.
 * - Everything is computed in UTC days so the ratio does not depend on the
 *   viewer's time zone.
 */
import type { PublicComponentStatus } from "./types";

/** Default length of the uptime window advertised to the public page. */
export const UPTIME_WINDOW_DAYS = 90;

/** UTC calendar day (`YYYY-MM-DD`) of an ISO 8601 instant. */
export const utcDay = (iso: string): string => iso.slice(0, 10);

/** The `YYYY-MM-DD` of every day ending at `day` (inclusive), oldest first. */
export const dayWindow = (day: string, days: number): string[] => {
	const end = Date.parse(`${day}T00:00:00.000Z`);
	if (!Number.isFinite(end) || days <= 0) {
		return [];
	}
	const list: string[] = [];
	for (let offset = days - 1; offset >= 0; offset -= 1) {
		list.push(new Date(end - offset * 86_400_000).toISOString().slice(0, 10));
	}
	return list;
};

/** Remaining number of days since a day (used for "no data" copy). */
export const daysBetween = (fromDay: string, toDay: string): number => {
	const from = Date.parse(`${fromDay}T00:00:00.000Z`);
	const to = Date.parse(`${toDay}T00:00:00.000Z`);
	if (!Number.isFinite(from) || !Number.isFinite(to)) {
		return 0;
	}
	return Math.round((to - from) / 86_400_000);
};

/** Only `operational` counts towards availability. */
export const isAvailable = (status: PublicComponentStatus): boolean =>
	status === "operational";

/**
 * Operational share (0–100, two decimals) over the observed samples.
 * Returns `null` when no sample was ever observed.
 */
export const availabilityPercent = (
	operationalSamples: number,
	samples: number,
): number | null => {
	if (samples <= 0) {
		return null;
	}
	return Math.round((operationalSamples / samples) * 10000) / 100;
};

/** Human-readable uptime ("99.98%", "no data"). */
export const formatUptime = (percent: number | null): string =>
	percent === null ? "No data" : `${percent.toFixed(2)}%`;
