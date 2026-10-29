/**
 * Status Core — transfer objects.
 *
 * The public DTOs are the *only* shapes the anonymous API and the browser UI
 * ever see. They are built by the projection layer from internal rows, so an
 * internal field (private description, correlation key, actor identity,
 * monitoring note, ...) can never leak by accident: it simply has no place in
 * these types.
 */
import type {
	ComponentCategory,
	EventType,
	GlobalStatus,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
	PublicComponentStatus,
} from "./types";

export interface PublicUptimeDayDto {
	/** UTC calendar day, `YYYY-MM-DD`. */
	date: string;
	/** Worst public status observed during the day; `null` when no data. */
	status: PublicComponentStatus | null;
}

export interface PublicComponentUptimeDto {
	/** Length of the window, in days, including days without data. */
	windowDays: number;
	/** Operational share over days with data, 0–100; `null` with no data. */
	uptimePercent: number | null;
	/** Oldest first; exactly `windowDays` entries. */
	days: PublicUptimeDayDto[];
}

export interface PublicComponentDto {
	id: string;
	name: string;
	description: string;
	category: ComponentCategory;
	groupName: string | null;
	position: number;
	status: GlobalStatus;
	/** Observed data missing or outdated — rendered as "no recent data". */
	stale: boolean;
	/** ISO 8601 UTC instant of the last monitoring observation, if any. */
	observedAt: string | null;
	/** Active published incidents currently affecting this component. */
	incidentIds: string[];
	/** Daily uptime rollup for the last 90 days (oldest first). */
	uptime: PublicComponentUptimeDto;
}

export interface PublicIncidentUpdateDto {
	id: string;
	message: string;
	state: IncidentState;
	createdAt: string;
}

export interface PublicIncidentDto {
	id: string;
	title: string;
	severity: IncidentSeverity;
	state: IncidentState;
	startedAt: string;
	resolvedAt: string | null;
	updatedAt: string;
	componentIds: string[];
	/** Short public summary written when the incident was created. */
	summary: string;
	/** Public timeline, oldest first. */
	updates: PublicIncidentUpdateDto[];
}

export interface PublicMaintenanceDto {
	id: string;
	title: string;
	description: string;
	state: MaintenanceState;
	startAt: string;
	endAt: string;
	timeZone: string;
	componentIds: string[];
	updatedAt: string;
}

export interface PublicHistoryEntryDto {
	id: string;
	type: EventType;
	subjectType: "incident" | "maintenance";
	subjectId: string;
	title: string;
	message: string;
	state: IncidentState | MaintenanceState | null;
	severity: IncidentSeverity | null;
	createdAt: string;
}

export interface PublicPageDto {
	slug: string;
	name: string;
	description: string;
	status: GlobalStatus;
	stale: boolean;
	/** Instant the payload was computed (ISO 8601 UTC). */
	generatedAt: string;
	/** Instant of the last state change persisted on this page. */
	updatedAt: string;
	refreshIntervalSeconds: number;
	components: PublicComponentDto[];
	activeIncidents: PublicIncidentDto[];
	scheduledMaintenances: PublicMaintenanceDto[];
}

export interface PaginatedDto<T> {
	items: T[];
	/** Opaque cursor for the next page; `null` when exhausted. */
	nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* Administration DTOs — returned only to authenticated operators.     */
/* ------------------------------------------------------------------ */

export interface AdminComponentDto {
	id: string;
	pageId: string;
	name: string;
	description: string;
	category: ComponentCategory;
	groupName: string | null;
	position: number;
	visibility: "public" | "private";
	parentId: string | null;
	source: "manual" | "monitoring";
	observedStatus: string;
	observedAt: string | null;
	lastPublishedStatus: GlobalStatus | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminIncidentDto {
	id: string;
	pageId: string;
	title: string;
	/** Internal description — never exposed publicly. */
	description: string;
	severity: IncidentSeverity;
	state: IncidentState;
	visibility: "public" | "private";
	published: boolean;
	publishedAt: string | null;
	correlationKey: string | null;
	componentIds: string[];
	startedAt: string;
	resolvedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminMaintenanceDto {
	id: string;
	pageId: string;
	title: string;
	description: string;
	state: MaintenanceState;
	visibility: "public" | "private";
	published: boolean;
	publishedAt: string | null;
	componentIds: string[];
	startAt: string;
	endAt: string;
	timeZone: string;
	createdAt: string;
	updatedAt: string;
}

export interface AdminPageDto {
	id: string;
	slug: string;
	name: string;
	description: string;
	status: GlobalStatus;
	stale: boolean;
	settings: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface AdminTokenDto {
	id: string;
	name: string;
	prefix: string;
	scopes: string[];
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
}

export interface AuditLogDto {
	id: string;
	at: string;
	actorType: string;
	actorId: string | null;
	actorLabel: string;
	action: string;
	subjectType: string;
	subjectId: string | null;
	detail: Record<string, unknown> | null;
	requestId: string | null;
}

export interface TimelineEventDto {
	id: string;
	type: EventType;
	visibility: "public" | "internal";
	message: string;
	state: string | null;
	severity: IncidentSeverity | null;
	actorType: string;
	actorLabel: string;
	createdAt: string;
}
