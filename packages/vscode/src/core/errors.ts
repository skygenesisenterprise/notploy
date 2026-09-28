/**
 * A single, human-readable error taxonomy for everything that can go wrong
 * while talking to a Notploy instance.
 *
 * The VS Code UI must never surface a raw stack trace or an SDK error body, so
 * every failure is funnelled through {@link toNotployError} and rendered with
 * {@link NotployError.userMessage}.
 */

export type NotployErrorCode =
	| "not-configured"
	| "connection"
	| "timeout"
	| "cancelled"
	| "unauthorized"
	| "forbidden"
	| "not-found"
	| "bad-request"
	| "server-error"
	| "unsupported"
	| "unknown";

export interface NotployErrorOptions {
	readonly code: NotployErrorCode;
	/** Message shown to the user. Must never contain a secret. */
	readonly userMessage: string;
	readonly cause?: unknown;
	readonly detail?: string;
	readonly status?: number;
}

export class NotployError extends Error {
	readonly code: NotployErrorCode;
	readonly userMessage: string;
	readonly detail?: string;
	readonly status?: number;

	constructor(options: NotployErrorOptions) {
		super(options.userMessage, { cause: options.cause });
		this.name = "NotployError";
		this.code = options.code;
		this.userMessage = options.userMessage;
		this.detail = options.detail;
		this.status = options.status;
	}

	/** True when retrying the same call could plausibly succeed. */
	get isRetryable(): boolean {
		return (
			this.code === "connection" ||
			this.code === "timeout" ||
			this.code === "server-error"
		);
	}
}

export interface ErrorContext {
	/** Where the failure happened, e.g. `GET /project.all`. Never a token. */
	readonly operation: string;
	readonly instanceName?: string;
	readonly baseUrl?: string;
}

const TOKEN_PATTERN =
	/(x-api-key|api[_-]?key|authorization|bearer|token|secret|password)\s*[:=]\s*\S+/gi;
/** Well-known credential prefixes (provider and Notploy keys). */
const PREFIXED_KEY_PATTERN =
	/\b(?:sk|pk|rk|npk|ghp|gho|glpat|xox[baprs])_[A-Za-z0-9_-]{6,}/gi;
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;

/**
 * Removes anything that looks like a credential from a string before it is
 * logged or shown in the UI.
 */
export function redact(value: string): string {
	return value
		.replace(TOKEN_PATTERN, "$1: [redacted]")
		.replace(PREFIXED_KEY_PATTERN, "[redacted]")
		.replace(LONG_SECRET_PATTERN, (match) =>
			// Keep short identifiers (project ids, container ids) readable; only
			// mask high-entropy blobs that are almost certainly keys.
			/[0-9]/.test(match) && /[a-zA-Z]/.test(match) ? "[redacted]" : match,
		);
}

function describeDetail(context: ErrorContext): string {
	const parts = [context.operation];
	if (context.instanceName) parts.push(`instance=${context.instanceName}`);
	if (context.baseUrl) parts.push(`url=${context.baseUrl}`);
	return parts.join(" ");
}

function stringifyUnknown(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "string") return redact(value);
	if (value instanceof Error) return redact(value.message);
	try {
		return redact(JSON.stringify(value));
	} catch {
		return undefined;
	}
}

interface ErrorLike {
	code?: string;
	status?: number;
	statusCode?: number;
	message?: string;
	name?: string;
	issues?: unknown;
}

function readErrorLike(error: unknown): ErrorLike {
	if (typeof error !== "object" || error === null) return {};
	return error as ErrorLike;
}

function statusToCode(status: number): NotployErrorCode {
	if (status === 400 || status === 422) return "bad-request";
	if (status === 401) return "unauthorized";
	if (status === 403) return "forbidden";
	if (status === 404) return "not-found";
	if (status === 408 || status === 504) return "timeout";
	if (status >= 500) return "server-error";
	return "unknown";
}

function tRpcCodeToCode(code: string): NotployErrorCode | undefined {
	switch (code) {
		case "UNAUTHORIZED":
			return "unauthorized";
		case "FORBIDDEN":
			return "forbidden";
		case "NOT_FOUND":
			return "not-found";
		case "BAD_REQUEST":
		case "PARSE_ERROR":
		case "UNPROCESSABLE_CONTENT":
			return "bad-request";
		case "TIMEOUT":
			return "timeout";
		case "TOO_MANY_REQUESTS":
			return "connection";
		case "INTERNAL_SERVER_ERROR":
		case "SERVICE_UNAVAILABLE":
			return "server-error";
		default:
			return undefined;
	}
}

