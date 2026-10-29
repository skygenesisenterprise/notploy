/**
 * Public read model.
 *
 * Every function here answers "what may an anonymous visitor see?". The
 * projection is the security boundary: it maps internal rows to public DTOs,
 * so private components, unpublished incidents, internal updates, correlation
 * keys, actor identities and monitoring notes simply have no path to the
 * outside. A test suite asserts exactly that.
 */
import type {
	AdminComponentDto,
	AdminIncidentDto,
	AdminMaintenanceDto,
	AdminPageDto,
	AuditLogDto,
	PaginatedDto,
	PublicComponentDto,
	PublicComponentUptimeDto,
	PublicHistoryEntryDto,
	PublicIncidentDto,
	PublicIncidentUpdateDto,
	PublicMaintenanceDto,
	PublicPageDto,
	TimelineEventDto,
} from "../core/dto";
import type { HistoryQuery } from "../core/schemas";
import {
	computePageStatus,
	type EngineComponent,
	type EngineIncident,
	type EngineMaintenance,
} from "../core/status-engine";
import type {
	ComponentCategory,
	EventType,
	GlobalStatus,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
} from "../core/types";
import { notFound } from "../errors";
import {
	type AuditRow,
	type ComponentRow,
	decodeCursor,
	type EventRow,
	encodeCursor,
	type IncidentRow,
	type MaintenanceRow,
	type PageRow,
	type TokenRow,
} from "../store/repositories";
import type { StatusContext } from "./context";
import { resolveSettings } from "./settings";
import { emptyComponentUptime, getUptimeForComponents } from "./uptime";

export const isPubliclyVisibleIncident = (row: IncidentRow): boolean =>
	row.published === 1 && row.visibility === "public";

export const isPubliclyVisibleMaintenance = (row: MaintenanceRow): boolean =>
	row.published === 1 && row.visibility === "public";

/* ----------------------------- engine feeding ---------------------------- */

export const toEngineInputs = (
	ctx: StatusContext,
	pageId: string,
): {
	components: EngineComponent[];
	incidents: EngineIncident[];
	maintenances: EngineMaintenance[];
} => {
	const components = ctx.repos.components.listByPage(pageId);
	const incidents = ctx.repos.incidents.listByPage(pageId);
	const maintenances = ctx.repos.maintenances.listByPage(pageId);
	return {
		components: components.map((component) => ({
			id: component.id,
			visibility:
				component.visibility === "private"
					? ("private" as const)
					: ("public" as const),
			parentId: component.parent_id,
			observedStatus:
				component.observed_status as EngineComponent["observedStatus"],
			observedAt: component.observed_at,
			lastPublishedStatus:
				component.last_published_status as EngineComponent["lastPublishedStatus"],
			position: component.position,
		})),
		incidents: incidents.map((incident) => ({
			id: incident.id,
			severity: incident.severity as IncidentSeverity,
			state: incident.state as IncidentState,
			published: incident.published === 1,
			visibility:
				incident.visibility === "private"
					? ("private" as const)
					: ("public" as const),
			componentIds: ctx.repos.incidents.componentIds(incident.id),
		})),
		maintenances: maintenances.map((maintenance) => ({
			id: maintenance.id,
			state: maintenance.state as MaintenanceState,
			published: maintenance.published === 1,
			visibility:
				maintenance.visibility === "private"
					? ("private" as const)
					: ("public" as const),
			componentIds: ctx.repos.maintenances.componentIds(maintenance.id),
		})),
	};
};

/* -------------------------------- projections ---------------------------- */

const publicUpdateDto = (row: EventRow): PublicIncidentUpdateDto => ({
	id: row.id,
	message: row.message,
	state: (row.state as IncidentState) ?? "investigating",
	createdAt: row.created_at,
});

export const publicIncidentDto = (
	ctx: StatusContext,
	row: IncidentRow,
	options: { includeUpdates?: boolean; updateLimit?: number } = {},
): PublicIncidentDto => {
	const updates = options.includeUpdates
		? ctx.repos.events
				.listBySubject(
					row.page_id,
					"incident",
					row.id,
					options.updateLimit ?? 100,
				)
				.filter((event) => event.visibility === "public")
				.map(publicUpdateDto)
		: [];
	return {
		id: row.id,
		title: row.title,
		severity: row.severity as IncidentSeverity,
		state: row.state as IncidentState,
		startedAt: row.started_at,
		resolvedAt: row.resolved_at,
		updatedAt: row.updated_at,
		componentIds: ctx.repos.incidents.componentIds(row.id),
		summary: row.description,
		updates,
	};
};

