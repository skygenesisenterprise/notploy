import { db } from "@notploy/server/db";
import {
	type apiCreateVaultProvider,
	projects,
	type VaultProviderAssignment,
	type VaultProviderConfig,
	vaultProvider,
} from "@notploy/server/db/schema";
import {
	type VaultCapabilityMatrix,
	getVaultCapabilities,
	getVaultClient,
	getVaultProviderCategory,
	type VaultProviderCategory,
	type VaultProviderType,
	vaultProviderTypes,
} from "@notploy/server/utils/vault";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";

export type VaultProvider = typeof vaultProvider.$inferSelect;

export const VAULT_SECRET_MASK = "********";

const SENSITIVE_FIELDS: Record<VaultProviderConfig["providerType"], string[]> =
	{
		hashicorp: ["token"],
		infisical: ["clientSecret"],
		aws: ["secretAccessKey"],
		"aws-parameter-store": ["secretAccessKey"],
		doppler: ["serviceToken"],
		azure: ["clientSecret"],
		scaleway: ["secretKey"],
		phase: ["token"],
		gcp: ["privateKey"],
		oci: ["privateKey"],
		onepassword: ["token"],
		vaultwarden: ["clientSecret"],
		kubernetes: ["token"],
		docker: [],
		generic: ["token"],
	};

export const maskVaultProviderConfig = (
	config: VaultProviderConfig,
): VaultProviderConfig => {
	const masked: Record<string, unknown> = { ...config };
	for (const field of SENSITIVE_FIELDS[config.providerType]) {
		if (masked[field]) {
			masked[field] = VAULT_SECRET_MASK;
		}
	}
	return masked as VaultProviderConfig;
};

export const mergeVaultProviderConfig = (
	incoming: VaultProviderConfig,
	existing: VaultProviderConfig,
): VaultProviderConfig => {
	const merged: Record<string, unknown> = { ...incoming };
	for (const field of SENSITIVE_FIELDS[incoming.providerType]) {
		if (merged[field] === VAULT_SECRET_MASK) {
			if (incoming.providerType !== existing.providerType) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Credentials must be re-entered when changing the provider type",
				});
			}
			merged[field] = (existing as Record<string, unknown>)[field];
		}
	}
	return merged as VaultProviderConfig;
};

const isUniqueNameViolation = (error: unknown) =>
	error instanceof Error &&
	error.message.includes("vault_provider_org_name_idx");

const validateAssignments = async (
	assignments: VaultProviderAssignment[],
	organizationId: string,
) => {
	const orgProjects = await db.query.projects.findMany({
		where: eq(projects.organizationId, organizationId),
		with: { environments: true },
	});
	for (const assignment of assignments) {
		const project = orgProjects.find(
			(p) => p.projectId === assignment.projectId,
		);
		if (!project) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Assignment references a project outside this organization",
			});
		}
		const environmentIds = new Set(
			project.environments.map((e) => e.environmentId),
		);
		for (const environmentId of assignment.environmentIds) {
			if (!environmentIds.has(environmentId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Assignment references an environment outside the selected project",
				});
			}
		}
	}
};

export const createVaultProvider = async (
	input: z.infer<typeof apiCreateVaultProvider>,
	organizationId: string,
) => {
	await validateAssignments(input.assignments, organizationId);
	try {
		const newProvider = await db
			.insert(vaultProvider)
			.values({
				name: input.name,
				providerType: input.config.providerType,
				config: input.config,
				assignments: input.assignments,
				organizationId,
			})
			.returning()
			.then((value) => value[0]);

		if (!newProvider) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the vault provider",
			});
		}
		return newProvider;
	} catch (error) {
		if (isUniqueNameViolation(error)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `A vault provider named "${input.name}" already exists in this organization`,
			});
		}
		throw error;
	}
};

export const findVaultProviderById = async (vaultProviderId: string) => {
	const provider = await db.query.vaultProvider.findFirst({
		where: eq(vaultProvider.vaultProviderId, vaultProviderId),
	});
	if (!provider) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Vault provider not found",
		});
	}
	return provider;
};

export const findVaultProviderInOrganization = async (
	vaultProviderId: string,
	organizationId: string,
) => {
	const provider = await findVaultProviderById(vaultProviderId);
	if (provider.organizationId !== organizationId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not allowed to access this vault provider",
		});
	}
	return provider;
};

