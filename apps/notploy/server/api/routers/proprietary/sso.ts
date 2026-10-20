import {
	getIdentityProviderHealth,
	listIdentityProviderDescriptors,
	normalizeTrustedOrigin,
} from "@notploy/server";
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
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@notploy/server/services/web-server-settings";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
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
			const merged: Record<string, unknown> = { ...oldValue, ...newValue };
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
	/**
	 * Public resolver used by the sign-in page to know whether an email is served
	 * by a directory provider (which needs a password on this page) or a
	 * federated one (which redirects to the external IdP).
	 */
	providerKind: publicProcedure
		.input(z.object({ email: z.string().min(1) }))
		.query(async ({ input }) => {
			const domain = input.email.split("@")[1]?.trim().toLowerCase() ?? "";
			if (!domain) return null;
			const providers = await db.query.ssoProvider.findMany({
				columns: {
					domain: true,
					oidcConfig: true,
					samlConfig: true,
					ldapConfig: true,
					oauthConfig: true,
				},
			});
			const match = providers.find((provider) =>
				provider.domain
					.split(",")
					.map((value) => value.trim().toLowerCase())
					.filter(Boolean)
					.some(
						(providerDomain) =>
							domain === providerDomain ||
							domain.endsWith(`.${providerDomain}`),
					),
			);
			if (!match) return null;
			if (match.ldapConfig) {
				try {
					const parsed = JSON.parse(match.ldapConfig) as {
						directoryType?: string;
					};
					return parsed.directoryType === "active-directory"
						? "active-directory"
						: "ldap";
				} catch {
					return "ldap";
				}
			}
			if (match.samlConfig) return "saml";
			if (match.oidcConfig) return "oidc";
			if (match.oauthConfig) return "oauth2";
			return null;
		}),
	/**
	 * Public resolver used by the sign-in page to offer a social source (GitHub)
	 * as a one-click sign-in. Returns the provider id and the social source it
	 * targets; `null` when none is configured.
	 */
	socialProvider: publicProcedure.query(async () => {
		const provider = await db.query.ssoProvider.findFirst({
			where: isNotNull(ssoProvider.oauthConfig),
			columns: { providerId: true, oauthConfig: true },
		});
		if (!provider?.oauthConfig) return null;
		try {
			const parsed = JSON.parse(provider.oauthConfig) as { provider?: string };
			return {
				providerId: provider.providerId,
				provider: parsed.provider ?? "github",
			};
		} catch {
			return null;
		}
	}),
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
				ldapConfig: true,
				oauthConfig: true,
				organizationId: true,
			},
			orderBy: [asc(ssoProvider.createdAt)],
		});
		return providers.map((provider) => ({
			...provider,
			oidcConfig: sanitizeSsoConfig(provider.oidcConfig),
			samlConfig: sanitizeSsoConfig(provider.samlConfig),
			ldapConfig: sanitizeSsoConfig(provider.ldapConfig),
			oauthConfig: sanitizeSsoConfig(provider.oauthConfig),
		}));
	}),
	/**
	 * Capability catalog for every identity provider protocol, so the Console can
	 * present what each protocol supports before one is configured.
	 */
	descriptors: adminProcedure.query(() => listIdentityProviderDescriptors()),
	/**
	 * Structured diagnostics for a single provider. OIDC is probed through its
	 * discovery document; SAML is validated structurally. Secrets are never
	 * returned.
	 */
	health: adminProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const provider = await db.query.ssoProvider.findFirst({
				where: and(
					eq(ssoProvider.providerId, input.providerId),
					eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
				),
				columns: {
					providerId: true,
					issuer: true,
					domain: true,
					oidcConfig: true,
					samlConfig: true,
					ldapConfig: true,
					oauthConfig: true,
				},
			});
			if (!provider) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"Identity provider not found or you do not have permission to access it",
				});
			}
			return await getIdentityProviderHealth(provider);
		}),
	/**
	 * Validates an identity provider configuration before it is saved, used by
	 * the Add/Edit provider dialog's "Test connection" action. When `providerId`
	 * is supplied (edit mode) any blank secret/certificate is resolved from the
	 * stored configuration, mirroring `update`.
	 */
	testConnection: adminProcedure
		.input(
			z.object({
				providerId: z.string().optional(),
				issuer: z.string().min(1, "Issuer URL is required"),
				oidcConfig: ssoProviderBodySchema.shape.oidcConfig,
				samlConfig: ssoProviderBodySchema.shape.samlConfig,
				ldapConfig: ssoProviderBodySchema.shape.ldapConfig,
				oauthConfig: ssoProviderBodySchema.shape.oauthConfig,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			let oidcConfig = input.oidcConfig;
			let samlConfig = input.samlConfig;
			let ldapConfig = input.ldapConfig;
			let oauthConfig = input.oauthConfig;

			if (input.providerId) {
				const existing = await db.query.ssoProvider.findFirst({
					where: and(
						eq(ssoProvider.providerId, input.providerId),
						eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
					),
					columns: {
						oidcConfig: true,
						samlConfig: true,
						ldapConfig: true,
						oauthConfig: true,
					},
				});
				if (existing) {
					if (oidcConfig) {
						oidcConfig = preserveStoredSsoConfig(
							existing.oidcConfig,
							oidcConfig,
						);
					}
					if (samlConfig) {
						samlConfig = preserveStoredSsoConfig(
							existing.samlConfig,
							samlConfig,
						);
					}
					if (ldapConfig) {
						ldapConfig = preserveStoredSsoConfig(
							existing.ldapConfig,
							ldapConfig,
						);
					}
					if (oauthConfig) {
						oauthConfig = preserveStoredSsoConfig(
							existing.oauthConfig,
							oauthConfig,
						);
					}
				}
			}

			return await getIdentityProviderHealth({
				providerId: input.providerId ?? "pending",
				issuer: input.issuer,
				domain: "",
				oidcConfig: oidcConfig ? JSON.stringify(oidcConfig) : null,
				samlConfig: samlConfig ? JSON.stringify(samlConfig) : null,
				ldapConfig: ldapConfig ? JSON.stringify(ldapConfig) : null,
				oauthConfig: oauthConfig ? JSON.stringify(oauthConfig) : null,
			});
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
					ldapConfig: true,
					oauthConfig: true,
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
				ldapConfig: sanitizeSsoConfig(provider.ldapConfig),
				oauthConfig: sanitizeSsoConfig(provider.oauthConfig),
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
					ldapConfig: true,
					oauthConfig: true,
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

			const isLdap = input.ldapConfig != null;
			const isSocial = input.oauthConfig != null;
			// Only federated issuers are checked against the trusted-origins list;
			// a directory or a social source is not an origin the browser is sent to
			// on its own.
			const issuerChanged =
				!isLdap &&
				!isSocial &&
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

			if (isLdap && input.ldapConfig) {
				const ldapConfig = preserveStoredSsoConfig(
					existing.ldapConfig,
					input.ldapConfig,
				);
				if (ldapConfig.bindDn && !ldapConfig.bindPassword?.trim()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "LDAP bind password is required",
					});
				}
				await db
					.update(ssoProvider)
					.set({
						issuer: input.issuer || ldapConfig.url,
						domain,
						providerId: input.providerId,
						ldapConfig: JSON.stringify(ldapConfig),
						oidcConfig: null,
						samlConfig: null,
					})
					.where(eq(ssoProvider.id, existing.id));
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceId: existing.id,
					resourceName: `Identity provider ${input.providerId}`,
					metadata: {
						protocol:
							ldapConfig.directoryType === "active-directory"
								? "Active Directory"
								: "LDAP",
					},
				});
				return { success: true };
			}

			if (isSocial && input.oauthConfig) {
				const oauthConfig = preserveStoredSsoConfig(
					existing.oauthConfig,
					input.oauthConfig,
				);
				if (!oauthConfig.clientSecret.trim()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "OAuth 2.0 client secret is required",
					});
				}
				await db
					.update(ssoProvider)
					.set({
						issuer: input.issuer,
						domain,
						providerId: input.providerId,
						oauthConfig: JSON.stringify(oauthConfig),
						oidcConfig: null,
						samlConfig: null,
						ldapConfig: null,
					})
					.where(eq(ssoProvider.id, existing.id));
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceId: existing.id,
					resourceName: `Identity provider ${input.providerId}`,
					metadata: { protocol: "OAuth 2.0" },
				});
				return { success: true };
			}

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

			// Removing the last external identity source restores local
			// authentication, so an operator is never locked out by a dangling
			// enforcement flag.
			if (!IS_CLOUD) {
				const remaining = await db.query.ssoProvider.findMany({
					where: eq(
						ssoProvider.organizationId,
						ctx.session.activeOrganizationId,
					),
					columns: { id: true },
				});
				if (remaining.length === 0) {
					await updateWebServerSettings({ enforceSSO: false });
				}
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
			if (input.oauthConfig && !input.oauthConfig.clientSecret.trim()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "OAuth 2.0 client secret is required",
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

			if (input.ldapConfig) {
				if (input.ldapConfig.bindDn && !input.ldapConfig.bindPassword?.trim()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "LDAP bind password is required",
					});
				}
				await db.insert(ssoProvider).values({
					id: nanoid(),
					issuer: input.issuer || input.ldapConfig.url,
					oidcConfig: null,
					samlConfig: null,
					ldapConfig: JSON.stringify(input.ldapConfig),
					providerId: input.providerId,
					userId: ctx.session.userId,
					organizationId,
					domain,
					domainVerified: true,
					createdAt: new Date(),
				});

				if (!IS_CLOUD) {
					await updateWebServerSettings({ enforceSSO: true });
				}

				await audit(ctx, {
					action: "create",
					resourceType: "settings",
					resourceName: `Identity provider ${input.providerId}`,
					metadata: {
						protocol:
							input.ldapConfig.directoryType === "active-directory"
								? "Active Directory"
								: "LDAP",
					},
				});
				return { success: true };
			}

			if (input.oauthConfig) {
				await db.insert(ssoProvider).values({
					id: nanoid(),
					issuer: input.issuer,
					oidcConfig: null,
					samlConfig: null,
					ldapConfig: null,
					oauthConfig: JSON.stringify(input.oauthConfig),
					providerId: input.providerId,
					userId: ctx.session.userId,
					organizationId,
					domain,
					domainVerified: true,
					createdAt: new Date(),
				});

				if (!IS_CLOUD) {
					await updateWebServerSettings({ enforceSSO: true });
				}

				await audit(ctx, {
					action: "create",
					resourceType: "settings",
					resourceName: `Identity provider ${input.providerId}`,
					metadata: { protocol: "OAuth 2.0" },
				});
				return { success: true };
			}

			await auth.registerSSOProvider({
				body: {
					...input,
					organizationId,
					domain,
				},
				headers: requestToHeaders(ctx.req),
			});

			// Once an external identity source exists it becomes the authority:
			// local password/social sign-in and sign-up are turned off so
			// authentication runs through the provider. Cloud manages this itself.
			if (!IS_CLOUD) {
				await updateWebServerSettings({ enforceSSO: true });
			}

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
