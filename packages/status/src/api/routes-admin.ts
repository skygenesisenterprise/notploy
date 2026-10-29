/**
 * Administration API (`/api/v1/admin`) — bearer token required.
 *
 * Scope rules (least privilege):
 * - `read`    inspect internal state, timeline and audit entries;
 * - `write`   manage pages, components and unpublished drafts;
 * - `publish` make content public or change published content;
 * - `tokens`  create and revoke credentials.
 *
 * Every sensitive operation is audited, and publication POSTs honour the
 * `Idempotency-Key` header so a network retry can never duplicate a public
 * incident.
 */
import { Hono } from "hono";
import {
	createComponentSchema,
	createIncidentSchema,
	createMaintenanceSchema,
	createPageSchema,
	createTokenSchema,
	incidentStateChangeSchema,
	incidentUpdateSchema,
	maintenanceStateChangeSchema,
	paginationSchema,
	publishSchema,
	updateComponentSchema,
	updateIncidentSchema,
	updateMaintenanceSchema,
	updatePageSchema,
} from "../core/schemas";
import { badRequest, forbidden } from "../errors";
import {
	createComponent,
	deleteComponent,
	listComponentsInternal,
	requireComponent,
	updateComponent,
} from "../services/components";
import type { Actor, StatusContext } from "../services/context";
import {
	addIncidentUpdate,
	changeIncidentState,
	createIncident,
	deleteIncident,
	requireIncident,
	setIncidentPublish,
	updateIncident,
} from "../services/incidents";
import {
	changeMaintenanceState,
	createMaintenance,
	deleteMaintenance,
	requireMaintenance,
	setMaintenancePublish,
	updateMaintenance,
} from "../services/maintenances";
import {
	createWebhookSubscription,
	listWebhookSubscriptions,
} from "../services/outbox";
import {
	createPage,
	listPagesInternal,
	requirePage,
	updatePage,
} from "../services/pages";
import {
	adminIncidentDto,
	adminMaintenanceDto,
	auditLogDto,
	listTimeline,
} from "../services/public";
import {
	createTokenRecord,
	listTokenRecords,
	revokeTokenRecord,
} from "../services/security";
import {
	authenticate,
	readJson,
	requireActorScope,
	type Variables,
	withIdempotency,
} from "./middleware";

const actorOf = (value: Actor | null): Actor =>
	value ?? { type: "system", id: null, label: "system" };

/** In-handler scope assertion for body-dependent rules. */
const assertScope = (actor: Actor, scope: "publish" | "write"): void => {
	const scopes = actor.scopes ?? [];
	if (!scopes.includes(scope) && !scopes.includes("admin")) {
		throw forbidden(`This token is missing the "${scope}" scope`);
	}
};

