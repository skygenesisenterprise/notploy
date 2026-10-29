/**
 * Planned maintenance lifecycle.
 *
 * Windows are stored as UTC instants with the operator's IANA time zone kept
 * for display. Only an *in-progress, published, public* maintenance influences
 * the public state (as `under_maintenance`, never as an outage), and only for
 * the components it covers.
 */
import { newId } from "../core/ids";
import type {
	CreateMaintenanceInput,
	MaintenanceStateChangeInput,
	PublishInput,
	UpdateMaintenanceInput,
} from "../core/schemas";
import { conflict, notFound } from "../errors";
import type { EventInput, MaintenanceRow } from "../store/repositories";
import { requireComponent } from "./components";
import type { Actor, StatusContext } from "./context";
import { requirePage } from "./pages";
import { adminMaintenanceDto } from "./public";

export const requireMaintenance = (
	ctx: StatusContext,
	maintenanceId: string,
	pageId?: string,
): MaintenanceRow => {
	const row = ctx.repos.maintenances.findById(maintenanceId);
	if (!row || (pageId && row.page_id !== pageId)) {
		throw notFound(`Maintenance "${maintenanceId}" does not exist`);
	}
	return row;
};

const insertEvent = (
	ctx: StatusContext,
	event: Omit<EventInput, "id" | "created_at">,
): string => {
	const id = newId("evt");
	ctx.repos.events.insert({ ...event, id, created_at: ctx.now() });
	return id;
};

const notify = (
	ctx: StatusContext,
	maintenance: MaintenanceRow,
	eventName: string,
	eventId: string,
): void => {
	ctx.enqueue({
		event: eventName,
		dedupKey: `${maintenance.id}:${eventId}`,
		payload: {
			pageId: maintenance.page_id,
			maintenanceId: maintenance.id,
			title: maintenance.title,
			state: maintenance.state,
			startAt: maintenance.start_at,
			endAt: maintenance.end_at,
		},
	});
};

export const createMaintenance = (
	ctx: StatusContext,
	ref: string,
	input: CreateMaintenanceInput,
	actor: Actor,
) => {
	const page = requirePage(ctx, ref);
	for (const componentId of input.componentIds) {
		requireComponent(ctx, componentId, page.id);
	}
	const timestamp = ctx.now();
	const published = input.published && input.visibility !== "private";
	const row: MaintenanceRow = {
		id: newId("mnt"),
		page_id: page.id,
		title: input.title,
		description: input.description,
		state: "scheduled",
		visibility: input.visibility,
		published: published ? 1 : 0,
		published_at: published ? timestamp : null,
		start_at: input.startAt,
		end_at: input.endAt,
		time_zone: input.timeZone,
		created_by: actor.id,
		created_at: timestamp,
		updated_at: timestamp,
	};
	ctx.repos.maintenances.insert(row);
	if (input.componentIds.length > 0) {
		ctx.repos.maintenances.replaceComponents(row.id, input.componentIds);
	}
	const publicFace = published && row.visibility === "public";
	const eventId = insertEvent(ctx, {
		page_id: page.id,
		subject_type: "maintenance",
		subject_id: row.id,
		type: "maintenance_created",
		visibility: publicFace ? "public" : "internal",
		message: input.update?.message ?? input.description ?? row.title,
		state: row.state,
		severity: null,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: JSON.stringify({
			componentIds: input.componentIds,
			startAt: row.start_at,
			endAt: row.end_at,
		}),
	});
	ctx.audit(actor, {
		action: "maintenance.create",
		subjectType: "maintenance",
		subjectId: row.id,
		detail: { pageId: page.id, startAt: row.start_at, endAt: row.end_at },
	});
	ctx.publishState(page.id);
	if (publicFace) {
		notify(ctx, row, "maintenance.published", eventId);
	}
	const stored = ctx.repos.maintenances.findById(row.id);
	if (!stored) {
		throw notFound("Maintenance disappeared during creation");
	}
	return adminMaintenanceDto(ctx, stored);
};

