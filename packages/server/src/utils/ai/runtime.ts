import { generateText, Output } from "ai";
import {
	type AiCapabilities,
	type AiCapabilityKey,
	getAiProviderLabel,
	getAiProviderPreset,
	getCapabilityWarnings,
	getModelCapabilities,
	isAiCapabilitySupported,
	resolveAiProviderId,
} from "./contracts";
import {
	getProviderHeaders,
	type Model,
	selectAIProvider,
} from "./select-ai-provider";

export const AI_MODEL_DISCOVERY_TIMEOUT_MS = 15_000;
export const AI_GENERATION_TIMEOUT_MS = 45_000;
export const AI_TEST_TIMEOUT_MS = 30_000;

export type AiErrorCategory =
	| "auth"
	| "quota"
	| "rate_limit"
	| "timeout"
	| "network"
	| "unsupported"
	| "invalid_request"
	| "provider_unavailable"
	| "unknown";

const RETRYABLE_CATEGORIES: ReadonlySet<AiErrorCategory> = new Set([
	"rate_limit",
	"timeout",
	"network",
	"provider_unavailable",
]);

export class AiRuntimeError extends Error {
	readonly category: AiErrorCategory;
	readonly providerId: string;
	readonly retryable: boolean;
	readonly statusCode?: number;

	constructor({
		category,
		message,
		providerId,
		retryable = RETRYABLE_CATEGORIES.has(category),
		statusCode,
		cause,
	}: {
		category: AiErrorCategory;
		message: string;
		providerId: string;
		retryable?: boolean;
		statusCode?: number;
		cause?: unknown;
	}) {
		super(message, { cause });
		this.name = "AiRuntimeError";
		this.category = category;
		this.providerId = providerId;
		this.retryable = retryable;
		this.statusCode = statusCode;
	}
}

