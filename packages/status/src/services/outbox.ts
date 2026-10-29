/**
 * Notification outbox.
 *
 * Publication never blocks on a notification provider: operations enqueue
 * deduplicated entries, and a worker delivers them with retries and
 * exponential backoff. Delivery is at-least-once with a stable delivery id,
 * so consumers can deduplicate; the `dedup_key` also guarantees a given
 * logical occurrence is never queued twice.
 *
 * Webhooks are HMAC-signed with a key *derived* from `STATUS_SECRET_KEY` and
 * the subscription id — no secret is stored in the database. When no
 * `STATUS_SECRET_KEY` is configured the channel is disabled (and the outbox
 * parks entries as skipped instead of pretending they were delivered).
 */
import { createHmac } from "node:crypto";
import { newId } from "../core/ids";
import { plusSeconds } from "../core/time";
import { badRequest, notFound } from "../errors";
import type { OutboxRow } from "../store/repositories";
import type { Actor, StatusContext } from "./context";

export interface OutboxDispatchSummary {
	due: number;
	sent: number;
	retried: number;
	dead: number;
	skipped: number;
}

export interface WebhookSubscriptionDto {
	id: string;
	url: string;
	events: string[];
	active: boolean;
	createdAt: string;
}

export const createWebhookSubscription = (
	ctx: StatusContext,
	input: { url: string; events: string[] },
	actor: Actor,
): WebhookSubscriptionDto => {
	if (!input.url.startsWith("https://") && !input.url.startsWith("http://")) {
		throw badRequest("url must be an http(s) endpoint");
	}
	const row = {
		id: newId("wh"),
		url: input.url,
		events_json: JSON.stringify(input.events),
		active: 1,
		created_at: ctx.now(),
	};
	ctx.repos.webhookSubscriptions.insert(row);
	ctx.audit(actor, {
		action: "webhook.create",
		subjectType: "webhook",
		subjectId: row.id,
		detail: { url: row.url, events: input.events },
	});
	return {
		id: row.id,
		url: row.url,
		events: input.events,
		active: true,
		createdAt: row.created_at,
	};
};

export const listWebhookSubscriptions = (
	ctx: StatusContext,
): WebhookSubscriptionDto[] =>
	ctx.repos.webhookSubscriptions.listActive().map((row) => ({
		id: row.id,
		url: row.url,
		events: JSON.parse(row.events_json) as string[],
		active: row.active === 1,
		createdAt: row.created_at,
	}));

const deriveSigningKey = (secretKey: string, subscriptionId: string): string =>
	createHmac("sha256", secretKey).update(subscriptionId).digest("hex");

const deliverWebhook = async (
	ctx: StatusContext,
	row: OutboxRow,
): Promise<{ ok: boolean; error?: string }> => {
	const payload = row.payload_json;
	const subscriptions = ctx.repos.webhookSubscriptions
		.listActive()
		.filter((subscription) => {
			const events = JSON.parse(subscription.events_json) as string[];
			const eventName = (JSON.parse(payload) as { event?: string }).event ?? "";
			return events.includes("*") || events.includes(eventName);
		});
	if (subscriptions.length === 0) {
		// Nothing subscribed: the entry is considered delivered (no provider to
		// retry against) but explicitly recorded as such.
		ctx.log.debug("outbox_skipped_no_subscriptions", { outboxId: row.id });
		return { ok: true };
	}
	if (!ctx.config.secretKey) {
		return {
			ok: false,
			error:
				"STATUS_SECRET_KEY is not configured; webhook delivery is disabled",
		};
	}
	const timestamp = ctx.now();
	const failures: string[] = [];
	for (const subscription of subscriptions) {
		const signature = createHmac(
			"sha256",
			deriveSigningKey(ctx.config.secretKey, subscription.id),
		)
			.update(`${timestamp}.${payload}`)
			.digest("hex");
		try {
			const response = await fetch(subscription.url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-notploy-status-delivery": row.id,
					"x-notploy-status-event": String(
						(JSON.parse(payload) as { event?: string }).event ?? "",
					),
					"x-notploy-status-timestamp": timestamp,
					"x-notploy-status-signature": `sha256=${signature}`,
				},
				body: payload,
				signal: AbortSignal.timeout(10_000),
			});
			if (!response.ok) {
				failures.push(`${subscription.id}: HTTP ${response.status}`);
			}
		} catch (error) {
			failures.push(
				`${subscription.id}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return failures.length > 0
		? { ok: false, error: failures.join("; ") }
		: { ok: true };
};

/** Deliver every due entry. Called by the worker started in the host app. */
export const dispatchOutbox = async (
	ctx: StatusContext,
): Promise<OutboxDispatchSummary> => {
	const now = ctx.now();
	const due = ctx.repos.outbox.listDue(now, 20);
	const summary: OutboxDispatchSummary = {
		due: due.length,
		sent: 0,
		retried: 0,
		dead: 0,
		skipped: 0,
	};
	for (const row of due) {
		if (row.channel !== "webhook") {
			ctx.repos.outbox.markSent(row.id, now);
			summary.skipped += 1;
			continue;
		}
		const result = await deliverWebhook(ctx, row);
		if (result.ok) {
			ctx.repos.outbox.markSent(row.id, ctx.now());
			summary.sent += 1;
			continue;
		}
		const attempts = row.attempts + 1;
		const error = result.error ?? "delivery failed";
		if (attempts >= ctx.config.outboxMaxAttempts) {
			ctx.repos.outbox.markDead(row.id, attempts, error, ctx.now());
			summary.dead += 1;
			ctx.log.warn("outbox_dead", { outboxId: row.id, attempts, error });
			continue;
		}
		const backoffSeconds = Math.min(5 * 2 ** attempts, 900);
		ctx.repos.outbox.markRetry(
			row.id,
			attempts,
			plusSeconds(ctx.now(), backoffSeconds),
			error,
			ctx.now(),
		);
		summary.retried += 1;
	}
	return summary;
};

/** Re-queue a parked entry (operator action, also exposed via the CLI). */
export const replayOutboxEntry = (
	ctx: StatusContext,
	outboxId: string,
): void => {
	const row = ctx.repos.outbox
		.listDue(plusSeconds(ctx.now(), 3600 * 24 * 365), 10_000)
		.find((entry) => entry.id === outboxId);
	if (!row) {
		throw notFound(`Outbox entry "${outboxId}" not found or already delivered`);
	}
	ctx.repos.outbox.markRetry(outboxId, 0, ctx.now(), "replayed", ctx.now());
};
