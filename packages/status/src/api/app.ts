/**
 * HTTP application factory.
 *
 * The whole platform (public API, administration API, integration API,
 * health probes, OpenAPI document) is a plain Hono app that can be mounted by
 * any host — in production it is served by the Next.js status application
 * through a single catch-all route, which keeps routing, validation and
 * authorization testable without a browser or a running server.
 */
import { Hono } from "hono";
import { newRequestId } from "../core/ids";
import type { StatusContext } from "../services/context";
import {
	corsPolicy,
	errorResponse,
	notFoundResponse,
	type Variables,
} from "./middleware";
import { publicRoutes } from "./routes-public";
import { adminRoutes } from "./routes-admin";
import { integrationRoutes } from "./routes-integration";
import { healthzHandler, readyzHandler } from "./health";
import { buildOpenApiDocument } from "./openapi";
import { rateLimit } from "./middleware";

export const createStatusApi = (ctx: StatusContext): Hono<{ Variables: Variables }> => {
	const app = new Hono<{ Variables: Variables }>();

	app.use("*", async (c, next) => {
		const requestId = newRequestId();
		c.set("requestId", requestId);
		c.header("x-request-id", requestId);
		await next();
	});
	app.use("*", corsPolicy(ctx));
	app.onError((error) => errorResponse(error));
	app.notFound(() => notFoundResponse());

	app.get("/healthz", () => healthzHandler());
	app.get("/readyz", () => readyzHandler(ctx));
	app.get("/api/v1/openapi.json", (c) =>
		c.json(buildOpenApiDocument(ctx.config.publicUrl)),
	);

	app.route("/api/v1", publicRoutes(ctx));

	const admin = adminRoutes(ctx);
	admin.use("*", rateLimit(ctx, "admin"));
	app.route("/api/v1/admin", admin);

	const integration = integrationRoutes(ctx);
	integration.use("*", rateLimit(ctx, "admin"));
	app.route("/api/v1/integration", integration);

	return app;
};