/** Trim provider payloads so an error toast never echoes a large response. */
const redactSecrets = (value: string) =>
	value
		.replace(/sk-[a-zA-Z0-9_-]{8,}/g, "sk-***")
		.replace(/(bearer\s+)[^\s,;]+/gi, "$1***")
		.replace(/(x-api-key["']?\s*[:=]\s*)[^\s,;]+/gi, "$1***")
		.slice(0, 280);

const readStatus = (error: unknown): number | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const candidate = error as {
		statusCode?: unknown;
		status?: unknown;
		response?: { status?: unknown };
	};
	for (const value of [
		candidate.statusCode,
		candidate.status,
		candidate.response?.status,
	]) {
		if (typeof value === "number") return value;
	}
	return undefined;
};

const readMessage = (error: unknown) => {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown AI provider error";
};

export const normalizeAiError = (
	error: unknown,
	{ providerId, timeoutMs }: { providerId?: string; timeoutMs?: number } = {},
): AiRuntimeError => {
	if (error instanceof AiRuntimeError) return error;

	const resolvedProviderId = providerId ?? "custom";
	const status = readStatus(error);
	const rawMessage = readMessage(error);
	const message = redactSecrets(rawMessage);
	const lower = rawMessage.toLowerCase();

	if (
		error instanceof Error &&
		(error.name === "AbortError" ||
			error.name === "TimeoutError" ||
			lower.includes("timeout") ||
			lower.includes("timed out") ||
			lower.includes("aborted"))
	) {
		return new AiRuntimeError({
			category: "timeout",
			message: `The provider did not answer within ${Math.round(
				(timeoutMs ?? AI_GENERATION_TIMEOUT_MS) / 1000,
			)}s.`,
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (status === 401 || status === 403) {
		return new AiRuntimeError({
			category: "auth",
			message: "The provider rejected the credentials.",
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (status === 402 || status === 429) {
		return new AiRuntimeError({
			category: status === 429 ? "rate_limit" : "quota",
			message:
				status === 429
					? "The provider rate limit was reached."
					: "The provider account has no remaining quota.",
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (status !== undefined && status >= 500) {
		return new AiRuntimeError({
			category: "provider_unavailable",
			message: "The provider is temporarily unavailable.",
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (
		lower.includes("fetch failed") ||
		lower.includes("econnrefused") ||
		lower.includes("enotfound") ||
		lower.includes("network") ||
		lower.includes("socket")
	) {
		return new AiRuntimeError({
			category: "network",
			message: "The provider could not be reached.",
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (
		lower.includes("not supported") ||
		lower.includes("unsupported") ||
		lower.includes("does not support")
	) {
		return new AiRuntimeError({
			category: "unsupported",
			message,
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	if (status === 400 || status === 404 || status === 422) {
		return new AiRuntimeError({
			category: "invalid_request",
			message,
			providerId: resolvedProviderId,
			statusCode: status,
			cause: error,
		});
	}

	return new AiRuntimeError({
		category: "unknown",
		message,
		providerId: resolvedProviderId,
		statusCode: status,
		cause: error,
	});
};

const BLOCKED_HOSTNAMES = new Set([
	"metadata",
	"metadata.google.internal",
	"metadata.goog",
	"metadata.azure.internal",
	"instance-data",
	"instance-data.ec2.internal",
]);

const BLOCKED_IPS = new Set([
	"169.254.169.254",
	"169.254.170.2",
	"100.100.100.200",
	"fd00:ec2::254",
]);

const normalizeHostname = (hostname: string) =>
	hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "");

const isPrivateIpv4 = (hostname: string) => {
	const parts = hostname.split(".").map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
		return false;
	}
	const [a = -1, b = -1] = parts;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
};

const isPrivateIpv6 = (hostname: string) => {
	const value = normalizeHostname(hostname);
	return (
		value === "::1" ||
		value === "::" ||
		value.startsWith("fc") ||
		value.startsWith("fd") ||
		value.startsWith("fe8") ||
		value.startsWith("fe9") ||
		value.startsWith("fea") ||
		value.startsWith("feb") ||
		value.startsWith("::ffff:127.") ||
		value.startsWith("::ffff:10.") ||
		value.startsWith("::ffff:192.168.")
	);
};

const isPrivateHostname = (hostname: string) => {
	const value = normalizeHostname(hostname);
	return (
		value === "localhost" ||
		value.endsWith(".localhost") ||
		value.endsWith(".local") ||
		value.endsWith(".internal") ||
		value.endsWith(".home.arpa") ||
		isPrivateIpv4(value) ||
		isPrivateIpv6(value)
	);
};

/**
 * Validate an endpoint before Notploy stores it or sends a request.
 *
 * Self-hosted installations legitimately target private networks and local
 * Ollama instances, so private ranges are allowed by default. Cloud must pass
 * `allowPrivateNetworks: false`. Cloud metadata and link-local addresses are
 * always blocked, whatever the deployment mode.
 *
 * This is a configuration-time guard; it does not resolve DNS. Reverse proxies
 * and network policies remain the enforcement point against DNS rebinding.
 */
export const validateAiEndpointUrl = (
	apiUrl: string,
	{ allowPrivateNetworks = true }: { allowPrivateNetworks?: boolean } = {},
): URL => {
	let url: URL;
	try {
		url = new URL(apiUrl.trim());
	} catch {
		throw new AiRuntimeError({
			category: "invalid_request",
			message: "Enter a valid absolute HTTP(S) endpoint.",
			providerId: "custom",
		});
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new AiRuntimeError({
			category: "invalid_request",
			message: "AI endpoints must use HTTP or HTTPS.",
			providerId: "custom",
		});
	}

	if (url.username || url.password) {
		throw new AiRuntimeError({
			category: "invalid_request",
			message: "Credentials must not be embedded in the endpoint URL.",
			providerId: "custom",
		});
	}

	const hostname = normalizeHostname(url.hostname);

	if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_IPS.has(hostname)) {
		throw new AiRuntimeError({
			category: "invalid_request",
			message:
				"Cloud metadata and link-local endpoints are not allowed as AI providers.",
			providerId: "custom",
		});
	}

	if (!allowPrivateNetworks && isPrivateHostname(hostname)) {
		throw new AiRuntimeError({
			category: "invalid_request",
			message:
				"Private and loopback AI endpoints are disabled for this deployment.",
			providerId: "custom",
		});
	}

	if (!allowPrivateNetworks && /^\d+$/.test(hostname)) {
		throw new AiRuntimeError({
			category: "invalid_request",
			message: "Private and loopback AI endpoints are disabled.",
			providerId: "custom",
		});
	}

	return url;
};

export interface AiRuntimeConfig {
	apiUrl: string;
	apiKey: string;
}

export interface AiRuntime {
	providerId: string;
	providerLabel: string;
	capabilities: AiCapabilities;
	model: (modelId: string) => ReturnType<ReturnType<typeof selectAIProvider>>;
}

export const createAiRuntime = (
	config: AiRuntimeConfig,
	{ allowPrivateNetworks = true }: { allowPrivateNetworks?: boolean } = {},
): AiRuntime => {
	const url = validateAiEndpointUrl(config.apiUrl, { allowPrivateNetworks });
	const apiUrl = url.toString().replace(/\/+$/, "");
	const providerId = resolveAiProviderId(apiUrl);
	const provider = selectAIProvider({ ...config, apiUrl });

	return {
		providerId,
		providerLabel: getAiProviderLabel(providerId),
		capabilities: getModelCapabilities(providerId, ""),
		model: (modelId: string) => provider(modelId),
	};
};

export const assertCapability = (
	capabilities: Partial<AiCapabilities>,
	capability: AiCapabilityKey,
	providerLabel: string,
) => {
	if (capabilities[capability] === "unsupported") {
		throw new AiRuntimeError({
			category: "unsupported",
			message: `${providerLabel} does not support ${capability} for this model.`,
			providerId: "custom",
		});
	}
};

export interface AiModelInfo extends Model {
	capabilities: AiCapabilities;
}

const MODEL_LISTS: Record<string, string[]> = {
	perplexity: [
		"sonar-deep-research",
		"sonar-reasoning-pro",
		"sonar-reasoning",
		"sonar-pro",
		"sonar",
	],
	zai: ["glm-5", "glm-4.7"],
	minimax: ["MiniMax-M2.7"],
};

const withCapabilities = (providerId: string, models: Model[]): AiModelInfo[] =>
	models.map((model) => ({
		...model,
		capabilities: getModelCapabilities(providerId, model.id),
	}));

const modelError = (providerId: string, message: string) =>
	new AiRuntimeError({
		category: "invalid_request",
		message,
		providerId,
	});

/**
 * Discover models from the provider endpoint when the API supports it.
 * Providers without a discovery endpoint return a curated list instead.
 */
export const discoverAiModels = async (
	config: AiRuntimeConfig,
	options: {
		allowPrivateNetworks?: boolean;
		timeoutMs?: number;
	} = {},
): Promise<AiModelInfo[]> => {
	const url = validateAiEndpointUrl(config.apiUrl, {
		allowPrivateNetworks: options.allowPrivateNetworks,
	});
	const apiUrl = url.toString().replace(/\/+$/, "");
	const providerId = resolveAiProviderId(apiUrl);
	const preset = getAiProviderPreset(providerId);
	const timeoutMs = options.timeoutMs ?? AI_MODEL_DISCOVERY_TIMEOUT_MS;
	const timeout = AbortSignal.timeout(timeoutMs);

	if (!preset?.modelDiscovery) {
		throw modelError(
			providerId,
			`${getAiProviderLabel(providerId)} does not expose a model discovery endpoint. Enter the model identifier manually.`,
		);
	}

	const hardcoded = MODEL_LISTS[providerId];
	if (hardcoded) {
		return withCapabilities(
			providerId,
			hardcoded.map((id) => ({
				id,
				object: "model",
				created: Date.now(),
				owned_by: providerId,
			})),
		);
	}

	if (preset.requiresApiKey && !config.apiKey) {
		throw new AiRuntimeError({
			category: "auth",
			message: `${getAiProviderLabel(providerId)} requires an API key to list models.`,
			providerId,
		});
	}

	const headers =
		providerId === "gemini"
			? {}
			: config.apiKey
				? getProviderHeaders(apiUrl, config.apiKey)
				: {};

	let response: Response;
	try {
		if (providerId === "ollama") {
			response = await fetch(`${apiUrl}/api/tags`, {
				headers,
				signal: timeout,
			});
		} else if (providerId === "gemini") {
			response = await fetch(
				`${apiUrl}/models?key=${encodeURIComponent(config.apiKey)}`,
				{ headers, signal: timeout },
			);
		} else {
			response = await fetch(`${apiUrl}/models`, { headers, signal: timeout });
		}
	} catch (error) {
		throw normalizeAiError(error, { providerId, timeoutMs });
	}

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw normalizeAiError(
			Object.assign(new Error(detail || response.statusText), {
				statusCode: response.status,
			}),
			{ providerId, timeoutMs },
		);
	}

	const body = (await response.json().catch(() => null)) as unknown;
	const rawModels: Model[] = (() => {
		if (Array.isArray(body)) return body as Model[];
		if (body && typeof body === "object") {
			const record = body as Record<string, unknown>;
			if (Array.isArray(record.models)) return record.models as Model[];
			if (Array.isArray(record.data)) return record.data as Model[];
			const firstArray = Object.values(record).find(Array.isArray);
			if (Array.isArray(firstArray)) return firstArray as Model[];
		}
		return [];
	})();

	return withCapabilities(
		providerId,
		rawModels
			.map((model) => ({
				id: String(model.id ?? (model as { name?: string }).name ?? ""),
				object: "model",
				created: Number(model.created ?? Date.now()),
				owned_by: String(model.owned_by ?? providerId),
			}))
			.filter((model) => model.id.length > 0),
	);
};

export interface AiExecutionMetadata {
	providerId: string;
	providerLabel: string;
	model: string;
	durationMs: number;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
}

export interface AiTextResult {
	text: string;
	metadata: AiExecutionMetadata;
}

/**
 * Generate text through the shared runtime. Callers pass an endpoint + model,
 * never a provider-specific client.
 */
export const generateAiText = async ({
	config,
	model,
	prompt,
	timeoutMs = AI_GENERATION_TIMEOUT_MS,
	maxRetries = 0,
	allowPrivateNetworks = true,
}: {
	config: AiRuntimeConfig;
	model: string;
	prompt: string;
	timeoutMs?: number;
	maxRetries?: number;
	allowPrivateNetworks?: boolean;
}): Promise<AiTextResult> => {
	const runtime = createAiRuntime(config, { allowPrivateNetworks });
	const startedAt = Date.now();

	try {
		const result = await generateText({
			model: runtime.model(model),
			prompt,
			maxRetries,
			temperature: 0,
			abortSignal: AbortSignal.timeout(timeoutMs),
		});

		return {
			text: result.text,
			metadata: {
				providerId: runtime.providerId,
				providerLabel: runtime.providerLabel,
				model,
				durationMs: Date.now() - startedAt,
				usage: result.usage
					? {
							inputTokens: result.usage.inputTokens,
							outputTokens: result.usage.outputTokens,
							totalTokens: result.usage.totalTokens,
						}
					: undefined,
			},
		};
	} catch (error) {
		throw normalizeAiError(error, {
			providerId: runtime.providerId,
			timeoutMs,
		});
	}
};

/**
 * Structured output wrapper used by AI features that validate JSON (for
 * example Compose suggestions). The provider must support structured output;
 * unknown support is allowed to try, and a clear runtime error is returned if
 * the provider rejects it.
 */
export const generateAiStructured = async <T>({
	config,
	model,
	prompt,
	schema,
	timeoutMs = AI_GENERATION_TIMEOUT_MS,
	allowPrivateNetworks = true,
}: {
	config: AiRuntimeConfig;
	model: string;
	prompt: string;
	schema: unknown;
	timeoutMs?: number;
	allowPrivateNetworks?: boolean;
}): Promise<{ output: T; metadata: AiExecutionMetadata }> => {
	const runtime = createAiRuntime(config, { allowPrivateNetworks });
	const startedAt = Date.now();

	try {
		const result = await generateText({
			model: runtime.model(model),
			prompt,
			maxRetries: 0,
			temperature: 0,
			abortSignal: AbortSignal.timeout(timeoutMs),
			// Zod + AI SDK Output.object() causes excessively deep instantiation.
			// @ts-expect-error
			output: Output.object({ schema }),
		});

		if (!result.output) {
			throw new AiRuntimeError({
				category: "invalid_request",
				message: "The provider returned no structured output.",
				providerId: runtime.providerId,
			});
		}

		return {
			output: result.output as T,
			metadata: {
				providerId: runtime.providerId,
				providerLabel: runtime.providerLabel,
				model,
				durationMs: Date.now() - startedAt,
				usage: result.usage
					? {
							inputTokens: result.usage.inputTokens,
							outputTokens: result.usage.outputTokens,
							totalTokens: result.usage.totalTokens,
						}
					: undefined,
			},
		};
	} catch (error) {
		throw normalizeAiError(error, {
			providerId: runtime.providerId,
			timeoutMs,
		});
	}
};

export interface AiConnectionTestResult {
	success: true;
	message: string;
	providerId: string;
	providerLabel: string;
	model: string;
	latencyMs: number;
	capabilities: AiCapabilities;
	verifiedCapabilities: Partial<AiCapabilities>;
	warnings: string[];
}

/**
 * Test a provider/model couple with a tiny generation call. A successful call
 * verifies text generation only; the other capabilities stay declared/unknown.
 */
export const testAiConnection = async ({
	config,
	model,
	timeoutMs = AI_TEST_TIMEOUT_MS,
	allowPrivateNetworks = true,
}: {
	config: AiRuntimeConfig;
	model: string;
	timeoutMs?: number;
	allowPrivateNetworks?: boolean;
}): Promise<AiConnectionTestResult> => {
	const runtime = createAiRuntime(config, { allowPrivateNetworks });
	const capabilities = getModelCapabilities(runtime.providerId, model);

	if (!isAiCapabilitySupported(capabilities, "text")) {
		throw new AiRuntimeError({
			category: "unsupported",
			message: `${runtime.providerLabel} model "${model}" does not support text generation.`,
			providerId: runtime.providerId,
		});
	}

	const result = await generateAiText({
		config,
		model,
		prompt: "Reply with the single word: ok",
		timeoutMs,
		maxRetries: 0,
		allowPrivateNetworks,
	});

	return {
		success: true,
		message: "Connection successful",
		providerId: runtime.providerId,
		providerLabel: runtime.providerLabel,
		model,
		latencyMs: result.metadata.durationMs,
		capabilities,
		verifiedCapabilities: { text: "supported" },
		warnings: getCapabilityWarnings(capabilities),
	};
};
