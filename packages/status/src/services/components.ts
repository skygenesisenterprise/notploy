/**
 * Component administration.
 *
 * A component is a *public capability* (Notploy API, Deployments, ...), not a
 * server: it may aggregate several instances through `parentId`, and a
 * monitoring source may update its observed state without ever touching the
 * public projection directly.
 */
import { newId } from "../core/ids";
import type {
	CreateComponentInput,
	UpdateComponentInput,
} from "../core/schemas";
import type { ObservedStatus } from "../core/types";
import { badRequest, notFound } from "../errors";
import type { ComponentRow } from "../store/repositories";
import type { Actor, StatusContext } from "./context";
import { requirePage } from "./pages";
import { adminComponentDto } from "./public";

/** Load a component, ensuring it belongs to the expected page. */
export const requireComponent = (
	ctx: StatusContext,
	componentId: string,
	pageId?: string,
): ComponentRow => {
	const row = ctx.repos.components.findById(componentId);
	if (!row || (pageId && row.page_id !== pageId)) {
		throw notFound(`Component "${componentId}" does not exist`);
	}
	return row;
};

/** Walk the parent chain to reject self-references and cycles. */
const wouldCreateCycle = (
	ctx: StatusContext,
	componentId: string,
	newParentId: string | null,
): boolean => {
	if (!newParentId) {
		return false;
	}
	if (newParentId === componentId) {
		return true;
	}
	let cursor: string | null = newParentId;
	const seen = new Set<string>();
	while (cursor) {
		if (cursor === componentId) {
			return true;
		}
		if (seen.has(cursor)) {
			return true;
		}
		seen.add(cursor);
		cursor = ctx.repos.components.findById(cursor)?.parent_id ?? null;
	}
	return false;
};

export const createComponent = (
	ctx: StatusContext,
	ref: string,
	input: CreateComponentInput,
	actor: Actor,
) => {
	const page = requirePage(ctx, ref);
	if (input.parentId) {
		const parent = ctx.repos.components.findById(input.parentId);
		if (!parent || parent.page_id !== page.id) {
			throw badRequest("parentId must reference a component of the same page");
		}
	}
	const timestamp = ctx.now();
	const observedAt = input.observedStatus !== "unknown" ? timestamp : null;
	const row: ComponentRow = {
		id: newId("cmp"),
		page_id: page.id,
		name: input.name,
		description: input.description,
		category: input.category,
		group_name: input.groupName ?? null,
		position: input.position ?? ctx.repos.components.listByPage(page.id).length,
		visibility: input.visibility,
		parent_id: input.parentId ?? null,
		source: input.source,
		observed_status: input.observedStatus,
		observed_at: observedAt,
		last_published_status: null,
		last_published_at: null,
		created_at: timestamp,
		updated_at: timestamp,
	};
	ctx.repos.components.insert(row);
	ctx.audit(actor, {
		action: "component.create",
		subjectType: "component",
		subjectId: row.id,
		detail: { pageId: page.id, name: row.name, visibility: row.visibility },
	});
	ctx.publishState(page.id);
	return adminComponentDto(row);
};

export const updateComponent = (
	ctx: StatusContext,
	componentId: string,
	input: UpdateComponentInput,
	actor: Actor,
) => {
	const row = requireComponent(ctx, componentId);
	if (input.parentId) {
		const parent = ctx.repos.components.findById(input.parentId);
		if (!parent || parent.page_id !== row.page_id) {
			throw badRequest("parentId must reference a component of the same page");
		}
		if (wouldCreateCycle(ctx, componentId, input.parentId)) {
			throw badRequest("parentId would create a dependency cycle");
		}
	}
	const fields: Partial<ComponentRow> = {
		name: input.name,
		description: input.description,
		category: input.category,
		group_name: input.groupName === undefined ? undefined : input.groupName,
		visibility: input.visibility,
		position: input.position,
		parent_id: input.parentId === undefined ? undefined : input.parentId,
	};
	if (input.observedStatus) {
		fields.observed_status = input.observedStatus;
		fields.observed_at =
			input.observedStatus === "unknown" ? row.observed_at : ctx.now();
	}
	ctx.repos.components.update(componentId, fields, ctx.now());
	ctx.audit(actor, {
		action: "component.update",
		subjectType: "component",
		subjectId: componentId,
		detail: { fields: Object.keys(input) },
	});
	ctx.publishState(row.page_id);
	const updated = ctx.repos.components.findById(componentId);
	if (!updated) {
		throw notFound("Component disappeared during update");
	}
	return adminComponentDto(updated);
};

export const deleteComponent = (
	ctx: StatusContext,
	componentId: string,
	actor: Actor,
): void => {
	const row = requireComponent(ctx, componentId);
	// Detach from any parent before deletion (FK is ON DELETE SET NULL, but be
	// explicit so behaviour does not depend on the pragma).
	for (const child of ctx.repos.components
		.listByPage(row.page_id)
		.filter((candidate) => candidate.parent_id === componentId)) {
		ctx.repos.components.update(child.id, { parent_id: null }, ctx.now());
	}
	ctx.repos.components.delete(componentId);
	ctx.audit(actor, {
		action: "component.delete",
		subjectType: "component",
		subjectId: componentId,
		detail: { pageId: row.page_id, name: row.name },
	});
	ctx.publishState(row.page_id);
};

export const listComponentsInternal = (
	ctx: StatusContext,
	ref: string,
	options: { includePrivate?: boolean } = {},
) => {
	const page = requirePage(ctx, ref);
	const rows = ctx.repos.components.listByPage(page.id);
	return rows
		.filter(
			(row) => options.includePrivate !== false || row.visibility === "public",
		)
		.map(adminComponentDto);
};

/**
 * Update the observed state of a component.
 *
 * Used by the integration API (monitoring agents, Console). The observed
 * state never directly becomes the published state: the engine decides, and
 * the change is re-projected through `publishState`.
 */
export const setComponentObservedState = (
	ctx: StatusContext,
	ref: string,
	componentId: string,
	input: { observedStatus: ObservedStatus; note?: string },
	actor: Actor,
) => {
	const page = requirePage(ctx, ref);
	const row = requireComponent(ctx, componentId, page.id);
	const timestamp = ctx.now();
	const changed = row.observed_status !== input.observedStatus;
	ctx.repos.components.update(
		componentId,
		{
			observed_status: input.observedStatus,
			observed_at:
				input.observedStatus === "unknown" ? row.observed_at : timestamp,
		},
		timestamp,
	);
	if (changed) {
		ctx.repos.events.insert({
			id: newId("evt"),
			page_id: page.id,
			subject_type: "component",
			subject_id: componentId,
			type: "component_updated",
			// Internal only: monitoring details never surface publicly.
			visibility: "internal",
			message: input.note ?? `observed status is now ${input.observedStatus}`,
			state: input.observedStatus,
			severity: null,
			actor_type: actor.type,
			actor_id: actor.id,
			actor_label: actor.label,
			metadata_json: JSON.stringify({
				from: row.observed_status,
				to: input.observedStatus,
			}),
			created_at: timestamp,
		});
	}
	ctx.audit(actor, {
		action: "component.state",
		subjectType: "component",
		subjectId: componentId,
		detail: { from: row.observed_status, to: input.observedStatus },
	});
	ctx.publishState(page.id);
	const updated = ctx.repos.components.findById(componentId);
	if (!updated) {
		throw notFound("Component disappeared during update");
	}
	return adminComponentDto(updated);
};
