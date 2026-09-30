import type {
	ApplicationStatus,
	DeploymentStatus,
	InstanceConnectionStatus,
} from "./domain";

/** ThemeIcons for every deployment status the API can report. */
export function deploymentStatusIcon(status: DeploymentStatus | undefined): {
	id: string;
	color?: string;
} {
	switch (status) {
		case "running":
			return { id: "sync~spin", color: "charts.blue" };
		case "done":
			return { id: "pass-filled", color: "charts.green" };
		case "error":
			return { id: "error", color: "charts.red" };
		case "cancelled":
			return { id: "circle-slash", color: "descriptionForeground" };
		default:
			return { id: "circle-outline", color: "descriptionForeground" };
	}
}

export function deploymentStatusLabel(
	status: DeploymentStatus | undefined,
): string {
	switch (status) {
		case "running":
			return "Running";
		case "done":
			return "Done";
		case "error":
			return "Failed";
		case "cancelled":
			return "Cancelled";
		default:
			return "Unknown";
	}
}

export function applicationStatusIcon(status: ApplicationStatus | undefined): {
	id: string;
	color?: string;
} {
	switch (status) {
		case "running":
			return { id: "sync~spin", color: "charts.blue" };
		case "done":
			return { id: "pass", color: "charts.green" };
		case "error":
			return { id: "error", color: "charts.red" };
		case "idle":
			return { id: "circle-outline", color: "descriptionForeground" };
		default:
			return { id: "question", color: "descriptionForeground" };
	}
}

export function applicationStatusLabel(
	status: ApplicationStatus | undefined,
): string {
	switch (status) {
		case "running":
			return "Running";
		case "done":
			return "Deployed";
		case "error":
			return "Failed";
		case "idle":
			return "Idle";
		default:
			return "Unknown";
	}
}

export function connectionStatusIcon(
	status: InstanceConnectionStatus | undefined,
): {
	id: string;
	color?: string;
} {
	switch (status) {
		case "connected":
			return { id: "pass-filled", color: "charts.green" };
		case "disconnected":
			return { id: "debug-disconnect", color: "charts.red" };
		case "unavailable":
			return { id: "cloud-offline", color: "charts.yellow" };
		case "authenticating":
			return { id: "loading~spin", color: "charts.blue" };
		default:
			return { id: "circle-outline", color: "descriptionForeground" };
	}
}

export function connectionStatusLabel(
	status: InstanceConnectionStatus | undefined,
): string {
	switch (status) {
		case "connected":
			return "Connected";
		case "disconnected":
			return "Disconnected";
		case "unavailable":
			return "Unavailable";
		case "authenticating":
			return "Authenticating";
		default:
			return "Not checked";
	}
}

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
	if (!timestamp) return "";
	const parsed = Date.parse(timestamp);
	if (Number.isNaN(parsed)) return timestamp;

	const diff = parsed - now;
	const absolute = Math.abs(diff);
	const formatter = new Intl.RelativeTimeFormat(undefined, {
		numeric: "auto",
	});

	let chosen: [Intl.RelativeTimeFormatUnit, number] = RELATIVE_UNITS[0]!;
	for (const unit of RELATIVE_UNITS) {
		if (absolute >= unit[1]) chosen = unit;
	}
	return formatter.format(Math.round(diff / chosen[1]), chosen[0]);
}

/** Absolute time, used in tooltips where precision matters more than brevity. */
export function absoluteTime(timestamp: string | undefined | null): string {
	if (!timestamp) return "";
	const parsed = Date.parse(timestamp);
	if (Number.isNaN(parsed)) return timestamp;
	return new Date(parsed).toLocaleString();
}

export function shorten(value: string, max = 40): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

/** Normalises a user-provided instance URL into an origin the SDK can use. */
export function normalizeInstanceUrl(input: string): string {
	let candidate = input.trim();
	if (!candidate) return "";
	if (!/^https?:\/\//i.test(candidate)) {
		candidate = `https://${candidate}`;
	}
	try {
		const parsed = new URL(candidate);
		// Users frequently paste the API base or a deep dashboard URL.
		parsed.pathname = "";
		parsed.search = "";
		parsed.hash = "";
		return parsed.origin;
	} catch {
		return "";
	}
}

/** The URL the dashboard lives at, given an instance origin. */
export function dashboardUrl(instanceUrl: string, path = ""): string {
	const base = instanceUrl.replace(/\/+$/, "");
	const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
	return `${base}/dashboard${suffix}`;
}

/**
 * The dashboard page where API keys are created.
 *
 * This is the page `notploy.login` sends a user to when the instance rejects
 * the key they pasted, so it has to be the canonical location rather than a
 * detail buried in the profile screen.
 */
export function apiKeysUrl(instanceUrl: string): string {
	return dashboardUrl(instanceUrl, "/settings/api-keys");
}

export function projectDashboardUrl(
	instanceUrl: string,
	projectId: string,
	environmentId?: string,
	applicationId?: string,
): string {
	if (applicationId && environmentId) {
		return dashboardUrl(
			instanceUrl,
			`/project/${projectId}/environment/${environmentId}/services/application/${applicationId}`,
		);
	}
	if (environmentId) {
		return dashboardUrl(
			instanceUrl,
			`/project/${projectId}/environment/${environmentId}`,
		);
	}
	return dashboardUrl(instanceUrl, `/project/${projectId}`);
}
