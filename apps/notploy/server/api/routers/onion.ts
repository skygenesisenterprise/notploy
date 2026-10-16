import {
	createOnionService,
	findComposeById,
	findOnionServiceById,
	findOnionServicesByComposeId,
	getOnionServiceStatus,
	type OnionServiceWithCompose,
	removeOnionService,
	restartOnionService,
	startOnionService,
	stopOnionService,
	updateOnionServiceDefinition,
} from "@notploy/server";
import { checkServicePermissionAndAccess } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateOnionService,
	apiDeleteOnionService,
	apiFindOnionService,
	apiFindOnionServicesByCompose,
	apiUpdateOnionService,
	type OnionService,
} from "@/server/db/schema";

/**
 * Managed Tor Onion Services for Docker Compose projects.
 *
 * Every procedure is protected and re-validates the caller server-side: the
 * target Compose project must belong to the active organization *and* be
 * reachable by the member, exactly like the Compose endpoints. The response is a
 * narrow DTO — the identity path is exposed so an operator can back it up, but
 * the private key never leaves the host, so it is never part of any payload.
 */

type RouteCtx = {
	user: { id: string };
	session: { activeOrganizationId: string };
};

const assertComposeInActiveOrganization = async (
	ctx: RouteCtx,
	composeId: string,
) => {
	const compose = await findComposeById(composeId);

	if (
		compose.environment.project.organizationId !==
		ctx.session.activeOrganizationId
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this compose",
		});
	}
};

const assertOnionServiceInActiveOrganization = async (
	ctx: RouteCtx,
	onionService: OnionServiceWithCompose,
) => {
	if (
		onionService.compose.environment.project.organizationId !==
		ctx.session.activeOrganizationId
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this Onion Service",
		});
	}
};

const toOnionServiceDto = (onionService: OnionService) => ({
	onionServiceId: onionService.onionServiceId,
	name: onionService.name,
	composeId: onionService.composeId,
	serviceName: onionService.serviceName,
	targetPort: onionService.targetPort,
	virtualPort: onionService.virtualPort,
	onionAddress: onionService.onionAddress,
	identityPath: onionService.identityPath,
	status: onionService.status,
	lastError: onionService.lastError,
	createdAt: onionService.createdAt,
	updatedAt: onionService.updatedAt,
});

export const onionRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateOnionService)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			await assertComposeInActiveOrganization(ctx, input.composeId);

			const onionService = await createOnionService(input);

			await audit(ctx, {
				action: "create",
				resourceType: "onionService",
				resourceId: onionService.onionServiceId,
				resourceName: onionService.name,
				metadata: {
					onionAddress: onionService.onionAddress,
					serviceName: onionService.serviceName,
					targetPort: onionService.targetPort,
				},
			});

			return toOnionServiceDto(onionService);
		}),

	list: protectedProcedure
		.input(apiFindOnionServicesByCompose)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["read"],
			});
			await assertComposeInActiveOrganization(ctx, input.composeId);

			const onionServices = await findOnionServicesByComposeId(input.composeId);

			return onionServices.map(toOnionServiceDto);
		}),

	one: protectedProcedure
		.input(apiFindOnionService)
		.query(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["read"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			return toOnionServiceDto(onionService);
		}),

	/** Live runtime state, read from Docker; never rewrites the resource. */
	status: protectedProcedure
		.input(apiFindOnionService)
		.query(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["read"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			return await getOnionServiceStatus(input.onionServiceId);
		}),

	update: protectedProcedure
		.input(apiUpdateOnionService)
		.mutation(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["create"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			const updated = await updateOnionServiceDefinition(input);

			await audit(ctx, {
				action: "update",
				resourceType: "onionService",
				resourceId: input.onionServiceId,
				resourceName: updated?.name ?? onionService.name,
			});

			return updated ? toOnionServiceDto(updated) : null;
		}),

	start: protectedProcedure
		.input(apiFindOnionService)
		.mutation(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["create"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			const started = await startOnionService(input.onionServiceId);

			await audit(ctx, {
				action: "start",
				resourceType: "onionService",
				resourceId: input.onionServiceId,
				resourceName: onionService.name,
				metadata: { onionAddress: started?.onionAddress },
			});

			return started ? toOnionServiceDto(started) : null;
		}),

	stop: protectedProcedure
		.input(apiFindOnionService)
		.mutation(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["create"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			const stopped = await stopOnionService(input.onionServiceId);

			await audit(ctx, {
				action: "stop",
				resourceType: "onionService",
				resourceId: input.onionServiceId,
				resourceName: onionService.name,
			});

			return stopped ? toOnionServiceDto(stopped) : null;
		}),

	restart: protectedProcedure
		.input(apiFindOnionService)
		.mutation(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["create"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			const restarted = await restartOnionService(input.onionServiceId);

			await audit(ctx, {
				action: "reload",
				resourceType: "onionService",
				resourceId: input.onionServiceId,
				resourceName: onionService.name,
			});

			return restarted ? toOnionServiceDto(restarted) : null;
		}),

	delete: protectedProcedure
		.input(apiDeleteOnionService)
		.mutation(async ({ input, ctx }) => {
			const onionService = await findOnionServiceById(input.onionServiceId);
			await checkServicePermissionAndAccess(ctx, onionService.composeId, {
				service: ["delete"],
			});
			await assertOnionServiceInActiveOrganization(ctx, onionService);

			const deleted = await removeOnionService(input);

			await audit(ctx, {
				action: "delete",
				resourceType: "onionService",
				resourceId: input.onionServiceId,
				resourceName: deleted?.name ?? onionService.name,
				metadata: { deleteIdentity: input.deleteIdentity },
			});

			return true;
		}),
});
