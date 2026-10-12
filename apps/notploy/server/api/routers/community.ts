import {
	CommunityServiceError,
	createCommunitySource,
	getCommunityHealthReport,
	getCommunityOverview,
	listCommunityActivity,
	listCommunityAttention,
	listCommunityReleases,
	listCommunityRepositories,
	listCommunitySources,
	listGithubInstallationRepositories,
	removeCommunitySource,
	resolveCommunityRange,
	syncCommunitySource,
	trackCommunityRepository,
	untrackCommunityRepository,
	updateCommunitySource,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";

/**
 * Community Console API.
 *
 * Reads are served from the projection the sync writes, never by calling GitHub
 * per request: the browser never sees a token, and a slow GitHub cannot slow the
 * page. Writes manage the followed sources and the tracked repositories, and are
 * gated behind the `community` resource so a member without it is refused before
 * anything runs.
 */

const rangeInput = z.object({
	preset: z.enum(["24h", "7d", "30d", "90d", "custom"]).default("30d"),
	from: z.string().min(1).optional(),
	to: z.string().min(1).optional(),
});

const eventTypeInput = z.enum([
	"issue-opened",
	"issue-closed",
	"pull-request-opened",
	"pull-request-review",
	"pull-request-merged",
	"pull-request-closed",
	"release-published",
	"repository-activity",
	"other",
]);

const repositoryScope = z
	.array(z.string().min(1))
	.max(50)
	.optional();

const readProcedure = withPermission("community", "read");
const writeProcedure = withPermission("community", "write");

/** Turn service-level failures into the tRPC codes the UI reacts to. */
const mapCommunityError = (error: unknown): never => {
	if (error instanceof CommunityServiceError) {
		switch (error.code) {
			case "SOURCE_NOT_FOUND":
			case "REPOSITORY_NOT_FOUND":
				throw new TRPCError({ code: "NOT_FOUND", message: error.message });
			case "SOURCE_EXISTS":
			case "REPOSITORY_EXISTS":
				throw new TRPCError({ code: "CONFLICT", message: error.message });
			case "SOURCE_INVALID":
			case "REPOSITORY_INVALID":
				throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
			case "PROVIDER_UNSUPPORTED":
				throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
			case "GITHUB_UNAUTHORIZED":
				throw new TRPCError({ code: "FORBIDDEN", message: error.message });
			case "RATE_LIMITED":
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: error.message,
				});
			default:
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error.message,
				});
		}
	}
	throw error;
};

export const communityRouter = createTRPCRouter({
	/** Followed sources, with their last sync state. */
	sources: readProcedure.query(async ({ ctx }) => {
		return await listCommunitySources(ctx.session.activeOrganizationId);
	}),

	/** Metrics of the selected period. No invented period-over-period change. */
	overview: readProcedure
		.input(rangeInput.extend({ repositoryIds: repositoryScope }))
		.query(async ({ ctx, input }) => {
			try {
				return await getCommunityOverview({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveCommunityRange(input),
				});
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	/** Tracked repositories, with their metadata and health profile. */
	repositories: readProcedure
		.input(
			z.object({
				sourceId: z.string().min(1).optional(),
				search: z.string().trim().max(120).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await listCommunityRepositories({
				organizationId: ctx.session.activeOrganizationId,
				sourceId: input.sourceId,
				search: input.search,
			});
		}),

	/** Contributions flagged by the explicit attention rules. */
	attention: readProcedure
		.input(
			z.object({
				repositoryIds: repositoryScope,
				limit: z.number().int().min(1).max(200).default(50),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await listCommunityAttention({
				organizationId: ctx.session.activeOrganizationId,
				repositoryIds: input.repositoryIds,
				limit: input.limit,
			});
		}),

	/** Chronological feed, filtered and paginated server-side. */
	activity: readProcedure
		.input(
			rangeInput.extend({
				repositoryIds: repositoryScope,
				types: z.array(eventTypeInput).max(9).optional(),
				limit: z.number().int().min(1).max(100).default(30),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				return await listCommunityActivity({
					organizationId: ctx.session.activeOrganizationId,
					range: resolveCommunityRange(input),
					repositoryIds: input.repositoryIds,
					types: input.types,
					limit: input.limit,
					offset: input.offset,
				});
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	/** Latest published releases across the tracked repositories. */
	releases: readProcedure
		.input(
			z.object({
				repositoryIds: repositoryScope,
				limit: z.number().int().min(1).max(50).default(10),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await listCommunityReleases({
				organizationId: ctx.session.activeOrganizationId,
				repositoryIds: input.repositoryIds,
				limit: input.limit,
			});
		}),

	/** Ecosystem-health hints: which contribution resources are present. */
	health: readProcedure
		.input(z.object({ repositoryIds: repositoryScope }))
		.query(async ({ ctx, input }) => {
			return await getCommunityHealthReport({
				organizationId: ctx.session.activeOrganizationId,
				repositoryIds: input.repositoryIds,
			});
		}),

	/** Repositories the connection can see, so a tracking choice is informed. */
	availableRepositories: readProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			try {
				return await listGithubInstallationRepositories(
					ctx.session.activeOrganizationId,
					input.sourceId,
				);
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	createSource: writeProcedure
		.input(
			z.object({
				gitProviderId: z.string().min(1),
				owner: z.string().trim().min(1).max(39),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const source = await createCommunitySource({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				await audit(ctx, {
					action: "create",
					resourceType: "communitySource",
					resourceId: source.id,
					resourceName: source.owner,
				});
				return { id: source.id, owner: source.owner };
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	updateSource: writeProcedure
		.input(
			z.object({
				sourceId: z.string().min(1),
				enabled: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const source = await updateCommunitySource({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				await audit(ctx, {
					action: "update",
					resourceType: "communitySource",
					resourceId: input.sourceId,
					resourceName: source?.owner ?? input.sourceId,
				});
				return { id: source?.id, enabled: source?.enabled };
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	removeSource: writeProcedure
		.input(z.object({ sourceId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await removeCommunitySource(
					ctx.session.activeOrganizationId,
					input.sourceId,
				);
				await audit(ctx, {
					action: "delete",
					resourceType: "communitySource",
					resourceId: input.sourceId,
				});
				return result;
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	trackRepository: writeProcedure
		.input(
			z.object({
				sourceId: z.string().min(1),
				fullName: z.string().trim().min(3).max(140),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const repository = await trackCommunityRepository({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
				await audit(ctx, {
					action: "create",
					resourceType: "communityRepository",
					resourceId: repository.id,
					resourceName: repository.fullName,
				});
				return { id: repository.id, fullName: repository.fullName };
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	untrackRepository: writeProcedure
		.input(z.object({ repositoryId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await untrackCommunityRepository(
					ctx.session.activeOrganizationId,
					input.repositoryId,
				);
				await audit(ctx, {
					action: "delete",
					resourceType: "communityRepository",
					resourceId: input.repositoryId,
				});
				return result;
			} catch (error) {
				return mapCommunityError(error);
			}
		}),

	/** Refresh the cache from GitHub, now. */
	syncNow: writeProcedure
		.input(
			z.object({
				sourceId: z.string().min(1),
				repositoryId: z.string().min(1).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await syncCommunitySource({
					organizationId: ctx.session.activeOrganizationId,
					...input,
				});
			} catch (error) {
				return mapCommunityError(error);
			}
		}),
});
