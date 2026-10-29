/**
 * Incident lifecycle.
 *
 * An incident is an operational problem visible to customers. It groups any
 * number of technical alerts (see `ingest.ts`), carries an ordered timeline
 * and is published explicitly: nothing here reaches the public API without
 * `published = 1 AND visibility = 'public'`.
 *
 * History is append-only. Changing the current state or the title never
 * rewrites past timeline entries, and internal updates stay internal even if
 * the incident is published later.
 */
import { newId } from "../core/ids";
import type {
	CreateIncidentInput,
	IncidentStateChangeInput,
	IncidentUpdateInput,
	PublishInput,
	UpdateIncidentInput,
} from "../core/schemas";
import { badRequest, conflict, notFound } from "../errors";
import type { EventInput, IncidentRow } from "../store/repositories";
import { requireComponent } from "./components";
import type { Actor, StatusContext } from "./context";
import { requirePage } from "./pages";
import { adminIncidentDto } from "./public";

export const requireIncident = (
	ctx: StatusContext,
	incidentId: string,
	pageId?: string,
): IncidentRow => {
	const row = ctx.repos.incidents.findById(incidentId);
	if (!row || (pageId && row.page_id !== pageId)) {
		throw notFound(`Incident "${incidentId}" does not exist`);
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
	incident: IncidentRow,
	eventName: string,
	eventId: string,
	extra: Record<string, unknown> = {},
): void => {
	ctx.enqueue({
		event: eventName,
		dedupKey: `${incident.id}:${eventId}`,
		payload: {
			pageId: incident.page_id,
			incidentId: incident.id,
			title: incident.title,
			severity: incident.severity,
			state: incident.state,
			...extra,
		},
	});
};

const validateComponents = (
	ctx: StatusContext,
	pageId: string,
	componentIds: string[],
): void => {
	for (const componentId of componentIds) {
		requireComponent(ctx, componentId, pageId);
	}
};

export const createIncident = (
	ctx: StatusContext,
	ref: string,
	input: CreateIncidentInput,
	actor: Actor,
) => {
	const page = requirePage(ctx, ref);
	validateComponents(ctx, page.id, input.componentIds);
	if (input.correlationKey) {
		const open = ctx.repos.incidents.findOpenByCorrelation(
			page.id,
			input.correlationKey,
		);
		if (open) {
			throw conflict(
				"An unresolved incident already uses this correlation key",
				{ incidentId: open.id },
			);
		}
	}
	const timestamp = ctx.now();
	const published = input.published && input.visibility !== "private";
	const row: IncidentRow = {
		id: newId("inc"),
		page_id: page.id,
		title: input.title,
		description: input.description,
		severity: input.severity,
		state: input.state,
		visibility: input.visibility,
		published: published ? 1 : 0,
		published_at: published ? timestamp : null,
		correlation_key: input.correlationKey ?? null,
		started_at: input.startedAt ?? timestamp,
		resolved_at: input.state === "resolved" ? timestamp : null,
		created_by: actor.id,
		created_at: timestamp,
		updated_at: timestamp,
	};
	ctx.repos.incidents.insert(row);
	if (input.componentIds.length > 0) {
		ctx.repos.incidents.replaceComponents(row.id, input.componentIds);
	}
	const publicFace = published && row.visibility === "public";
	const createdEvent = insertEvent(ctx, {
		page_id: page.id,
		subject_type: "incident",
		subject_id: row.id,
		type: "incident_created",
		visibility: publicFace ? "public" : "internal",
		message: input.update?.message ?? input.description ?? row.title,
		state: row.state,
		severity: row.severity,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: JSON.stringify({ componentIds: input.componentIds }),
	});
	ctx.audit(actor, {
		action: "incident.create",
		subjectType: "incident",
		subjectId: row.id,
		detail: {
			pageId: page.id,
			severity: row.severity,
			published: publicFace,
		},
	});
	ctx.publishState(page.id);
	if (publicFace) {
		notify(ctx, row, "incident.published", createdEvent);
	}
	const stored = ctx.repos.incidents.findById(row.id);
	if (!stored) {
		throw notFound("Incident disappeared during creation");
	}
	return adminIncidentDto(ctx, stored);
};

export const updateIncident = (
	ctx: StatusContext,
	incidentId: string,
	input: UpdateIncidentInput,
	actor: Actor,
) => {
	const row = requireIncident(ctx, incidentId);
	if (input.componentIds) {
		validateComponents(ctx, row.page_id, input.componentIds);
	}
	ctx.repos.incidents.update(
		incidentId,
		{
			title: input.title,
			description: input.description,
			severity: input.severity,
			visibility: input.visibility,
		},
		ctx.now(),
	);
	if (input.componentIds) {
		ctx.repos.incidents.replaceComponents(incidentId, input.componentIds);
	}
	insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "incident",
		subject_id: incidentId,
		type: "incident_updated",
		visibility: "internal",
		message: `incident updated (${Object.keys(input).join(", ")})`,
		state: null,
		severity: input.severity ?? null,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: JSON.stringify({ fields: Object.keys(input) }),
	});
	ctx.audit(actor, {
		action: "incident.update",
		subjectType: "incident",
		subjectId: incidentId,
		detail: { fields: Object.keys(input) },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.incidents.findById(incidentId);
	if (!updated) {
		throw notFound("Incident disappeared during update");
	}
	return adminIncidentDto(ctx, updated);
};

/**
 * Transition the incident state.
 *
 * `resolved` is terminal: reopening an incident is a new incident (possibly
 * with the same correlation key), so the public history never gets muddled by
 * a resolved incident silently coming back to life.
 */
export const changeIncidentState = (
	ctx: StatusContext,
	incidentId: string,
	input: IncidentStateChangeInput,
	actor: Actor,
) => {
	const row = requireIncident(ctx, incidentId);
	if (row.state === "resolved") {
		throw conflict("A resolved incident cannot change state", {
			state: row.state,
		});
	}
	const timestamp = ctx.now();
	const resolved = input.state === "resolved";
	const publicFace = row.published === 1 && row.visibility === "public";
	ctx.repos.incidents.update(
		incidentId,
		{
			state: input.state,
			resolved_at: resolved
				? (input.resolvedAt ?? timestamp)
				: (row.resolved_at ?? undefined),
		},
		timestamp,
	);
	const eventId = insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "incident",
		subject_id: incidentId,
		type: resolved ? "incident_resolved" : "incident_state_changed",
		visibility: publicFace ? "public" : "internal",
		message:
			input.message ?? `Status changed to ${input.state.replace("_", " ")}`,
		state: input.state,
		severity: row.severity,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: null,
	});
	ctx.audit(actor, {
		action: resolved ? "incident.resolve" : "incident.state",
		subjectType: "incident",
		subjectId: incidentId,
		detail: { from: row.state, to: input.state },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.incidents.findById(incidentId);
	if (!updated) {
		throw notFound("Incident disappeared during state change");
	}
	if (publicFace) {
		notify(
			ctx,
			updated,
			resolved ? "incident.resolved" : "incident.updated",
			eventId,
		);
	}
	return adminIncidentDto(ctx, updated);
};

export const addIncidentUpdate = (
	ctx: StatusContext,
	incidentId: string,
	input: IncidentUpdateInput,
	actor: Actor,
) => {
	const row = requireIncident(ctx, incidentId);
	if (row.state === "resolved") {
		throw conflict("A resolved incident cannot receive updates", {
			state: row.state,
		});
	}
	const timestamp = ctx.now();
	const targetState = input.state ?? (row.state as never);
	if (input.state) {
		ctx.repos.incidents.update(incidentId, { state: input.state }, timestamp);
	}
	const publicFace =
		input.visibility === "public" &&
		row.published === 1 &&
		row.visibility === "public";
	const eventId = insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "incident",
		subject_id: incidentId,
		type: "incident_updated",
		visibility: publicFace ? "public" : "internal",
		message: input.message,
		state: targetState,
		severity: row.severity,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: null,
	});
	ctx.audit(actor, {
		action: "incident.update.add",
		subjectType: "incident",
		subjectId: incidentId,
		detail: { visibility: input.visibility, state: targetState },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.incidents.findById(incidentId);
	if (!updated) {
		throw notFound("Incident disappeared during update");
	}
	if (publicFace) {
		notify(ctx, updated, "incident.updated", eventId);
	}
	return adminIncidentDto(ctx, updated);
};

/**
 * Publish or withdraw an incident.
 *
 * Publishing makes the incident and its *already public* updates visible;
 * internal updates remain internal. Withdrawing hides it from every public
 * read path without deleting anything.
 */
export const setIncidentPublish = (
	ctx: StatusContext,
	incidentId: string,
	input: PublishInput,
	actor: Actor,
) => {
	const row = requireIncident(ctx, incidentId);
	const timestamp = ctx.now();
	const visibility =
		input.visibility ?? (row.visibility as "public" | "private");
	const published = input.published && visibility !== "private";
	ctx.repos.incidents.update(
		incidentId,
		{
			published: published ? 1 : 0,
			published_at: published ? (row.published_at ?? timestamp) : null,
			visibility,
		},
		timestamp,
	);
	const eventId = insertEvent(ctx, {
		page_id: row.page_id,
		subject_type: "incident",
		subject_id: incidentId,
		type: published ? "incident_published" : "incident_unpublished",
		// The publication marker itself is only shown publicly once visible.
		visibility: published && visibility === "public" ? "public" : "internal",
		message: published ? "Incident published" : "Incident withdrawn",
		state: row.state,
		severity: row.severity,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: null,
	});
	ctx.audit(actor, {
		action: published ? "incident.publish" : "incident.unpublish",
		subjectType: "incident",
		subjectId: incidentId,
		detail: { visibility },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.incidents.findById(incidentId);
	if (!updated) {
		throw notFound("Incident disappeared during publication");
	}
	if (published && visibility === "public") {
		notify(ctx, updated, "incident.published", eventId);
	}
	return adminIncidentDto(ctx, updated);
};

/**
 * Hard-delete an incident, but only while it was never published: published
 * history must be withdrawn (unpublish), not silently erased.
 */
export const deleteIncident = (
	ctx: StatusContext,
	incidentId: string,
	actor: Actor,
): void => {
	const row = requireIncident(ctx, incidentId);
	if (row.published === 1) {
		throw conflict(
			"Published incidents cannot be deleted; unpublish it instead so the change stays auditable",
		);
	}
	ctx.repos.events.deleteBySubject("incident", incidentId);
	ctx.repos.incidents.delete(incidentId);
	ctx.audit(actor, {
		action: "incident.delete",
		subjectType: "incident",
		subjectId: incidentId,
		detail: { pageId: row.page_id, title: row.title },
	});
	ctx.publishState(row.page_id);
};

export { badRequest };
