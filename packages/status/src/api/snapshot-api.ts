/**
 * Snapshot API — the degraded, read-only surface served when the status
 * database cannot be opened.
 *
 * It answers the public read paths from the last persisted snapshot
 * (`snapshot.json`, refreshed after every publication) so the page keeps
 * informing users during a storage incident, and returns an explicit 503 for
 * everything that requires writing or storage-backed history. It never
 * fabricates an "operational" answer.
 */
import { Hono } from "hono";
import type { StatusConfig } from "../config";
import type { PublicPageDto } from "../core/dto";
import { healthzHandler } from "./health";
import {
	corsPolicy,
	errorResponse,
	notFoundResponse,
	rateLimit,
	type Variables,
} from "./middleware";

const unavailable = (message: string): Response =>
	Response.json(
		{ error: { code: "unavailable", message } },
		{ status: 503, headers: { "cache-control": "no-store" } },
	);

export const createSnapshotApi = (
	pages: PublicPageDto[],
	config: StatusConfig,
): Hono<{ Variables: Variables }> => {
	const app = new Hono<{ Variables: Variables }>();
	const ctx = { config } as never;
	app.use("*", corsPolicy(ctx));
	app.onError((error) => errorResponse(error));
	app.notFound(() => notFoundResponse());

	app.get("/healthz", () => healthzHandler());
	app.get("/readyz", () =>
		unavailable("Status storage is unavailable; serving the snapshot"),
	);

	const publicApp = new Hono();
	publicApp.use("*", rateLimit(ctx, "public"));

	const summary = (page: PublicPageDto) => ({
		slug: page.slug,
		name: page.name,
		description: page.description,
		status: page.status,
		stale: true,
		updatedAt: page.updatedAt,
	});

	publicApp.get("/pages", (c) => c.json({ items: pages.map(summary) }));

	publicApp.get("/pages/:slug", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		if (!page) {
			return c.json(
				{ error: { code: "not_found", message: "No snapshot for this page" } },
				404,
			);
		}
		// Everything served from the snapshot is marked stale: it is the last
		// known public state, not a live observation.
		return c.json({
			...page,
			stale: true,
			generatedAt: new Date().toISOString(),
		});
	});

	publicApp.get("/pages/:slug/status", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		if (!page) {
			return c.json(
				{ error: { code: "not_found", message: "No snapshot for this page" } },
				404,
			);
		}
		return c.json({
			slug: page.slug,
			status: page.status,
			stale: true,
			generatedAt: new Date().toISOString(),
			updatedAt: page.updatedAt,
		});
	});

	publicApp.get("/pages/:slug/components", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		if (!page) {
			return c.json(
				{ error: { code: "not_found", message: "No snapshot for this page" } },
				404,
			);
		}
		return c.json({ items: page.components });
	});

	publicApp.get("/pages/:slug/uptime", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		if (!page) {
			return c.json(
				{ error: { code: "not_found", message: "No snapshot for this page" } },
				404,
			);
		}
		const componentId = c.req.query("componentId");
		const components = componentId
			? page.components.filter((component) => component.id === componentId)
			: page.components;
		return c.json({
			items: components.map((component) => ({
				componentId: component.id,
				uptime: component.uptime,
			})),
		});
	});

	publicApp.get("/pages/:slug/incidents", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		if (!page) {
			return c.json(
				{ error: { code: "not_found", message: "No snapshot for this page" } },
				404,
			);
		}
		return c.json({ items: page.activeIncidents, nextCursor: null });
	});

	publicApp.get("/pages/:slug/incidents/:incidentId", (c) => {
		const page = pages.find((entry) => entry.slug === c.req.param("slug"));
		const incident = page?.activeIncidents.find(
			(entry) => entry.id === c.req.param("incidentId"),
		);
		if (!incident) {
			return c.json(
				{
					error: {
						code: "not_found",
						message:
							"Only currently active incidents are available from the snapshot",
					},
				},
				404,
			);
		}
		return c.json(incident);
	});

	app.route("/api/v1", publicApp);

	app.get("/api/v1/pages/:slug/history", () =>
		unavailable(
			"History requires the status database; only the last known public state is served",
		),
	);
	app.get("/api/v1/pages/:slug/maintenances", () =>
		unavailable("Planned maintenances require the status database"),
	);
	app.all("/api/v1/admin/*", () =>
		unavailable("Administration is unavailable while storage is degraded"),
	);
	app.all("/api/v1/admin", () =>
		unavailable("Administration is unavailable while storage is degraded"),
	);
	app.all("/api/v1/integration/*", () =>
		unavailable(
			"Integration ingestion is unavailable while storage is degraded",
		),
	);
	app.all("/api/v1/integration", () =>
		unavailable(
			"Integration ingestion is unavailable while storage is degraded",
		),
	);

	return app;
};
