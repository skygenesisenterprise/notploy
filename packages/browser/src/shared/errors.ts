/**
 * Minimal error taxonomy for the browser extension.
 *
 * Mirrors `packages/vscode/src/core/errors.ts`: the UI must never surface a
 * raw stack trace or an SDK body, and anything that looks like a credential is
 * redacted before logging.
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

export interface ErrorContext {
	readonly operation: string;
	readonly instanceName?: string;
	readonly baseUrl?: string;
}

export class NotployError extends Error {
	readonly code: NotployErrorCode;
	readonly userMessage: string;
	readonly detail?: string;
	readonly status?: number;

	constructor(options: {
		code: NotployErrorCode;
		userMessage: string;
		cause?: unknown;
		detail?: string;
		status?: number;
	}) {
		super(options.userMessage, { cause: options.cause });
		this.name = "NotployError";
		this.code = options.code;
		this.userMessage = options.userMessage;
		this.detail = options.detail;
		this.status = options.status;
	}

	get isRetryable(): boolean {
		return (
			this.code === "connection" ||
			this.code === "timeout" ||
			this.code === "server-error"
		);
	}

	get isSessionExpired(): boolean {
		return this.code === "unauthorized" || this.code === "forbidden";
	}
}

const TOKEN_PATTERN =
	/(x-api-key|api[_-]?key|authorization|bearer|token|secret|password)\s*[:=]\s*\S+/gi;
const PREFIXED_KEY_PATTERN =
	/\b(?:sk|pk|rk|npk|ghp|gho|glpat|xox[bpas])_[A-Za-z0-9_-]{6,}/gi;
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;

export function redact(value: string): string {
	return value
		.replace(TOKEN_PATTERN, "$1: [redacted]")
		.replace(PREFIXED_KEY_PATTERN, "[redacted]")
		.replace(LONG_SECRET_PATTERN, (match) =>
			/[0-9]/.test(match) && /[a-zA-Z]/.test(match) ? "[redacted]" : match,
		);
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
			return `Unable to reach ${target}. Check the URL and your network.`;
		case "timeout":
			return `${target} did not respond in time.`;
		case "unauthorized":
			return `${target} rejected the stored API key. Sign in again.`;
		case "forbidden":
			return `${target} denied this operation for the current account.`;
		case "not-found":
			return `${target} could not find the requested resource.`;
		case "bad-request":
			return `${target} rejected the request parameters.`;
		case "server-error":
			return `${target} reported an internal error.`;
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

interface ErrorLike {
	code?: string;
	status?: number;
	statusCode?: number;
	message?: string;
	name?: string;
}

function readErrorLike(error: unknown): ErrorLike {
	if (typeof error !== "object" || error === null) return {};
	return error as ErrorLike;
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

export function toNotployError(
	error: unknown,
	context: ErrorContext,
): NotployError {
	if (error instanceof NotployError) return error;
	const detail = `${context.operation} :: ${stringifyUnknown(error) ?? "unknown"}`;
	if (
		error instanceof DOMException &&
		(error.name === "AbortError" || error.name === "TimeoutError")
	) {
		const code: NotployErrorCode =
			error.name === "TimeoutError" ? "timeout" : "cancelled";
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
			userMessage: userMessageFor(code, context),
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
				userMessage: userMessageFor(mapped, context),
				detail,
				cause: error,
			});
		}
	}
	if (like.name === "AbortError" || like.name === "TimeoutError") {
		const code: NotployErrorCode =
			like.name === "TimeoutError" ? "timeout" : "cancelled";
		return new NotployError({
			code,
			userMessage: userMessageFor(code, context),
			detail,
			cause: error,
		});
	}
	if (error instanceof TypeError) {
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

export function notConfigured(): NotployError {
	return new NotployError({
		code: "not-configured",
		userMessage: userMessageFor("not-configured", { operation: "resolve" }),
	});
}
