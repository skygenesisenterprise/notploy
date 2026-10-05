import {
	createVaultProvider,
	createVaultSecret,
	findVaultProviderInOrganization,
	findVaultProvidersByOrganizationId,
	getVaultProviderHealth,
	isVaultProviderAssigned,
	listVaultProviderDescriptors,
	listVaultProviderSecretNames,
	listVaultProviderSecretRecords,
	listVaultSecretsForProvider,
	maskVaultProviderConfig,
	mergeVaultProviderConfig,
	removeVaultProvider,
	removeVaultSecret,
	testVaultProviderConnection,
	updateVaultProvider,
	updateVaultSecret,
	type VaultSecretRecord,
} from "@notploy/server";
import { findMemberByUserId } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateVaultProvider,
	apiCreateVaultSecret,
	apiFindOneVaultProvider,
	apiListVaultSecretNames,
	apiRemoveVaultProvider,
	apiRemoveVaultSecret,
	apiTestVaultProvider,
	apiUpdateVaultProvider,
	apiUpdateVaultSecret,
} from "@/server/db/schema";
import { createTRPCRouter, withPermission } from "../trpc";

export const vaultProviderRouter = createTRPCRouter({
	create: withPermission("vaultProvider", "create")
		.input(apiCreateVaultProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await createVaultProvider(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "vaultProvider",
				resourceId: provider.vaultProviderId,
				resourceName: provider.name,
			});
			return { ...provider, config: maskVaultProviderConfig(provider.config) };
		}),

	update: withPermission("vaultProvider", "update")
		.input(apiUpdateVaultProvider)
		.mutation(async ({ ctx, input }) => {
			await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);
			const updated = await updateVaultProvider(
				input.vaultProviderId,
				input.name,
				input.config,
				input.assignments,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "vaultProvider",
				resourceId: updated.vaultProviderId,
				resourceName: updated.name,
			});
			return { ...updated, config: maskVaultProviderConfig(updated.config) };
		}),

	remove: withPermission("vaultProvider", "delete")
		.input(apiRemoveVaultProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "vaultProvider",
				resourceId: provider.vaultProviderId,
				resourceName: provider.name,
			});
			await removeVaultProvider(input.vaultProviderId);
			return true;
		}),

	all: withPermission("vaultProvider", "read").query(async ({ ctx }) => {
		const providers = await findVaultProvidersByOrganizationId(
			ctx.session.activeOrganizationId,
		);
		return providers.map((provider) => ({
			...provider,
			config: maskVaultProviderConfig(provider.config),
		}));
	}),

	one: withPermission("vaultProvider", "read")
		.input(apiFindOneVaultProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);
			return { ...provider, config: maskVaultProviderConfig(provider.config) };
		}),

	testConnection: withPermission("vaultProvider", "create")
		.input(apiTestVaultProvider)
		.mutation(async ({ ctx, input }) => {
			if (!input.config && !input.vaultProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Provide a config or a vaultProviderId to test",
				});
			}

			let config = input.config;
			if (input.vaultProviderId) {
				const provider = await findVaultProviderInOrganization(
					input.vaultProviderId,
					ctx.session.activeOrganizationId,
				);
				config = config
					? mergeVaultProviderConfig(config, provider.config)
					: provider.config;
			}

			await testVaultProviderConnection(config!);
			return true;
		}),

	listSecretNames: withPermission("vaultProvider", "read")
		.input(apiListVaultSecretNames)
		.query(async ({ ctx, input }) => {
			const provider = await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);

			if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
				const { accessedProjects } = await findMemberByUserId(
					ctx.user.id,
					ctx.session.activeOrganizationId,
				);
				if (!accessedProjects.includes(input.projectId)) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this project",
					});
				}
			}

			if (
				!isVaultProviderAssigned(
					provider.assignments,
					input.projectId,
					input.environmentId,
				)
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"This vault provider is not enabled for the given project/environment",
				});
			}	return await listVaultProviderSecretNames(provider.config);
	}),

	/**
	 * Capability matrix for every provider type, so the Console can show what a
	 * provider supports before it is connected.
	 */
	descriptors: withPermission("vaultProvider", "read").query(() =>
		listVaultProviderDescriptors(),
	),

	health: withPermission("vaultProvider", "read")
		.input(apiFindOneVaultProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);
			return await getVaultProviderHealth(provider.config);
		}),

	/**
	 * Secret records (name, source and resolvability) for a connected provider,
	 * combining the provider adapter's secrets with the ones Notploy manages.
	 * Values are never returned, and the read is auditable.
	 */
	listSecrets: withPermission("vaultProvider", "read")
		.input(apiFindOneVaultProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findVaultProviderInOrganization(
				input.vaultProviderId,
				ctx.session.activeOrganizationId,
			);
			const managed = await listVaultSecretsForProvider(
				provider.vaultProviderId,
			);
			const managedRecords: VaultSecretRecord[] = managed.map((secret) => ({
				id: secret.vaultSecretId,
				name: secret.name,
				source: "Notploy",
				resolvable: true,
				managed: true,
				...(secret.description ? { detail: secret.description } : {}),
			}));

			// A broken adapter must not hide the secrets Notploy stores itself.
			let external: VaultSecretRecord[] = [];
			try {
				external = await listVaultProviderSecretRecords(provider.config);
			} catch {
				external = [];
			}

			const byName = new Map(external.map((record) => [record.name, record]));
			for (const record of managedRecords) {
				byName.set(record.name, record);
			}
			const secrets = [...byName.values()].sort((a, b) =>
				a.name.localeCompare(b.name),
			);

			await audit(ctx, {
				action: "read",
				resourceType: "vaultProvider",
				resourceId: provider.vaultProviderId,
				resourceName: provider.name,
			});
			return {
				secrets,
				secretNames: secrets.map((secret) => secret.name),
				count: secrets.length,
			};
		}),

	/** Stores a secret in Notploy, encrypted at rest. */
	createSecret: withPermission("vaultProvider", "create")
		.input(apiCreateVaultSecret)
		.mutation(async ({ ctx, input }) => {
			const secret = await createVaultSecret(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "vaultProvider",
				resourceId: secret.vaultProviderId,
				resourceName: secret.name,
			});
			return {
				vaultSecretId: secret.vaultSecretId,
				name: secret.name,
				description: secret.description ?? null,
			};
		}),

	updateSecret: withPermission("vaultProvider", "update")
		.input(apiUpdateVaultSecret)
		.mutation(async ({ ctx, input }) => {
			const secret = await updateVaultSecret(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "vaultProvider",
				resourceId: secret.vaultProviderId,
				resourceName: secret.name,
			});
			return {
				vaultSecretId: secret.vaultSecretId,
				name: secret.name,
				description: secret.description ?? null,
			};
		}),

	removeSecret: withPermission("vaultProvider", "delete")
		.input(apiRemoveVaultSecret)
		.mutation(async ({ ctx, input }) => {
			await removeVaultSecret(input.vaultSecretId, ctx.session.activeOrganizationId);
			await audit(ctx, {
				action: "delete",
				resourceType: "vaultProvider",
				resourceId: input.vaultSecretId,
			});
			return true;
		}),
});
