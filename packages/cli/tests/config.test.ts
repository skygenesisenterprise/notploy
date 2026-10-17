import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	collectSecretValues,
	configPermissionWarning,
	getConfigDir,
	getConfigPath,
	listProfiles,
	loadEnvFile,
	migrateLegacyConfig,
	normalizeServerUrl,
	readConfigFile,
	removeProfile,
	resolveAuth,
	resolveTimeout,
	saveProfile,
	setCurrentProfile,
} from "../src/config.js";
import { createTempDir, removeTempDir } from "./helpers/cli.js";

let dir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
	dir = createTempDir();
	env = {
		NOTPLOY_CONFIG_DIR: dir,
		NOTPLOY_NO_DOTENV: "1",
	};
});

afterEach(() => {
	removeTempDir(dir);
});

describe("getConfigDir", () => {
	it("uses XDG_CONFIG_HOME on Linux", () => {
		expect(
			getConfigDir("linux", { XDG_CONFIG_HOME: "/tmp/xdg" }, "/home/dev"),
		).toBe("/tmp/xdg/notploy");
	});

	it("falls back to ~/.config on Linux", () => {
		expect(getConfigDir("linux", {}, "/home/dev")).toBe(
			"/home/dev/.config/notploy",
		);
	});

	it("uses Application Support on macOS", () => {
		expect(getConfigDir("darwin", {}, "/Users/dev")).toBe(
			"/Users/dev/Library/Application Support/notploy",
		);
	});

	it("uses APPDATA on Windows", () => {
		expect(
			getConfigDir(
				"win32",
				{ APPDATA: "C:\\Users\\dev\\AppData\\Roaming" },
				"C:\\Users\\dev",
			),
		).toBe("C:\\Users\\dev\\AppData\\Roaming\\notploy");
	});

	it("lets NOTPLOY_CONFIG_DIR override the platform location", () => {
		expect(
			getConfigDir("linux", { NOTPLOY_CONFIG_DIR: dir }, "/home/dev"),
		).toBe(dir);
	});
});

describe("normalizeServerUrl", () => {
	it("removes trailing slashes and a trailing /api", () => {
		expect(normalizeServerUrl("https://panel.notploy.com/")).toBe(
			"https://panel.notploy.com",
		);
		expect(normalizeServerUrl("https://panel.notploy.com/api/")).toBe(
			"https://panel.notploy.com",
		);
	});

	it("adds https for remote hosts and http for localhost", () => {
		expect(normalizeServerUrl("panel.notploy.com")).toBe(
			"https://panel.notploy.com",
		);
		expect(normalizeServerUrl("localhost:3000")).toBe("http://localhost:3000");
	});

	it("rejects embedded credentials and unsupported protocols", () => {
		expect(() =>
			normalizeServerUrl("https://user:pass@panel.notploy.com"),
		).toThrow(/must not contain credentials/);
		expect(() => normalizeServerUrl("ftp://panel.notploy.com")).toThrow(
			/Unsupported/,
		);
	});
});

describe("profiles", () => {
	it("writes restrictive permissions and reads profiles back", () => {
		const configPath = saveProfile(
			"local",
			"http://localhost:3000",
			"secret-token",
			{ env },
		);
		expect(fs.existsSync(configPath)).toBe(true);
		if (process.platform !== "win32") {
			expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
		}

		const loaded = readConfigFile({ env });
		expect(loaded.config.currentProfile).toBe("local");
		expect(loaded.config.profiles.local).toEqual({
			url: "http://localhost:3000",
			token: "secret-token",
		});
		expect(configPermissionWarning(configPath)).toBeUndefined();
	});

	it("lists profiles sorted and supports switching/removal", () => {
		saveProfile("production", "https://prod.notploy.com", "prod-token", {
			env,
		});
		saveProfile("local", "http://localhost:3000", "local-token", {
			env,
		});
		const listed = listProfiles({ env });
		expect(listed.profiles.map((profile) => profile.name)).toEqual([
			"local",
			"production",
		]);
		expect(listed.currentProfile).toBe("local");

		setCurrentProfile("production", { env });
		expect(readConfigFile({ env }).config.currentProfile).toBe("production");

		const removed = removeProfile("production", { env });
		expect(removed.removed).toBe(true);
		expect(removed.currentProfile).toBe("local");
	});

	it("rejects selecting a missing profile", () => {
		expect(() => setCurrentProfile("missing", { env })).toThrow(
			/does not exist/,
		);
	});
});

