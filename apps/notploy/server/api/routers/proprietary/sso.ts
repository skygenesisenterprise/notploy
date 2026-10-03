import { normalizeTrustedOrigin } from "@notploy/server";
import { IS_CLOUD } from "@notploy/server/constants";
import { db } from "@notploy/server/db";
import { ssoProvider, user } from "@notploy/server/db/schema";
import { ssoProviderBodySchema } from "@notploy/server/db/schema/sso";
import {
	getOrganizationOwnerId,
	requestToHeaders,
} from "@notploy/server/index";
import { auth } from "@notploy/server/lib/auth";
import { invalidateTrustedOriginsCache } from "@notploy/server/services/admin";
import { getWebServerSettings } from "@notploy/server/services/web-server-settings";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	adminProcedure,
	createTRPCRouter,
	publicProcedure,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";

function stripSensitiveSsoConfigValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stripSensitiveSsoConfigValue);
	}
	if (!value || typeof value !== "object") return value;

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, entry]) => {
			if (
				/secret|token|password|private.?key|credential|certificate|^cert$|metadata/i.test(
					key,
				)
			) {
				return [];
			}
			return [[key, stripSensitiveSsoConfigValue(entry)]];
		}),
	);
}

function sanitizeSsoConfig(config: string | null) {
	if (!config) return config;
	try {
		return JSON.stringify(stripSensitiveSsoConfigValue(JSON.parse(config)));
	} catch {
		return null;
	}
}

function preserveStoredSsoConfig<T>(stored: string | null, updated: T): T {
	if (!stored || !updated || typeof updated !== "object") return updated;
	let previous: unknown;
	try {
		previous = JSON.parse(stored);
	} catch {
		return updated;
	}

	const merge = (
		oldValue: unknown,
		newValue: unknown,
		key?: string,
	): unknown => {
		if (
			newValue === undefined ||
			(newValue === "" &&
				!!key &&
				/secret|token|password|private.?key|credential|certificate|^cert$/i.test(
					key,
				) &&
				typeof oldValue === "string" &&
				oldValue.length > 0)
		) {
			return oldValue;
		}
		if (
			newValue &&
			oldValue &&
			typeof newValue === "object" &&
			typeof oldValue === "object" &&
			!Array.isArray(newValue) &&
			!Array.isArray(oldValue)
		) {
			const merged = { ...oldValue, ...newValue };
			for (const key of Object.keys(oldValue)) {
				if (!(key in newValue)) {
					merged[key] = (oldValue as Record<string, unknown>)[key];
				} else {
					merged[key] = merge(
						(oldValue as Record<string, unknown>)[key],
						(newValue as Record<string, unknown>)[key],
						key,
					);
				}
			}
			return merged;
		}
		return newValue;
	};

	return merge(previous, updated) as T;
}

