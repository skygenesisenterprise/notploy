/**
 * Catalog seeding tests.
 *
 * The seed is what gives a fresh install the six Notploy offerings. Two
 * properties matter: it must produce exactly the catalog, and it must be safe
 * to re-run — a second run never duplicates a component nor overwrites an
 * operator edit.
 */
import { describe, expect, it } from "vitest";
import {
	buildPublicPage,
	NOTPLOY_STATUS_CATALOG,
	resolveSettings,
	seedCatalog,
	updateComponent,
} from "../src/index";
import { createHarness } from "./helpers";

const EXPECTED = [
	"Notploy Cloud",
	"API",
	"MCP Server",
	"GitHub App",
	"Website",
	"Docs",
];

describe("Notploy catalog", () => {
	it("declares the six offerings the status page tracks", () => {
		expect(NOTPLOY_STATUS_CATALOG.components.map((c) => c.name)).toEqual(
			EXPECTED,
		);
	});

	it("creates the page and every component, grouped for the public page", () => {
		const { ctx } = createHarness();
		const result = seedCatalog(ctx, NOTPLOY_STATUS_CATALOG);

		expect(result.created).toEqual(EXPECTED);
		expect(result.existing).toEqual([]);

		const page = buildPublicPage(ctx, result.page);
		expect(page.components.map((component) => component.name)).toEqual(
			EXPECTED,
		);
		expect(
			new Set(page.components.map((component) => component.groupName)),
		).toEqual(new Set(["Platform", "Integrations", "Web presence"]));
		// Every seeded component is published, so the page is coherent at once.
		expect(
			page.components.every((component) => component.status === "operational"),
		).toBe(true);
		// The catalog's page settings are applied on creation.
		expect(resolveSettings(result.page).staleAfterSeconds).toBe(900);
	});

	it("is idempotent and preserves operator edits", () => {
		const { ctx } = createHarness();
		seedCatalog(ctx, NOTPLOY_STATUS_CATALOG);

		const page = ctx.repos.pages.findBySlug(NOTPLOY_STATUS_CATALOG.page.slug);
		if (!page) {
			throw new Error("seed did not create the page");
		}
		const api = ctx.repos.components
			.listByPage(page.id)
			.find((component) => component.name === "API");
		if (!api) {
			throw new Error("seed did not create the API component");
		}
		updateComponent(
			ctx,
			api.id,
			{ description: "Curated by an operator", visibility: "private" },
			{ type: "system", id: null, label: "test" },
		);

		const second = seedCatalog(ctx, NOTPLOY_STATUS_CATALOG);
		expect(second.created).toEqual([]);
		expect(second.existing).toEqual(EXPECTED);
		expect(ctx.repos.components.listByPage(page.id)).toHaveLength(
			EXPECTED.length,
		);

		const edited = ctx.repos.components.findById(api.id);
		expect(edited?.description).toBe("Curated by an operator");
		expect(edited?.visibility).toBe("private");
	});

	it("can seed an alternative page without touching the default one", () => {
		const { ctx } = createHarness();
		seedCatalog(ctx, NOTPLOY_STATUS_CATALOG);
		const staging = seedCatalog(ctx, NOTPLOY_STATUS_CATALOG, {
			slug: "notploy-staging",
			name: "Notploy Status (staging)",
		});
		expect(staging.page.slug).toBe("notploy-staging");
		expect(staging.created).toEqual(EXPECTED);
		expect(ctx.repos.pages.list()).toHaveLength(2);
	});
});
