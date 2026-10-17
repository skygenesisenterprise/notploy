import { IS_CLOUD } from "@notploy/server/constants";
import {
	apiCreateAi,
	apiSaveAiCustomProviders,
	apiUpdateAi,
	deploySuggestionSchema,
} from "@notploy/server/db/schema/ai";
import {
	createDomain,
	createMount,
	findEnvironmentById,
} from "@notploy/server/index";
import {
	deleteAiSettings,
	findAiSettingById,
	getAiModelsForSetting,
	getAiSettingsByOrganizationId,
	getCustomAiProviders,
	saveAiSettings,
	saveCustomAiProviders,
	suggestVariants,
	testAiConnectionForSetting,
	toAiSettingView,
} from "@notploy/server/services/ai";
import { createComposeByTemplate } from "@notploy/server/services/compose";
import {
	addNewService,
	checkServiceAccess,
} from "@notploy/server/services/permission";
import { findProjectById } from "@notploy/server/services/project";
import {
	getAiProviderLabel,
	getModelCapabilities,
	resolveAiProviderId,
} from "@notploy/server/utils/ai/contracts";
import {
	generateAiText,
	normalizeAiError,
} from "@notploy/server/utils/ai/runtime";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { generatePassword } from "@/templates/utils";

const asTrpcError = (error: unknown): TRPCError => {
	if (error instanceof TRPCError) return error;
	const normalized = normalizeAiError(error);
	return new TRPCError({
		code: "BAD_REQUEST",
		message: `${normalized.category}: ${normalized.message}`,
		cause: error,
	});
};