export const adminRoutes = (
	ctx: StatusContext,
): Hono<{ Variables: Variables }> => {
	const app = new Hono<{ Variables: Variables }>();
	app.use("*", authenticate(ctx));

	/* --------------------------------- pages -------------------------------- */

	app.get("/pages", requireActorScope(ctx, "read"), (c) =>
		c.json({ items: listPagesInternal(ctx) }),
	);

	app.post("/pages", requireActorScope(ctx, "write"), async (c) => {
		const body = await readJson<unknown>(c, ctx);
		const input = createPageSchema.parse(body);
		return withIdempotency(
			ctx,
			c,
			"admin:pages:create",
			JSON.stringify(body),
			() => c.json(createPage(ctx, input, actorOf(c.get("actor"))), 201),
		);
	});

	app.get("/pages/:ref", requireActorScope(ctx, "read"), (c) => {
		const page = requirePage(ctx, c.req.param("ref"));
		return c.json({
			id: page.id,
			slug: page.slug,
			name: page.name,
			description: page.description,
			settings: JSON.parse(page.settings_json) as Record<string, unknown>,
			createdAt: page.created_at,
			updatedAt: page.updated_at,
		});
	});

	app.patch("/pages/:ref", requireActorScope(ctx, "write"), async (c) => {
		const body = await readJson<unknown>(c, ctx);
		const input = updatePageSchema.parse(body);
		return c.json(
			updatePage(ctx, c.req.param("ref"), input, actorOf(c.get("actor"))),
		);
	});

	/* ------------------------------ components ------------------------------ */

	app.get("/pages/:ref/components", requireActorScope(ctx, "read"), (c) =>
		c.json({
			items: listComponentsInternal(ctx, c.req.param("ref"), {
				includePrivate: true,
			}),
		}),
	);

	app.post(
		"/pages/:ref/components",
		requireActorScope(ctx, "write"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = createComponentSchema.parse(body);
			return c.json(
				createComponent(
					ctx,
					c.req.param("ref"),
					input,
					actorOf(c.get("actor")),
				),
				201,
			);
		},
	);

	app.patch(
		"/components/:componentId",
		requireActorScope(ctx, "write"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = updateComponentSchema.parse(body);
			requireComponent(ctx, c.req.param("componentId"));
			return c.json(
				updateComponent(
					ctx,
					c.req.param("componentId"),
					input,
					actorOf(c.get("actor")),
				),
			);
		},
	);

	app.delete(
		"/components/:componentId",
		requireActorScope(ctx, "write"),
		(c) => {
			deleteComponent(ctx, c.req.param("componentId"), actorOf(c.get("actor")));
			return c.json({ deleted: true });
		},
	);

	/* ------------------------------- incidents ------------------------------ */

	app.get("/pages/:ref/incidents", requireActorScope(ctx, "read"), (c) => {
		const page = requirePage(ctx, c.req.param("ref"));
		const includeUnpublished = c.req.query("includeUnpublished") !== "false";
		const rows = ctx.repos.incidents
			.listByPage(page.id)
			.filter(
				(row) =>
					includeUnpublished ||
					(row.published === 1 && row.visibility === "public"),
			);
		return c.json({ items: rows.map((row) => adminIncidentDto(ctx, row)) });
	});

	app.post(
		"/pages/:ref/incidents",
		requireActorScope(ctx, "write"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = createIncidentSchema.parse(body);
			if (input.published) {
				assertScope(actorOf(c.get("actor")), "publish");
			}
			return withIdempotency(
				ctx,
				c,
				"admin:incidents:create",
				JSON.stringify(body),
				() =>
					c.json(
						createIncident(
							ctx,
							c.req.param("ref"),
							input,
							actorOf(c.get("actor")),
						),
						201,
					),
			);
		},
	);

	app.get("/incidents/:incidentId", requireActorScope(ctx, "read"), (c) => {
		const row = requireIncident(ctx, c.req.param("incidentId"));
		return c.json(adminIncidentDto(ctx, row));
	});

	app.get(
		"/incidents/:incidentId/timeline",
		requireActorScope(ctx, "read"),
		(c) => {
			const row = requireIncident(ctx, c.req.param("incidentId"));
			return c.json({
				items: listTimeline(ctx, row.page_id, "incident", row.id),
			});
		},
	);

	app.patch(
		"/incidents/:incidentId",
		requireActorScope(ctx, "write"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = updateIncidentSchema.parse(body);
			return c.json(
				updateIncident(
					ctx,
					c.req.param("incidentId"),
					input,
					actorOf(c.get("actor")),
				),
			);
		},
	);

	app.post(
		"/incidents/:incidentId/state",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = incidentStateChangeSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				`admin:incidents:state:${c.req.param("incidentId")}`,
				JSON.stringify(body),
				() =>
					c.json(
						changeIncidentState(
							ctx,
							c.req.param("incidentId"),
							input,
							actorOf(c.get("actor")),
						),
					),
			);
		},
	);

	app.post(
		"/incidents/:incidentId/updates",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = incidentUpdateSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				`admin:incidents:updates:${c.req.param("incidentId")}:${input.message.slice(0, 64)}`,
				JSON.stringify(body),
				() =>
					c.json(
						addIncidentUpdate(
							ctx,
							c.req.param("incidentId"),
							input,
							actorOf(c.get("actor")),
						),
					),
			);
		},
	);

	app.post(
		"/incidents/:incidentId/publish",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = publishSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				`admin:incidents:publish:${c.req.param("incidentId")}`,
				JSON.stringify(body),
				() =>
					c.json(
						setIncidentPublish(
							ctx,
							c.req.param("incidentId"),
							input,
							actorOf(c.get("actor")),
						),
					),
			);
		},
	);

	app.delete("/incidents/:incidentId", requireActorScope(ctx, "write"), (c) => {
		deleteIncident(ctx, c.req.param("incidentId"), actorOf(c.get("actor")));
		return c.json({ deleted: true });
	});

	/* ------------------------------ maintenances ---------------------------- */

	app.get("/pages/:ref/maintenances", requireActorScope(ctx, "read"), (c) => {
		const page = requirePage(ctx, c.req.param("ref"));
		const includeUnpublished = c.req.query("includeUnpublished") !== "false";
		const rows = ctx.repos.maintenances
			.listByPage(page.id)
			.filter(
				(row) =>
					includeUnpublished ||
					(row.published === 1 && row.visibility === "public"),
			);
		return c.json({ items: rows.map((row) => adminMaintenanceDto(ctx, row)) });
	});

	app.post(
		"/pages/:ref/maintenances",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = createMaintenanceSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				"admin:maintenances:create",
				JSON.stringify(body),
				() =>
					c.json(
						createMaintenance(
							ctx,
							c.req.param("ref"),
							input,
							actorOf(c.get("actor")),
						),
						201,
					),
			);
		},
	);

	app.patch(
		"/maintenances/:maintenanceId",
		requireActorScope(ctx, "write"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = updateMaintenanceSchema.parse(body);
			requireMaintenance(ctx, c.req.param("maintenanceId"));
			return c.json(
				updateMaintenance(
					ctx,
					c.req.param("maintenanceId"),
					input,
					actorOf(c.get("actor")),
				),
			);
		},
	);

	app.post(
		"/maintenances/:maintenanceId/state",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = maintenanceStateChangeSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				`admin:maintenances:state:${c.req.param("maintenanceId")}`,
				JSON.stringify(body),
				() =>
					c.json(
						changeMaintenanceState(
							ctx,
							c.req.param("maintenanceId"),
							input,
							actorOf(c.get("actor")),
						),
					),
			);
		},
	);

	app.post(
		"/maintenances/:maintenanceId/publish",
		requireActorScope(ctx, "publish"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = publishSchema.parse(body);
			return withIdempotency(
				ctx,
				c,
				`admin:maintenances:publish:${c.req.param("maintenanceId")}`,
				JSON.stringify(body),
				() =>
					c.json(
						setMaintenancePublish(
							ctx,
							c.req.param("maintenanceId"),
							input,
							actorOf(c.get("actor")),
						),
					),
			);
		},
	);

	app.delete(
		"/maintenances/:maintenanceId",
		requireActorScope(ctx, "write"),
		(c) => {
			deleteMaintenance(
				ctx,
				c.req.param("maintenanceId"),
				actorOf(c.get("actor")),
			);
			return c.json({ deleted: true });
		},
	);

	/* --------------------------------- tokens -------------------------------- */

	app.get("/tokens", requireActorScope(ctx, "tokens"), (c) =>
		c.json({ items: listTokenRecords(ctx) }),
	);

	app.post("/tokens", requireActorScope(ctx, "tokens"), async (c) => {
		const body = await readJson<unknown>(c, ctx);
		const input = createTokenSchema.parse(body);
		const created = createTokenRecord(ctx, input, actorOf(c.get("actor")));
		// The plaintext value is present exactly once, in this response.
		return c.json({ token: created.token, value: created.value }, 201);
	});

	app.delete("/tokens/:tokenId", requireActorScope(ctx, "tokens"), (c) =>
		c.json(
			revokeTokenRecord(ctx, c.req.param("tokenId"), actorOf(c.get("actor"))),
		),
	);

	/* --------------------------------- audit --------------------------------- */

	app.get("/audit", requireActorScope(ctx, "read"), (c) => {
		const query = paginationSchema.parse({
			limit: c.req.query("limit"),
			cursor: c.req.query("cursor"),
		});
		const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
		const rows = ctx.repos.audit.list(query.limit + 1, offset);
		const hasMore = rows.length > query.limit;
		const slice = hasMore ? rows.slice(0, query.limit) : rows;
		return c.json({
			items: slice.map(auditLogDto),
			nextCursor: hasMore ? String(offset + query.limit) : null,
		});
	});

	/* ------------------------------- webhooks -------------------------------- */

	app.get("/webhooks", requireActorScope(ctx, "read"), (c) =>
		c.json({ items: listWebhookSubscriptions(ctx) }),
	);

	app.post("/webhooks", requireActorScope(ctx, "write"), async (c) => {
		const body =
			(await readJson<{ url?: string; events?: string[] }>(c, ctx)) ?? {};
		if (!body.url || !Array.isArray(body.events) || body.events.length === 0) {
			throw badRequest("url and events[] are required");
		}
		return c.json(
			createWebhookSubscription(
				ctx,
				{ url: body.url, events: body.events },
				actorOf(c.get("actor")),
			),
			201,
		);
	});

	return app;
};
