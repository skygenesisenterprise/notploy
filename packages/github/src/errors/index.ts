/**
 * Structured errors for the Notploy GitHub integration layer.
 *
 * Errors never embed credentials (tokens, private keys). They carry only
 * request-scoped metadata useful for debugging: HTTP status, GitHub error
 * code/documentation URL, request ID and rate-limit information.
 */

export interface GitHubRateLimitInfo {
	/** Total number of requests allowed in the current window. */
	limit: number;
	/** Remaining requests in the current window. */
	remaining: number;
	/** ISO 8601 timestamp at which the current window resets. */
	resetAt: string;
}

export interface GitHubRequestMeta {
	/** HTTP status returned by GitHub, when applicable. */
	status?: number;
	/** GitHub error identifier, e.g. "not_found" or "validation_failed". */
	code?: string;
	/** Value of the `X-GitHub-Request-Id` response header, when available. */
	requestId?: string;
	/** Rate-limit snapshot attached to 403/429 responses, when available. */
	rateLimit?: GitHubRateLimitInfo;
	/** Resource type reported by GitHub for 404 responses. */
	resource?: string;
}

/** Base class for every error raised by this package. */
export class GitHubError extends Error {
	readonly name: string = "GitHubError";

	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "GitHubError";
	}
}

/** Thrown when GitHub App or installation credentials are missing/invalid. */
export class GitHubAuthenticationError extends GitHubError {
	readonly name: string = "GitHubAuthenticationError";

	constructor(message = "GitHub authentication failed") {
		super(message);
		this.name = "GitHubAuthenticationError";
	}
}

/** Thrown when the authenticated identity lacks permission for an operation. */
export class GitHubAuthorizationError extends GitHubError {
	readonly name: string = "GitHubAuthorizationError";
	readonly status: number;
	readonly requestId?: string;

	constructor(
		message = "Not authorized to perform this GitHub operation",
		meta: GitHubRequestMeta = {},
	) {
		super(message);
		this.name = "GitHubAuthorizationError";
		this.status = meta.status ?? 403;
		this.requestId = meta.requestId;
	}
}

/** Thrown when a resource does not exist (HTTP 404). */
export class GitHubNotFoundError extends GitHubError {
	readonly name: string = "GitHubNotFoundError";
	readonly status: number;
	readonly resource?: string;
	readonly requestId?: string;

	constructor(
		message = "GitHub resource not found",
		meta: GitHubRequestMeta = {},
	) {
		super(message);
		this.name = "GitHubNotFoundError";
		this.status = meta.status ?? 404;
		this.resource = meta.resource;
		this.requestId = meta.requestId;
	}
}

/** Thrown when the primary or secondary rate limit is hit. */
export class GitHubRateLimitError extends GitHubError {
	readonly name: string = "GitHubRateLimitError";
	readonly status: number;
	readonly rateLimit?: GitHubRateLimitInfo;
	readonly requestId?: string;

	constructor(
		message = "GitHub API rate limit exceeded",
		meta: GitHubRequestMeta = {},
	) {
		super(message);
		this.name = "GitHubRateLimitError";
		this.status = meta.status ?? 403;
		this.rateLimit = meta.rateLimit;
		this.requestId = meta.requestId;
	}
}

/** Thrown for any other non-success response from the GitHub API. */
export class GitHubApiError extends GitHubError {
	readonly name: string = "GitHubApiError";
	readonly status?: number;
	readonly code?: string;
	readonly requestId?: string;
	readonly rateLimit?: GitHubRateLimitInfo;

	constructor(message: string, meta: GitHubRequestMeta = {}) {
		super(message);
		this.name = "GitHubApiError";
		this.status = meta.status;
		this.code = meta.code;
		this.requestId = meta.requestId;
		this.rateLimit = meta.rateLimit;
	}
}

/** Thrown when webhook signature verification or payload parsing fails. */
export class GitHubWebhookError extends GitHubError {
	readonly name: string = "GitHubWebhookError";
	/** Machine-readable reason: "invalid_signature", "unsupported_event", "malformed_payload". */
	readonly reason: string;

	constructor(
		message: string,
		reason: "invalid_signature" | "unsupported_event" | "malformed_payload",
	) {
		super(message);
		this.name = "GitHubWebhookError";
		this.reason = reason;
	}
}

/** Thrown when required client configuration is missing or invalid. */
export class GitHubConfigurationError extends GitHubError {
	readonly name: string = "GitHubConfigurationError";

	constructor(message: string) {
		super(message);
		this.name = "GitHubConfigurationError";
	}
}
