/**
 * Pure presentation helpers.
 *
 * Everything the UI derives from data (labels, tones, freshness banners,
 * relative times) lives here as pure functions so the component tree stays
 * thin and the behaviour is unit-testable without a DOM.
 */
import type {
	GlobalStatus,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
} from "@notploy/status";

export type Tone = "green" | "amber" | "orange" | "red" | "blue" | "neutral";

export const statusLabel = (status: GlobalStatus): string => {
	switch (status) {
		case "operational":
			return "All systems operational";
		case "degraded_performance":
			return "Degraded performance";
		case "partial_outage":
			return "Partial outage";
		case "major_outage":
			return "Major outage";
		case "under_maintenance":
			return "Under maintenance";
	}
};

export const statusTone = (status: GlobalStatus): Tone => {
	switch (status) {
		case "operational":
			return "green";
		case "degraded_performance":
			return "amber";
		case "partial_outage":
			return "orange";
		case "major_outage":
			return "red";
		case "under_maintenance":
			return "blue";
	}
};

export const severityLabel = (severity: IncidentSeverity): string =>
	severity === "critical"
		? "Critical"
		: severity === "major"
			? "Major"
			: "Minor";

export const severityTone = (severity: IncidentSeverity): Tone =>
	severity === "critical" ? "red" : severity === "major" ? "orange" : "amber";

export const incidentStateLabel = (state: IncidentState): string => {
	switch (state) {
		case "investigating":
			return "Investigating";
		case "identified":
			return "Identified";
		case "monitoring":
			return "Monitoring";
		case "resolved":
			return "Resolved";
	}
};

export const maintenanceStateLabel = (state: MaintenanceState): string =>
	state
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

export const componentStatusTone = (status: GlobalStatus): Tone =>
	statusTone(status);

export const componentStatusLabel = (status: GlobalStatus): string => {
	switch (status) {
		case "operational":
			return "Operational";
		case "degraded_performance":
			return "Degraded";
		case "partial_outage":
			return "Partial outage";
		case "major_outage":
			return "Major outage";
		case "under_maintenance":
			return "Under maintenance";
	}
};

/**
 * Freshness banner logic. A communication failure must never be rendered as
 * "operational": the UI keeps showing the last known state and explains that
 * it may be outdated.
 */
export interface FreshnessState {
	kind: "live" | "stale-data" | "connection-lost";
	label: string;
	tone: Tone;
}

export const describeFreshness = (input: {
	serverStale: boolean;
	connectionOk: boolean;
	updatedAt: string;
	now: number;
}): FreshnessState => {
	if (!input.connectionOk) {
		return {
			kind: "connection-lost",
			label: `Connection to the status API lost — showing the last known state from ${formatDateTime(input.updatedAt)}. Data may be outdated.`,
			tone: "amber",
		};
	}
	if (input.serverStale) {
		return {
			kind: "stale-data",
			label:
				"Some components have not reported recent data — their last known state is shown.",
			tone: "amber",
		};
	}
	return {
		kind: "live",
		label: "Live data",
		tone: "green",
	};
};

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
	["year", 365 * 24 * 3600],
	["month", 30 * 24 * 3600],
	["day", 24 * 3600],
	["hour", 3600],
	["minute", 60],
];

/** Compact relative time ("3 minutes ago", "in 2 hours"). */
export const formatRelativeTime = (iso: string, now: number): string => {
	const target = Date.parse(iso);
	if (!Number.isFinite(target)) {
		return "";
	}
	const deltaSeconds = (target - now) / 1000;
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	for (const [unit, seconds] of RELATIVE_UNITS) {
		if (Math.abs(deltaSeconds) >= seconds) {
			return formatter.format(Math.round(deltaSeconds / seconds), unit);
		}
	}
	return formatter.format(Math.round(deltaSeconds), "second");
};

/** Absolute timestamp, always displayed in UTC to avoid ambiguity. */
export const formatDateTime = (iso: string): string => {
	const target = new Date(iso);
	if (Number.isNaN(target.getTime())) {
		return "";
	}
	return `${target.toUTCString().replace("GMT", "UTC")}`;
};

/**
 * Uptime percentage for display. Kept here (instead of importing the engine's
 * `formatUptime`) so client components never pull the engine's Node-only code
 * (`node:fs`, `node:sqlite`) into the browser bundle.
 */
export const formatUptimePercent = (percent: number | null): string =>
	percent === null ? "No data" : `${percent.toFixed(2)}%`;

export const categoryLabel = (category: string): string =>
	category
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