export const ssoRouter = createTRPCRouter({
	/**
	 * Whether the instance offers SSO sign-in. SSO is available on both
	 * Notploy Cloud and self-hosted Notploy, so this is always true. Kept as an
	 * endpoint because the public API/SDK/CLI/MCP surface references it.
	 */
	showSignInWithSSO: publicProcedure.query(() => true),
	enforceSSO: publicProcedure.query(async () => {
		if (IS_CLOUD) {
			return false;
		}
		const settings = await getWebServerSettings();
		return settings?.enforceSSO ?? false;
	}),
	listProviders: adminProcedure.query(async ({ ctx }) => {
		const providers = await db.query.ssoProvider.findMany({
			where: eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
			columns: {
				id: true,
				providerId: true,
				issuer: true,
				domain: true,
				oidcConfig: true,
				samlConfig: true,
				organizationId: true,
			},
			orderBy: [asc(ssoProvider.createdAt)],
		});
		return providers.map((provider) => ({
			...provider,
			oidcConfig: sanitizeSsoConfig(provider.oidcConfig),
			samlConfig: sanitizeSsoConfig(provider.samlConfig),
		}));
	}),
	getTrustedOrigins: adminProcedure.query(async ({ ctx }) => {
		const ownerId = await getOrganizationOwnerId(
			ctx.session.activeOrganizationId,
		);
		if (!ownerId) return [];
		const ownerUser = await db.query.user.findFirst({
			where: eq(user.id, ownerId),
			columns: { trustedOrigins: true },
		});
		return ownerUser?.trustedOrigins ?? [];
	}),
	one: adminProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const provider = await db.query.ssoProvider.findFirst({
				where: and(
					eq(ssoProvider.providerId, input.providerId),
					eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
				),
				columns: {
					id: true,
					providerId: true,
					issuer: true,
					domain: true,
					oidcConfig: true,
					samlConfig: true,
					organizationId: true,
				},
			});
			if (!provider) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"SSO provider not found or you do not have permission to access it",
				});
			}
			return {
				...provider,
				oidcConfig: sanitizeSsoConfig(provider.oidcConfig),
				samlConfig: sanitizeSsoConfig(provider.samlConfig),
			};
		}),
	update: adminProcedure
		.input(ssoProviderBodySchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.ssoProvider.findFirst({
				where: and(
					eq(ssoProvider.providerId, input.providerId),
					eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
				),
				columns: {
					id: true,
					issuer: true,
					domain: true,
					userId: true,
					oidcConfig: true,
					samlConfig: true,
				},
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"SSO provider not found or you do not have permission to update it",
				});
			}

			if (existing.userId !== ctx.session.userId) {
				await db
					.update(ssoProvider)
					.set({ userId: ctx.session.userId })
					.where(eq(ssoProvider.id, existing.id));
			}

			const providers = await db.query.ssoProvider.findMany({
				where: eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
				columns: { providerId: true, domain: true },
			});

			for (const provider of providers) {
				if (provider.providerId === input.providerId) continue;
				const providerDomains = provider.domain
					.split(",")
					.map((d) => d.trim().toLowerCase());
				for (const domain of input.domains) {
					if (providerDomains.includes(domain)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Domain ${domain} is already registered for another provider`,
						});
					}
				}
			}

			const issuerChanged =
				normalizeTrustedOrigin(existing.issuer) !==
				normalizeTrustedOrigin(input.issuer);
			if (issuerChanged) {
				const ownerId = await getOrganizationOwnerId(
					ctx.session.activeOrganizationId,
				);
				if (!ownerId) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Organization owner not found",
					});
				}
				const ownerUser = await db.query.user.findFirst({
					where: eq(user.id, ownerId),
					columns: { trustedOrigins: true },
				});
				const trustedOrigins = ownerUser?.trustedOrigins ?? [];
				const newOrigin = normalizeTrustedOrigin(input.issuer);
				const isInTrustedOrigins = trustedOrigins.some(
					(o) => o.toLowerCase() === newOrigin.toLowerCase(),
				);
				if (!isInTrustedOrigins) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"The new Issuer URL is not in the organization's trusted origins list. Please add it in Manage origins before saving.",
					});
				}
			}

			const domain = input.domains.join(",");
			const updateBody: {
				providerId: string;
				issuer: string;
				domain: string;
				oidcConfig?: (typeof input)["oidcConfig"];
				samlConfig?: (typeof input)["samlConfig"];
			} = {
				issuer: input.issuer,
				domain,
				providerId: input.providerId,
			};
			if (input.oidcConfig != null) {
				const oidcConfig = preserveStoredSsoConfig(
					existing.oidcConfig,
					input.oidcConfig,
				);
				if (!oidcConfig.clientSecret.trim()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "OIDC client secret is required",
					});
				}
				updateBody.oidcConfig = oidcConfig;
			}
			if (input.samlConfig != null) {
				const samlConfig = preserveStoredSsoConfig(
					existing.samlConfig,
					input.samlConfig,
				);
				if (!samlConfig.cert.trim()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "SAML signing certificate is required",
					});
				}
				updateBody.samlConfig = samlConfig;
			}

			await auth.updateSSOProvider({
				params: { providerId: input.providerId },
				body: updateBody,
				headers: requestToHeaders(ctx.req),
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceId: existing.id,
				resourceName: `Identity provider ${input.providerId}`,
				metadata: {
					protocol: input.oidcConfig ? "OIDC" : "SAML",
				},
			});
			return { success: true };
		}),
	deleteProvider: adminProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			// Obtener el provider antes de eliminarlo para obtener sus dominios
			const providerToDelete = await db.query.ssoProvider.findFirst({
				where: and(
					eq(ssoProvider.providerId, input.providerId),
					eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
				),
				columns: {
					id: true,
					domain: true,
					issuer: true,
				},
			});

			if (!providerToDelete) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"SSO provider not found or you do not have permission to delete it",
				});
			}

			const [deleted] = await db
				.delete(ssoProvider)
				.where(
					and(
						eq(ssoProvider.providerId, input.providerId),
						eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
					),
				)
				.returning({ id: ssoProvider.id });

			if (!deleted) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"SSO provider not found or you do not have permission to delete it",
				});
			}

			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceId: providerToDelete.id,
				resourceName: `Identity provider ${input.providerId}`,
			});
			return { success: true };
		}),
	register: adminProcedure
		.input(ssoProviderBodySchema)
		.mutation(async ({ ctx, input }) => {
			if (input.oidcConfig && !input.oidcConfig.clientSecret.trim()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "OIDC client secret is required",
				});
			}
			if (input.samlConfig && !input.samlConfig.cert.trim()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "SAML signing certificate is required",
				});
			}
			const organizationId = ctx.session.activeOrganizationId;

			const providers = await db.query.ssoProvider.findMany({
				columns: {
					domain: true,
				},
			});

			for (const provider of providers) {
				const providerDomains = provider.domain
					.split(",")
					.map((d) => d.trim().toLowerCase());
				for (const domain of input.domains) {
					if (providerDomains.includes(domain)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Domain ${domain} is already registered for another provider`,
						});
					}
				}
			}
			const domain = input.domains.join(",");

			await auth.registerSSOProvider({
				body: {
					...input,
					organizationId,
					domain,
				},
				headers: requestToHeaders(ctx.req),
			});
			await audit(ctx, {
				action: "create",
				resourceType: "settings",
				resourceName: `Identity provider ${input.providerId}`,
				metadata: {
					protocol: input.oidcConfig ? "OIDC" : "SAML",
				},
			});
			return { success: true };
		}),
	addTrustedOrigin: adminProcedure
		.input(z.object({ origin: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const ownerId = await getOrganizationOwnerId(
				ctx.session.activeOrganizationId,
			);
			if (!ownerId) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Organization owner not found",
				});
			}
			const normalized = normalizeTrustedOrigin(input.origin);
			const ownerUser = await db.query.user.findFirst({
				where: eq(user.id, ownerId),
				columns: { trustedOrigins: true },
			});
			const existing = ownerUser?.trustedOrigins || [];
			if (existing.some((o) => o.toLowerCase() === normalized.toLowerCase())) {
				return { success: true };
			}
			const next = Array.from(new Set([...existing, normalized]));
			await db
				.update(user)
				.set({ trustedOrigins: next })
				.where(eq(user.id, ownerId));
			invalidateTrustedOriginsCache();
			return { success: true };
		}),
	removeTrustedOrigin: adminProcedure
		.input(z.object({ origin: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const ownerId = await getOrganizationOwnerId(
				ctx.session.activeOrganizationId,
			);
			if (!ownerId) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Organization owner not found",
				});
			}
			const normalized = normalizeTrustedOrigin(input.origin);
			const ownerUser = await db.query.user.findFirst({
				where: eq(user.id, ownerId),
				columns: { trustedOrigins: true },
			});
			const existing = ownerUser?.trustedOrigins || [];
			const next = existing.filter(
				(o) => o.toLowerCase() !== normalized.toLowerCase(),
			);
			await db
				.update(user)
				.set({ trustedOrigins: next })
				.where(eq(user.id, ownerId));
			invalidateTrustedOriginsCache();
			return { success: true };
		}),
	updateTrustedOrigin: adminProcedure
		.input(
			z.object({
				oldOrigin: z.string().min(1),
				newOrigin: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const ownerId = await getOrganizationOwnerId(
				ctx.session.activeOrganizationId,
			);
			if (!ownerId) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Organization owner not found",
				});
			}
			const oldNorm = normalizeTrustedOrigin(input.oldOrigin);
			const newNorm = normalizeTrustedOrigin(input.newOrigin);
			const ownerUser = await db.query.user.findFirst({
				where: eq(user.id, ownerId),
				columns: { trustedOrigins: true },
			});
			const existing = ownerUser?.trustedOrigins || [];
			const next = existing.map((o) =>
				o.toLowerCase() === oldNorm.toLowerCase() ? newNorm : o,
			);
			await db
				.update(user)
				.set({ trustedOrigins: next })
				.where(eq(user.id, ownerId));
			invalidateTrustedOriginsCache();
			return { success: true };
		}),
});
