/**
 * Integration API (`/api/v1/integration`) — machine-to-machine.
 *
 * Used by Notploy Console, the Go monitoring agent or any probe holding a
 * token with the `ingest` scope. Publication remains an explicit decision:
 * ingesting an event never makes anything public unless the target page
 * opted into `autoIncident` **and** `autoPublish`.
 */
import { Hono } from "hono";
import { componentStateSchema, ingestEventSchema } from "../core/schemas";
import { notFound } from "../errors";
import { setComponentObservedState } from "../services/components";
import type { Actor, StatusContext } from "../services/context";
import {
	getComponentObservedState,
	ingestMonitoringEvent,
} from "../services/ingest";
import {
	authenticate,
	readJson,
	requireActorScope,
	type Variables,
	withIdempotency,
} from "./middleware";

export const integrationRoutes = (
	ctx: StatusContext,
): Hono<{ Variables: Variables }> => {
	const app = new Hono<{ Variables: Variables }>();
	app.use("*", authenticate(ctx));

	app.post("/events", requireActorScope(ctx, "ingest"), async (c) => {
		const body = await readJson<unknown>(c, ctx);
		const input = ingestEventSchema.parse(body);
		const actor = (c.get("actor") ?? {
			type: "integration",
			id: null,
			label: input.source,
		}) as Actor;
		return withIdempotency(
			ctx,
			c,
			"integration:events",
			JSON.stringify(body),
			() => c.json(ingestMonitoringEvent(ctx, input, actor), 202),
		);
	});

	app.post(
		"/pages/:slug/components/:componentId/state",
		requireActorScope(ctx, "ingest"),
		async (c) => {
			const body = await readJson<unknown>(c, ctx);
			const input = componentStateSchema.parse(body);
			const actor = (c.get("actor") ?? {
				type: "integration",
				id: null,
				label: "integration",
			}) as Actor;
			const updated = setComponentObservedState(
				ctx,
				c.req.param("slug"),
				c.req.param("componentId"),
				{ observedStatus: input.observedStatus, note: input.note },
				actor,
			);
			return c.json({
				componentId: updated.id,
				observedStatus: updated.observedStatus,
				lastPublishedStatus: updated.lastPublishedStatus,
				updatedAt: updated.updatedAt,
			});
		},
	);

	app.get(
		"/pages/:slug/components/:componentId/state",
		requireActorScope(ctx, "read"),
		(c) => {
			try {
				return c.json(
					getComponentObservedState(
						ctx,
						c.req.param("slug"),
						c.req.param("componentId"),
					),
				);
			} catch (error) {
				if (error instanceof Error && error.name === "StatusError") {
					throw error;
				}
				throw notFound("Component not found");
			}
		},
	);

	return app;
};
