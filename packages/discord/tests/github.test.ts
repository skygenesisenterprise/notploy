import { describe, expect, it, vi } from "vitest";
import { GitHubIntegration } from "../src/integrations/github/index.js";
import {
	type GitHubEvent,
	buildGitHubNotificationEmbed,
	eventType,
	truncate,
} from "../src/integrations/github/events.js";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("GitHubIntegration", () => {
	it("maps the latest release", async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({
				tag_name: "v1.2.3",
				name: "v1.2.3",
				html_url: "https://github.com/a/b/releases/tag/v1.2.3",
				published_at: "2026-01-01T00:00:00Z",
				body: "Notes",
			}),
		);

		const github = new GitHubIntegration({
			repository: "a/b",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		const release = await github.getLatestRelease();

		expect(release?.tagName).toBe("v1.2.3");
		expect(release?.url).toContain("/releases/tag/v1.2.3");
		expect(fetchImpl).toHaveBeenCalledOnce();
	});

	it("returns null on API errors", async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ message: "nope" }, 403));
		const github = new GitHubIntegration({
			repository: "a/b",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		expect(await github.getLatestRelease()).toBeNull();
	});

	it("returns null when the request throws", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("network down");
		});
		const github = new GitHubIntegration({
			repository: "a/b",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		expect(await github.getLatestRelease()).toBeNull();
	});
});

describe("GitHub event embeds", () => {
	it("truncates long text", () => {
		const long = "a".repeat(4000);
		expect(truncate(long).length).toBeLessThanOrEqual(3500);
		expect(truncate("short")).toBe("short");
	});

	it("reports the event type", () => {
		const event: GitHubEvent = {
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
		};
		expect(eventType(event)).toBe("releases");
	});

	const events: GitHubEvent[] = [
		{
			type: "releases",
			release: {
				tagName: "v1",
				name: "Version 1",
				url: "https://example.com/release",
				publishedAt: null,
				prerelease: false,
				draft: false,
				body: "Release notes",
			},
		},
		{
			type: "issues",
			action: "opened",
			number: 7,
			title: "Bug",
			url: "https://example.com/issue/7",
			author: "octocat",
		},
		{
			type: "pullRequests",
			action: "merged",
			number: 8,
			title: "Feature",
			url: "https://example.com/pr/8",
			author: "octocat",
			draft: false,
		},
		{
			type: "discussions",
			action: "created",
			title: "Question",
			url: "https://example.com/discussion/1",
		},
		{
			type: "security",
			title: "Advisory",
			url: "https://example.com/advisory",
			severity: "high",
		},
	];

	it.each(events)("builds a branded embed for $type", (event) => {
		const embed = buildGitHubNotificationEmbed(event).toJSON();
		expect(embed.title).toBeTruthy();
		expect(embed.url).toBeTruthy();
		expect(embed.footer?.text).toBe("Notploy Community");
	});
});
