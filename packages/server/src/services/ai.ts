import { db } from "@notploy/server/db";
import { ai, organization } from "@notploy/server/db/schema";
import { aiCustomProviderSchema } from "@notploy/server/db/schema/ai";
import {
	type AiCapabilities,
	getAiProviderLabel,
	getAiProviderPreset,
	getModelCapabilities,
	resolveAiProviderId,
} from "@notploy/server/utils/ai/contracts";
import {
	type AiConnectionTestResult,
	type AiModelInfo,
	discoverAiModels,
	generateAiStructured,
	normalizeAiError,
	testAiConnection,
	validateAiEndpointUrl,
} from "@notploy/server/utils/ai/runtime";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { IS_CLOUD } from "../constants";
import { findServerById } from "./server";
import { getWebServerSettings } from "./web-server-settings";

interface SuggestionItem {
	id: string;
	name: string;
	shortDescription: string;
	description: string;
}

interface SuggestionsOutput {
	suggestions: SuggestionItem[];
}

interface DockerOutput {
	dockerCompose: string;
	envVariables: Array<{ name: string; value: string }>;
	domains: Array<{ host: string; port: number; serviceName: string }>;
	configFiles?: Array<{ content: string; filePath: string }> | null;
}

export const getAiSettingsByOrganizationId = async (organizationId: string) => {
	const aiSettings = await db.query.ai.findMany({
		where: eq(ai.organizationId, organizationId),
		orderBy: desc(ai.createdAt),
	});
	return aiSettings;
};

export const getAiSettingById = async (aiId: string) => {
	const aiSetting = await db.query.ai.findFirst({
		where: eq(ai.aiId, aiId),
	});
	if (!aiSetting) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "AI settings not found",
		});
	}
	return aiSetting;
};

/**
 * Load a configuration while enforcing the organization boundary. Every
 * mutation and every operation that uses a stored API key goes through this
 * helper instead of trusting an `aiId` sent by the client.
 */
export const findAiSettingById = async (
	aiId: string,
	organizationId: string,
) => {
	const aiSetting = await db.query.ai.findFirst({
		where: and(eq(ai.aiId, aiId), eq(ai.organizationId, organizationId)),
	});
	if (!aiSetting) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "AI settings not found",
		});
	}
	return aiSetting;
};

export type AiTestStatus = "success" | "error";

export interface AiSettingView {
	aiId: string;
	name: string;
	apiUrl: string;
	model: string;
	isEnabled: boolean;
	createdAt: string;
	hasApiKey: boolean;
	providerId: string;
	providerLabel: string;
	capabilities: AiCapabilities;
	verifiedCapabilities: Partial<AiCapabilities> | null;
	lastTestStatus: AiTestStatus | null;
	lastTestMessage: string | null;
	lastTestedAt: string | null;
	lastTestLatencyMs: number | null;
}

const parseVerifiedCapabilities = (
	value: string | null,
): Partial<AiCapabilities> | null => {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as Record<string, unknown>;
		const result: Partial<AiCapabilities> = {};
		for (const [key, support] of Object.entries(parsed)) {
			if (support === "supported") {
				result[key as keyof AiCapabilities] = "supported";
			}
		}
		return Object.keys(result).length > 0 ? result : null;
	} catch {
		return null;
	}
};

/** Strip secrets before an AI configuration leaves the server. */
export const toAiSettingView = (
	setting: typeof ai.$inferSelect,
): AiSettingView => {
	const providerId = resolveAiProviderId(setting.apiUrl);
	return {
		aiId: setting.aiId,
		name: setting.name,
		apiUrl: setting.apiUrl,
		model: setting.model,
		isEnabled: setting.isEnabled,
		createdAt: setting.createdAt,
		hasApiKey: Boolean(setting.apiKey),
		providerId,
		providerLabel: getAiProviderLabel(providerId),
		capabilities: getModelCapabilities(providerId, setting.model),
		verifiedCapabilities: parseVerifiedCapabilities(
			setting.verifiedCapabilities,
		),
		lastTestStatus: (setting.lastTestStatus as AiTestStatus | null) ?? null,
		lastTestMessage: setting.lastTestMessage,
		lastTestedAt: setting.lastTestedAt,
		lastTestLatencyMs: setting.lastTestLatencyMs,
	};
};

type AiCustomProvider = z.infer<typeof aiCustomProviderSchema>;

const parseOrgMetadata = (metadata: string | null) => {
	try {
		const parsed = JSON.parse(metadata || "{}");
		return typeof parsed === "object" && parsed !== null
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
};

export const getCustomAiProviders = async (organizationId: string) => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
	});
	const metadata = parseOrgMetadata(org?.metadata ?? null);
	const result = z
		.array(aiCustomProviderSchema)
		.safeParse(metadata.aiProviders);
	return result.success ? result.data : [];
};

