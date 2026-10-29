/**
 * Status page administration.
 *
 * A "page" is a publication scope (e.g. `notploy`, `sge-cloud`). Multiple
 * pages let the platform serve several products without duplicating the
 * deployment.
 */
import { newId } from "../core/ids";
import type { CreatePageInput, UpdatePageInput } from "../core/schemas";
import { badRequest, notFound } from "../errors";
import type { PageRow } from "../store/repositories";
import type { Actor, StatusContext } from "./context";
import { adminPageDto } from "./public";
import { mergeSettings, resolveSettings } from "./settings";

/** Resolve a page by id (`pg_...`) or by public slug. */
export const requirePage = (ctx: StatusContext, ref: string): PageRow => {
	const row = ref.startsWith("pg_")
		? ctx.repos.pages.findById(ref)
		: ctx.repos.pages.findBySlug(ref);
	if (!row) {
		throw notFound(`Status page "${ref}" does not exist`);
	}
	return row;
};

export const createPage = (
	ctx: StatusContext,
	input: CreatePageInput,
	actor: Actor,
) => {
	if (ctx.repos.pages.findBySlug(input.slug)) {
		throw badRequest(`A status page with slug "${input.slug}" already exists`);
	}
	const timestamp = ctx.now();
	const settings = mergeSettings(
		resolveSettings({ ...emptyPage() } as PageRow),
		{
			...(input.settings ?? {}),
			severityToStatus: input.settings?.severityToStatus ?? {},
		},
	);
	const row: PageRow = {
		id: newId("pg"),
		slug: input.slug,
		name: input.name,
		description: input.description,
		settings_json: JSON.stringify(settings),
		created_at: timestamp,
		updated_at: timestamp,
	};
	ctx.repos.pages.insert(row);
	ctx.audit(actor, {
		action: "page.create",
		subjectType: "page",
		subjectId: row.id,
		detail: { slug: row.slug },
	});
	return adminPageDto(ctx, row);
};

const emptyPage = (): PageRow => ({
	id: "",
	slug: "",
	name: "",
	description: "",
	settings_json: "{}",
	created_at: "",
	updated_at: "",
});

export const updatePage = (
	ctx: StatusContext,
	ref: string,
	input: UpdatePageInput,
	actor: Actor,
) => {
	const row = requirePage(ctx, ref);
	const current = resolveSettings(row);
	const merged = input.settings
		? mergeSettings(current, {
				...(input.settings ?? {}),
				severityToStatus: input.settings?.severityToStatus ?? {},
			})
		: current;
	ctx.repos.pages.update(
		row.id,
		{
			name: input.name,
			description: input.description,
			settings_json: JSON.stringify(merged),
		},
		ctx.now(),
	);
	ctx.audit(actor, {
		action: "page.update",
		subjectType: "page",
		subjectId: row.id,
		detail: { fields: Object.keys(input) },
	});
	ctx.publishState(row.id);
	const updated = ctx.repos.pages.findById(row.id);
	if (!updated) {
		throw notFound("Status page disappeared during update");
	}
	return adminPageDto(ctx, updated);
};

export const listPagesInternal = (ctx: StatusContext) =>
	ctx.repos.pages.list().map((row) => adminPageDto(ctx, row));
