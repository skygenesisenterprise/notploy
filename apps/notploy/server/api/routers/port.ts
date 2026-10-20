import {
	createPort,
	findPortConflict,
	findPortsByApplicationId,
	finPortById,
	removePortById,
	updatePortById,
} from "@notploy/server";
import { checkServicePermissionAndAccess } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreatePort,
	apiFindOnePort,
	apiUpdatePort,
} from "@/server/db/schema";

export const portRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreatePort)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkServicePermissionAndAccess(ctx, input.applicationId, {
					service: ["create"],
				});
				const existingPorts = await findPortsByApplicationId(
					input.applicationId,
				);
				const conflict = findPortConflict(input, existingPorts);
				if (conflict) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: conflict.message,
					});
				}
				const port = await createPort(input);
				await audit(ctx, {
					action: "create",
					resourceType: "port",
					resourceId: port.portId,
					resourceName: `${port.publishedPort}:${port.targetPort}`,
				});
				return port;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error input: Inserting port",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOnePort)
		.query(async ({ input, ctx }) => {
			try {
				const port = await finPortById(input.portId);
				await checkServicePermissionAndAccess(
					ctx,
					port.application.applicationId,
					{ service: ["read"] },
				);
				return port;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Port not found",
					cause: error,
				});
			}
		}),
	delete: protectedProcedure
		.input(apiFindOnePort)
		.mutation(async ({ input, ctx }) => {
			const port = await finPortById(input.portId);
			await checkServicePermissionAndAccess(
				ctx,
				port.application.applicationId,
				{ service: ["delete"] },
			);
			try {
				const result = await removePortById(input.portId);
				await audit(ctx, {
					action: "delete",
					resourceType: "port",
					resourceId: port.portId,
					resourceName: `${port.publishedPort}:${port.targetPort}`,
				});
				return result;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error input: Deleting port";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
	update: protectedProcedure
		.input(apiUpdatePort)
		.mutation(async ({ input, ctx }) => {
			const port = await finPortById(input.portId);
			await checkServicePermissionAndAccess(
				ctx,
				port.application.applicationId,
				{ service: ["create"] },
			);
			try {
				const existingPorts = (
					await findPortsByApplicationId(port.application.applicationId)
				).filter((entry) => entry.portId !== input.portId);
				const conflict = findPortConflict(input, existingPorts);
				if (conflict) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: conflict.message,
					});
				}
				const result = await updatePortById(input.portId, input);
				await audit(ctx, {
					action: "update",
					resourceType: "port",
					resourceId: port.portId,
					resourceName: `${port.publishedPort}:${port.targetPort}`,
				});
				return result;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				const message =
					error instanceof Error ? error.message : "Error updating the port";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
});
