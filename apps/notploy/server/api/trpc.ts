/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

// import { getServerAuthSession } from "@/server/auth";
import { db } from "@notploy/server/db";
import type { statements } from "@notploy/server/lib/access-control";
import {
	type CicdAction,
	type CicdTokenScope,
	cicdScopeAllows,
	parseCicdTokenScope,
} from "@notploy/server/lib/cicd-scope";
import { validateRequest, type RequestApiKey } from "@notploy/server/lib/auth";
import { checkPermission } from "@notploy/server/services/permission";
import type { OpenApiMeta } from "@notploy/trpc-openapi";
import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { Session, User } from "better-auth";
import superjson from "superjson";
import { ZodError } from "zod";

type Resource = keyof typeof statements;
type ActionOf<R extends Resource> = (typeof statements)[R][number];

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateContextOptions {
	user:
		| (User & {
				role: "member" | "admin" | "owner";
				ownerId: string;
		  })
		| null;
	session:
		| (Session & { activeOrganizationId: string; impersonatedBy?: string })
		| null;
	req: CreateNextContextOptions["req"];
	res: CreateNextContextOptions["res"];
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so you don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where you don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
const createInnerTRPCContext = (opts: CreateContextOptions) => {
	return {
		session: opts.session,
		db,
		req: opts.req,
		res: opts.res,
		user: opts.user,
	};
};

/**
 * Context every procedure receives.
 *
 * `apiKey` is set only when the request authenticated with an API key. It is
 * optional rather than nullable so the server-side helpers of the pages, which
 * build a context by hand, don't have to know about credentials at all.
 */
type TRPCContext = ReturnType<typeof createInnerTRPCContext> & {
	/**
	 * The API key that authenticated the request, when one did. The CI/CD API
	 * needs it to know which credential was used and what it may do; dashboard
	 * requests authenticated with a cookie leave it undefined.
	 */
	apiKey?: RequestApiKey | undefined;
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
	const { req, res } = opts;

	// Get from the request
	const { session, user, apiKey } = await validateRequest(req);

	return {
		...createInnerTRPCContext({
			req,
			res,
			// @ts-ignore
			session: session
				? {
						...session,
						activeOrganizationId: session.activeOrganizationId || "",
					}
				: null,
			// @ts-ignore
			user: user
				? {
						...user,
						email: user.email,
						role: user.role as "owner" | "member" | "admin",
						id: user.id,
						ownerId: user.ownerId,
					}
				: null,
		}),
		apiKey,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get type safety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC
	.meta<OpenApiMeta>()
	.context<TRPCContext>()
	.create({
		transformer: superjson,
		errorFormatter({ shape, error }) {
			return {
				...shape,
				data: {
					...shape.data,
					zodError:
						error.cause instanceof ZodError ? error.cause.flatten() : null,
				},
			};
		},
	});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session || !ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

export const cliProcedure = t.procedure.use(({ ctx, next }) => {
	if (
		!ctx.session ||
		!ctx.user ||
		(ctx.user.role !== "owner" && ctx.user.role !== "admin")
	) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
	if (
		!ctx.session ||
		!ctx.user ||
		(ctx.user.role !== "owner" && ctx.user.role !== "admin")
	) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

/**
 * Permission-checked procedure factory.
 *
 * Verifies the caller has the required resource+action permission before the
 * handler runs. Works for all role types:
 * - owner / admin  → always granted (static roles)
 * - member         → legacy boolean fields
 * - custom role    → permissions stored on the organization role
 *
 * Usage:
 *   create: withPermission("project", "create")
 *     .input(...)
 *     .mutation(async ({ ctx, input }) => { ... })
 */
export const withPermission = <R extends Resource>(
	resource: R,
	action: ActionOf<R>,
) =>
	protectedProcedure.use(async ({ ctx, next }) => {
		await checkPermission(ctx, { [resource]: [action] } as any);
		return next();
	});

/**
 * CI/CD API procedure.
 *
 * The CI/CD API is a machine-to-machine surface, so it deliberately does not
 * accept a dashboard session: a workflow must present an API key that carries a
 * CI/CD scope (see `parseCicdTokenScope`). That keeps every automated
 * deployment attributable to a revocable, rotatable credential instead of a
 * long-lived session, and it means a leaked session cookie cannot be used to
 * drive deployments.
 *
 * The scope itself is only *parsed* here; `withCicdAction` checks the action and
 * `assertCicdTarget` checks the project/environment/application, so a handler
 * always runs after its access rules have been evaluated.
 */
export const cicdProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.apiKey) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message:
				"This endpoint requires a Notploy CI/CD API token. Send it as `x-api-key` or `Authorization: Bearer <token>`.",
		});
	}

	const scope = parseCicdTokenScope(ctx.apiKey.metadata);
	if (!scope) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"This API key is not a CI/CD token. Create one from the project's CI/CD page.",
		});
	}

	if (!ctx.session || !ctx.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "The CI/CD token is not valid for any organization",
		});
	}

	return next({
		ctx: {
			session: ctx.session,
			user: ctx.user,
			cicd: {
				apiKeyId: ctx.apiKey.id,
				scope,
			} satisfies { apiKeyId: string; scope: CicdTokenScope },
		},
	});
});

/**
 * Restricts a `cicdProcedure` to a single action of the token scope.
 *
 * Usage:
 *   deploy: withCicdAction("deploy").input(...).mutation(...)
 */
export const withCicdAction = (action: CicdAction) =>
	cicdProcedure.use(({ ctx, next }) => {
		if (!cicdScopeAllows(ctx.cicd.scope, action)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `This CI/CD token is not allowed to ${action}`,
			});
		}
		return next();
	});
