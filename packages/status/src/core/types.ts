/**
 * Status Core — shared domain types.
 *
 * This module is intentionally free of any framework, storage or transport
 * dependency: the same vocabulary is consumed by the persistence layer, the
 * HTTP API, the server-rendered UI, the tests and the Notploy integration
 * client.
 *
 * Three distinct state notions exist and must never be conflated:
 *
 * - `ObservedStatus`     what a monitoring source reports (may be `unknown`).
 * - internal state       the operational state kept by operators
 *                        (`IncidentState`, `MaintenanceState`).
 * - `PublicComponentStatus` what the public status page is allowed to show.
 */

/** Vocabulary published on the public status page. */
export type PublicComponentStatus =
	| "operational"
	| "degraded_performance"
	| "partial_outage"
	| "major_outage"
	| "under_maintenance";

/** The page-wide indicator uses the same vocabulary as components. */
export type GlobalStatus = PublicComponentStatus;

/**
 * Raw state reported by a monitoring source. `unknown` means "no usable data":
 * it is explicitly NOT an implicit green.
 */
export type ObservedStatus = "operational" | "degraded" | "outage" | "unknown";

/** Severity of an incident. */
export type IncidentSeverity = "minor" | "major" | "critical";

/** Internal lifecycle of an incident. */
export type IncidentState =
	| "investigating"
	| "identified"
	| "monitoring"
	| "resolved";

/** Lifecycle of a planned maintenance. */
export type MaintenanceState =
	| "scheduled"
	| "in_progress"
	| "completed"
	| "cancelled";

/** Whether an object is visible on the public page. */
export type Visibility = "public" | "private";

/** Where a component's observed state comes from. */
export type ComponentSource = "manual" | "monitoring";

/** Coarse grouping used to render components in sections. */
export type ComponentCategory =
	| "core"
	| "application"
	| "api"
	| "infrastructure"
	| "storage"
	| "network"
	| "documentation"
	| "security"
	| "other";

/** Actor of an audited or timeline operation. */
export type ActorType = "user" | "token" | "system" | "integration";

/**
 * Scopes carried by an administration / integration token. `admin` implies
 * every other scope. Scopes are checked on every protected route; knowing an
 * identifier is never an authorization.
 */
export type TokenScope =
	| "read"
	| "write"
	| "publish"
	| "ingest"
	| "tokens"
	| "admin";

/** Timeline / event types shared by incidents and maintenances. */
export type EventType =
	| "incident_created"
	| "incident_updated"
	| "incident_state_changed"
	| "incident_published"
	| "incident_unpublished"
	| "incident_resolved"
	| "maintenance_created"
	| "maintenance_updated"
	| "maintenance_started"
	| "maintenance_completed"
	| "maintenance_cancelled"
	| "maintenance_published"
	| "maintenance_unpublished"
	| "alert_attached"
	| "component_updated"
	| "page_updated";

/** Configuration of a status page. Persisted as JSON in `status_pages.settings`. */
export interface PageSettings {
	/** Seconds after which observed data counts as stale. */
	staleAfterSeconds: number;
	/** Auto-refresh interval (seconds) advertised to the browser UI. 0 disables. */
	refreshIntervalSeconds: number;
	/** Show the recent history section on the main view. */
	showHistory: boolean;
	/** Number of history entries shown on the main view. */
	historyLimit: number;
	/** Allow automatic incident creation from ingested monitoring events. */
	autoIncident: boolean;
	/**
	 * When `autoIncident` is enabled, publish automatically created incidents.
	 * Stays `false` unless an operator explicitly opts in.
	 */
	autoPublish: boolean;
	/** Debounce window (seconds) preventing duplicate auto-incidents. */
	autoIncidentWindowSeconds: number;
	/** Severity → public status mapping used by the state engine. */
	severityToStatus: Record<IncidentSeverity, GlobalStatus>;
}