export const updateMaintenance = (
	ctx: StatusContext,
	maintenanceId: string,
	input: UpdateMaintenanceInput,
	actor: Actor,
) => {
	const row = requireMaintenance(ctx, maintenanceId);
	if (row.state === "completed" || row.state === "cancelled") {
		throw conflict("A finished maintenance cannot be edited", {
			state: row.state,
		});
	}
	if (input.componentIds) {
		for (const componentId of input.componentIds) {
			requireComponent(ctx, componentId, row.page_id);
		}
	}
	const startAt = input.startAt ?? row.start_at;
	const endAt = input.endAt ?? row.end_at;
	if (Date.parse(endAt) <= Date.parse(startAt)) {
		throw conflict("endAt must be after startAt");
	}
	ctx.repos.maintenances.update(
		maintenanceId,
		{
			title: input.title,
			description: input.description,
			start_at: input.startAt,
			end_at: input.endAt,
			time_zone: input.timeZone,
			visibility: input.visibility,
		},
		ctx.now(),
	);
	if (input.componentIds) {
		ctx.repos.maintenances.replaceComponents(maintenanceId, input.componentIds);
	}
	insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "maintenance",
		subject_id: maintenanceId,
		type: "maintenance_updated",
		visibility: "internal",
		message: `maintenance updated (${Object.keys(input).join(", ")})`,
		state: null,
		severity: null,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: JSON.stringify({ fields: Object.keys(input) }),
	});
	ctx.audit(actor, {
		action: "maintenance.update",
		subjectType: "maintenance",
		subjectId: maintenanceId,
		detail: { fields: Object.keys(input) },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.maintenances.findById(maintenanceId);
	if (!updated) {
		throw notFound("Maintenance disappeared during update");
	}
	return adminMaintenanceDto(ctx, updated);
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
	scheduled: ["in_progress", "cancelled"],
	in_progress: ["completed", "cancelled"],
	completed: [],
	cancelled: [],
};

export const changeMaintenanceState = (
	ctx: StatusContext,
	maintenanceId: string,
	input: MaintenanceStateChangeInput,
	actor: Actor,
) => {
	const row = requireMaintenance(ctx, maintenanceId);
	if (!ALLOWED_TRANSITIONS[row.state]?.includes(input.state)) {
		throw conflict(
			`Cannot move a maintenance from "${row.state}" to "${input.state}"`,
		);
	}
	const timestamp = ctx.now();
	ctx.repos.maintenances.update(
		maintenanceId,
		{ state: input.state },
		timestamp,
	);
	const typeByState: Record<string, string> = {
		in_progress: "maintenance_started",
		completed: "maintenance_completed",
		cancelled: "maintenance_cancelled",
	};
	const publicFace = row.published === 1 && row.visibility === "public";
	const eventId = insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "maintenance",
		subject_id: maintenanceId,
		type: typeByState[input.state] ?? "maintenance_updated",
		visibility: publicFace ? "public" : "internal",
		message: input.message ?? `Maintenance ${input.state.replace("_", " ")}`,
		state: input.state,
		severity: null,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: null,
	});
	ctx.audit(actor, {
		action: "maintenance.state",
		subjectType: "maintenance",
		subjectId: maintenanceId,
		detail: { from: row.state, to: input.state },
	});
	// Re-projection: an in-progress maintenance changes component states.
	ctx.publishState(row.page_id);
	const updated = ctx.repos.maintenances.findById(maintenanceId);
	if (!updated) {
		throw notFound("Maintenance disappeared during state change");
	}
	if (publicFace) {
		notify(ctx, updated, `maintenance.${input.state}`, eventId);
	}
	return adminMaintenanceDto(ctx, updated);
};

export const setMaintenancePublish = (
	ctx: StatusContext,
	maintenanceId: string,
	input: PublishInput,
	actor: Actor,
) => {
	const row = requireMaintenance(ctx, maintenanceId);
	const timestamp = ctx.now();
	const visibility =
		input.visibility ?? (row.visibility as "public" | "private");
	const published = input.published && visibility !== "private";
	ctx.repos.maintenances.update(
		maintenanceId,
		{
			published: published ? 1 : 0,
			published_at: published ? (row.published_at ?? timestamp) : null,
			visibility,
		},
		timestamp,
	);
	const eventId = insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "maintenance",
		subject_id: maintenanceId,
		type: published ? "maintenance_published" : "maintenance_unpublished",
		visibility: published && visibility === "public" ? "public" : "internal",
		message: published ? "Maintenance published" : "Maintenance withdrawn",
		state: row.state,
		severity: null,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: null,
	});
	ctx.audit(actor, {
		action: published ? "maintenance.publish" : "maintenance.unpublish",
		subjectType: "maintenance",
		subjectId: maintenanceId,
		detail: { visibility },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.maintenances.findById(maintenanceId);
	if (!updated) {
		throw notFound("Maintenance disappeared during publication");
	}
	if (published && visibility === "public") {
		notify(ctx, updated, "maintenance.published", eventId);
	}
	return adminMaintenanceDto(ctx, updated);
};

/** Withdraw-only deletion rule, same rationale as incidents. */
export const deleteMaintenance = (
	ctx: StatusContext,
	maintenanceId: string,
	actor: Actor,
): void => {
	const row = requireMaintenance(ctx, maintenanceId);
	if (row.published === 1) {
		throw conflict(
			"Published maintenances cannot be deleted; unpublish it instead so the change stays auditable",
		);
	}
	ctx.repos.events.deleteBySubject("maintenance", maintenanceId);
	ctx.repos.maintenances.delete(maintenanceId);
	ctx.audit(actor, {
		action: "maintenance.delete",
		subjectType: "maintenance",
		subjectId: maintenanceId,
		detail: { pageId: row.page_id, title: row.title },
	});
	ctx.publishState(row.page_id);
};