function userMessageFor(code: NotployErrorCode, context: ErrorContext): string {
	const target = context.instanceName ? `"${context.instanceName}"` : "Notploy";
	switch (code) {
		case "connection":
			return `Unable to reach ${target}. The server may be unavailable, the URL may be incorrect, or the network may be blocking the connection.`;
		case "timeout":
			return `${target} did not respond in time. The instance may be busy or unreachable.`;
		case "unauthorized":
			return `${target} rejected the credentials. Sign in again or generate a new API key.`;
		case "forbidden":
			return `${target} denied this operation for the current account.`;
		case "not-found":
			return `${target} could not find the requested resource. It may have been removed.`;
		case "bad-request":
			return `${target} rejected the request because its parameters were invalid.`;
		case "server-error":
			return `${target} reported an internal error. The instance may need attention.`;
		case "cancelled":
			return "The operation was cancelled.";
		case "not-configured":
			return "No Notploy instance is configured. Add one to get started.";
		case "unsupported":
			return `${target} does not expose this capability.`;
		default:
			return `An unexpected error occurred while talking to ${target}.`;
	}
}

/** Detects the abort/timeout errors raised by `AbortSignal`. */
function isAbortError(error: unknown): boolean {
	const like = readErrorLike(error);
	return (
		like.name === "AbortError" ||
		like.name === "TimeoutError" ||
		(error instanceof DOMException && error.name === "AbortError")
	);
}

function isNetworkError(error: unknown): boolean {
	if (error instanceof TypeError) return true;
	const like = readErrorLike(error);
	if (like.name === "FetchError" || like.name === "NetworkError") return true;
	const cause = (error as { cause?: unknown })?.cause;
	if (cause instanceof Error) {
		const code = (cause as { code?: string }).code;
		return (
			code === "ECONNREFUSED" ||
			code === "ENOTFOUND" ||
			code === "ECONNRESET" ||
			code === "EHOSTUNREACH" ||
			code === "ENETUNREACH" ||
			code === "ETIMEDOUT" ||
			code === "UND_ERR_CONNECT_TIMEOUT" ||
			code === "UND_ERR_SOCKET"
		);
	}
	return false;
}

/**
 * Converts anything thrown by the Notploy SDK (or by our own guards) into a
 * {@link NotployError} carrying a message safe to show in the VS Code UI.
 */
export function toNotployError(
	error: unknown,
	context: ErrorContext,
): NotployError {
	if (error instanceof NotployError) return error;

	const detail = `${describeDetail(context)} :: ${stringifyUnknown(error) ?? "unknown"}`;

	if (isAbortError(error)) {
		const aborted = readErrorLike(error).name === "TimeoutError";
		const code: NotployErrorCode = aborted ? "timeout" : "cancelled";
		return new NotployError({
			code,
			userMessage: userMessageFor(code, context),
			detail,
			cause: error,
		});
	}

	const like = readErrorLike(error);

	const status = like.status ?? like.statusCode;
	if (typeof status === "number") {
		const code = statusToCode(status);
		return new NotployError({
			code,
			userMessage: messageWithApiDetail(code, context, like.message),
			detail,
			status,
			cause: error,
		});
	}

	if (typeof like.code === "string") {
		const mapped = tRpcCodeToCode(like.code);
		if (mapped) {
			return new NotployError({
				code: mapped,
				userMessage: messageWithApiDetail(mapped, context, like.message),
				detail,
				cause: error,
			});
		}
	}

	if (isNetworkError(error)) {
		return new NotployError({
			code: "connection",
			userMessage: userMessageFor("connection", context),
			detail,
			cause: error,
		});
	}

	return new NotployError({
		code: "unknown",
		userMessage: userMessageFor("unknown", context),
		detail,
		cause: error,
	});
}

/**
 * Prefers the server's own message when it is safe and informative, and falls
 * back to our generic copy otherwise.
 */
function messageWithApiDetail(
	code: NotployErrorCode,
	context: ErrorContext,
	apiMessage: string | undefined,
): string {
	if (code === "not-found" || code === "forbidden" || code === "server-error") {
		const trimmed = apiMessage?.trim();
		if (trimmed && trimmed.length <= 200 && !looksSensitive(trimmed)) {
			return trimmed;
		}
	}
	return userMessageFor(code, context);
}

function looksSensitive(text: string): boolean {
	// Anything redaction would rewrite is a credential, by construction.
	return redact(text) !== text;
}

export function isNotployError(error: unknown): error is NotployError {
	return error instanceof NotployError;
}

/** Throws a `not-configured` error; used by services with no active instance. */
export function notConfigured(): NotployError {
	return new NotployError({
		code: "not-configured",
		userMessage: userMessageFor("not-configured", { operation: "resolve" }),
	});
}

/** Signals a capability the instance does not expose. */
export function unsupported(capability: string): NotployError {
	return new NotployError({
		code: "unsupported",
		userMessage: `This Notploy instance does not expose "${capability}". The API has no endpoint for it.`,
		detail: `unsupported capability: ${capability}`,
	});
}