export const findVaultProvidersByOrganizationId = async (
	organizationId: string,
) => {
	return await db.query.vaultProvider.findMany({
		where: eq(vaultProvider.organizationId, organizationId),
		orderBy: (providers, { asc }) => [asc(providers.name)],
	});
};

export const updateVaultProvider = async (
	vaultProviderId: string,
	name: string,
	config: VaultProviderConfig,
	assignments: VaultProviderAssignment[],
) => {
	const existing = await findVaultProviderById(vaultProviderId);
	const mergedConfig = mergeVaultProviderConfig(config, existing.config);
	await validateAssignments(assignments, existing.organizationId);

	try {
		const updated = await db
			.update(vaultProvider)
			.set({
				name,
				providerType: mergedConfig.providerType,
				config: mergedConfig,
				assignments,
			})
			.where(eq(vaultProvider.vaultProviderId, vaultProviderId))
			.returning()
			.then((res) => res[0]);

		if (!updated) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error updating the vault provider",
			});
		}
		return updated;
	} catch (error) {
		if (isUniqueNameViolation(error)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `A vault provider named "${name}" already exists in this organization`,
			});
		}
		throw error;
	}
};

export const removeVaultProvider = async (vaultProviderId: string) => {
	const removed = await db
		.delete(vaultProvider)
		.where(eq(vaultProvider.vaultProviderId, vaultProviderId))
		.returning()
		.then((res) => res[0]);

	if (!removed) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Vault provider not found",
		});
	}
	return removed;
};

export const testVaultProviderConnection = async (
	config: VaultProviderConfig,
) => {
	const client = getVaultClient(config.providerType);
	try {
		await client.testConnection(config);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error
					? error.message
					: "Error connecting to the vault provider",
		});
	}
};

export const listVaultProviderSecretNames = async (
	config: VaultProviderConfig,
) => {
	const client = getVaultClient(config.providerType);
	if (!client.listSecretNames) {
		return [];
	}
	try {
		return await client.listSecretNames(config);
	} catch {
		return [];
	}
};

export interface VaultProviderDescriptor {
	providerType: VaultProviderType;
	category: VaultProviderCategory;
	capabilities: VaultCapabilityMatrix;
}

/**
 * Capability matrix for every provider type, so the Console can show what a
 * provider supports before it is connected.
 */
export const listVaultProviderDescriptors = (): VaultProviderDescriptor[] =>
	vaultProviderTypes.map((providerType) => ({
		providerType,
		category: getVaultProviderCategory(providerType),
		capabilities: getVaultCapabilities(providerType),
	}));

export interface VaultProviderHealth {
	status: "connected" | "degraded" | "unreachable" | "misconfigured";
	checkedAt: string;
	latencyMs: number | null;
	message?: string;
	secretCount?: number;
}

/**
 * Probes a provider and reports its health. The probe reuses the adapter's
 * `testConnection`, so a provider reporting `connected` is also reachable for
 * the routine deploy-time resolution, and a follow-up listing tells the Console
 * how many secrets it can browse. No secret value ever leaves the adapter.
 */
export const getVaultProviderHealth = async (
	config: VaultProviderConfig,
): Promise<VaultProviderHealth> => {
	const checkedAt = new Date().toISOString();
	const client = getVaultClient(config.providerType);
	const startedAt = Date.now();
	try {
		await client.testConnection(config);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "The provider is unreachable";
		return {
			status: /unauthor|forbidden|401|403/i.test(message)
				? "misconfigured"
				: "unreachable",
			checkedAt,
			latencyMs: null,
			message,
		};
	}

	const latencyMs = Date.now() - startedAt;
	if (!client.listSecretNames) {
		return { status: "connected", checkedAt, latencyMs };
	}
	try {
		const secretNames = await client.listSecretNames(config);
		return { status: "connected", checkedAt, latencyMs, secretCount: secretNames.length };
	} catch (error) {
		return {
			status: "degraded",
			checkedAt,
			latencyMs,
			message:
				error instanceof Error
					? error.message
					: "The provider is reachable but its secrets could not be listed",
		};
	}
};

/**
 * Lists the secret *names* a provider exposes so the Console can browse them.
 * Values are never returned: the adapter only reports metadata.
 */
export const listVaultProviderSecrets = async (
	config: VaultProviderConfig,
): Promise<string[]> => {
	const client = getVaultClient(config.providerType);
	if (!client.listSecretNames) {
		return [];
	}
	try {
		return await client.listSecretNames(config);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error
					? error.message
					: "Error listing the secrets of this provider",
		});
	}
};
