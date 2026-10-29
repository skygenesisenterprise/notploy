/**
 * Catalog seeding.
 *
 * Turns a declarative catalog into a real status page. Deliberately
 * idempotent and non-destructive:
 *
 * - the page is created only when its slug is free;
 * - a component is created only when no component of that page already bears
 *   its name, so operator edits (icon, description, visibility, observed
 *   state, position) survive a re-run.
 *
 * New components are created `public` with an `operational` observed state, so
 * the page is coherent immediately and monitoring can then record real states
 * through the integration API.
 */
import type { CatalogComponent, StatusCatalog } from "../core/catalog";
import type { PageRow } from "../store/repositories";
import { createComponent } from "./components";
import type { Actor, StatusContext } from "./context";
import { createPage } from "./pages";

export interface SeedResult {
	page: PageRow;
	/** Names of the components created by this run. */
	created: string[];
	/** Names already present, left untouched. */
	existing: string[];
}

export interface SeedOptions {
	/** Override the page slug (e.g. to seed a staging status page). */
	slug?: string;
	name?: string;
	description?: string;
	/** Start from a different position instead of appending after existing ones. */
	basePosition?: number;
}

const actorOf = (actor?: Actor): Actor =>
	actor ?? { type: "system", id: null, label: "seed" };

export const seedCatalog = (
	ctx: StatusContext,
	catalog: StatusCatalog,
	options: SeedOptions = {},
	actor?: Actor,
): SeedResult => {
	const resolvedActor = actorOf(actor);
	const slug = options.slug ?? catalog.page.slug;

	let page = ctx.repos.pages.findBySlug(slug);
	if (!page) {
		createPage(
			ctx,
			{
				slug,
				name: options.name ?? catalog.page.name,
				description: options.description ?? catalog.page.description,
				...(catalog.page.settings ? { settings: catalog.page.settings } : {}),
			},
			resolvedActor,
		);
		page = ctx.repos.pages.findBySlug(slug);
		if (!page) {
			throw new Error(`Status page "${slug}" disappeared during seeding`);
		}
	}

	const components = ctx.repos.components.listByPage(page.id);
	const existing = new Set(components.map((component) => component.name));
	const created: string[] = [];
	const alreadyThere: string[] = [];
	const basePosition = options.basePosition ?? components.length;

	for (const [offset, spec] of catalog.components.entries()) {
		if (existing.has(spec.name)) {
			alreadyThere.push(spec.name);
			continue;
		}
		createComponent(
			ctx,
			page.slug,
			{
				name: spec.name,
				description: spec.description,
				category: spec.category as CatalogComponent["category"],
				groupName: spec.groupName,
				visibility: "public",
				position: basePosition + offset,
				source: "manual",
				observedStatus: "operational",
			},
			resolvedActor,
		);
		created.push(spec.name);
	}

	return { page, created, existing: alreadyThere };
};
