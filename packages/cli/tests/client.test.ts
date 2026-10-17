import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDir, removeTempDir } from "./helpers/cli.js";

let configDir: string;
const originalEnv = { ...process.env };

beforeEach(() => {
	configDir = createTempDir();
	delete process.env.NOTPLOY_URL;
	delete process.env.NOTPLOY_API_KEY;
	delete process.env.NOTPLOY_AUTH_TOKEN;
	delete process.env.NOTPLOY_PROFILE;
	process.env.NOTPLOY_CONFIG_DIR = configDir;
	process.env.NOTPLOY_NO_DOTENV = "1";
});

afterEach(() => {
	process.env = { ...originalEnv };
	removeTempDir(configDir);
	vi.restoreAllMocks();
});

describe("readAuthConfig", () => {
	it("reads from NOTPLOY_API_KEY", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_API_KEY = "test-key-123";

		const { readAuthConfig } = await import("../src/client.js");
		expect(readAuthConfig()).toEqual({
			url: "https://test.notploy.com",
			token: "test-key-123",
		});
	});

	it("falls back to NOTPLOY_AUTH_TOKEN", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_AUTH_TOKEN = "auth-token-456";

		const { readAuthConfig } = await import("../src/client.js");
		expect(readAuthConfig().token).toBe("auth-token-456");
	});

	it("prefers NOTPLOY_API_KEY over NOTPLOY_AUTH_TOKEN", async () => {
		process.env.NOTPLOY_URL = "https://test.notploy.com";
		process.env.NOTPLOY_API_KEY = "api-key";
		process.env.NOTPLOY_AUTH_TOKEN = "auth-token";

		const { readAuthConfig } = await import("../src/client.js");
		expect(readAuthConfig().token).toBe("api-key");
	});

	it("throws a usage error instead of exiting when nothing is configured", async () => {
		const { readAuthConfig } = await import("../src/client.js");
		expect(() => readAuthConfig()).toThrow(/Not authenticated/);
	});
});

describe("saveAuthConfig", () => {
	it("writes a profile to the user config directory", async () => {
		const { saveAuthConfig } = await import("../src/client.js");
		saveAuthConfig("https://test.notploy.com", "test-key-123");

		const configPath = path.join(configDir, "config.json");
		expect(fs.existsSync(configPath)).toBe(true);
		const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
			currentProfile: string;
			profiles: Record<string, { url: string; token: string }>;
		};
		expect(config.currentProfile).toBe("default");
		expect(config.profiles.default).toEqual({
			url: "https://test.notploy.com",
			token: "test-key-123",
		});
	});
});

describe("createClient", () => {
	it("sets a base URL, timeout, API key header and user agent", async () => {
		const { createClient } = await import("../src/http.js");
		const client = createClient(
			{ url: "https://test.notploy.com/", token: "secret" },
			5000,
		);
		expect(client.defaults.baseURL).toBe("https://test.notploy.com/api");
		expect(client.defaults.timeout).toBe(5000);
		expect(client.defaults.headers["x-api-key"]).toBe("secret");
		expect(String(client.defaults.headers["User-Agent"])).toContain(
			"notploy-cli/",
		);
	});
});
