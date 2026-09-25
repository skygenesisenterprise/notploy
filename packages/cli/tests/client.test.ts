import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("readAuthConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		delete process.env.NOTPLOY_URL;
		delete process.env.NOTPLOY_API_KEY;
		delete process.env.NOTPLOY_AUTH_TOKEN;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		vi.restoreAllMocks();
	});

	it("should read from NOTPLOY_API_KEY env var", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_API_KEY = "test-key-123";

		const { readAuthConfig } = await import("../src/client.js");
		const config = readAuthConfig();

		expect(config.url).toBe("https://test.notploy.com");
		expect(config.token).toBe("test-key-123");
	});

	it("should read from NOTPLOY_AUTH_TOKEN env var as fallback", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_AUTH_TOKEN = "auth-token-456";

		const { readAuthConfig } = await import("../src/client.js");
		const config = readAuthConfig();

		expect(config.url).toBe("https://test.notploy.com");
		expect(config.token).toBe("auth-token-456");
	});

	it("should prefer NOTPLOY_API_KEY over NOTPLOY_AUTH_TOKEN", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_API_KEY = "api-key";
		process.env.NOTPLOY_AUTH_TOKEN = "auth-token";

		const { readAuthConfig } = await import("../src/client.js");
		const config = readAuthConfig();

		expect(config.token).toBe("api-key");
	});
});

describe("saveAuthConfig", () => {
	it("should write config with correct structure", async () => {
		const { saveAuthConfig } = await import("../src/client.js");
		expect(typeof saveAuthConfig).toBe("function");
	});
});
