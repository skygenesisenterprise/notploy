import { getAuditLogs } from "@notploy/server/services/proprietary/audit-log";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "../../trpc";

export const auditLogRouter = createTRPCRouter({
	all: withPermission("auditLog", "read")
		.input(
			z.object({
				search: z.string().trim().max(200).optional(),
				userId: z.string().optional(),
				userEmail: z.string().optional(),
				resourceName: z.string().optional(),
				action: z
					.enum([
						"create",
						"update",
						"delete",
						"deploy",
						"cancel",
						"redeploy",
						"login",
						"logout",
						"restore",
						"run",
						"start",
						"stop",
						"reload",
						"rebuild",
						"move",
					])
					.optional(),
				resourceType: z
					.enum([
						"project",
						"service",
						"environment",
						"deployment",
						"user",
						"customRole",
						"domain",
						"certificate",
						"registry",
						"server",
						"sshKey",
						"gitProvider",
						"destination",
						"notification",
						"settings",
						"session",
						"port",
						"redirect",
						"security",
						"schedule",
						"backup",
						"volumeBackup",
						"docker",
						"swarm",
						"previewDeployment",
						"organization",
						"cluster",
						"mount",
						"application",
						"compose",
						"network",
						"vaultProvider",
						"dnsProvider",
					])
					.optional(),
				from: z.date().optional(),
				to: z.date().optional(),
				sortOrder: z.enum(["asc", "desc"]).default("desc"),
				limit: z.number().min(1).max(500).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			return getAuditLogs({
				organizationId: ctx.session.activeOrganizationId,
				...input,
			});
		}),
});
