import type { AuditResourceType } from "@notploy/server/db/schema";
import { ProjectQuotaExceededError } from "@notploy/server/services/project-quota";
import { audit } from "./audit";

interface QuotaAuditCtx {
	user: { id: string; email: string; role: string };
	session: { activeOrganizationId: string };
}

/**
 * Runs a mutation and records an audit entry when it is refused because a
 * project resource quota would be exceeded. The original error (already a
 * `TRPCError` with `PRECONDITION_FAILED`) is rethrown so the client receives
 * the explicit refusal message.
 */
export const withQuotaAudit = async <T>(
	ctx: QuotaAuditCtx,
	resource: {
		type: AuditResourceType;
		id?: string;
		name?: string;
	},
	run: () => Promise<T>,
): Promise<T> => {
	try {
		return await run();
	} catch (error) {
		if (error instanceof ProjectQuotaExceededError) {
			await audit(ctx, {
				action: "quotaExceeded",
				resourceType: resource.type,
				resourceId: resource.id ?? error.serviceId,
				resourceName: resource.name,
				metadata: error.auditMetadata,
			});
		}
		throw error;
	}
};
