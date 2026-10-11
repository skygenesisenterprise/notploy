/**
 * The status vocabulary, shared by the renderer and the main process.
 *
 * The tray and the window describe the same instance state, and a tray tooltip
 * that says "Unreachable" while the title bar says "Unavailable" is a bug. One
 * mapping, two consumers.
 *
 * `Tone` is the semantic label; the CSS classes that give it a colour live in
 * the renderer only, because the main process has no styling.
 *
 * This module must stay free of `node:` and `electron` imports.
 */

import type {
	ApplicationStatus,
	ConnectionStatus,
	DeploymentStatus,
} from "./domain";

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

/**
 * Application and managed-database services share one status column in the API
 * (`applicationStatus`), so they share one mapping too.
 */
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

/** A database is a service: same vocabulary, database-first wording. */
export function databaseStatus(
	status: ApplicationStatus | undefined,
): StatusDisplay {
	switch (status) {
		case "running":
			return { label: "Running", tone: "info" };
		case "done":
			return { label: "Ready", tone: "ok" };
		case "error":
			return { label: "Failed", tone: "danger" };
		case "idle":
			return { label: "Stopped", tone: "muted" };
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