export const saveCustomAiProviders = async (
	organizationId: string,
	providers: AiCustomProvider[],
) => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
	});
	if (!org) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Organization not found",
		});
	}

	const seen = new Set<string>();
	const normalized = providers.map((provider) => {
		const apiUrl = normalizeApiUrl(provider.apiUrl);
		validateAiEndpointUrl(apiUrl, { allowPrivateNetworks: !IS_CLOUD });
		if (seen.has(apiUrl)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Duplicate custom provider URL: ${apiUrl}`,
			});
		}
		seen.add(apiUrl);
		return {
			name: provider.name.trim(),
			apiUrl,
		};
	});

	const metadata = parseOrgMetadata(org.metadata);
	metadata.aiProviders = normalized;
	await db
		.update(organization)
		.set({ metadata: JSON.stringify(metadata) })
		.where(eq(organization.id, organizationId));
	return normalized;
};

const normalizeApiUrl = (url: string) => url.trim().replace(/\/+$/, "");

const resetTestState = {
	lastTestStatus: null,
	lastTestMessage: null,
	lastTestedAt: null,
	lastTestLatencyMs: null,
	verifiedCapabilities: null,
} as const;

interface SaveAiSettingsInput {
	aiId?: string;
	name?: string;
	apiUrl?: string;
	apiKey?: string;
	model?: string;
	isEnabled?: boolean;
}

export const saveAiSettings = async (
	organizationId: string,
	settings: SaveAiSettingsInput,
) => {
	const requestedAiId =
		typeof settings.aiId === "string" && settings.aiId.length > 0
			? settings.aiId
			: undefined;
	const existing = requestedAiId
		? await findAiSettingById(requestedAiId, organizationId)
		: null;

	const apiUrl = normalizeApiUrl(
		String(settings.apiUrl ?? existing?.apiUrl ?? ""),
	);
	if (!apiUrl) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "API URL is required",
		});
	}

	validateAiEndpointUrl(apiUrl, { allowPrivateNetworks: !IS_CLOUD });

	const customProviders = await getCustomAiProviders(organizationId);
	if (customProviders.length > 0) {
		const isAllowed = customProviders.some(
			(provider) => normalizeApiUrl(provider.apiUrl) === apiUrl,
		);
		if (!isAllowed) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"This API URL is not in your organization's allowed AI providers",
			});
		}
	}

	const providerId = resolveAiProviderId(apiUrl);
	const preset = getAiProviderPreset(providerId);
	const submittedKey =
		typeof settings.apiKey === "string" ? settings.apiKey.trim() : undefined;
	// An empty key means "keep the stored secret" when editing. Creating a
	// cloud configuration still requires a key; local/custom endpoints may not.
	const apiKey = submittedKey || existing?.apiKey || "";
	if (!apiKey && preset?.requiresApiKey) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `${preset.name} requires an API key`,
		});
	}

	const name = String(settings.name ?? existing?.name ?? "").trim();
	const model = String(settings.model ?? existing?.model ?? "").trim();
	if (!name || !model) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Name and model are required",
		});
	}

	const values = {
		...(requestedAiId ? { aiId: requestedAiId } : {}),
		organizationId,
		name,
		apiUrl,
		apiKey,
		model,
		isEnabled:
			typeof settings.isEnabled === "boolean"
				? settings.isEnabled
				: (existing?.isEnabled ?? true),
	};

	const endpointChanged =
		!existing ||
		normalizeApiUrl(existing.apiUrl) !== apiUrl ||
		existing.model !== model;

	return db
		.insert(ai)
		.values(values)
		.onConflictDoUpdate({
			target: ai.aiId,
			set: endpointChanged ? { ...values, ...resetTestState } : values,
		});
};

export const deleteAiSettings = async (
	aiId: string,
	organizationId: string,
) => {
	await findAiSettingById(aiId, organizationId);
	return db
		.delete(ai)
		.where(and(eq(ai.aiId, aiId), eq(ai.organizationId, organizationId)));
};

export const getAiModelsForSetting = async ({
	aiId,
	organizationId,
	apiUrl,
	apiKey,
}: {
	aiId?: string;
	organizationId: string;
	apiUrl?: string;
	apiKey?: string;
}): Promise<AiModelInfo[]> => {
	const existing = aiId ? await findAiSettingById(aiId, organizationId) : null;
	const resolvedUrl = normalizeApiUrl(String(apiUrl ?? existing?.apiUrl ?? ""));
	if (!resolvedUrl) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "API URL is required",
		});
	}

	return discoverAiModels(
		{
			apiUrl: resolvedUrl,
			apiKey: apiKey?.trim() || existing?.apiKey || "",
		},
		{ allowPrivateNetworks: !IS_CLOUD },
	);
};

export const testAiConnectionForSetting = async ({
	aiId,
	organizationId,
	apiUrl,
	apiKey,
	model,
}: {
	aiId?: string;
	organizationId: string;
	apiUrl?: string;
	apiKey?: string;
	model: string;
}): Promise<AiConnectionTestResult> => {
	const existing = aiId ? await findAiSettingById(aiId, organizationId) : null;
	const resolvedUrl = normalizeApiUrl(String(apiUrl ?? existing?.apiUrl ?? ""));

	try {
		const result = await testAiConnection({
			config: {
				apiUrl: resolvedUrl,
				apiKey: apiKey?.trim() || existing?.apiKey || "",
			},
			model,
			allowPrivateNetworks: !IS_CLOUD,
		});

		if (existing) {
			await db
				.update(ai)
				.set({
					lastTestStatus: "success",
					lastTestMessage: result.message,
					lastTestedAt: new Date().toISOString(),
					lastTestLatencyMs: result.latencyMs,
					verifiedCapabilities: JSON.stringify(result.verifiedCapabilities),
				})
				.where(
					and(
						eq(ai.aiId, existing.aiId),
						eq(ai.organizationId, organizationId),
					),
				);
		}

		return result;
	} catch (error) {
		const normalized = normalizeAiError(error);
		if (existing) {
			await db
				.update(ai)
				.set({
					lastTestStatus: "error",
					lastTestMessage: `${normalized.category}: ${normalized.message}`,
					lastTestedAt: new Date().toISOString(),
					lastTestLatencyMs: null,
					verifiedCapabilities: null,
				})
				.where(
					and(
						eq(ai.aiId, existing.aiId),
						eq(ai.organizationId, organizationId),
					),
				);
		}
		throw normalized;
	}
};

interface Props {
	organizationId: string;
	aiId: string;
	input: string;
	serverId?: string | undefined;
}

export const suggestVariants = async ({
	organizationId,
	aiId,
	input,
	serverId,
}: Props) => {
	try {
		const aiSettings = await getAiSettingById(aiId);
		if (!aiSettings.isEnabled || aiSettings.organizationId !== organizationId) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "AI features are not enabled for this configuration",
			});
		}

		const capabilities = getModelCapabilities(
			resolveAiProviderId(aiSettings.apiUrl),
			aiSettings.model,
		);
		if (capabilities.structuredOutput === "unsupported") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"This provider does not support the structured output required for Compose suggestions",
			});
		}

		let ip = "";
		if (!IS_CLOUD) {
			const settings = await getWebServerSettings();
			ip = settings?.serverIp || "";
		}

		if (serverId) {
			const server = await findServerById(serverId);
			ip = server.ipAddress;
		} else if (process.env.NODE_ENV === "development") {
			ip = "127.0.0.1";
		}

		const fullSchema = z.object({
			suggestions: z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					shortDescription: z.string(),
					description: z.string(),
					dockerCompose: z.string(),
					envVariables: z.array(
						z.object({
							name: z.string(),
							value: z.string(),
						}),
					),
					domains: z.array(
						z.object({
							host: z.string(),
							port: z.number(),
							serviceName: z.string(),
						}),
					),
					configFiles: z
						.array(
							z.object({
								content: z.string(),
								filePath: z.string(),
							}),
						)
						.nullable(),
				}),
			),
		});

		const result = await generateAiStructured<
			SuggestionsOutput & {
				suggestions: (SuggestionItem & DockerOutput)[];
			}
		>({
			config: {
				apiUrl: aiSettings.apiUrl,
				apiKey: aiSettings.apiKey,
			},
			model: aiSettings.model,
			schema: fullSchema,
			allowPrivateNetworks: !IS_CLOUD,
			prompt: `
		    Act as advanced DevOps engineer. Analyze the user's request and generate up to 3 deployment suggestions, each with a complete docker compose configuration.

		    CRITICAL - Read the user's request carefully and follow the appropriate strategy:

		    Strategy A - If the user specifies a PARTICULAR APPLICATION/SERVICE (e.g., "deploy Chatwoot", "install sendingtk/chatwoot:develop", "setup Bitwarden"):
		    - Generate different deployment VARIANTS of that SAME application
		    - Each variant should be a different configuration (minimal, full stack, with different databases, development vs production, etc.)
		    - Example: For "Chatwoot" → "Chatwoot with PostgreSQL", "Chatwoot Development", "Chatwoot Full Stack"
		    - The name MUST include the specific application name the user mentioned

		    Strategy B - If the user describes a GENERAL NEED or USE CASE (e.g., "personal blog", "project management tool", "chat application"):
		    - Suggest different open source projects that fulfill that need
		    - Each suggestion should be a different tool/platform that solves the same problem
		    - Example: For "personal blog" → "WordPress", "Ghost", "Hugo with Nginx"
		    - The name should be the actual project name

		    Return your response as a JSON object with this structure:
		    {
		      "suggestions": [
		        {
		          "id": "project-or-variant-slug",
		          "name": "Project Name or Variant Name",
		          "shortDescription": "Brief one-line description",
		          "description": "Detailed description of the project/variant",
		          "dockerCompose": "yaml string here",
		          "envVariables": [{"name": "VAR_NAME", "value": "example_value"}],
		          "domains": [{"host": "domain.com", "port": 3000, "serviceName": "service"}],
		          "configFiles": [{"content": "file content", "filePath": "path/to/file"}]
		        }
		      ]
		    }

		    Suggestion Rules:
		    1. Use slug format for the id field (lowercase, hyphenated)
		    2. The description field should ONLY contain plain text — no code snippets or installation instructions
		    3. The shortDescription should be a single-line summary focusing on key technologies or differentiators
		    4. All suggestions should be installable in docker and have docker compose support
		    5. Provide variety in your suggestions - different complexity levels, tech stacks, or approaches

		    Docker Compose Rules:
		    1. Use placeholder like \${VARIABLE_NAME-default} for generated variables in the docker-compose.yml
		    2. Use complex values for passwords/secrets variables
		    3. Don't set container_name field in services
		    4. Don't set version field in the docker compose
		    5. Don't set ports like 'ports: 3000:3000', use 'ports: "3000"' instead
		    6. If a service depends on a database or other service, INCLUDE that service in the docker-compose
		    7. Make sure all required services are defined in the docker-compose

		    Docker Image Rules (CRITICAL):
		    1. ALWAYS use 'image:' field, NEVER use 'build:' field
		    2. NEVER use 'build: .' or any build directive - we don't have local Dockerfiles
		    3. Use images from Docker Hub or other public registries (e.g., docker.io, ghcr.io, quay.io)
		    4. For dependencies (databases, redis, etc.), use official images (e.g., postgres:16, redis:8, etc.)
		    5. Always specify image tags - avoid using 'latest' tag, use specific versions when possible
		    6. Examples of correct image usage:
		       - image: sendingtk/chatwoot:develop
		       - image: postgres:16-alpine
		       - image: redis:8-alpine
		    7. Examples of INCORRECT usage (DO NOT USE):
		       - build: .
		       - build: ./app
		       - build:
		           context: .
		           dockerfile: Dockerfile

		    Volume Mounting and Configuration Rules:
		    1. DO NOT create configuration files unless the service CANNOT work without them
		    2. Most services can work with just environment variables - USE THEM FIRST
		    3. If and ONLY IF a config file is absolutely required:
		       - Keep it minimal with only critical settings
		       - Use "../files/" prefix for all mounts
		       - Format: "../files/folder:/container/path"
		    4. DO NOT add configuration files for default configs, env-configurable settings, or proxy/routing configs

		    Environment Variables Rules:
		    1. For the envVariables array, provide ACTUAL example values, not placeholders
		    2. Use realistic example values (e.g., "admin@example.com" for emails, "mypassword123" for passwords)
		    3. DO NOT use \${VARIABLE_NAME-default} syntax in the envVariables values
		    4. ONLY include environment variables that are actually used in the docker-compose
		    5. Every environment variable referenced in the docker-compose MUST have a corresponding entry in envVariables

		    Domain Rules - For each service that needs to be exposed to the internet:
		    1. Define a domain with:
		       - host: {service-name}-{random-3-chars-hex}-${ip ? ip.replaceAll(".", "-") : ""}.sslip.io
		       - port: the internal port the service runs on
		       - serviceName: the name of the service in the docker-compose
		    2. Make sure the service is properly configured to work with the specified port

		    User's request: ${input}
		  `,
		});

		const output = result.output as
			| { suggestions: (SuggestionItem & DockerOutput)[] }
			| undefined;

		if (!output?.suggestions?.length) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "No suggestions found",
			});
		}

		return output.suggestions.filter((s) => s.dockerCompose);
	} catch (error) {
		// Do not log the prompt or the provider response: both may contain
		// user data or credentials.
		throw normalizeAiError(error);
	}
};
