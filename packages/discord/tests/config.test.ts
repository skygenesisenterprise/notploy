import { describe, expect, it } from "vitest";
import {
	loadConfig,
	resolveNotifications,
	resolveResources,
	SUPPORTED_NOTIFICATION_EVENTS,
} from "../src/config/env.js";
import { ConfigurationError } from "../src/utils/errors.js";

const baseEnv = { DISCORD_TOKEN: "token", DISCORD_CLIENT_ID: "123456789" };

describe("loadConfig", () => {
	it("throws when DISCORD_TOKEN is missing", () => {
		expect(() => loadConfig({ DISCORD_CLIENT_ID: "1" })).toThrow(ConfigurationError);
	});

	it("throws when DISCORD_CLIENT_ID is missing", () => {
		expect(() => loadConfig({ DISCORD_TOKEN: "token" })).toThrow(ConfigurationError);
	});

	it("applies sensible defaults", () => {
		const config = loadConfig(baseEnv);
		expect(config.guildId).toBeNull();
		expect(config.resources.githubRepository).toBe("skygenesisenterprise/notploy");
		expect(config.resources.githubUrl).toBe("https://github.com/skygenesisenterprise/notploy");
		expect(config.resources.docs).toBe("https://docs.notploy.com");
		expect(config.notifications.enabledEvents).toEqual([]);
		expect(config.notployApi).toEqual({ baseUrl: null, apiKey: null });
	});

	it("honours environment overrides", () => {
		const config = loadConfig({
			...baseEnv,
			DISCORD_GUILD_ID: "42",
			NOTPLOY_DOCS_URL: "https://docs.example.com/",
			GITHUB_REPOSITORY: "acme/widgets",
			DISCORD_MEMBER_ROLE_ID: "777",
			NOTPLOY_URL: "https://notploy.example.com",
			NOTPLOY_API_KEY: "secret",
		});

		expect(config.guildId).toBe("42");
		expect(config.resources.docs).toBe("https://docs.example.com/");
		expect(config.resources.githubUrl).toBe("https://github.com/acme/widgets");
		expect(config.onboarding.memberRoleId).toBe("777");
		expect(config.notployApi).toEqual({
			baseUrl: "https://notploy.example.com",
			apiKey: "secret",
		});
	});
});

describe("resolveResources", () => {
	it("supports all supported notification events", () => {
		expect(SUPPORTED_NOTIFICATION_EVENTS).toContain("releases");
		expect(SUPPORTED_NOTIFICATION_EVENTS).toContain("security");
	});

	it("trims empty values to defaults", () => {
		const resources = resolveResources({ GITHUB_REPOSITORY: "  " });
		expect(resources.githubRepository).toBe("skygenesisenterprise/notploy");
	});
});

describe("resolveNotifications", () => {
	it("enables every event that has a channel when not explicitly configured", () => {
		const result = resolveNotifications({
			DISCORD_RELEASES_CHANNEL_ID: "1",
			DISCORD_ISSUES_CHANNEL_ID: "2",
		});
		expect(result.enabledEvents.sort()).toEqual(["issues", "releases"]);
		expect(result.channels).toEqual({ releases: "1", issues: "2" });
	});

	it("filters to the explicitly configured events", () => {
		const result = resolveNotifications({
			DISCORD_NOTIFICATION_EVENTS: "releases,security,bogus",
			DISCORD_RELEASES_CHANNEL_ID: "1",
			DISCORD_ISSUES_CHANNEL_ID: "2",
		});
		expect(result.enabledEvents.sort()).toEqual(["releases", "security"]);
		expect(result.channels).toEqual({ releases: "1", issues: "2" });
	});

	it("deduplicates events", () => {
		const result = resolveNotifications({
			DISCORD_NOTIFICATION_EVENTS: "releases,releases",
		});
		expect(result.enabledEvents).toEqual(["releases"]);
	});
});