export const aiRouter = createTRPCRouter({
	one: withPermission("aiProvider", "read")
		.input(z.object({ aiId: z.string() }))
		.query(async ({ input, ctx }) => {
			const setting = await findAiSettingById(
				input.aiId,
				ctx.session.activeOrganizationId,
			);
			return toAiSettingView(setting);
		}),

	getModels: withPermission("aiProvider", "read")
		.input(
			z.object({
				apiUrl: z.string().optional(),
				apiKey: z.string().optional(),
				aiId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			try {
				return await getAiModelsForSetting({
					aiId: input.aiId,
					organizationId: ctx.session.activeOrganizationId,
					apiUrl: input.apiUrl,
					apiKey: input.apiKey,
				});
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	create: withPermission("aiProvider", "create")
		.input(apiCreateAi)
		.mutation(async ({ ctx, input }) => {
			try {
				const setting = await saveAiSettings(
					ctx.session.activeOrganizationId,
					input,
				);
				return setting;
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	update: withPermission("aiProvider", "update")
		.input(apiUpdateAi)
		.mutation(async ({ ctx, input }) => {
			try {
				const setting = await saveAiSettings(
					ctx.session.activeOrganizationId,
					input,
				);
				return setting;
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	getAll: withPermission("aiProvider", "read").query(async ({ ctx }) => {
		const settings = await getAiSettingsByOrganizationId(
			ctx.session.activeOrganizationId,
		);
		return settings.map(toAiSettingView);
	}),

	get: withPermission("aiProvider", "read")
		.input(z.object({ aiId: z.string() }))
		.query(async ({ input, ctx }) => {
			const setting = await findAiSettingById(
				input.aiId,
				ctx.session.activeOrganizationId,
			);
			return toAiSettingView(setting);
		}),

	delete: withPermission("aiProvider", "delete")
		.input(z.object({ aiId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			return deleteAiSettings(input.aiId, ctx.session.activeOrganizationId);
		}),

	getCustomProviders: withPermission("aiProvider", "read").query(
		async ({ ctx }) => {
			return getCustomAiProviders(ctx.session.activeOrganizationId);
		},
	),

	saveCustomProviders: withPermission("aiProvider", "update")
		.input(apiSaveAiCustomProviders)
		.mutation(async ({ ctx, input }) => {
			try {
				return await saveCustomAiProviders(
					ctx.session.activeOrganizationId,
					input.providers,
				);
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	getEnabledProviders: withPermission("aiProvider", "read").query(
		async ({ ctx }) => {
			const settings = await getAiSettingsByOrganizationId(
				ctx.session.activeOrganizationId,
			);
			return settings
				.filter((setting) => setting.isEnabled)
				.map((setting) => ({
					aiId: setting.aiId,
					name: setting.name,
					model: setting.model,
					providerLabel: getAiProviderLabel(
						resolveAiProviderId(setting.apiUrl),
					),
				}));
		},
	),

	analyzeLogs: withPermission("aiProvider", "read")
		.input(
			z.object({
				aiId: z.string().min(1),
				logs: z.string().min(1),
				context: z.enum(["build", "runtime"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const aiSettings = await findAiSettingById(
				input.aiId,
				ctx.session.activeOrganizationId,
			);
			if (!aiSettings.isEnabled) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "AI provider is not enabled",
				});
			}

			const capabilities = getModelCapabilities(
				resolveAiProviderId(aiSettings.apiUrl),
				aiSettings.model,
			);
			if (capabilities.text === "unsupported") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This model does not support text generation",
				});
			}

			const contextLabel =
				input.context === "build" ? "build/deployment" : "runtime/container";

			try {
				const result = await generateAiText({
					config: {
						apiUrl: aiSettings.apiUrl,
						apiKey: aiSettings.apiKey,
					},
					model: aiSettings.model,
					allowPrivateNetworks: !IS_CLOUD,
					prompt: `You are a DevOps engineer analyzing ${contextLabel} logs. Analyze the following logs and provide:

1. **Summary**: A brief summary of what's happening
2. **Issues Found**: Any errors, warnings, or problems detected
3. **Root Cause**: The most likely root cause if there are errors
4. **Suggested Fix**: Actionable steps to resolve the issues

Be concise and practical. Focus on the most important issues. If the logs look healthy, say so briefly.

Logs:
${input.logs}`,
				});
				return { analysis: result.text, metadata: result.metadata };
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	testConnection: withPermission("aiProvider", "read")
		.input(
			z.object({
				aiId: z.string().optional(),
				apiUrl: z.string().optional(),
				apiKey: z.string().optional(),
				model: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				return await testAiConnectionForSetting({
					aiId: input.aiId,
					organizationId: ctx.session.activeOrganizationId,
					apiUrl: input.apiUrl,
					apiKey: input.apiKey,
					model: input.model,
				});
			} catch (error) {
				throw asTrpcError(error);
			}
		}),

	suggest: withPermission("aiProvider", "read")
		.input(
			z.object({
				aiId: z.string(),
				input: z.string(),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await suggestVariants({
					...input,
					organizationId: ctx.session.activeOrganizationId,
				});
			} catch (error) {
				throw asTrpcError(error);
			}
		}),
	deploy: protectedProcedure
		.input(deploySuggestionSchema)
		.mutation(async ({ ctx, input }) => {
			const environment = await findEnvironmentById(input.environmentId);
			const project = await findProjectById(environment.projectId);
			await checkServiceAccess(ctx, environment.projectId, "create");

			if (IS_CLOUD && !input.serverId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You need to use a server to create a compose",
				});
			}

			const projectName = slugify(`${project.name} ${input.id}`);

			const compose = await createComposeByTemplate({
				...input,
				composeFile: input.dockerCompose,
				env: input.envVariables,
				serverId: input.serverId,
				name: input.name,
				sourceType: "raw",
				appName: `${projectName}-${generatePassword(6)}`,
				environmentId: input.environmentId,
			});

			if (input.domains && input.domains?.length > 0) {
				for (const domain of input.domains) {
					await createDomain({
						...domain,
						domainType: "compose",
						certificateType: "none",
						composeId: compose.composeId,
					});
				}
			}
			if (input.configFiles && input.configFiles?.length > 0) {
				for (const mount of input.configFiles) {
					await createMount({
						filePath: mount.filePath,
						mountPath: "",
						content: mount.content,
						serviceId: compose.composeId,
						serviceType: "compose",
						type: "file",
					});
				}
			}

			await addNewService(ctx, compose.composeId);

			return null;
		}),
});
