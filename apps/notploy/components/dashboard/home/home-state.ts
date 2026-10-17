import type { HomeMetric, HomeTone, MetricState, SourceState } from "./types";

/**
 * Pure helpers shared by the three homepage compositions and their data
 * builders. Kept free of React and tRPC so they can be unit tested directly.
 */

/** Small caption explaining why a metric has no value. */
export const METRIC_STATE_LABELS: Record<MetricState, string> = {
	available: "",
	loading: "Loading",
	unavailable: "Unavailable",
	restricted: "Restricted",
	not_applicable: "Not applicable",
};

export const metricStateLabel = (state: MetricState): string =>
	METRIC_STATE_LABELS[state];

/**
 * Maps a query state to a metric state.
 *
 * `enabled` is false when the source is gated by a permission: that is
 * reported as `restricted`, never as an outage.
 */
export const metricState = (
	source: SourceState,
	enabled = true,
): MetricState => {
	if (!enabled) return "restricted";
	if (source.isLoading) return "loading";
	if (source.isError) return "unavailable";
	return "available";
};

/**
 * Value carried by a metric: `null` unless the datum is really available, so
 * an unavailable or gated source can never be read as `0`.
 */
export const resolvedValue = (
	state: MetricState,
	value: number | string | null,
): number | string | null => (state === "available" ? value : null);

/** Value as rendered by a summary card. */
export const displayMetricValue = (metric: HomeMetric): string => {
	if (metric.state === "available") {
		return metric.value === null ? "—" : String(metric.value);
	}
	if (metric.state === "loading") return "—";
	if (metric.state === "restricted") return "Restricted";
	if (metric.state === "unavailable") return "Unavailable";
	return "N/A";
};

export const HOME_TONES: Record<
	HomeTone,
	{ bar: string; dot: string; text: string; badge: "green" | "yellow" | "red" | "blue" | "blank" }
> = {
	healthy: {
		bar: "bg-emerald-500",
		dot: "bg-emerald-500",
		text: "text-emerald-600 dark:text-emerald-400",
		badge: "green",
	},
	warning: {
		bar: "bg-amber-500",
		dot: "bg-amber-500",
		text: "text-amber-600 dark:text-amber-400",
		badge: "yellow",
	},
	critical: {
		bar: "bg-destructive",
		dot: "bg-destructive",
		text: "text-destructive",
		badge: "red",
	},
	info: {
		bar: "bg-sky-500",
		dot: "bg-sky-500",
		text: "text-sky-600 dark:text-sky-400",
		badge: "blue",
	},
	neutral: {
		bar: "bg-muted-foreground/40",
		dot: "bg-muted-foreground/40",
		text: "text-muted-foreground",
		badge: "blank",
	},
};

/** Tone of a service status as recorded by Notploy. */
export const serviceStatusTone = (status: string | null): HomeTone => {
	if (status === "done") return "healthy";
	if (status === "running") return "warning";
	if (status === "error") return "critical";
	return "neutral";
};

/** Label of a service status as recorded by Notploy. */
export const serviceStatusLabel = (status: string | null): string => {
	if (status === "done") return "Healthy";
	if (status === "running") return "Deploying";
	if (status === "error") return "Failed";
	return "Idle";
};

/** Tone of an operational event severity. */
export const severityTone = (severity: string): HomeTone => {
	if (severity === "critical") return "critical";
	if (severity === "warning") return "warning";
	if (severity === "success") return "healthy";
	return "info";
};

/** Tone of an incident state (the status platform vocabulary). */
export const incidentStateTone = (state: string): HomeTone => {
	if (state === "resolved") return "healthy";
	if (state === "monitoring") return "info";
	return "critical";
};

/** Human readable duration, used for the control plane uptime. */
export const formatDuration = (seconds: number): string => {
	const total = Math.max(Math.floor(seconds), 0);
	const days = Math.floor(total / 86_400);
	const hours = Math.floor((total % 86_400) / 3_600);
	const minutes = Math.floor((total % 3_600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
};

/** Plan limits are `null` when unlimited; never rendered as `0`. */
export const formatLimit = (limit: number | null): string =>
	limit === null ? "Unlimited" : String(limit);

/** Sum of a segment distribution. */
export const segmentTotal = (
	segments: Array<{ value: number }>,
): number => segments.reduce((total, segment) => total + segment.value, 0);
