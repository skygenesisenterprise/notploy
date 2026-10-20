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
	/**
	 * Raw request body exactly as received. Passing a re-serialized JSON body is
	 * never equivalent: the HMAC is computed over the original bytes.
	 */
	payload: RawWebhookPayload;
	/** Value of the `X-Hub-Signature-256` header. */
	signature: string;
}

/**
 * Raw delivery body, exactly as received.
 *
 * A parsed object or a re-serialized JSON string is not a substitute: the HMAC
 * is computed over the original bytes.
 */
export type RawWebhookPayload = string;

/** GitHub rejects deliveries above this size; we refuse them even earlier. */
export const DEFAULT_MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;

/** Case-insensitive header bag, as exposed by Node, Fetch and most proxies. */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface ReceiveOptions {
	payload: RawWebhookPayload;
	/** Request headers; `X-GitHub-Event`, `X-Hub-Signature-256` and `X-GitHub-Delivery` are required. */
	headers: WebhookHeaders;
}

export interface ReceiveResult {
	event: GitHubWebhookEvent;
	eventName: GitHubWebhookEventName;
	deliveryId: string;
}

export interface ParseOptions {
	/** Raw request body. */
	payload: RawWebhookPayload;
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

/**
 * Reads a header case-insensitively and normalizes repeated headers.
 * Returns `undefined` for missing or empty values.
 */
export const getWebhookHeader = (
	headers: WebhookHeaders,
	name: string,
): string | undefined => {
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== target) continue;
		const first = Array.isArray(value) ? value[0] : value;
		const trimmed = first?.trim();
		return trimmed ? trimmed : undefined;
	}
	return undefined;
};

export class WebhooksNamespace {
	private readonly webhooks: Webhooks;
	private readonly maxPayloadBytes: number;

	constructor(options: { secret: string; maxPayloadBytes?: number }) {
		if (!options.secret || options.secret.trim() === "") {
			throw new GitHubWebhookError(
				"A webhook secret is required to verify GitHub deliveries",
				"invalid_signature",
			);
		}
		this.maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
		this.webhooks = new Webhooks({ secret: options.secret });
	}

	/**
	 * Rejects missing, empty or oversized bodies before any HMAC work.
	 * A body that is not the exact delivered bytes cannot be verified.
	 */
	private assertPayload(payload: RawWebhookPayload): void {
		if (!payload) {
			throw new GitHubWebhookError(
				"Webhook payload is empty",
				"malformed_payload",
			);
		}

		if (Buffer.byteLength(payload, "utf8") > this.maxPayloadBytes) {
			throw new GitHubWebhookError(
				"Webhook payload exceeds the configured size limit",
				"payload_too_large",
			);
		}
	}

	/** Verifies the HMAC signature of a delivery. Returns true when valid. */
	async verify(options: VerifyOptions): Promise<boolean> {
		this.assertPayload(options.payload);

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
		this.assertPayload(options.payload);

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

	/**
	 * Full request handling: validate headers, verify the exact raw bytes, then
	 * parse. This is the entry point HTTP handlers should use — it refuses to
	 * look at payload fields until the signature is known to be valid.
	 */
	async receive(options: ReceiveOptions): Promise<ReceiveResult> {
		const signature = getWebhookHeader(options.headers, "x-hub-signature-256");
		const eventName = getWebhookHeader(options.headers, "x-github-event");
		const deliveryId = getWebhookHeader(options.headers, "x-github-delivery");

		if (!signature || !eventName || !deliveryId) {
			throw new GitHubWebhookError(
				"Missing X-Hub-Signature-256, X-GitHub-Event or X-GitHub-Delivery header",
				"invalid_headers",
			);
		}

		if (!isValidDeliveryId(deliveryId)) {
			throw new GitHubWebhookError(
				"Malformed X-GitHub-Delivery header",
				"invalid_headers",
			);
		}

		const { event } = await this.verifyAndParse({
			payload: options.payload,
			signature,
			eventName,
			deliveryId,
		});

		return {
			event,
			eventName: eventName as GitHubWebhookEventName,
			deliveryId,
		};
	}
}

/**
 * GitHub delivery ids are UUIDs. The check stays permissive enough for GitHub
 * Enterprise variants but still rejects path/header injection attempts.
 */
export const isValidDeliveryId = (value: string): boolean =>
	/^[A-Za-z0-9-]{8,100}$/.test(value);
