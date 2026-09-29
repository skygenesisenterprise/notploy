/**
 * Display formatting.
 *
 * The status vocabularies themselves live in `@/shared/status`, because the
 * main process renders the same states in the tray. What stays here is what is
 * renderer-only: the CSS classes a tone maps to, and the time helpers.
 */

/**
 * The status vocabularies are the App's and live in `@/shared/status`, because
 * the main process renders the same states in the tray. The colour mapping a
 * tone resolves to now lives with the components that use it, as the App's own
 * Badge variants (`@/renderer/components/ui/primitives`).
 */
export {
	applicationStatus,
	connectionStatus,
	databaseStatus,
	deploymentStatus,
	type StatusDisplay,
	type Tone,
} from "@/shared/status";

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
	["second", 1000],
	["minute", 60_000],
	["hour", 3_600_000],
	["day", 86_400_000],
	["month", 2_592_000_000],
	["year", 31_536_000_000],
];

/** "3 minutes ago" / "in 2 hours", tolerant of invalid timestamps. */
export function relativeTime(
	timestamp: string | undefined | null,
	now: number = Date.now(),
): string {
	if (!timestamp) return "—";
	const parsed = Date.parse(timestamp);
	if (Number.isNaN(parsed)) return timestamp;

	const diff = parsed - now;
	const absolute = Math.abs(diff);
	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

	let chosen: [Intl.RelativeTimeFormatUnit, number] = RELATIVE_UNITS[0]!;
	for (const unit of RELATIVE_UNITS) {
		if (absolute >= unit[1]) chosen = unit;
	}
	return formatter.format(Math.round(diff / chosen[1]), chosen[0]);
}

/** Absolute time, for tooltips and detail panels where precision matters. */
export function absoluteTime(timestamp: string | undefined | null): string {
	if (!timestamp) return "—";
	const parsed = Date.parse(timestamp);
	if (Number.isNaN(parsed)) return timestamp;
	return new Date(parsed).toLocaleString();
}

export function shorten(value: string, max = 40): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

/** Duration between two timestamps, e.g. "1m 12s". */
export function duration(
	start: string | undefined | null,
	end: string | undefined | null,
): string {
	if (!start) return "—";
	const from = Date.parse(start);
	const to = end ? Date.parse(end) : Date.now();
	if (Number.isNaN(from) || Number.isNaN(to)) return "—";
	const seconds = Math.max(0, Math.round((to - from) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	if (minutes < 60) return `${minutes}m ${rest}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}

/** The dashboard URL a "open in browser" action points at. */
export function dashboardUrl(instanceUrl: string, path = ""): string {
	const base = instanceUrl.replace(/\/+$/, "");
	const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
	return `${base}/dashboard${suffix}`;
}
