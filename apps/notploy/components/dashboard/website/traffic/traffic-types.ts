/**
 * Shared vocabulary of the Traffic Manager page.
 *
 * The filters are the ones the API accepts, so what the operator picks is what
 * the queries receive — nothing here is decorative.
 */

export type TrafficRangePreset = "1h" | "24h" | "7d" | "30d" | "custom";

export interface TrafficFilterState {
	preset: TrafficRangePreset;
	/** Only used by the `custom` preset. */
	from?: Date;
	to?: Date;
	/** `all` or a platform name. */
	platform: string;
	/** `all` or a web property id (a single domain). */
	propertyId: string;
	compare: boolean;
}

export const DEFAULT_TRAFFIC_FILTERS: TrafficFilterState = {
	preset: "24h",
	platform: "all",
	propertyId: "all",
	compare: false,
};

export const RANGE_PRESETS: { value: TrafficRangePreset; label: string }[] = [
	{ value: "1h", label: "Last hour" },
	{ value: "24h", label: "Last 24 hours" },
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "custom", label: "Custom range" },
];

/** Payload shared by every Traffic Manager query. */
export const toRangeInput = (filters: TrafficFilterState) => ({
	preset: filters.preset,
	from: filters.preset === "custom" ? filters.from?.toISOString() : undefined,
	to: filters.preset === "custom" ? filters.to?.toISOString() : undefined,
});

export const toFilterInput = (filters: TrafficFilterState) => ({
	propertyIds: filters.propertyId === "all" ? undefined : [filters.propertyId],
	platform: filters.platform === "all" ? undefined : filters.platform,
});

const numberFormatter = new Intl.NumberFormat("en-US");

export const formatCount = (value: number | null | undefined): string =>
	value === null || value === undefined ? "—" : numberFormatter.format(value);

export const formatBytes = (value: number | null | undefined): string => {
	if (value === null || value === undefined) {
		return "—";
	}
	if (value < 1024) {
		return `${numberFormatter.format(value)} B`;
	}
	const units = ["KB", "MB", "GB", "TB", "PB"];
	let size = value / 1024;
	let index = 0;
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index += 1;
	}
	return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[index]}`;
};

export const formatMilliseconds = (value: number | null | undefined): string =>
	value === null || value === undefined ? "—" : `${Math.round(value)} ms`;

export const formatPercent = (
	value: number | null | undefined,
	digits = 1,
): string =>
	value === null || value === undefined ? "—" : `${value.toFixed(digits)} %`;

export const formatDateTime = (value: string | null | undefined): string => {
	if (!value) {
		return "—";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const formatRelativeMinutes = (
	minutes: number | null | undefined,
): string => {
	if (minutes === null || minutes === undefined) {
		return "never";
	}
	if (minutes < 1) {
		return "just now";
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 48) {
		return `${hours} h ago`;
	}
	return `${Math.round(hours / 24)} d ago`;
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
	traefik: "Reverse proxy",
	"web-instrumentation": "Web instrumentation",
	external: "External provider",
};

/** Bucket axis of the period, so empty buckets are drawn as gaps. */
export const buildBucketAxis = (
	from: string,
	to: string,
	intervalSeconds: number,
): number[] => {
	const start = new Date(from).getTime();
	const end = new Date(to).getTime();
	const step = Math.max(1, intervalSeconds) * 1000;
	const buckets: number[] = [];
	for (let cursor = start; cursor < end; cursor += step) {
		buckets.push(cursor);
	}
	return buckets;
};
