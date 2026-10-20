import type { IncomingMessage } from "node:http";
import { db } from "@notploy/server/db";
import { githubWebhookDelivery } from "@notploy/server/db/schema";
import { Webhooks } from "@octokit/webhooks";
import { and, eq, lt, sql } from "drizzle-orm";

/**
 * GitHub caps webhook payloads at 25 MB. Refusing larger bodies before reading
 * them keeps an unauthenticated request from exhausting memory or a worker.
 */
export const MAX_GITHUB_WEBHOOK_BYTES = 25 * 1024 * 1024;

/**
 * Bounds the retries GitHub can induce for a delivery that keeps failing, so a
 * deterministic bug cannot be retried forever.
 */
export const MAX_GITHUB_DELIVERY_ATTEMPTS = 5;

/**
 * A `received` delivery older than this belonged to a worker that died mid-way
 * and may be processed again.
 */
export const GITHUB_DELIVERY_STALE_AFTER_MS = 10 * 60 * 1000;

/** A rejected webhook request: `status` is safe to return to GitHub. */
export class GithubWebhookRequestError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "GithubWebhookRequestError";
		this.status = status;
	}
}

/**
 * Reads the raw request body.
 *
 * The signature is an HMAC over the bytes GitHub sent, so the body must never be
 * parsed and re-serialized before verification. This is why the route disables
 * Next's body parser and reads the stream itself.
 */
export const readRawWebhookBody = async (
	req: IncomingMessage,
	maxBytes = MAX_GITHUB_WEBHOOK_BYTES,
): Promise<string> => {
	const chunks: Buffer[] = [];
	let size = 0;

	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk)
			? chunk
			: Buffer.from(chunk as string);
		size += buffer.byteLength;
		if (size > maxBytes) {
			throw new GithubWebhookRequestError("Payload too large", 413);
		}
		chunks.push(buffer);
	}

	if (size === 0) {
		throw new GithubWebhookRequestError("Empty payload", 400);
	}

	return Buffer.concat(chunks).toString("utf8");
};

/** Constant-time signature check performed by `@octokit/webhooks`. */
export const verifyGithubSignature = async (options: {
	secret: string;
	payload: string;
	signature: string;
}): Promise<boolean> => {
	if (!options.secret) return false;
	try {
		return await new Webhooks({ secret: options.secret }).verify(
			options.payload,
			options.signature,
		);
	} catch {
		return false;
	}
};

export type DeliveryClaim =
	/** This process now owns the delivery and must process it. */
	| "claimed"
	/** Already processed, in progress, or ignored: acknowledge, do not work. */
	| "duplicate"
	/** A previous attempt failed with a retryable error and was re-claimed. */
	| "retried";

/**
 * Atomically claims a delivery.
 *
 * The composite primary key on `(githubId, deliveryId)` is what makes this safe
 * under concurrent redeliveries: exactly one insert wins. A delivery whose
 * previous attempt failed is re-claimed (at most one winner), so transient
 * failures are retried without ever duplicating a deployment.
 */
export const claimGithubDelivery = async (options: {
	githubId: string;
	deliveryId: string;
	event: string;
}): Promise<DeliveryClaim> => {
	const inserted = await db
		.insert(githubWebhookDelivery)
		.values({
			githubId: options.githubId,
			deliveryId: options.deliveryId,
			event: options.event,
			status: "received",
			attempts: 1,
		})
		.onConflictDoNothing()
		.returning({ deliveryId: githubWebhookDelivery.deliveryId });

	if (inserted.length > 0) {
		return "claimed";
	}

	const existing = await db.query.githubWebhookDelivery.findFirst({
		where: and(
			eq(githubWebhookDelivery.githubId, options.githubId),
			eq(githubWebhookDelivery.deliveryId, options.deliveryId),
		),
	});

	if (!existing) {
		// Racing with a retention cleanup: the row is gone, so start over.
		return "retried";
	}

	if (existing.attempts >= MAX_GITHUB_DELIVERY_ATTEMPTS) {
		return "duplicate";
	}

	const staleBefore = new Date(
		Date.now() - GITHUB_DELIVERY_STALE_AFTER_MS,
	).toISOString();

	// A failed delivery is retried; a `received` one is only retried once the
	// worker that claimed it is considered dead.
	const isFailed = existing.status === "failed";
	const receivedAt = Date.parse(existing.receivedAt);
	const isStale =
		existing.status === "received" &&
		(Number.isNaN(receivedAt) ||
			receivedAt < Date.now() - GITHUB_DELIVERY_STALE_AFTER_MS);

	if (!isFailed && !isStale) {
		return "duplicate";
	}

	const reclaimCondition = isFailed
		? eq(githubWebhookDelivery.status, "failed")
		: and(
				eq(githubWebhookDelivery.status, "received"),
				lt(githubWebhookDelivery.receivedAt, staleBefore),
			);

	const reclaimed = await db
		.update(githubWebhookDelivery)
		.set({
			status: "received",
			errorMessage: null,
			receivedAt: new Date().toISOString(),
			attempts: sql`${githubWebhookDelivery.attempts} + 1`,
		})
		.where(
			and(
				eq(githubWebhookDelivery.githubId, options.githubId),
				eq(githubWebhookDelivery.deliveryId, options.deliveryId),
				reclaimCondition,
			),
		)
		.returning({ deliveryId: githubWebhookDelivery.deliveryId });

	return reclaimed.length > 0 ? "retried" : "duplicate";
};

/**
 * Records the outcome of a delivery. `errorMessage` must already be safe: no
 * payload, token, private key or raw driver error.
 */
export const completeGithubDelivery = async (options: {
	githubId: string;
	deliveryId: string;
	status: "processed" | "ignored" | "failed";
	errorMessage?: string;
}): Promise<void> => {
	await db
		.update(githubWebhookDelivery)
		.set({
			status: options.status,
			processedAt: new Date().toISOString(),
			errorMessage: options.errorMessage ?? null,
		})
		.where(
			and(
				eq(githubWebhookDelivery.githubId, options.githubId),
				eq(githubWebhookDelivery.deliveryId, options.deliveryId),
			),
		);
};
