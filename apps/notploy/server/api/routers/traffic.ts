import {
	createTrafficProperty,
	declareRecommendedProperties,
	deleteTrafficProperty,
	ingestTraefikAccessLog,
	listTrafficProperties,
	TrafficServiceError,
	updateTrafficProperty,
	upsertTrafficSource,
} from "@notploy/server";
import {
	getAudienceReport,
	getHttpReport,
	getTrafficOverview,
	getTrafficSourceHealth,
	getTrafficTimeseries,
	listTrafficPlatforms,
	resolveTrafficRange,
	TrafficRangeError,
} from "@notploy/server/services/traffic-analytics";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "../trpc";

/**
 * Traffic Manager API.
 *
 * Reads are served by the aggregation service (server-side `SUM`/`GROUP BY`,
 * never the browser iterating over events); writes are limited to declaring the
 * watched properties, configuring their collection sources and triggering a
 * collection run. Every procedure is permission-checked against the `traffic`
 * resource, so a member without it is refused instead of silently reading.
 */

const rangeInput = z.object({
	preset: z.enum(["1h", "24h", "7d", "30d", "custom"]).default("24h"),
	/** ISO 8601, required with the `custom` preset. */
	from: z.string().min(1).optional(),
	to: z.string().min(1).optional(),
});

const filterInput = z.object({
	/** Restrict to specific web properties (the domain selector). */
	propertyIds: z.array(z.string().min(1)).max(50).optional(),
	/** Restrict to a platform; an empty value means every platform. */
	platform: z.string().min(1).max(64).optional(),
});

const readProcedure = withPermission("traffic", "read");
const writeProcedure = withPermission("traffic", "write");

/** Turn service-level failures into the tRPC codes the UI reacts to. */
const mapTrafficError = (error: unknown): never => {
	if (error instanceof TrafficServiceError) {
		switch (error.code) {
			case "PROPERTY_NOT_FOUND":
				throw new TRPCError({ code: "NOT_FOUND", message: error.message });
			case "PROPERTY_DOMAIN_EXISTS":
				throw new TRPCError({ code: "CONFLICT", message: error.message });
			case "PROPERTY_DOMAIN_INVALID":
			case "ORIGIN_NOT_ALLOWED":
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error.message,
				});
			case "SOURCE_DISABLED":
			case "AUDIENCE_INGEST_DISABLED":
				throw new TRPCError({ code: "FORBIDDEN", message: error.message });
			default:
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error.message,
				});
		}
	}
	if (error instanceof TrafficRangeError) {
		throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
	}
	throw error;
};

export const trafficRouter = createTRPCRouter({
	/** Summary of the selected period, with comparison and availability states. */
	overview: readProcedure
		.input(
			rangeInput.extend({
				...filterInput.shape,
				compare: z.boolean().default(false),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				return await getTrafficOverview({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveTrafficRange(input),
					propertyIds: input.propertyIds,
					platform: input.platform,
					compare: input.compare,
				});
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** Requests / errors / page views / sessions / visitors over time. */
	timeseries: readProcedure
		.input(
			rangeInput.extend({
				...filterInput.shape,
				includeHttp: z.boolean().default(true),
				includeAudience: z.boolean().default(true),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				return await getTrafficTimeseries({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveTrafficRange(input),
					propertyIds: input.propertyIds,
					platform: input.platform,
					includeHttp: input.includeHttp,
					includeAudience: input.includeAudience,
				});
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** HTTP observability: status classes, domains, busiest and failing routes. */
	http: readProcedure
		.input(
			rangeInput.extend({
				...filterInput.shape,
				limit: z.number().int().min(1).max(50).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				return await getHttpReport({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveTrafficRange(input),
					propertyIds: input.propertyIds,
					platform: input.platform,
					limit: input.limit,
				});
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** Audience analytics: pages, referrers, devices, instrumented events. */
	audience: readProcedure
		.input(
			rangeInput.extend({
				...filterInput.shape,
				limit: z.number().int().min(1).max(50).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				return await getAudienceReport({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveTrafficRange(input),
					propertyIds: input.propertyIds,
					platform: input.platform,
					limit: input.limit,
				});
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** Watched properties and the health of each of their collection sources. */
	properties: readProcedure.query(async ({ ctx }) => {
		const organizationId = ctx.session.activeOrganizationId;
		const [properties, health, platforms] = await Promise.all([
			listTrafficProperties(organizationId),
			getTrafficSourceHealth({ organizationId }),
			listTrafficPlatforms(organizationId),
		]);
		return {
			properties: properties.map((property) => ({
				id: property.id,
				platform: property.platform,
				name: property.name,
				domain: property.domain,
				enabled: property.enabled,
				matchesSubdomains: property.matchesSubdomains,
			})),
			health,
			platforms,
		};
	}),

	/** Declare a watched domain and its first collection source. */
	createProperty: writeProcedure
		.input(
			z.object({
				platform: z.string().min(1).max(64),
				name: z.string().min(1).max(120).optional(),
				domain: z.string().min(3).max(253),
				matchesSubdomains: z.boolean().default(true),
				sourceType: z
					.enum(["traefik", "web-instrumentation", "external"])
					.default("traefik"),
				logPath: z.string().max(512).optional(),
				allowedOrigins: z.array(z.string().max(253)).max(20).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const property = await createTrafficProperty({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				return { id: property.id, domain: property.domain };
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	updateProperty: writeProcedure
		.input(
			z.object({
				propertyId: z.string().min(1),
				name: z.string().min(1).max(120).optional(),
				platform: z.string().min(1).max(64).optional(),
				matchesSubdomains: z.boolean().optional(),
				enabled: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const property = await updateTrafficProperty({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				return { id: property.id, enabled: property.enabled };
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	deleteProperty: writeProcedure
		.input(z.object({ propertyId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				await deleteTrafficProperty(
					ctx.session.activeOrganizationId,
					input.propertyId,
				);
				return { deleted: true };
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** Configure one source of a property (enable, log path, allowed origins). */
	upsertSource: writeProcedure
		.input(
			z.object({
				propertyId: z.string().min(1),
				type: z.enum(["traefik", "web-instrumentation", "external"]),
				enabled: z.boolean().optional(),
				logPath: z.string().max(512).nullable().optional(),
				allowedOrigins: z
					.array(z.string().max(253))
					.max(20)
					.nullable()
					.optional(),
				rotatePublicKey: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const source = await upsertTrafficSource({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				return {
					id: source.id,
					type: source.type,
					enabled: source.enabled,
					publicKey: source.publicKey,
				};
			} catch (error) {
				return mapTrafficError(error);
			}
		}),

	/** Declare the recommended SGE properties (idempotent). */
	declareRecommended: writeProcedure.mutation(async ({ ctx }) => {
		try {
			return await declareRecommendedProperties(
				ctx.session.activeOrganizationId,
			);
		} catch (error) {
			return mapTrafficError(error);
		}
	}),

	/**
	 * Read the reverse proxy log right now instead of waiting for the scheduled
	 * run. Bounded by the same per-run budget, and safe to call concurrently:
	 * the cursor makes the run incremental and the write is transactional.
	 */
	collectNow: writeProcedure.mutation(async ({ ctx }) => {
		try {
			return await ingestTraefikAccessLog({
				organizationId: ctx.session.activeOrganizationId,
			});
		} catch (error) {
			return mapTrafficError(error);
		}
	}),
});
