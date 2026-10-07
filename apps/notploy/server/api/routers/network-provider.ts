import {
	createNetworkProvider,
	findNetworkProviderInOrganization,
	findNetworkProvidersByOrganizationId,
	getNetworkProviderHealth,
	listNetworkProviderDescriptors,
	listNetworkProviderPeers,
	maskNetworkProviderConfig,
	mergeNetworkProviderConfig,
	removeNetworkProvider,
	testNetworkProviderConnection,
	updateNetworkProvider,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateNetworkProvider,
	apiFindOneNetworkProvider,
	apiRemoveNetworkProvider,
	apiTestNetworkProvider,
	apiUpdateNetworkProvider,
} from "@/server/db/schema";
import { createTRPCRouter, withPermission } from "../trpc";

export const networkProviderRouter = createTRPCRouter({
	create: withPermission("networkProvider", "create")
		.input(apiCreateNetworkProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await createNetworkProvider(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "networkProvider",
				resourceId: provider.networkProviderId,
				resourceName: provider.name,
			});
			return {
				...provider,
				config: maskNetworkProviderConfig(provider.config),
			};
		}),

	update: withPermission("networkProvider", "update")
		.input(apiUpdateNetworkProvider)
		.mutation(async ({ ctx, input }) => {
			await findNetworkProviderInOrganization(
				input.networkProviderId,
				ctx.session.activeOrganizationId,
			);
			const updated = await updateNetworkProvider(
				input.networkProviderId,
				input.name,
				input.config,
				input.peers,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "networkProvider",
				resourceId: updated.networkProviderId,
				resourceName: updated.name,
			});
			return { ...updated, config: maskNetworkProviderConfig(updated.config) };
		}),

	remove: withPermission("networkProvider", "delete")
		.input(apiRemoveNetworkProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await findNetworkProviderInOrganization(
				input.networkProviderId,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "networkProvider",
				resourceId: provider.networkProviderId,
				resourceName: provider.name,
			});
			await removeNetworkProvider(input.networkProviderId);
			return true;
		}),

	all: withPermission("networkProvider", "read").query(async ({ ctx }) => {
		const providers = await findNetworkProvidersByOrganizationId(
			ctx.session.activeOrganizationId,
		);
		return providers.map((provider) => ({
			...provider,
			config: maskNetworkProviderConfig(provider.config),
		}));
	}),

	one: withPermission("networkProvider", "read")
		.input(apiFindOneNetworkProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findNetworkProviderInOrganization(
				input.networkProviderId,
				ctx.session.activeOrganizationId,
			);
			const peers = await listNetworkProviderPeers(provider.networkProviderId);
			return {
				...provider,
				config: maskNetworkProviderConfig(provider.config),
				peers,
			};
		}),

	peers: withPermission("networkProvider", "read")
		.input(apiFindOneNetworkProvider)
		.query(async ({ ctx, input }) => {
			await findNetworkProviderInOrganization(
				input.networkProviderId,
				ctx.session.activeOrganizationId,
			);
			return listNetworkProviderPeers(input.networkProviderId);
		}),

	testConnection: withPermission("networkProvider", "create")
		.input(apiTestNetworkProvider)
		.mutation(async ({ ctx, input }) => {
			if (!input.config && !input.networkProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Provide a config or a networkProviderId to test",
				});
			}

			let config = input.config;
			if (input.networkProviderId) {
				const provider = await findNetworkProviderInOrganization(
					input.networkProviderId,
					ctx.session.activeOrganizationId,
				);
				config = config
					? mergeNetworkProviderConfig(config, provider.config)
					: provider.config;
			}

			await testNetworkProviderConnection(config!);
			return true;
		}),

	descriptors: withPermission("networkProvider", "read").query(() =>
		listNetworkProviderDescriptors(),
	),

	health: withPermission("networkProvider", "read")
		.input(apiFindOneNetworkProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findNetworkProviderInOrganization(
				input.networkProviderId,
				ctx.session.activeOrganizationId,
			);
			const peers = await listNetworkProviderPeers(provider.networkProviderId);
			return await getNetworkProviderHealth(provider.config, peers.length);
		}),
});