export const publicMaintenanceDto = (
	ctx: StatusContext,
	row: MaintenanceRow,
): PublicMaintenanceDto => ({
	id: row.id,
	title: row.title,
	description: row.description,
	state: row.state as MaintenanceState,
	startAt: row.start_at,
	endAt: row.end_at,
	timeZone: row.time_zone,
	componentIds: ctx.repos.maintenances.componentIds(row.id),
	updatedAt: row.updated_at,
});

/* ------------------------------- admin views ----------------------------- */

export const adminComponentDto = (row: ComponentRow): AdminComponentDto => ({
	id: row.id,
	pageId: row.page_id,
	name: row.name,
	description: row.description,
	category: row.category as ComponentCategory,
	groupName: row.group_name,
	position: row.position,
	visibility: row.visibility === "private" ? "private" : "public",
	parentId: row.parent_id,
	source: row.source === "monitoring" ? "monitoring" : "manual",
	observedStatus: row.observed_status,
	observedAt: row.observed_at,
	lastPublishedStatus: row.last_published_status as GlobalStatus | null,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

export const adminIncidentDto = (
	ctx: StatusContext,
	row: IncidentRow,
): AdminIncidentDto => ({
	id: row.id,
	pageId: row.page_id,
	title: row.title,
	description: row.description,
	severity: row.severity as IncidentSeverity,
	state: row.state as IncidentState,
	visibility: row.visibility === "private" ? "private" : "public",
	published: row.published === 1,
	publishedAt: row.published_at,
	correlationKey: row.correlation_key,
	componentIds: ctx.repos.incidents.componentIds(row.id),
	startedAt: row.started_at,
	resolvedAt: row.resolved_at,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

export const adminMaintenanceDto = (
	ctx: StatusContext,
	row: MaintenanceRow,
): AdminMaintenanceDto => ({
	id: row.id,
	pageId: row.page_id,
	title: row.title,
	description: row.description,
	state: row.state as MaintenanceState,
	visibility: row.visibility === "private" ? "private" : "public",
	published: row.published === 1,
	publishedAt: row.published_at,
	componentIds: ctx.repos.maintenances.componentIds(row.id),
	startAt: row.start_at,
	endAt: row.end_at,
	timeZone: row.time_zone,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

export const adminPageDto = (
	ctx: StatusContext,
	row: PageRow,
): AdminPageDto => {
	const { engine } = pageEngine(ctx, row);
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		status: engine.status,
		stale: engine.stale,
		settings: resolveSettings(row) as unknown as Record<string, unknown>,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
};

export const adminTokenDto = (row: TokenRow) => ({
	id: row.id,
	name: row.name,
	prefix: row.prefix,
	scopes: JSON.parse(row.scopes_json) as string[],
	createdAt: row.created_at,
	lastUsedAt: row.last_used_at,
	revokedAt: row.revoked_at,
});

export const auditLogDto = (row: AuditRow): AuditLogDto => ({
	id: row.id,
	at: row.at,
	actorType: row.actor_type,
	actorId: row.actor_id,
	actorLabel: row.actor_label,
	action: row.action,
	subjectType: row.subject_type,
	subjectId: row.subject_id,
	detail: row.detail_json
		? (JSON.parse(row.detail_json) as Record<string, unknown>)
		: null,
	requestId: row.request_id,
});

export const timelineEventDto = (row: EventRow): TimelineEventDto => ({
	id: row.id,
	type: row.type as EventType,
	visibility: row.visibility === "public" ? "public" : "internal",
	message: row.message,
	state: row.state,
	severity: row.severity as IncidentSeverity | null,
	actorType: row.actor_type,
	actorLabel: row.actor_label,
	createdAt: row.created_at,
});

/* ------------------------------ public queries --------------------------- */

const pageEngine = (
	ctx: StatusContext,
	row: PageRow,
): {
	engine: ReturnType<typeof computePageStatus>;
	settings: ReturnType<typeof resolveSettings>;
} => {
	const settings = resolveSettings(row);
	const inputs = toEngineInputs(ctx, row.id);
	const engine = computePageStatus({
		...inputs,
		staleAfterSeconds: settings.staleAfterSeconds,
		severityToStatus: settings.severityToStatus,
		now: ctx.now(),
	});
	return { engine, settings };
};

export const buildPublicPage = (
	ctx: StatusContext,
	row: PageRow,
): PublicPageDto => {
	const { engine, settings } = pageEngine(ctx, row);
	const statusByComponent = new Map(
		engine.componentStatuses.map((status) => [status.componentId, status]),
	);
	const publicComponents = ctx.repos.components
		.listByPage(row.id)
		.filter((component) => component.visibility === "public");
	const uptimeByComponent = getUptimeForComponents(
		ctx,
		row.id,
		publicComponents.map((component) => component.id),
	);
	const components: PublicComponentDto[] = publicComponents.map((component) => {
		const status = statusByComponent.get(component.id);
		return {
			id: component.id,
			name: component.name,
			description: component.description,
			category: component.category as ComponentCategory,
			groupName: component.group_name,
			position: component.position,
			status: status?.status ?? "operational",
			stale: status?.stale ?? true,
			observedAt: component.observed_at,
			incidentIds: status?.incidentIds ?? [],
			uptime: uptimeByComponent.get(component.id) ?? emptyComponentUptime(),
		};
	});

	const activeIncidents = ctx.repos.incidents
		.listByPage(row.id)
		.filter(
			(incident) =>
				isPubliclyVisibleIncident(incident) && incident.state !== "resolved",
		)
		.map((incident) =>
			publicIncidentDto(ctx, incident, { includeUpdates: true }),
		);

	const scheduledMaintenances = ctx.repos.maintenances
		.listByPage(row.id)
		.filter(
			(maintenance) =>
				isPubliclyVisibleMaintenance(maintenance) &&
				(maintenance.state === "scheduled" ||
					maintenance.state === "in_progress"),
		)
		.map((maintenance) => publicMaintenanceDto(ctx, maintenance));

	return {
		slug: row.slug,
		name: row.name,
		description: row.description,
		status: engine.status,
		stale: engine.stale,
		generatedAt: engine.generatedAt,
		updatedAt: row.updated_at,
		refreshIntervalSeconds: settings.refreshIntervalSeconds,
		components,
		activeIncidents,
		scheduledMaintenances,
	};
};

export const buildAllPublicPages = (ctx: StatusContext): PublicPageDto[] =>
	ctx.repos.pages.list().map((row) => buildPublicPage(ctx, row));

export const getPublicPage = (
	ctx: StatusContext,
	slug: string,
): PublicPageDto | null => {
	const row = ctx.repos.pages.findBySlug(slug);
	return row ? buildPublicPage(ctx, row) : null;
};

export const requirePublicPage = (
	ctx: StatusContext,
	slug: string,
): PublicPageDto => {
	const page = getPublicPage(ctx, slug);
	if (!page) {
		throw notFound(`Status page "${slug}" does not exist`);
	}
	return page;
};

export const getPublicStatus = (
	ctx: StatusContext,
	slug: string,
): {
	slug: string;
	status: GlobalStatus;
	stale: boolean;
	generatedAt: string;
	updatedAt: string;
} | null => {
	const page = getPublicPage(ctx, slug);
	if (!page) {
		return null;
	}
	return {
		slug: page.slug,
		status: page.status,
		stale: page.stale,
		generatedAt: page.generatedAt,
		updatedAt: page.updatedAt,
	};
};

export const listPages = (
	ctx: StatusContext,
): Array<{
	slug: string;
	name: string;
	description: string;
	status: GlobalStatus;
	stale: boolean;
	updatedAt: string;
}> =>
	ctx.repos.pages.list().map((row) => {
		const page = buildPublicPage(ctx, row);
		return {
			slug: page.slug,
			name: page.name,
			description: page.description,
			status: page.status,
			stale: page.stale,
			updatedAt: page.updatedAt,
		};
	});

/**
 * Daily uptime of every public component of a page (or of a single one).
 * Extracted from the same projection as the page payload so the two can never
 * disagree.
 */
export const listPublicUptime = (
	ctx: StatusContext,
	slug: string,
	componentId?: string,
): Array<{ componentId: string; uptime: PublicComponentUptimeDto }> => {
	const page = requirePublicPage(ctx, slug);
	const components = componentId
		? page.components.filter((component) => component.id === componentId)
		: page.components;
	if (componentId && components.length === 0) {
		throw notFound(`Component "${componentId}" is not published on "${slug}"`);
	}
	return components.map((component) => ({
		componentId: component.id,
		uptime: component.uptime,
	}));
};

export const listPublicIncidents = (
	ctx: StatusContext,
	slug: string,
	query: {
		status?: "active" | "resolved" | "all";
		limit: number;
		cursor?: string;
	},
): PaginatedDto<PublicIncidentDto> => {
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		throw notFound(`Status page "${slug}" does not exist`);
	}
	const cursor = decodeCursor(query.cursor);
	let rows = ctx.repos.incidents
		.listByPage(page.id)
		.filter((incident) => isPubliclyVisibleIncident(incident));
	if (query.status === "active") {
		rows = rows.filter((incident) => incident.state !== "resolved");
	} else if (query.status === "resolved") {
		rows = rows.filter((incident) => incident.state === "resolved");
	}
	// Cursor is applied on the already ordered list (started_at DESC, id DESC).
	if (cursor) {
		const index = rows.findIndex(
			(row) =>
				row.started_at < cursor.createdAt ||
				(row.started_at === cursor.createdAt && row.id < cursor.id),
		);
		rows = index >= 0 ? rows.slice(index) : [];
	}
	const slice = rows.slice(0, query.limit);
	const nextCursor =
		rows.length > query.limit && slice.length > 0
			? encodeCursor({
					createdAt: slice[slice.length - 1]?.started_at ?? "",
					id: slice[slice.length - 1]?.id ?? "",
				})
			: null;
	return {
		items: slice.map((row) =>
			publicIncidentDto(ctx, row, { includeUpdates: true }),
		),
		nextCursor,
	};
};

export const getPublicIncident = (
	ctx: StatusContext,
	slug: string,
	incidentId: string,
): PublicIncidentDto | null => {
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		return null;
	}
	const row = ctx.repos.incidents.findById(incidentId);
	if (!row || row.page_id !== page.id || !isPubliclyVisibleIncident(row)) {
		return null;
	}
	return publicIncidentDto(ctx, row, {
		includeUpdates: true,
		updateLimit: 200,
	});
};

export const listPublicIncidentUpdates = (
	ctx: StatusContext,
	slug: string,
	incidentId: string,
	query: { limit: number; cursor?: string },
): PaginatedDto<PublicIncidentUpdateDto> => {
	const incident = getPublicIncident(ctx, slug, incidentId);
	if (!incident) {
		throw notFound("Incident not found");
	}
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		throw notFound("Status page does not exist");
	}
	const cursor = decodeCursor(query.cursor);
	let rows = ctx.repos.events
		.listBySubject(page.id, "incident", incidentId, 500)
		.filter((event) => event.visibility === "public");
	if (cursor) {
		const index = rows.findIndex(
			(row) =>
				row.created_at < cursor.createdAt ||
				(row.created_at === cursor.createdAt && row.id < cursor.id),
		);
		rows = index >= 0 ? rows.slice(index) : [];
	}
	const slice = rows.slice(0, query.limit);
	const last = slice[slice.length - 1];
	return {
		items: slice.map(publicUpdateDto),
		nextCursor:
			rows.length > query.limit && last
				? encodeCursor({ createdAt: last.created_at, id: last.id })
				: null,
	};
};

export const listPublicMaintenances = (
	ctx: StatusContext,
	slug: string,
	query: {
		status?: "scheduled" | "in_progress" | "completed" | "all";
		limit: number;
		cursor?: string;
	},
): PaginatedDto<PublicMaintenanceDto> => {
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		throw notFound(`Status page "${slug}" does not exist`);
	}
	const cursor = decodeCursor(query.cursor);
	let rows = ctx.repos.maintenances
		.listByPage(page.id)
		.filter((maintenance) => isPubliclyVisibleMaintenance(maintenance));
	if (query.status && query.status !== "all") {
		rows = rows.filter((maintenance) => maintenance.state === query.status);
	} else {
		// Completed maintenances live in the history; the default view shows
		// what is upcoming or running.
		rows = rows.filter(
			(maintenance) =>
				maintenance.state === "scheduled" ||
				maintenance.state === "in_progress",
		);
	}
	if (cursor) {
		const index = rows.findIndex(
			(row) =>
				row.start_at < cursor.createdAt ||
				(row.start_at === cursor.createdAt && row.id < cursor.id),
		);
		rows = index >= 0 ? rows.slice(index) : [];
	}
	const slice = rows.slice(0, query.limit);
	const last = slice[slice.length - 1];
	return {
		items: slice.map((row) => publicMaintenanceDto(ctx, row)),
		nextCursor:
			rows.length > query.limit && last
				? encodeCursor({ createdAt: last.start_at, id: last.id })
				: null,
	};
};

export const listPublicHistory = (
	ctx: StatusContext,
	slug: string,
	query: HistoryQuery,
): PaginatedDto<PublicHistoryEntryDto> => {
	const page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		throw notFound(`Status page "${slug}" does not exist`);
	}
	const incidents = ctx.repos.incidents
		.listByPage(page.id)
		.filter((incident) => isPubliclyVisibleIncident(incident));
	const maintenances = ctx.repos.maintenances
		.listByPage(page.id)
		.filter((maintenance) => isPubliclyVisibleMaintenance(maintenance));

	const incidentById = new Map(
		incidents.map((incident) => [incident.id, incident]),
	);
	const maintenanceById = new Map(
		maintenances.map((maintenance) => [maintenance.id, maintenance]),
	);

	let subjectIds = [
		...incidents.map((incident) => incident.id),
		...maintenances.map((m) => m.id),
	];
	if (query.componentId) {
		subjectIds = subjectIds.filter((subjectId) => {
			const incident = incidentById.get(subjectId);
			if (incident) {
				return ctx.repos.incidents
					.componentIds(subjectId)
					.includes(query.componentId as string);
			}
			return ctx.repos.maintenances
				.componentIds(subjectId)
				.includes(query.componentId as string);
		});
	}
	if (query.state) {
		subjectIds = subjectIds.filter((subjectId) => {
			const incident = incidentById.get(subjectId);
			if (incident) {
				return incident.state === query.state;
			}
			return true;
		});
	}

	const rows = ctx.repos.events.listPublicByPage(page.id, subjectIds, {
		limit: query.limit + 1,
		cursor: decodeCursor(query.cursor),
		from: query.from,
		to: query.to,
	});
	const hasMore = rows.length > query.limit;
	const slice = hasMore ? rows.slice(0, query.limit) : rows;
	const items = slice.map((row): PublicHistoryEntryDto => {
		const incident = incidentById.get(row.subject_id);
		const maintenance = maintenanceById.get(row.subject_id);
		return {
			id: row.id,
			type: row.type as EventType,
			subjectType: incident ? "incident" : "maintenance",
			subjectId: row.subject_id,
			title: incident?.title ?? maintenance?.title ?? "",
			message: row.message,
			state: (row.state as IncidentState | MaintenanceState | null) ?? null,
			severity:
				(incident?.severity as IncidentSeverity | undefined) ??
				(row.severity as IncidentSeverity | null),
			createdAt: row.created_at,
		};
	});
	const last = items[items.length - 1];
	return {
		items,
		nextCursor:
			hasMore && last
				? encodeCursor({ createdAt: last.createdAt, id: last.id })
				: null,
	};
};

/** Timeline of one subject (incident or maintenance), internal view. */
export const listTimeline = (
	ctx: StatusContext,
	pageId: string,
	subjectType: "incident" | "maintenance",
	subjectId: string,
): TimelineEventDto[] =>
	ctx.repos.events
		.listBySubject(pageId, subjectType, subjectId, 500)
		.map(timelineEventDto);
