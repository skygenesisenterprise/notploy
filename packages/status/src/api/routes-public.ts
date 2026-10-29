/**
 * Public API (`/api/v1`) — no authentication, read-only.
 *
 * Only projected DTOs leave this module: private components, unpublished
 * incidents, internal updates and infrastructure details have no path here
 * (covered by `tests/isolation.test.ts`).
 */
import { Hono } from "hono";
import { buildRssFeed } from "../api/rss";
import { historyQuerySchema, paginationSchema } from "../core/schemas";
import { notFound } from "../errors";
import type { StatusContext } from "../services/context";
import {
	getPublicIncident,
	getPublicPage,
	getPublicStatus,
	listPages,
	listPublicHistory,
	listPublicIncidents,
	listPublicIncidentUpdates,
	listPublicMaintenances,
	listPublicUptime,
} from "../services/public";
import { rateLimit } from "./middleware";

const parse = <T>(
	schema: { parse: (value: Record<string, unknown>) => T },
	value: Record<string, unknown>,
): T => schema.parse(value);

export const publicRoutes = (ctx: StatusContext): Hono => {
	const app = new Hono();
	app.use("*", rateLimit(ctx, "public"));

	app.get("/pages", (c) => c.json({ items: listPages(ctx) }));

	app.get("/pages/:slug", (c) => {
		const page = getPublicPage(ctx, c.req.param("slug"));
		if (!page) {
			throw notFound(`Status page "${c.req.param("slug")}" does not exist`);
		}
		return c.json(page);
	});

	app.get("/pages/:slug/status", (c) => {
		const status = getPublicStatus(ctx, c.req.param("slug"));
		if (!status) {
			throw notFound(`Status page "${c.req.param("slug")}" does not exist`);
		}
		return c.json(status);
	});

	app.get("/pages/:slug/components", (c) => {
		const page = getPublicPage(ctx, c.req.param("slug"));
		if (!page) {
			throw notFound(`Status page "${c.req.param("slug")}" does not exist`);
		}
		return c.json({ items: page.components });
	});

	app.get("/pages/:slug/uptime", (c) => {
		const componentId = c.req.query("componentId") || undefined;
		return c.json({
			items: listPublicUptime(ctx, c.req.param("slug"), componentId),
		});
	});

	app.get("/pages/:slug/incidents", (c) => {
		const query = parse(
			paginationSchema.extend({
				status: c.req.query("status") as
					| "active"
					| "resolved"
					| "all"
					| undefined,
			}),
			{
				limit: c.req.query("limit"),
				cursor: c.req.query("cursor"),
				status: c.req.query("status"),
			},
		);
		const status =
			query.status === "resolved" || query.status === "active"
				? query.status
				: "active";
		return c.json(
			listPublicIncidents(ctx, c.req.param("slug"), {
				status,
				limit: query.limit,
				cursor: query.cursor,
			}),
		);
	});

	app.get("/pages/:slug/incidents/:incidentId", (c) => {
		const incident = getPublicIncident(
			ctx,
			c.req.param("slug"),
			c.req.param("incidentId"),
		);
		if (!incident) {
			throw notFound("Incident not found");
		}
		return c.json(incident);
	});

	app.get("/pages/:slug/incidents/:incidentId/updates", (c) => {
		const query = parse(paginationSchema, {
			limit: c.req.query("limit"),
			cursor: c.req.query("cursor"),
		});
		return c.json(
			listPublicIncidentUpdates(
				ctx,
				c.req.param("slug"),
				c.req.param("incidentId"),
				query,
			),
		);
	});

	app.get("/pages/:slug/maintenances", (c) => {
		const query = parse(paginationSchema, {
			limit: c.req.query("limit"),
			cursor: c.req.query("cursor"),
		});
		const statusParam = c.req.query("status");
		const status =
			statusParam === "scheduled" ||
			statusParam === "in_progress" ||
			statusParam === "completed" ||
			statusParam === "all"
				? statusParam
				: undefined;
		return c.json(
			listPublicMaintenances(ctx, c.req.param("slug"), {
				status,
				limit: query.limit,
				cursor: query.cursor,
			}),
		);
	});

	app.get("/pages/:slug/history", (c) => {
		const query = parse(historyQuerySchema, {
			limit: c.req.query("limit"),
			cursor: c.req.query("cursor"),
			from: c.req.query("from") || undefined,
			to: c.req.query("to") || undefined,
			componentId: c.req.query("componentId") || undefined,
			state: c.req.query("state") || undefined,
		});
		return c.json(listPublicHistory(ctx, c.req.param("slug"), query));
	});

	app.get("/pages/:slug/feed.xml", (c) => {
		const xml = buildRssFeed(ctx, c.req.param("slug"));
		if (!xml) {
			throw notFound(`Status page "${c.req.param("slug")}" does not exist`);
		}
		return c.body(xml, 200, {
			"content-type": "application/rss+xml; charset=utf-8",
			"cache-control": "public, max-age=60",
		});
	});

	return app;
};
