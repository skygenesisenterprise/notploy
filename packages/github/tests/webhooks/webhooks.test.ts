import { describe, expect, it } from "vitest";
import { GitHubWebhookError } from "../../src/errors/index.js";
import { parseWebhookPayload } from "../../src/webhooks/events.js";
import { WebhooksNamespace } from "../../src/webhooks/index.js";

/**
 * Realistic webhook payloads (hand-written fixtures, no secrets involved —
 * the webhook secret below is a test-only value).
 */
const TEST_SECRET = "test-only-webhook-secret";

const pushPayload = JSON.stringify({
	ref: "refs/heads/main",
	before: "0000000000000000000000000000000000000000",
	after: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	created: false,
	deleted: false,
	forced: false,
	repository: {
		id: 503873119,
		name: "notploy",
		full_name: "skygenesisenterprise/notploy",
		default_branch: "main",
		owner: { login: "skygenesisenterprise" },
	},
	sender: { login: "octocat" },
	commits: [
		{
			id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			message: "feat: initial commit",
			added: ["src/index.ts"],
			modified: [],
			removed: [],
		},
	],
});

const pullRequestPayload = JSON.stringify({
	action: "opened",
	number: 42,
	pull_request: {
		id: 1,
		title: "Add GitHub integration",
		state: "open",
		draft: false,
		head: {
			ref: "feature/github",
			sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		},
		base: { ref: "main" },
		html_url: "https://github.com/skygenesisenterprise/notploy/pull/42",
		user: { login: "octocat" },
	},
	repository: {
		id: 503873119,
		name: "notploy",
		full_name: "skygenesisenterprise/notploy",
		default_branch: "main",
		owner: { login: "skygenesisenterprise" },
	},
	sender: { login: "octocat" },
});

/** Builds a valid GitHub signature for a payload with the test secret. */
const sign = async (payload: string): Promise<string> => {
	const { Webhooks } = await import("@octokit/webhooks");
	const wh = new Webhooks({ secret: TEST_SECRET });
	return wh.sign(payload);
};

describe("webhooks.verify", () => {
	it("accepts a valid signature", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(pushPayload);
		await expect(wh.verify({ payload: pushPayload, signature })).resolves.toBe(
			true,
		);
	});

	it("rejects an invalid signature", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		await expect(
			wh.verify({
				payload: pushPayload,
				signature: "sha256=deadbeef",
			}),
		).resolves.toBe(false);
	});

	it("rejects a malformed signature", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		await expect(
			wh.verify({ payload: pushPayload, signature: "garbage" }),
		).resolves.toBe(false);
	});

	it("rejects when the payload was modified after signing", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(pushPayload);
		const tampered = pushPayload.replace("feat:", "hack:");
		await expect(wh.verify({ payload: tampered, signature })).resolves.toBe(
			false,
		);
	});
});

describe("webhooks.parse", () => {
	it("parses a push event into a typed event", () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const event = wh.parse({ payload: pushPayload, eventName: "push" });
		expect(event.type).toBe("push");
		if (event.type === "push") {
			expect(event.repository.fullName).toBe("skygenesisenterprise/notploy");
			expect(event.after).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
			expect(event.commits).toHaveLength(1);
			expect(event.senderLogin).toBe("octocat");
		}
	});

	it("parses a pull_request event into a typed event", () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const event = wh.parse({
			payload: pullRequestPayload,
			eventName: "pull_request",
		});
		expect(event.type).toBe("pull_request");
		if (event.type === "pull_request") {
			expect(event.action).toBe("opened");
			expect(event.number).toBe(42);
			expect(event.pullRequest.headRef).toBe("feature/github");
			expect(event.pullRequest.baseRef).toBe("main");
		}
	});

	it("throws GitHubWebhookError for unsupported events", () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		expect(() =>
			wh.parse({ payload: "{}", eventName: "membership" }),
		).toThrowError(GitHubWebhookError);
		try {
			wh.parse({ payload: "{}", eventName: "membership" });
		} catch (error) {
			expect((error as GitHubWebhookError).reason).toBe("unsupported_event");
		}
	});

	it("throws GitHubWebhookError for malformed JSON", () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		expect(() =>
			wh.parse({ payload: "{not-json", eventName: "push" }),
		).toThrowError(GitHubWebhookError);
		try {
			wh.parse({ payload: "{not-json", eventName: "push" });
		} catch (error) {
			expect((error as GitHubWebhookError).reason).toBe("malformed_payload");
		}
	});
});

describe("webhooks.verifyAndParse", () => {
	it("verifies and parses in one call", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(pushPayload);
		const result = await wh.verifyAndParse({
			payload: pushPayload,
			signature,
			eventName: "push",
			deliveryId: "delivery-1",
		});
		expect(result.event.type).toBe("push");
		expect(result.deliveryId).toBe("delivery-1");
	});

	it("throws invalid_signature without parsing untrusted payloads", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		await expect(
			wh.verifyAndParse({
				payload: pushPayload,
				signature: "sha256=invalid",
				eventName: "push",
			}),
		).rejects.toMatchObject({ reason: "invalid_signature" });
	});
});

describe("parseWebhookPayload (standalone)", () => {
	it("returns null for unknown event names", () => {
		expect(
			parseWebhookPayload({ eventName: "something_else", payload: {} }),
		).toBeNull();
	});

	it("parses installation events", () => {
		const event = parseWebhookPayload({
			eventName: "installation",
			payload: {
				action: "created",
				installation: {
					id: 10,
					repository_selection: "all",
					account: { login: "acme" },
				},
				sender: { login: "octocat" },
			},
		});
		expect(event).toMatchObject({
			type: "installation",
			action: "created",
		});
	});

	it("parses installation_repositories events", () => {
		const event = parseWebhookPayload({
			eventName: "installation_repositories",
			payload: {
				action: "added",
				installation: { id: 10 },
				repositories_added: [{ id: 1, name: "a", full_name: "acme/a" }],
				repositories_removed: [],
				repository_selection: "selected",
			},
		});
		expect(event).toMatchObject({ type: "installation_repositories" });
		if (event?.type === "installation_repositories") {
			expect(event.repositoriesAdded).toHaveLength(1);
			expect(event.repositoriesAdded[0]?.fullName).toBe("acme/a");
		}
	});

	it("parses release events", () => {
		const event = parseWebhookPayload({
			eventName: "release",
			payload: {
				action: "published",
				release: {
					id: 5,
					tag_name: "v1.2.3",
					name: "v1.2.3",
					draft: false,
					prerelease: false,
					html_url: "https://github.com/acme/a/releases/tag/v1.2.3",
				},
				repository: {
					id: 1,
					name: "a",
					full_name: "acme/a",
					owner: { login: "acme" },
				},
			},
		});
		expect(event).toMatchObject({ type: "release", action: "published" });
	});

	it("parses workflow_run events", () => {
		const event = parseWebhookPayload({
			eventName: "workflow_run",
			payload: {
				action: "completed",
				workflow_run: {
					id: 7,
					name: "CI",
					head_branch: "main",
					head_sha: "abc",
					status: "completed",
					conclusion: "success",
					html_url: "https://github.com/acme/a/actions/runs/7",
				},
				repository: {
					id: 1,
					name: "a",
					full_name: "acme/a",
					owner: { login: "acme" },
				},
			},
		});
		expect(event).toMatchObject({ type: "workflow_run" });
		if (event?.type === "workflow_run") {
			expect(event.workflowRun.conclusion).toBe("success");
		}
	});
});
