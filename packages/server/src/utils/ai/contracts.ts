/**
 * Shared AI contracts.
 *
 * A provider describes *how* Notploy reaches a model endpoint. A model is an
 * identifier exposed by that endpoint. Capabilities describe what the adapter
 * knows about the protocol, not what every model served by it can do — an
 * `unknown` capability must never be presented as guaranteed.
 *
 * Keep this module free of Node-only imports: the settings UI imports the
 * preset list and labels from here so both sides share one source of truth.
 */

export const AI_CAPABILITY_KEYS = [
	"text",
	"streaming",
	"structuredOutput",
	"toolCalling",
	"embeddings",
] as const;

export type AiCapabilityKey = (typeof AI_CAPABILITY_KEYS)[number];

/**
 * - `supported`: declared by the adapter and safe to rely on for this endpoint.
 * - `unsupported`: the adapter cannot provide it.
 * - `unknown`: the endpoint may support it, but Notploy has not verified it.
 */
export type AiCapabilitySupport = "supported" | "unsupported" | "unknown";

export type AiCapabilities = Record<AiCapabilityKey, AiCapabilitySupport>;

export interface AiCapabilityMeta {
	label: string;
	description: string;
}

export const AI_CAPABILITY_META: Record<AiCapabilityKey, AiCapabilityMeta> = {
	text: {
		label: "Text",
		description: "Generate text responses.",
	},
	streaming: {
		label: "Streaming",
		description: "Stream tokens while the model is generating.",
	},
	structuredOutput: {
		label: "Structured",
		description: "Return validated JSON / structured objects.",
	},
	toolCalling: {
		label: "Tools",
		description: "Call tools or functions exposed by the caller.",
	},
	embeddings: {
		label: "Embeddings",
		description: "Generate vector embeddings.",
	},
};

export const AI_CAPABILITY_ORDER = AI_CAPABILITY_KEYS;

export type AiProviderCategory = "cloud" | "gateway" | "self-hosted" | "custom";

export const AI_PROVIDER_CATEGORY_LABELS: Record<AiProviderCategory, string> = {
	cloud: "Cloud providers",
	gateway: "Gateways",
	"self-hosted": "Self-hosted / local",
	custom: "Custom endpoint",
};

export interface AiProviderPreset {
	id: string;
	name: string;
	apiUrl: string;
	category: AiProviderCategory;
	description: string;
	requiresApiKey: boolean;
	/** Whether the provider exposes an endpoint Notploy can use to list models. */
	modelDiscovery: boolean;
	capabilities: AiCapabilities;
}

const supported = {
	text: "supported",
	streaming: "supported",
	structuredOutput: "supported",
	toolCalling: "supported",
	embeddings: "supported",
} as const satisfies AiCapabilities;

const chatOnly = {
	text: "supported",
	streaming: "supported",
	structuredOutput: "supported",
	toolCalling: "supported",
	embeddings: "unsupported",
} as const satisfies AiCapabilities;

const openAiCompatible = {
	text: "supported",
	streaming: "unknown",
	structuredOutput: "unknown",
	toolCalling: "unknown",
	embeddings: "unknown",
} as const satisfies AiCapabilities;

const localOllama = {
	text: "supported",
	streaming: "supported",
	structuredOutput: "unknown",
	toolCalling: "unknown",
	embeddings: "supported",
} as const satisfies AiCapabilities;

const manualEndpoint = {
	text: "supported",
	streaming: "unknown",
	structuredOutput: "unknown",
	toolCalling: "unknown",
	embeddings: "unknown",
} as const satisfies AiCapabilities;

/**
 * Built-in presets. These are conveniences, not compatibility guarantees: a
 * provider may change its API, and self-hosted endpoints may only implement a
 * subset of the OpenAI protocol.
 */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
	{
		id: "openai",
		name: "OpenAI",
		apiUrl: "https://api.openai.com/v1",
		category: "cloud",
		description: "Official OpenAI platform.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: supported,
	},
	{
		id: "anthropic",
		name: "Anthropic",
		apiUrl: "https://api.anthropic.com/v1",
		category: "cloud",
		description: "Claude models through the native Anthropic API.",
		requiresApiKey: true,
		modelDiscovery: false,
		capabilities: chatOnly,
	},
	{
		id: "gemini",
		name: "Google Gemini",
		apiUrl: "https://generativelanguage.googleapis.com/v1beta",
		category: "cloud",
		description: "Google Generative Language API.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: supported,
	},
	{
		id: "mistral",
		name: "Mistral",
		apiUrl: "https://api.mistral.ai/v1",
		category: "cloud",
		description: "Mistral AI platform.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: supported,
	},
	{
		id: "cohere",
		name: "Cohere",
		apiUrl: "https://api.cohere.ai/v2",
		category: "cloud",
		description: "Cohere generation and embedding models.",
		requiresApiKey: true,
		modelDiscovery: false,
		capabilities: {
			text: "supported",
			streaming: "supported",
			structuredOutput: "unknown",
			toolCalling: "supported",
			embeddings: "supported",
		},
	},
	{
		id: "perplexity",
		name: "Perplexity",
		apiUrl: "https://api.perplexity.ai",
		category: "cloud",
		description: "Sonar models with built-in web search.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: {
			text: "supported",
			streaming: "supported",
			structuredOutput: "unknown",
			toolCalling: "unknown",
			embeddings: "unsupported",
		},
	},
	{
		id: "deepinfra",
		name: "DeepInfra",
		apiUrl: "https://api.deepinfra.com/v1/openai",
		category: "gateway",
		description: "OpenAI-compatible model gateway.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: openAiCompatible,
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		apiUrl: "https://openrouter.ai/api/v1",
		category: "gateway",
		description: "OpenAI-compatible multi-provider gateway.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: openAiCompatible,
	},
	{
		id: "zai",
		name: "Z.AI",
		apiUrl: "https://api.z.ai/api/paas/v4",
		category: "cloud",
		description: "Z.AI GLM models.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: openAiCompatible,
	},
	{
		id: "minimax",
		name: "MiniMax",
		apiUrl: "https://api.minimax.io/v1",
		category: "cloud",
		description: "MiniMax models.",
		requiresApiKey: true,
		modelDiscovery: true,
		capabilities: openAiCompatible,
	},
	{
		id: "ollama",
		name: "Ollama",
		apiUrl: "http://localhost:11434",
		category: "self-hosted",
		description: "Local or self-hosted Ollama instance. No API key required.",
		requiresApiKey: false,
		modelDiscovery: true,
		capabilities: localOllama,
	},
	{
		id: "custom",
		name: "Custom OpenAI-compatible",
		apiUrl: "",
		category: "custom",
		description: "Any OpenAI-compatible endpoint, including an internal LLM.",
		requiresApiKey: false,
		modelDiscovery: true,
		capabilities: manualEndpoint,
	},
] as const;

