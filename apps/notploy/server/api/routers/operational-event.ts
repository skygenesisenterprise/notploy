import { db } from "@notploy/server/db";
import { operationalEvents } from "@notploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import {
	and,
	count,
	desc,
	eq,
	gt,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const operationalEventRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const organizationId = ctx.session.activeOrganizationId;
		const recentSince = new Date(
			Date.now() - 14 * 24 * 60 * 60 * 1000,
		).toISOString();
		const activeActionFilter = and(
			eq(operationalEvents.organizationId, organizationId),
			eq(operationalEvents.requiresAction, true),
			isNull(operationalEvents.acknowledgedAt),
			isNull(operationalEvents.resolvedAt),
		);

		const [actionRequired, [actionCount], recent] = await Promise.all([
			db.query.operationalEvents.findMany({
				where: activeActionFilter,
				orderBy: [
					sql`CASE ${operationalEvents.severity}
						WHEN 'critical' THEN 0
						WHEN 'warning' THEN 1
						WHEN 'info' THEN 2
						ELSE 3
					END`,
					desc(operationalEvents.lastSeenAt),
				],
			}),
			db
				.select({ count: count() })
				.from(operationalEvents)
				.where(activeActionFilter),
			db.query.operationalEvents.findMany({
				where: and(
					eq(operationalEvents.organizationId, organizationId),
					gt(operationalEvents.lastSeenAt, recentSince),
					or(
						eq(operationalEvents.requiresAction, false),
						isNotNull(operationalEvents.acknowledgedAt),
						isNotNull(operationalEvents.resolvedAt),
					),
				),
				orderBy: desc(operationalEvents.lastSeenAt),
				limit: 25,
			}),
		]);

		return {
			actionRequired,
			actionCount: actionCount?.count ?? 0,
			recent,
		};
	}),
	acknowledge: protectedProcedure
		.input(z.object({ eventId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [event] = await db
				.update(operationalEvents)
				.set({
					acknowledgedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.where(
					and(
						eq(operationalEvents.eventId, input.eventId),
						eq(
							operationalEvents.organizationId,
							ctx.session.activeOrganizationId,
						),
						eq(operationalEvents.requiresAction, true),
						isNull(operationalEvents.resolvedAt),
					),
				)
				.returning({ eventId: operationalEvents.eventId });

			if (!event) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Operational event not found or already resolved",
				});
			}

			return event;
		}),
});
