/**
 * Display formatting.
 *
 * The status vocabularies come from the API and are mapped in one place, so a
 * deployment shown in the deployments table and in the overview cannot drift
 * apart in wording or colour.
 */

import type {
	ApplicationStatus,
	ConnectionStatus,
	DeploymentStatus,
} from "@/shared/domain";

export type Tone = "ok" | "warn" | "danger" | "info" | "muted";

export interface StatusDisplay {
	label: string;
	tone: Tone;
}

export function deploymentStatus(
	status: DeploymentStatus | undefined,
): StatusDisplay {
	switch (status) {
		case "running":
			return { label: "Running", tone: "info" };
		case "done":
			return { label: "Done", tone: "ok" };
		case "error":
			return { label: "Failed", tone: "danger" };
		case "cancelled":
			return { label: "Cancelled", tone: "muted" };
		default:
			return { label: "Unknown", tone: "muted" };
	}
}

export function applicationStatus(
	status: ApplicationStatus | undefined,
): StatusDisplay {
	switch (status) {
		case "running":
			return { label: "Running", tone: "info" };
		case "done":
			return { label: "Deployed", tone: "ok" };
		case "error":
			return { label: "Failed", tone: "danger" };
		case "idle":
			return { label: "Idle", tone: "muted" };
		default:
			return { label: "Unknown", tone: "muted" };
	}
}

export function connectionStatus(status: ConnectionStatus): StatusDisplay {
	switch (status) {
		case "connected":
			return { label: "Connected", tone: "ok" };
		case "checking":
			return { label: "Checking…", tone: "info" };
		case "disconnected":
			return { label: "No credential", tone: "warn" };
		case "unavailable":
			return { label: "Unreachable", tone: "danger" };
		default:
			return { label: "Not checked", tone: "muted" };
	}
}

/** Colour classes per tone, so the mapping is not repeated per component. */
export const TONE_CLASSES: Record<Tone, string> = {
	ok: "bg-ok/15 text-ok border-ok/30",
	warn: "bg-warn/15 text-warn border-warn/30",
	danger: "bg-danger/15 text-danger border-danger/30",
	info: "bg-accent/15 text-accent border-accent/30",
	muted: "bg-surface-hover text-content-muted border-border",
};

export const TONE_DOT_CLASSES: Record<Tone, string> = {
	ok: "bg-ok",
	warn: "bg-warn",
	danger: "bg-danger",
	info: "bg-accent",
	muted: "bg-content-subtle",
};

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
