import type { Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import type { GitHubIntegration } from "../src/integrations/github/index.js";
import { NotificationService } from "../src/services/notifications.js";
import { createLogger } from "../src/utils/logger.js";

const logger = createLogger("test", "error");

function createConfig(env: Record<string, string> = {}) {
	return loadConfig({
		DISCORD_TOKEN: "token",
		DISCORD_CLIENT_ID: "1",
		...env,
	});
}

function fakeClient(sent: unknown[], sendable = true): Client {
	return {
		channels: {
			fetch: vi.fn(async () => (sendable ? { send: async (o: unknown) => sent.push(o) } : null)),
		},
	} as unknown as Client;
}

const github = { getLatestRelease: vi.fn() } as unknown as GitHubIntegration;

describe("NotificationService", () => {
	it("reports disabled events", () => {
		const service = new NotificationService(fakeClient([]), createConfig(), github, logger);
		expect(service.isEnabled("releases")).toBe(false);
		expect(service.channelIdFor("releases")).toBeNull();
	});

	it("publishes to the configured channel", async () => {
		const sent: unknown[] = [];
		const config = createConfig({
			DISCORD_NOTIFICATION_EVENTS: "releases",
			DISCORD_RELEASES_CHANNEL_ID: "999",
		});
		const service = new NotificationService(fakeClient(sent), config, github, logger);

		const published = await service.publish({
			type: "releases",
			release: {
				tagName: "v1",
				name: "v1",
				url: "https://example.com",
				publishedAt: null,
				prerelease: false,
				draft: false,
				body: null,
			},
		});

		expect(published).toBe(true);
		expect(sent).toHaveLength(1);
	});

	it("does not publish disabled events", async () => {
		const sent: unknown[] = [];
		const service = new NotificationService(fakeClient(sent), createConfig(), github, logger);
		const published = await service.publish({
			type: "issues",
			action: "opened",
			number: 1,
			title: "x",
			url: "https://example.com",
		});
		expect(published).toBe(false);
		expect(sent).toHaveLength(0);
	});

	it("returns a no-op watcher when releases are disabled", () => {
		const service = new NotificationService(fakeClient([]), createConfig(), github, logger);
		const stop = service.startReleaseWatcher(10);
		expect(typeof stop).toBe("function");
		stop();
	});
});
