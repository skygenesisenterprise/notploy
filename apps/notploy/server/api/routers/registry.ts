import {
	createAdapterForConnection,
	createAdapterForRegistry,
	createRegistry,
	findRegistryById,
	findRegistryInOrganization,
	listOrganizationVaultSecrets,
	mergeRegistryConnection,
	registryProviderDescriptors,
	removeRegistry,
	updateRegistry,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateRegistry,
	apiFindOneRegistry,
	apiRegistryDeleteImage,
	apiRegistryReference,
	apiRegistryRepository,
	apiRemoveRegistry,
	apiTestRegistryConnection,
	apiUpdateRegistry,
	registry,
} from "@/server/db/schema";
import { createTRPCRouter, withPermission } from "../trpc";

/**
 * Container Registries.
 *
 * A registry is any endpoint serving OCI artifacts, so every provider — managed,
 * self-hosted, private or custom — is reached through the same adapter. The
 * router therefore exposes capabilities, health and the OCI operations
 * (repositories, tags, manifests, digests) once, instead of a per-vendor
 * surface, and credentials are resolved from the Secrets Manager or from the
 * record's inline fallback, never returned to the client.
 */
export const registryRouter = createTRPCRouter({
	create: withPermission("registry", "create")
		.input(apiCreateRegistry)
		.mutation(async ({ ctx, input }) => {
			const reg = await createRegistry(input, ctx.session.activeOrganizationId);
			await audit(ctx, {
				action: "create",
				resourceType: "registry",
				resourceId: reg.registryId,
				resourceName: reg.registryName,
			});
			return reg;
		}),

	update: withPermission("registry", "create")
		.input(apiUpdateRegistry)
		.mutation(async ({ ctx, input }) => {
			const { registryId, ...rest } = input;
			const existing = await findRegistryInOrganization(
				registryId,
				ctx.session.activeOrganizationId,
			);
			const application = await updateRegistry(registryId, {
				...rest,
			});

			if (!application) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating registry",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "registry",
				resourceId: registryId,
				resourceName: existing.registryName,
			});
			return true;
		}),

	remove: withPermission("registry", "delete")
		.input(apiRemoveRegistry)
		.mutation(async ({ ctx, input }) => {
			const existing = await findRegistryById(input.registryId);
			if (existing.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not allowed to delete this registry",
				});
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "registry",
				resourceId: existing.registryId,
				resourceName: existing.registryName,
			});
			return await removeRegistry(input.registryId);
		}),

	/** Registries of the organization. Credentials are never projected. */
	all: withPermission("registry", "read").query(async ({ ctx }) => {
		const registryResponse = await db.query.registry.findMany({
			where: eq(registry.organizationId, ctx.session.activeOrganizationId),
			columns: { password: false },
		});
		return registryResponse;
	}),

	one: withPermission("registry", "read")
		.input(apiFindOneRegistry)
		.query(async ({ ctx, input }) => {
			const found = await db.query.registry.findFirst({
				where: eq(registry.registryId, input.registryId),
				columns: { password: false },
			});
			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Registry not found",
				});
			}
			if (found.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not allowed to access this registry",
				});
			}
			return found;
		}),

	/**
	 * Provider catalogue, so the Console can describe every registry — endpoint
	 * shape, accepted authentication, capabilities — before one is connected.
	 */
	descriptors: withPermission("registry", "read").query(() =>
		registryProviderDescriptors.map((descriptor) => ({
			...descriptor,
			capabilities: { ...descriptor.capabilities },
		})),
	),

	/** Managed secrets a registry may authenticate with, by identity only. */
	secretOptions: withPermission("registry", "read").query(async ({ ctx }) =>
		listOrganizationVaultSecrets(ctx.session.activeOrganizationId),
	),

	health: withPermission("registry", "read")
		.input(apiFindOneRegistry)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.health();
		}),

	capabilities: withPermission("registry", "read")
		.input(apiFindOneRegistry)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.getCapabilities();
		}),

	/**
	 * Tests a connection, by id or from a form that has not been saved yet.
	 * Omitted fields fall back to the stored record, so an edit can be tested
	 * without the Console ever receiving the credential again.
	 */
	testConnection: withPermission("registry", "read")
		.input(apiTestRegistryConnection)
		.mutation(async ({ ctx, input }) => {
			const { registryId, ...override } = input;
			const adapter = registryId
				? await mergeRegistryConnection(
						await findRegistryInOrganization(
							registryId,
							ctx.session.activeOrganizationId,
						),
						override,
					)
				: await createAdapterForConnection({
						...override,
						providerType: override.providerType ?? "generic-oci",
						registryUrl: override.registryUrl ?? "",
					});

			if (!registryId && !override.registryUrl?.trim()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Enter the registry endpoint to test",
				});
			}

			return await adapter.testConnection();
		}),

	listRepositories: withPermission("registry", "read")
		.input(apiFindOneRegistry)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.listRepositories();
		}),

	listTags: withPermission("registry", "read")
		.input(apiRegistryRepository)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.listTags(input.repository);
		}),

	getManifest: withPermission("registry", "read")
		.input(apiRegistryReference)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.getManifest(input.repository, input.reference);
		}),

	/** The immutable identity of a tag: what a deployment should pin. */
	getDigest: withPermission("registry", "read")
		.input(apiRegistryReference)
		.query(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			return await adapter.getDigest(input.repository, input.reference);
		}),

	deleteImage: withPermission("registry", "delete")
		.input(apiRegistryDeleteImage)
		.mutation(async ({ ctx, input }) => {
			const found = await findRegistryInOrganization(
				input.registryId,
				ctx.session.activeOrganizationId,
			);
			const adapter = await createAdapterForRegistry(found);
			await adapter.deleteImage(input.repository, input.digest);
			await audit(ctx, {
				action: "delete",
				resourceType: "registry",
				resourceId: found.registryId,
				resourceName: `${input.repository}@${input.digest}`,
			});
			return true;
		}),

	/**
	 * @deprecated Replaced by `testConnection`, which validates the endpoint,
	 * the catalogue and the credentials through the OCI adapter. Kept so an
	 * older Console build keeps working during an upgrade.
	 */
	testRegistry: withPermission("registry", "read")
		.input(apiTestRegistryConnection)
		.mutation(async ({ ctx, input }) => {
			const { registryId, ...override } = input;
			const adapter = registryId
				? await mergeRegistryConnection(
						await findRegistryInOrganization(
							registryId,
							ctx.session.activeOrganizationId,
						),
						override,
					)
				: await createAdapterForConnection({
						...override,
						providerType: override.providerType ?? "generic-oci",
						registryUrl: override.registryUrl ?? "",
					});
			const result = await adapter.testConnection();
			if (!result.connected) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: result.message,
				});
			}
			return true;
		}),

	testRegistryById: withPermission("registry", "read")
		.input(apiFindOneRegistry)
		.mutation(async ({ ctx, input }) => {
			const adapter = await createAdapterForRegistry(
				await findRegistryInOrganization(
					input.registryId,
					ctx.session.activeOrganizationId,
				),
			);
			const result = await adapter.testConnection();
			if (!result.connected) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: result.message,
				});
			}
			return true;
		}),
});
