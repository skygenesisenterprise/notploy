import {
	ensureCloudDomainForApplication,
	getCloudDomainBase,
	getCloudDomainForApplication,
	releaseCloudDomain,
	toCloudDomainView,
} from "@notploy/server";
import { checkServicePermissionAndAccess } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { apiFindOneApplication } from "@/server/db/schema";

/**
 * Notploy Cloud generated hostnames (issue #113).
 *
 * Custom domains keep using `domain.*`; this router only exposes the managed
 * `*.notploy.app` allocation: read its status, retry provisioning, release it.
 * Allocation itself happens after a successful deployment.
 */
export const cloudDomainRouter = createTRPCRouter({
	byApplicationId: protectedProcedure
		.input(apiFindOneApplication)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				domain: ["read"],
			});
			return getCloudDomainForApplication(input.applicationId);
		}),
	/**
	 * Allocates the hostname if needed and retries routing/TLS provisioning.
	 * Safe to call repeatedly: an existing hostname is reused, never replaced.
	 */
	ensure: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				domain: ["create"],
			});
			requireCloudDomains();
			const result = await ensureCloudDomainForApplication(input.applicationId);
			await audit(ctx, {
				action: "create",
				resourceType: "cloudDomain",
				resourceId: result.domain?.cloudDomainId ?? input.applicationId,
				resourceName: result.domain?.hostname ?? input.applicationId,
			});
			return result;
		}),
	release: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				domain: ["delete"],
			});
			requireCloudDomains();
			const released = await releaseCloudDomain(input.applicationId);
			if (!released) {
				return null;
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "cloudDomain",
				resourceId: released.cloudDomainId,
				resourceName: released.hostname,
			});
			return toCloudDomainView(released);
		}),
});

const requireCloudDomains = () => {
	if (!getCloudDomainBase()) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Notploy Cloud domains are not enabled on this instance",
		});
	}
};
