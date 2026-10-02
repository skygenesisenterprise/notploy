import {
	getPublicWhitelabelingConfig,
	getWebServerSettings,
	IS_CLOUD,
	updateWebServerSettings,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { apiUpdateWhitelabeling } from "@/server/db/schema";
import {
	createTRPCRouter,
	adminProcedure,
	protectedProcedure,
	publicProcedure,
} from "../../trpc";

/** Invalidate the SSR branding caches in _document.tsx so the next request picks up fresh settings. */
function clearBrandingSSRCache() {
	globalThis.__SETTINGS_CACHE = null;
}

export const whitelabelingRouter = createTRPCRouter({
	get: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}
		const settings = await getWebServerSettings();
		return settings?.whitelabelingConfig ?? null;
	}),

	update: adminProcedure
		.input(apiUpdateWhitelabeling)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Whitelabeling is not available in Cloud",
				});
			}

			if (ctx.user.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the owner can update whitelabeling settings",
				});
			}

			await updateWebServerSettings({
				whitelabelingConfig: input.whitelabelingConfig,
			});

			// Clear the cache so Next.js SSR applies changes immediately
			clearBrandingSSRCache();

			return { success: true };
		}),

	reset: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Whitelabeling is not available in Cloud",
			});
		}

		if (ctx.user.role !== "owner") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Only the owner can reset whitelabeling settings",
			});
		}

		await updateWebServerSettings({
			whitelabelingConfig: {
				appName: null,
				appDescription: null,
				logoUrl: null,
				faviconUrl: null,
				customCss: null,
				loginLogoUrl: null,
				supportUrl: null,
				docsUrl: null,
				errorPageTitle: null,
				errorPageDescription: null,
				ogImageUrl: null,
				footerText: null,
			},
		});

		// Clear the cache so Next.js SSR applies changes immediately
		clearBrandingSSRCache();

		return { success: true };
	}),

	// Public endpoint only for unauthenticated pages (login, register, error)
	// Returns only the fields needed for public pages
	getPublic: publicProcedure.query(() => getPublicWhitelabelingConfig()),
});
