import { describe, expect, it } from "vitest";
import {
	getAiProviderLabel,
	getCapabilityWarnings,
	getModelCapabilities,
	resolveAiProviderId,
} from "@notploy/server/utils/ai/contracts";
import { toAiSettingView } from "@notploy/server/services/ai";
import {
	AiRuntimeError,
	normalizeAiError,
	validateAiEndpointUrl,
} from "@notploy/server/utils/ai/runtime";

describe("resolveAiProviderId", () => {
	it("resolves known provider hostnames", () => {
		expect(resolveAiProviderId("https://api.openai.com/v1")).toBe("openai");
		expect(resolveAiProviderId("https://api.anthropic.com/v1")).toBe(
			"anthropic",
		);
		expect(resolveAiProviderId("http://localhost:11434")).toBe("ollama");
	});

	it("does not match a lookalike hostname", () => {
		expect(
			resolveAiProviderId("https://api.openai.com.example.net/v1"),
		).toBe("custom");
	});

	it("falls back to custom for malformed URLs", () => {
		expect(resolveAiProviderId("not a url")).toBe("custom");
	});
});

describe("getModelCapabilities", () => {
	it("keeps unknown capabilities unknown for a custom endpoint", () => {
		const capabilities = getModelCapabilities("custom", "internal-chat");
		expect(capabilities.text).toBe("supported");
		expect(capabilities.streaming).toBe("unknown");
		expect(capabilities.structuredOutput).toBe("unknown");
	});

	it("treats embedding models as embeddings-only", () => {
		const capabilities = getModelCapabilities(
			"openai",
			"text-embedding-3-small",
		);
		expect(capabilities.embeddings).toBe("supported");
		expect(capabilities.text).toBe("unsupported");
		expect(capabilities.streaming).toBe("unsupported");
	});

	it("reflects adapter-level limitations", () => {
		const capabilities = getModelCapabilities(
			"anthropic",
			"claude-sonnet-4-20250514",
		);
		expect(capabilities.text).toBe("supported");
		expect(capabilities.embeddings).toBe("unsupported");
	});

	it("reports unknown capabilities as warnings", () => {
		const warnings = getCapabilityWarnings(
			getModelCapabilities("custom", "internal-chat"),
		);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings.join(" ")).toContain("Streaming");
	});
});

describe("validateAiEndpointUrl", () => {
	it("allows local and private endpoints for self-hosted installations", () => {
		expect(() =>
			validateAiEndpointUrl("http://localhost:11434"),
		).not.toThrow();
		expect(() =>
			validateAiEndpointUrl("http://10.0.0.5:8000/v1"),
		).not.toThrow();
	});

	it("blocks cloud metadata endpoints", () => {
		expect(() =>
			validateAiEndpointUrl("http://169.254.169.254/latest/meta-data"),
		).toThrow(AiRuntimeError);
		expect(() =>
			validateAiEndpointUrl("http://metadata.google.internal/computeMetadata"),
		).toThrow(AiRuntimeError);
	});

	it("rejects non-http protocols and embedded credentials", () => {
		expect(() => validateAiEndpointUrl("file:///etc/passwd")).toThrow(
			AiRuntimeError,
		);
		expect(() =>
			validateAiEndpointUrl("https://user:secret@api.example.com/v1"),
		).toThrow(AiRuntimeError);
	});

	it("blocks private endpoints in cloud mode", () => {
		expect(() =>
			validateAiEndpointUrl("http://localhost:11434", {
				allowPrivateNetworks: false,
			}),
		).toThrow(AiRuntimeError);
		expect(() =>
			validateAiEndpointUrl("https://api.openai.com/v1", {
				allowPrivateNetworks: false,
			}),
		).not.toThrow();
	});
});

describe("normalizeAiError", () => {
	it("maps authentication and rate-limit responses", () => {
		const auth = normalizeAiError(
			Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
		);
		expect(auth.category).toBe("auth");
		expect(auth.retryable).toBe(false);

		const limited = normalizeAiError(
			Object.assign(new Error("Too many requests"), { statusCode: 429 }),
		);
		expect(limited.category).toBe("rate_limit");
		expect(limited.retryable).toBe(true);
	});

	it("maps aborts to timeouts", () => {
		const error = new Error("The operation was aborted");
		error.name = "AbortError";
		expect(normalizeAiError(error).category).toBe("timeout");
	});

	it("maps network failures without leaking the original payload", () => {
		const normalized = normalizeAiError(
			new Error("connect ECONNREFUSED 127.0.0.1:11434"),
		);
		expect(normalized.category).toBe("network");
		expect(normalized.message).not.toContain("ECONNREFUSED");
	});
});

describe("provider labels", () => {
	it("returns the human label for a known provider", () => {
		expect(getAiProviderLabel("openai")).toBe("OpenAI");
		expect(getAiProviderLabel("unknown-provider")).toBe(
			"Custom OpenAI-compatible",
		);
	});
});

describe("toAiSettingView", () => {
	it("never returns the stored API key", () => {
		const view = toAiSettingView({
			aiId: "ai_1",
			name: "Production",
			apiUrl: "https://api.openai.com/v1",
			apiKey: "sk-super-secret",
			model: "gpt-4o",
			isEnabled: true,
			organizationId: "org_1",
			createdAt: "2026-10-17T00:00:00.000Z",
			lastTestStatus: "success",
			lastTestMessage: "Connection successful",
			lastTestedAt: "2026-10-17T00:05:00.000Z",
			lastTestLatencyMs: 42,
			verifiedCapabilities: JSON.stringify({ text: "supported" }),
		} as any);

		expect(view).not.toHaveProperty("apiKey");
		expect(view.hasApiKey).toBe(true);
		expect(view.providerId).toBe("openai");
		expect(view.providerLabel).toBe("OpenAI");
		expect(view.verifiedCapabilities).toEqual({ text: "supported" });
		expect(view.lastTestLatencyMs).toBe(42);
	});

	it("reports a missing API key without exposing one", () => {
		const view = toAiSettingView({
			aiId: "ai_2",
			name: "Local",
			apiUrl: "http://localhost:11434",
			apiKey: "",
			model: "llama3.1",
			isEnabled: false,
			organizationId: "org_1",
			createdAt: "2026-10-17T00:00:00.000Z",
			lastTestStatus: null,
			lastTestMessage: null,
			lastTestedAt: null,
			lastTestLatencyMs: null,
			verifiedCapabilities: null,
		} as any);

		expect(view.hasApiKey).toBe(false);
		expect(view.providerId).toBe("ollama");
		expect(view.verifiedCapabilities).toBeNull();
	});
});
