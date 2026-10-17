import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createCohere } from "@ai-sdk/cohere";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOllama } from "ai-sdk-ollama";
import { resolveAiProviderId } from "./contracts";

/**
 * Provider detection is hosted in the shared contracts so the UI and the
 * runtime agree on what a given endpoint represents.
 */
export function getProviderName(apiUrl: string) {
	return resolveAiProviderId(apiUrl);
}

export function selectAIProvider(config: { apiUrl: string; apiKey: string }) {
	const providerName = getProviderName(config.apiUrl);

	switch (providerName) {
		case "openai":
			return createOpenAI({
				apiKey: config.apiKey,
				baseURL: config.apiUrl,
			});
		case "azure":
			// Azure OpenAI-compatible endpoints already include /v1 in the path.
			// Using createAzure with such URLs causes a doubled /v1//v1/ suffix.
			if (config.apiUrl.includes("/v1")) {
				return createOpenAICompatible({
					name: "azure",
					baseURL: config.apiUrl,
					headers: {
						"api-key": config.apiKey,
						Authorization: `Bearer ${config.apiKey}`,
					},
				});
			}
			return createAzure({
				apiKey: config.apiKey,
				baseURL: config.apiUrl,
			});
		case "anthropic":
			return createAnthropic({
				apiKey: config.apiKey,
				baseURL: config.apiUrl,
			});
		case "cohere":
			return createCohere({
				baseURL: config.apiUrl,
				apiKey: config.apiKey,
			});
		case "perplexity":
			return createOpenAICompatible({
				name: "perplexity",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		case "mistral":
			return createMistral({
				baseURL: config.apiUrl,
				apiKey: config.apiKey,
			});
		case "ollama":
			return createOllama({
				baseURL: config.apiUrl,
				headers: config.apiKey
					? { Authorization: `Bearer ${config.apiKey}` }
					: undefined,
			});
		case "deepinfra":
			return createDeepInfra({
				baseURL: config.apiUrl,
				apiKey: config.apiKey,
			});
		case "gemini":
			return createOpenAICompatible({
				name: "gemini",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		case "openrouter":
			return createOpenAICompatible({
				name: "openrouter",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		case "zai":
			return createOpenAICompatible({
				name: "zai",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		case "minimax":
			return createOpenAICompatible({
				name: "minimax",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		case "custom":
			return createOpenAICompatible({
				name: "custom",
				baseURL: config.apiUrl,
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			});
		default:
			throw new Error(`Unsupported AI provider: ${providerName}`);
	}
}

export const getProviderHeaders = (
	apiUrl: string,
	apiKey: string,
): Record<string, string> => {
	const providerId = resolveAiProviderId(apiUrl);

	if (providerId === "anthropic") {
		return {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		};
	}

	// Mistral and other OpenAI-compatible endpoints use bearer auth.
	return {
		Authorization: `Bearer ${apiKey}`,
	};
};
export interface Model {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}
