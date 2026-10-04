import {
	assertGitProviderAccess,
	findGitProviderById,
	getAccessibleGitProviderIds,
	getGitProviderCommit,
	getGitProviderHealth,
	getGitProviderIdentity,
	getGitProviderRepositoryPermissions,
	listGitProviderBranches,
	listGitProviderDescriptors,
	listGitProviderRepositories,
	removeGitProvider,
	searchGitProviderRepositories,
	updateGitProvider,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { findMemberByUserId } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiFindOneGitProvider,
	apiGetGitProviderCommit,
	apiListGitProviderBranches,
	apiListGitProviderRepositories,
	apiRemoveGitProvider,
	apiSearchGitProviderRepositories,
	apiToggleShareGitProvider,
	gitProvider,
} from "@/server/db/schema";

/**
 * Loads a provider the caller is allowed to use, from the active organization.
 *
 * Using a shared provider is not the same privilege as reading its credentials,
 * but using it does mean the server will clone with them, so it is checked on
 * every generic procedure below.
 */
const requireUsableGitProvider = async (
	ctx: { session: { userId: string; activeOrganizationId: string } },
	gitProviderId: string,
) => {
	const provider = await findGitProviderById(gitProviderId);
	await assertGitProviderAccess(ctx.session, provider);
	return provider;
};

export const gitProviderRouter = createTRPCRouter({
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		if (accessibleIds.size === 0) {
			return [];
		}

		const results = await db.query.gitProvider.findMany({
			with: {
				gitlab: true,
				bitbucket: true,
				github: true,
				gitea: true,
			},
			orderBy: desc(gitProvider.createdAt),
			where: inArray(gitProvider.gitProviderId, [...accessibleIds]),
		});

		return results.map((r) => ({
			...r,
			isOwner: r.userId === ctx.session.userId,
			github: r.github
				? {
						githubId: r.github.githubId,
						githubAppName: r.github.githubAppName,
						githubAppId: r.github.githubAppId,
						githubInstallationId: r.github.githubInstallationId,
						githubUrl: r.github.githubUrl,
						isConfigured: !!(
							r.github.githubPrivateKey &&
							r.github.githubAppId &&
							r.github.githubInstallationId
						),
					}
				: null,
			gitlab: r.gitlab
				? {
						gitlabId: r.gitlab.gitlabId,
						applicationId: r.gitlab.applicationId,
						gitlabUrl: r.gitlab.gitlabUrl,
						isConfigured: !!(r.gitlab.accessToken && r.gitlab.refreshToken),
					}
				: null,
			bitbucket: r.bitbucket
				? {
						bitbucketId: r.bitbucket.bitbucketId,
						bitbucketUsername: r.bitbucket.bitbucketUsername,
						// An API token is the supported credential; an app password
						// still authenticates but is reported as deprecated.
						isConfigured: !!(
							r.bitbucket.apiToken ||
							(r.bitbucket.bitbucketUsername && r.bitbucket.appPassword)
						),
						isDeprecated: !!(r.bitbucket.appPassword && !r.bitbucket.apiToken),
					}
				: null,
			gitea: r.gitea
				? {
						giteaId: r.gitea.giteaId,
						giteaUrl: r.gitea.giteaUrl,
						clientId: r.gitea.clientId,
						isConfigured: !!(r.gitea.accessToken && r.gitea.refreshToken),
					}
				: null,
		}));
	}),

	/**
	 * Health of a connection.
	 *
	 * `connected` means the provider could list repositories, which is the real
	 * precondition for deploying from a source repository — not merely that the
	 * API answered. Each other status carries the message and the remediation to
	 * show next to it.
	 */
	health: withPermission("gitProviders", "read")
		.input(apiFindOneGitProvider)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await getGitProviderHealth(input.gitProviderId);
		}),

	/**
	 * Provider types that can be connected and what each supports, so the page
	 * can explain a provider's limits before one is configured.
	 */
	descriptors: withPermission("gitProviders", "read")
		.meta({ openapi: { enabled: false } })
		.query(() => listGitProviderDescriptors()),

	/** Repositories a connection can deploy from, normalized. */
	repositories: withPermission("gitProviders", "read")
		.input(apiListGitProviderRepositories)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await listGitProviderRepositories(input.gitProviderId, {
				limit: input.limit,
			});
		}),

	/** Repository search, with a client-side fallback for providers without one. */
	searchRepositories: withPermission("gitProviders", "read")
		.input(apiSearchGitProviderRepositories)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await searchGitProviderRepositories(input.gitProviderId, input.q, {
				limit: input.limit,
			});
		}),

	/** Branches of a repository, normalized. */
	branches: withPermission("gitProviders", "read")
		.input(apiListGitProviderBranches)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await listGitProviderBranches(
				input.gitProviderId,
				input.repository,
			);
		}),

	/** Resolves a branch, tag or short sha to the commit that would be built. */
	commit: withPermission("gitProviders", "read")
		.input(apiGetGitProviderCommit)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await getGitProviderCommit(
				input.gitProviderId,
				input.repository,
				input.ref,
			);
		}),

	/** Account the connection acts as. */
	identity: withPermission("gitProviders", "read")
		.input(apiFindOneGitProvider)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await getGitProviderIdentity(input.gitProviderId);
		}),

	/** Whether the connection may read / write a repository. */
	repositoryPermissions: withPermission("gitProviders", "read")
		.input(apiListGitProviderBranches)
		.meta({ openapi: { enabled: false } })
		.query(async ({ ctx, input }) => {
			await requireUsableGitProvider(ctx, input.gitProviderId);
			return await getGitProviderRepositoryPermissions(
				input.gitProviderId,
				input.repository,
			);
		}),

	toggleShare: protectedProcedure
		.input(apiToggleShareGitProvider)
		.mutation(async ({ input, ctx }) => {
			const provider = await findGitProviderById(input.gitProviderId);

			if (
				provider.userId !== ctx.session.userId ||
				provider.organizationId !== ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Only the owner can share this provider",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: provider.gitProviderId,
				resourceName: provider.name ?? provider.gitProviderId,
			});

			return await updateGitProvider(input.gitProviderId, {
				sharedWithOrganization: input.sharedWithOrganization,
			});
		}),

	allForPermissions: withPermission("member", "update").query(async ({ ctx }) => {
			return await db.query.gitProvider.findMany({
				columns: {
					gitProviderId: true,
					name: true,
					providerType: true,
				},
				orderBy: desc(gitProvider.createdAt),
				where: eq(gitProvider.organizationId, ctx.session.activeOrganizationId),
			});
		}),

	remove: withPermission("gitProviders", "delete")
		.input(apiRemoveGitProvider)
		.mutation(async ({ input, ctx }) => {
			try {
				const gitProvider = await findGitProviderById(input.gitProviderId);

				if (gitProvider.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not allowed to delete this Git provider",
					});
				}

				const memberRecord = await findMemberByUserId(
					ctx.user.id,
					ctx.session.activeOrganizationId,
				);
				const isPrivileged =
					memberRecord.role === "owner" || memberRecord.role === "admin";
				if (!isPrivileged && gitProvider.userId !== ctx.session.userId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You can only delete your own Git providers",
					});
				}
				await audit(ctx, {
					action: "delete",
					resourceType: "gitProvider",
					resourceId: gitProvider.gitProviderId,
					resourceName: gitProvider.name ?? gitProvider.gitProviderId,
				});
				return await removeGitProvider(input.gitProviderId);
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Error deleting this Git provider";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
});