describe("resolveAuth precedence", () => {
	it("uses flags above environment above profile", () => {
		const configPath = getConfigPath(env);
		saveProfile("default", "https://profile.example", "profile-token", {
			env,
		});

		const withEnv = resolveAuth({
			env: {
				...env,
				NOTPLOY_URL: "https://env.example",
				NOTPLOY_API_KEY: "env-token",
			},
			cwd: dir,
		});
		expect(withEnv).toMatchObject({
			url: "https://env.example",
			token: "env-token",
			source: "env",
		});

		const withFlags = resolveAuth({
			url: "https://flag.example",
			token: "flag-token",
			env: {
				...env,
				NOTPLOY_URL: "https://env.example",
				NOTPLOY_API_KEY: "env-token",
			},
			cwd: dir,
		});
		expect(withFlags).toMatchObject({
			url: "https://flag.example",
			token: "flag-token",
			source: "flags",
		});
		expect(fs.existsSync(configPath)).toBe(true);
	});

	it("selects a named profile", () => {
		saveProfile("staging", "https://staging.example", "staging-token", {
			env,
		});
		const auth = resolveAuth({
			profile: "staging",
			env,
			cwd: dir,
		});
		expect(auth).toMatchObject({
			profile: "staging",
			url: "https://staging.example",
			token: "staging-token",
			source: "profile",
		});
	});

	it("fails with a usage error when nothing is configured", () => {
		expect(() => resolveAuth({ env, cwd: dir })).toThrow(/Not authenticated/);
		try {
			resolveAuth({ env, cwd: dir });
		} catch (error) {
			expect((error as { code: number }).code).toBe(2);
		}
	});

	it("fails clearly when an explicitly requested profile is missing", () => {
		expect(() => resolveAuth({ profile: "missing", env, cwd: dir })).toThrow(
			/Profile "missing" does not exist/,
		);
	});
});

describe("legacy config and env helpers", () => {
	it("migrates the old flat config shape in memory", () => {
		expect(
			migrateLegacyConfig({
				url: "https://legacy.example",
				token: "legacy-token",
			}),
		).toEqual({
			version: 1,
			currentProfile: "default",
			profiles: {
				default: {
					url: "https://legacy.example",
					token: "legacy-token",
				},
			},
		});
	});

	it("loads .env without overriding existing variables", () => {
		const envFile = path.join(dir, ".env");
		fs.writeFileSync(
			envFile,
			'NOTPLOY_URL="https://dotenv.example"\nNOTPLOY_API_KEY=dotenv-token\n',
		);
		const localEnv: NodeJS.ProcessEnv = {
			NOTPLOY_API_KEY: "already-set",
		};
		loadEnvFile(dir, localEnv);
		expect(localEnv.NOTPLOY_URL).toBe("https://dotenv.example");
		expect(localEnv.NOTPLOY_API_KEY).toBe("already-set");
	});

	it("collects secret values for redaction", () => {
		saveProfile("default", "https://example.com", "profile-secret", {
			env,
		});
		const secrets = collectSecretValues({
			...env,
			NOTPLOY_API_KEY: "env-secret",
		});
		expect(secrets).toContain("env-secret");
		expect(secrets).toContain("profile-secret");
	});

	it("validates timeout bounds", () => {
		expect(resolveTimeout("5000", {})).toBe(5000);
		expect(() => resolveTimeout("10", {})).toThrow(/Invalid timeout/);
		expect(() => resolveTimeout("9999999", {})).toThrow(/Invalid timeout/);
	});
});