export const AI_PROVIDER_IDS = AI_PROVIDER_PRESETS.map(
	(provider) => provider.id,
) as readonly string[];

const PRESET_BY_ID = new Map(
	AI_PROVIDER_PRESETS.map((provider) => [provider.id, provider]),
);

const CUSTOM_PRESET = AI_PROVIDER_PRESETS.find(
	(provider) => provider.id === "custom",
) as AiProviderPreset;

export const getAiProviderPreset = (providerId: string): AiProviderPreset =>
	PRESET_BY_ID.get(providerId) ?? CUSTOM_PRESET;

export const getAiProviderLabel = (providerId: string) =>
	getAiProviderPreset(providerId).name;

export const getDeclaredAiCapabilities = (
	providerId: string,
): AiCapabilities => {
	const preset = getAiProviderPreset(providerId);
	return { ...(preset.capabilities ?? manualEndpoint) };
};

const hostMatches = (hostname: string, expected: string) =>
	hostname === expected || hostname.endsWith(`.${expected}`);

const OLLAMA_PORT = "11434";

/**
 * Resolve a provider adapter from an API URL.
 *
 * Matching is done on the parsed hostname instead of `String.includes`, so a
 * lookalike domain such as `api.openai.com.example.net` is treated as a custom
 * endpoint rather than being handed OpenAI-specific behaviour.
 */
export const resolveAiProviderId = (apiUrl: string): string => {
	let url: URL;
	try {
		url = new URL(apiUrl);
	} catch {
		return "custom";
	}

	const hostname = url.hostname.toLowerCase();
	const port = url.port || (url.protocol === "https:" ? "443" : "80");

	if (
		port === OLLAMA_PORT ||
		hostMatches(hostname, "ollama.com") ||
		hostname.startsWith("ollama.")
	) {
		return "ollama";
	}

	if (hostMatches(hostname, "api.openai.com")) return "openai";
	if (hostMatches(hostname, "openai.azure.com")) return "azure";
	if (hostMatches(hostname, "api.anthropic.com")) return "anthropic";
	if (
		hostMatches(hostname, "api.cohere.ai") ||
		hostMatches(hostname, "api.cohere.com")
	) {
		return "cohere";
	}
	if (hostMatches(hostname, "api.perplexity.ai")) return "perplexity";
	if (hostMatches(hostname, "api.mistral.ai")) return "mistral";
	if (hostMatches(hostname, "api.deepinfra.com")) return "deepinfra";
	if (hostMatches(hostname, "generativelanguage.googleapis.com")) {
		return "gemini";
	}
	if (hostMatches(hostname, "openrouter.ai")) return "openrouter";
	if (hostMatches(hostname, "api.z.ai")) return "zai";
	if (hostMatches(hostname, "api.minimax.io")) return "minimax";

	return "custom";
};

const NON_CHAT_MODEL =
	/(embed|embedding|whisper|tts|audio|image|dall-e|moderation|rerank)/i;

const EMBEDDING_MODEL = /(embed|embedding)/i;

/**
 * Model-level refinement of the adapter's declared capabilities. Model names
 * are heuristics only; a successful connection test is what marks text as
 * verified. Unknowns remain unknown on purpose.
 */
export const getModelCapabilities = (
	providerId: string,
	model: string,
): AiCapabilities => {
	const base = getDeclaredAiCapabilities(providerId);
	const id = model.toLowerCase();

	if (EMBEDDING_MODEL.test(id)) {
		return {
			text: "unsupported",
			streaming: "unsupported",
			structuredOutput: "unsupported",
			toolCalling: "unsupported",
			embeddings: "supported",
		};
	}

	if (NON_CHAT_MODEL.test(id)) {
		return {
			text: "unsupported",
			streaming: "unsupported",
			structuredOutput: "unsupported",
			toolCalling: "unsupported",
			embeddings: base.embeddings,
		};
	}

	return base;
};

export const getCapabilityWarnings = (
	capabilities: Partial<AiCapabilities>,
): string[] => {
	const warnings: string[] = [];
	for (const key of AI_CAPABILITY_ORDER) {
		if (capabilities[key] === "unknown") {
			warnings.push(
				`${AI_CAPABILITY_META[key].label} support has not been verified for this endpoint.`,
			);
		}
	}
	return warnings;
};

export const isAiCapabilitySupported = (
	capabilities: Partial<AiCapabilities>,
	key: AiCapabilityKey,
) => capabilities[key] === "supported";

export const isAiCapabilityKnown = (
	capabilities: Partial<AiCapabilities>,
	key: AiCapabilityKey,
) => capabilities[key] !== undefined && capabilities[key] !== "unknown";
