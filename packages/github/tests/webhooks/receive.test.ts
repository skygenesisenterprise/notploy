import { describe, expect, it } from "vitest";
import { GitHubWebhookError } from "../../src/errors/index.js";
import {
	getWebhookHeader,
	WebhooksNamespace,
} from "../../src/webhooks/index.js";

const TEST_SECRET = "test-only-webhook-secret";

/**
 * The body deliberately keeps GitHub's original whitespace: signing the exact
 * bytes and then verifying a re-serialized equivalent must fail.
 */
const rawPayload = `{
  "ref": "refs/heads/main",
  "after": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "repository": {
    "id": 503873119,
    "name": "notploy",
    "full_name": "skygenesisenterprise/notploy",
    "default_branch": "main",
    "owner": { "login": "skygenesisenterprise" }
  },
  "sender": { "login": "octocat" }
}`;

const sign = async (payload: string): Promise<string> => {
	const { Webhooks } = await import("@octokit/webhooks");
	return new Webhooks({ secret: TEST_SECRET }).sign(payload);
};

const headers = (overrides: Record<string, string | undefined> = {}) => ({
	"x-github-event": "push",
	"x-github-delivery": "72d3162e-cc78-11e3-81ab-4c9367dc0958",
	"x-hub-signature-256": "sha256=placeholder",
	...overrides,
});

describe("getWebhookHeader", () => {
	it("reads headers case-insensitively", () => {
		expect(
			getWebhookHeader({ "X-GitHub-Event": "push" }, "x-github-event"),
		).toBe("push");
	});

	it("returns undefined for missing, empty or array-empty headers", () => {
		expect(getWebhookHeader({}, "x-github-event")).toBeUndefined();
		expect(getWebhookHeader({ "x-github-event": "  " }, "x-github-event")).toBe(
			undefined,
		);
		expect(getWebhookHeader({ "x-github-event": [] }, "x-github-event")).toBe(
			undefined,
		);
	});
});

describe("webhooks.receive", () => {
	it("verifies the exact raw bytes then parses the event", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);

		const result = await wh.receive({
			payload: rawPayload,
			headers: headers({ "x-hub-signature-256": signature }),
		});

		expect(result.deliveryId).toBe("72d3162e-cc78-11e3-81ab-4c9367dc0958");
		expect(result.eventName).toBe("push");
		expect(result.event.type).toBe("push");
	});

	it("rejects a re-serialized body signed in its original form", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);
		const reserialized = JSON.stringify(JSON.parse(rawPayload));

		await expect(
			wh.receive({
				payload: reserialized,
				headers: headers({ "x-hub-signature-256": signature }),
			}),
		).rejects.toMatchObject({ reason: "invalid_signature" });
	});

	it("rejects a body modified after signing", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);

		await expect(
			wh.receive({
				payload: rawPayload.replace("refs/heads/main", "refs/heads/main2"),
				headers: headers({ "x-hub-signature-256": signature }),
			}),
		).rejects.toMatchObject({ reason: "invalid_signature" });
	});

	it("rejects missing required headers before verifying", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);

		await expect(
			wh.receive({
				payload: rawPayload,
				headers: headers({
					"x-github-event": undefined,
					"x-hub-signature-256": signature,
				}),
			}),
		).rejects.toMatchObject({ reason: "invalid_headers" });

		await expect(
			wh.receive({
				payload: rawPayload,
				headers: headers({ "x-github-delivery": undefined }),
			}),
		).rejects.toMatchObject({ reason: "invalid_headers" });
	});

	it("rejects a malformed delivery id", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);

		await expect(
			wh.receive({
				payload: rawPayload,
				headers: headers({
					"x-hub-signature-256": signature,
					"x-github-delivery": "../../etc/passwd",
				}),
			}),
		).rejects.toMatchObject({ reason: "invalid_headers" });
	});

	it("rejects an oversized payload without verifying it", async () => {
		const wh = new WebhooksNamespace({
			secret: TEST_SECRET,
			maxPayloadBytes: 32,
		});
		const signature = await sign(rawPayload);

		await expect(
			wh.receive({
				payload: rawPayload,
				headers: headers({ "x-hub-signature-256": signature }),
			}),
		).rejects.toMatchObject({ reason: "payload_too_large" });
	});

	it("rejects an empty payload", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });

		await expect(
			wh.receive({ payload: "", headers: headers() }),
		).rejects.toMatchObject({ reason: "malformed_payload" });
	});

	it("rejects malformed JSON only after a valid signature", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign("{not-json");

		await expect(
			wh.receive({
				payload: "{not-json",
				headers: headers({ "x-hub-signature-256": signature }),
			}),
		).rejects.toBeInstanceOf(GitHubWebhookError);
	});

	it("is idempotent for a redelivered event", async () => {
		const wh = new WebhooksNamespace({ secret: TEST_SECRET });
		const signature = await sign(rawPayload);
		const options = {
			payload: rawPayload,
			headers: headers({ "x-hub-signature-256": signature }),
		};

		const first = await wh.receive(options);
		const second = await wh.receive(options);

		expect(second.deliveryId).toBe(first.deliveryId);
	});
});
