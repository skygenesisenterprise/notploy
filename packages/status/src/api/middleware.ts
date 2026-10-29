/**
 * HTTP plumbing shared by every route group.
 *
 * - explicit CORS policy (configurable origins, no wildcard credentials),
 * - fixed-window rate limiting per client address and route class,
 * - bearer-token authentication with scope checks,
 * - `Idempotency-Key` support for publication operations,
 * - uniform JSON error responses that never expose internals.
 */
import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { newRequestId } from "../core/ids";
import {
	badRequest,
	StatusError,
	tooManyRequests,
	unauthorized,
} from "../errors";
import type { StatusContext } from "../services/context";
import {
	type AuthenticatedActor,
	requireScope,
	verifyBearer,
} from "../services/security";

export type Variables = {
	requestId: string;
	actor: AuthenticatedActor | null;
};

export type StatusHttpContext = Context<{ Variables: Variables }>;

export const clientIp = (c: Context): string => {
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) {
			return first;
		}
	}
	return c.req.header("x-real-ip") ?? "local";
};

/* --------------------------------- CORS ---------------------------------- */

export const corsPolicy = (ctx: StatusContext): MiddlewareHandler => {
	return async (c, next) => {
		const origin = c.req.header("origin");
		const allowed = ctx.config.corsOrigins;
		const allowAll = allowed.includes("*");
		if (origin && (allowAll || allowed.includes(origin))) {
			c.header("access-control-allow-origin", allowAll ? "*" : origin);
			c.header("vary", "Origin");
			c.header(
				"access-control-allow-methods",
				"GET, POST, PATCH, DELETE, OPTIONS",
			);
			c.header(
				"access-control-allow-headers",
				"authorization, content-type, idempotency-key",
			);
			c.header("access-control-max-age", "600");
		}
		if (c.req.method === "OPTIONS") {
			return c.body(null, 204);
		}
		return next();
	};
};

/* ------------------------------ rate limiting ----------------------------- */

interface RateWindow {
	count: number;
	resetAt: number;
}

export const rateLimit = (
	ctx: StatusContext,
	bucket: "public" | "admin",
): MiddlewareHandler => {
	const windows = new Map<string, RateWindow>();
	const max =
		bucket === "admin"
			? ctx.config.rateLimit.adminMax
			: ctx.config.rateLimit.publicMax;
	const windowMs = ctx.config.rateLimit.windowMs;
	return async (c, next) => {
		const now = Date.now();
		if (windows.size > 5000) {
			for (const [key, window] of windows) {
				if (window.resetAt <= now) {
					windows.delete(key);
				}
			}
		}
		const key = `${bucket}:${clientIp(c)}`;
		let window = windows.get(key);
		if (!window || window.resetAt <= now) {
			window = { count: 0, resetAt: now + windowMs };
			windows.set(key, window);
		}
		window.count += 1;
		if (window.count > max) {
			c.header("retry-after", String(Math.ceil((window.resetAt - now) / 1000)));
			throw tooManyRequests(
				"Too many requests — slow down and retry after the indicated delay",
			);
		}
		await next();
	};
};

/* ------------------------------ authentication ---------------------------- */

export const authenticate = (
	ctx: StatusContext,
): MiddlewareHandler<{ Variables: Variables }> => {
	return async (c, next) => {
		c.set("requestId", c.get("requestId") ?? newRequestId());
		c.set("actor", verifyBearer(ctx, c.req.header("authorization")));
		await next();
	};
};

export const requireActorScope = (
	ctx: StatusContext,
	scope: Parameters<typeof requireScope>[1],
): MiddlewareHandler<{ Variables: Variables }> => {
	return async (c, next) => {
		const actor =
			c.get("actor") ?? verifyBearer(ctx, c.req.header("authorization"));
		requireScope(actor, scope);
		c.set("actor", actor);
		await next();
	};
};

/* ------------------------------ body handling ----------------------------- */

export const readJson = async <T>(
	c: Context,
	ctx: StatusContext,
): Promise<T> => {
	const declared = Number(c.req.header("content-length") ?? "0");
	if (declared > ctx.config.maxBodyBytes) {
		throw badRequest(
			`Request body exceeds the ${ctx.config.maxBodyBytes} bytes limit`,
		);
	}
	const text = await c.req.text();
	if (Buffer.byteLength(text, "utf8") > ctx.config.maxBodyBytes) {
		throw badRequest(
			`Request body exceeds the ${ctx.config.maxBodyBytes} bytes limit`,
		);
	}
	if (!text) {
		throw badRequest("A JSON body is required");
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw badRequest("Request body is not valid JSON");
	}
};

/* ------------------------------- idempotency ------------------------------ */

export interface IdempotentResult {
	response: Response;
}

/**
 * Wrap a publication operation with `Idempotency-Key` semantics: the same
 * key replays the stored response (marked with `Idempotency-Replayed`), a
 * different body under the same key is rejected with 409.
 */
export const withIdempotency = async (
	ctx: StatusContext,
	c: Context,
	scope: string,
	bodyText: string,
	operation: () => Promise<Response> | Response,
): Promise<Response> => {
	const key = c.req.header("idempotency-key");
	if (!key) {
		return operation();
	}
	if (key.length > 200) {
		throw badRequest("Idempotency-Key is too long (max 200 characters)");
	}
	const requestHash = createHash("sha256")
		.update(`${c.req.method} ${c.req.path} ${bodyText}`)
		.digest("hex");
	const existing = ctx.repos.idempotency.find(key, scope);
	if (existing) {
		if (existing.request_hash !== requestHash) {
			throw new StatusError(
				409,
				"idempotency_conflict",
				"This Idempotency-Key was already used with a different request body",
			);
		}
		return new Response(existing.response_json, {
			status: existing.status_code,
			headers: {
				"content-type": "application/json",
				"idempotency-replayed": "true",
			},
		});
	}
	const response = await operation();
	const text = await response.clone().text();
	ctx.repos.idempotency.insert({
		key,
		scope,
		request_hash: requestHash,
		status_code: response.status,
		response_json: text,
		created_at: ctx.now(),
	});
	return response;
};

/* ------------------------------ error mapping ----------------------------- */

export const errorResponse = (error: unknown): Response => {
	if (error instanceof StatusError) {
		return Response.json(
			{
				error: {
					code: error.code,
					message: error.message,
					...(error.details ? { details: error.details } : {}),
				},
			},
			{ status: error.status },
		);
	}
	// Anything else is an internal fault: log it, never echo it.
	process.stderr.write(
		`${JSON.stringify({
			level: "error",
			time: new Date().toISOString(),
			msg: "unhandled_api_error",
			error: error instanceof Error ? error.message : String(error),
		})}\n`,
	);
	return Response.json(
		{ error: { code: "internal_error", message: "Internal server error" } },
		{ status: 500 },
	);
};

export const notFoundResponse = (): Response =>
	Response.json(
		{ error: { code: "not_found", message: "Route not found" } },
		{ status: 404 },
	);

export { unauthorized };
