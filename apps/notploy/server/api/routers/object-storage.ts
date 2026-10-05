import {
	createObjectStorageBucket,
	createObjectStorageProvider,
	findObjectStorageBucketInOrganization,
	findObjectStorageBucketsByOrganizationId,
	findObjectStorageProviderInOrganization,
	findObjectStorageProvidersByOrganizationId,
	getObjectStorageBucketUsage,
	getObjectStorageProviderHealth,
	listObjectStorageDescriptors,
	maskObjectStorageConfig,
	mergeObjectStorageConfig,
	removeObjectStorageBucket,
	removeObjectStorageProvider,
	testObjectStorageConnection,
	updateObjectStorageBucket,
	updateObjectStorageProvider,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateObjectStorageBucket,
	apiCreateObjectStorageProvider,
	apiFindOneObjectStorageBucket,
	apiFindOneObjectStorageProvider,
	apiListObjectStorageBuckets,
	apiRemoveObjectStorageBucket,
	apiRemoveObjectStorageProvider,
	apiTestObjectStorageBucket,
	apiTestObjectStorageProvider,
	apiUpdateObjectStorageBucket,
	apiUpdateObjectStorageProvider,
} from "@/server/db/schema";
import { createTRPCRouter, withPermission } from "../trpc";

export const objectStorageRouter = createTRPCRouter({
	// -------------------------------------------------------------------------
	// Providers
	// -------------------------------------------------------------------------
	createProvider: withPermission("objectStorage", "create")
		.input(apiCreateObjectStorageProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await createObjectStorageProvider(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "objectStorage",
				resourceId: provider.objectStorageProviderId,
				resourceName: provider.name,
			});
			return {
				...provider,
				config: maskObjectStorageConfig(provider.config),
			};
		}),

	updateProvider: withPermission("objectStorage", "update")
		.input(apiUpdateObjectStorageProvider)
		.mutation(async ({ ctx, input }) => {
			await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			const updated = await updateObjectStorageProvider(
				input.objectStorageProviderId,
				input,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "objectStorage",
				resourceId: updated.objectStorageProviderId,
				resourceName: updated.name,
			});
			return { ...updated, config: maskObjectStorageConfig(updated.config) };
		}),

	removeProvider: withPermission("objectStorage", "delete")
		.input(apiRemoveObjectStorageProvider)
		.mutation(async ({ ctx, input }) => {
			const provider = await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "objectStorage",
				resourceId: provider.objectStorageProviderId,
				resourceName: provider.name,
			});
			await removeObjectStorageProvider(input.objectStorageProviderId);
			return true;
		}),

	providers: withPermission("objectStorage", "read").query(async ({ ctx }) => {
		const providers = await findObjectStorageProvidersByOrganizationId(
			ctx.session.activeOrganizationId,
		);
		return providers.map((provider) => ({
			...provider,
			config: maskObjectStorageConfig(provider.config),
		}));
	}),

	provider: withPermission("objectStorage", "read")
		.input(apiFindOneObjectStorageProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			return { ...provider, config: maskObjectStorageConfig(provider.config) };
		}),

	/**
	 * Provider presets so the Console can guide users per vendor while keeping a
	 * generic S3-compatible endpoint option.
	 */
	descriptors: withPermission("objectStorage", "read").query(() =>
		listObjectStorageDescriptors(),
	),

	providerHealth: withPermission("objectStorage", "read")
		.input(apiFindOneObjectStorageProvider)
		.query(async ({ ctx, input }) => {
			const provider = await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			return await getObjectStorageProviderHealth(provider);
		}),

	testConnection: withPermission("objectStorage", "create")
		.input(apiTestObjectStorageProvider)
		.mutation(async ({ ctx, input }) => {
			if (!input.config && !input.objectStorageProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Provide a config or an objectStorageProviderId to test",
				});
			}

			let providerType = input.providerType;
			let config = input.config;
			if (input.objectStorageProviderId) {
				const provider = await findObjectStorageProviderInOrganization(
					input.objectStorageProviderId,
					ctx.session.activeOrganizationId,
				);
				providerType = providerType ?? provider.providerType;
				config = config
					? mergeObjectStorageConfig(config, provider.config)
					: provider.config;
			}

			if (!config || !providerType) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A provider type and config are required to test",
				});
			}

			await testObjectStorageConnection({
				providerType,
				config,
				bucket: input.bucket,
				serverId: input.serverId,
			});
			return true;
		}),

	// -------------------------------------------------------------------------
	// Buckets
	// -------------------------------------------------------------------------
	createBucket: withPermission("objectStorage", "create")
		.input(apiCreateObjectStorageBucket)
		.mutation(async ({ ctx, input }) => {
			const provider = await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			const bucket = await createObjectStorageBucket(
				{
					objectStorageProviderId: provider.objectStorageProviderId,
					name: input.name,
					bucket: input.bucket,
					region: input.region || provider.config.region,
					endpoint: input.endpoint || provider.config.endpoint,
					versioning: input.versioning,
					lifecycle: input.lifecycle,
				},
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "objectStorage",
				resourceId: bucket.objectStorageBucketId,
				resourceName: bucket.name,
			});
			return bucket;
		}),

	updateBucket: withPermission("objectStorage", "update")
		.input(apiUpdateObjectStorageBucket)
		.mutation(async ({ ctx, input }) => {
			await findObjectStorageBucketInOrganization(
				input.objectStorageBucketId,
				ctx.session.activeOrganizationId,
			);
			const updated = await updateObjectStorageBucket(
				input.objectStorageBucketId,
				{
					name: input.name,
					bucket: input.bucket,
					region: input.region,
					endpoint: input.endpoint,
					versioning: input.versioning,
					lifecycle: input.lifecycle,
				},
			);
			await audit(ctx, {
				action: "update",
				resourceType: "objectStorage",
				resourceId: updated.objectStorageBucketId,
				resourceName: updated.name,
			});
			return updated;
		}),

	removeBucket: withPermission("objectStorage", "delete")
		.input(apiRemoveObjectStorageBucket)
		.mutation(async ({ ctx, input }) => {
			const bucket = await findObjectStorageBucketInOrganization(
				input.objectStorageBucketId,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "objectStorage",
				resourceId: bucket.objectStorageBucketId,
				resourceName: bucket.name,
			});
			await removeObjectStorageBucket(input.objectStorageBucketId);
			return true;
		}),

	/**
	 * Every bucket in the organization, enriched with the number of backup
	 * destinations that consume it (the "usage/status" the issue asks for).
	 */
	buckets: withPermission("objectStorage", "read").query(async ({ ctx }) => {
		const [buckets, usage] = await Promise.all([
			findObjectStorageBucketsByOrganizationId(
				ctx.session.activeOrganizationId,
			),
			getObjectStorageBucketUsage(ctx.session.activeOrganizationId),
		]);
		return buckets.map((bucket) => ({
			...bucket,
			usedBy: usage[bucket.objectStorageBucketId] ?? 0,
		}));
	}),

	bucket: withPermission("objectStorage", "read")
		.input(apiFindOneObjectStorageBucket)
		.query(async ({ ctx, input }) => {
			return await findObjectStorageBucketInOrganization(
				input.objectStorageBucketId,
				ctx.session.activeOrganizationId,
			);
		}),

	bucketsByProvider: withPermission("objectStorage", "read")
		.input(apiListObjectStorageBuckets)
		.query(async ({ ctx, input }) => {
			await findObjectStorageProviderInOrganization(
				input.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			const buckets = await findObjectStorageBucketsByOrganizationId(
				ctx.session.activeOrganizationId,
			);
			return buckets.filter(
				(bucket) =>
					bucket.objectStorageProviderId === input.objectStorageProviderId,
			);
		}),

	testBucket: withPermission("objectStorage", "create")
		.input(apiTestObjectStorageBucket)
		.mutation(async ({ ctx, input }) => {
			const bucket = await findObjectStorageBucketInOrganization(
				input.objectStorageBucketId,
				ctx.session.activeOrganizationId,
			);
			const provider = await findObjectStorageProviderInOrganization(
				bucket.objectStorageProviderId,
				ctx.session.activeOrganizationId,
			);
			await testObjectStorageConnection({
				providerType: provider.providerType,
				config: provider.config,
				bucket: bucket.bucket,
				serverId: input.serverId,
			});
			return true;
		}),
});
