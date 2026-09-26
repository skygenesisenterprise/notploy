/**
 * Webhook support: verify signatures server-side, then parse payloads into
 * strongly-typed, discriminated Notploy events.
 *
 *   receive raw payload
 *     -> verify signature
 *       -> identify event
 *         -> parse event
 *           -> return typed event
 */

import { Webhooks } from "@octokit/webhooks";
import { GitHubWebhookError } from "../errors/index.js";
import type { GitHubWebhookEvent, GitHubWebhookEventName } from "./events.js";
import { parseWebhookPayload } from "./events.js";

export interface VerifyOptions {
	/** Raw request body as received (do not re-serialize JSON before verifying). */
	payload: string;
	/** Value of the `X-Hub-Signature-256` header. */
	signature: string;
}

export interface ParseOptions {
	/** Raw request body. */
	payload: string;
	/** Value of the `X-GitHub-Event` header. */
	eventName: string;
	/** Optional delivery id (`X-GitHub-Delivery` header) for tracing. */
	deliveryId?: string;
}

export interface VerifyAndParseOptions extends ParseOptions {
	/** Value of the `X-Hub-Signature-256` header. */
	signature: string;
}

export interface VerifyAndParseResult {
	event: GitHubWebhookEvent;
	deliveryId?: string;
}

export class WebhooksNamespace {
	private readonly webhooks: Webhooks;

	constructor(options: { secret: string }) {
		if (!options.secret || options.secret.trim() === "") {
			throw new GitHubWebhookError(
				"A webhook secret is required to verify GitHub deliveries",
				"invalid_signature",
			);
		}
		this.webhooks = new Webhooks({ secret: options.secret });
	}

	/** Verifies the HMAC signature of a delivery. Returns true when valid. */
	async verify(options: VerifyOptions): Promise<boolean> {
		try {
			return await this.webhooks.verify(options.payload, options.signature);
		} catch {
			// @octokit/webhooks throws on malformed signatures; treat as invalid.
			return false;
		}
	}

	/**
	 * Parses a raw payload into a typed Notploy event.
	 * Throws `GitHubWebhookError` for unsupported events or malformed payloads.
	 */
	parse(options: ParseOptions): GitHubWebhookEvent {
		let raw: unknown;
		try {
			raw = JSON.parse(options.payload);
		} catch {
			throw new GitHubWebhookError(
				"Webhook payload is not valid JSON",
				"malformed_payload",
			);
		}

		const parsed = parseWebhookPayload({
			eventName: options.eventName as GitHubWebhookEventName,
			payload: raw,
			...(options.deliveryId ? { deliveryId: options.deliveryId } : {}),
		});

		if (!parsed) {
			throw new GitHubWebhookError(
				`Unsupported GitHub webhook event: ${options.eventName}`,
				"unsupported_event",
			);
		}

		return parsed;
	}

	/**
	 * Verifies the signature then parses the payload in one call.
	 * Throws `GitHubWebhookError` (reason: "invalid_signature") when the
	 * signature check fails; never parses untrusted payloads.
	 */
	async verifyAndParse(
		options: VerifyAndParseOptions,
	): Promise<VerifyAndParseResult> {
		const isValid = await this.verify({
			payload: options.payload,
			signature: options.signature,
		});

		if (!isValid) {
			throw new GitHubWebhookError(
				"Webhook signature verification failed",
				"invalid_signature",
			);
		}

		const event = this.parse({
			payload: options.payload,
			eventName: options.eventName,
			...(options.deliveryId ? { deliveryId: options.deliveryId } : {}),
		});

		return {
			event,
			...(options.deliveryId ? { deliveryId: options.deliveryId } : {}),
		};
	}
}
