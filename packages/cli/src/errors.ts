import axios from "axios";

/**
 * Stable exit codes for automation. See readme.md for the public contract.
 */
export const ExitCode = {
	Success: 0,
	General: 1,
	Usage: 2,
	Auth: 3,
	Api: 4,
	Timeout: 5,
	Interrupted: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export type ErrorType =
	| "general"
	| "usage"
	| "auth"
	| "api"
	| "timeout"
	| "interrupted";

export interface CliErrorOptions {
	code?: ExitCodeValue;
	hint?: string;
	cause?: unknown;
}

/**
 * An expected CLI failure. Messages and hints are safe to show to users after
 * redaction (the top-level printer always redacts known secrets).
 */
export class CliError extends Error {
	readonly code: ExitCodeValue;
	readonly hint?: string;

	constructor(message: string, options: CliErrorOptions = {}) {
		super(message, { cause: options.cause });
		this.name = "CliError";
		this.code = options.code ?? ExitCode.General;
		this.hint = options.hint;
	}
}

export function isCliError(error: unknown): error is CliError {
	return error instanceof CliError;
}

export function usageError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Usage, hint });
}

export function authError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Auth, hint });
}

export function apiError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Api, hint });
}

export function timeoutError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Timeout, hint });
}

const SECRET_KEY_PATTERN =
	/(x-api-key|authorization|api[_-]?key|token|password|secret)(\s*[:=]\s*)([^\s,;"'}]+)/gi;
const BEARER_PATTERN = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Removes known secret values and common credential patterns from text.
 *
 * Never rely on this instead of avoiding secret output in the first place; it
 * is a last line of defence for server-provided error messages.
 */
export function redactSecrets(text: string, secrets: string[] = []): string {
	let result = text;
	for (const secret of secrets) {
		if (!secret || secret.length < 4) continue;
		result = result.replace(
			new RegExp(escapeRegExp(secret), "g"),
			"[REDACTED]",
		);
	}
	return result
		.replace(BEARER_PATTERN, "$1 [REDACTED]")
		.replace(SECRET_KEY_PATTERN, (_match, key, separator) => {
			return `${key}${separator}[REDACTED]`;
		});
}

function extractServerMessage(data: unknown): string | undefined {
	if (typeof data === "string") {
		return data.trim() || undefined;
	}
	if (!data || typeof data !== "object") return undefined;

	const record = data as Record<string, unknown>;
	const candidates: unknown[] = [
		record.message,
		(record.error as Record<string, unknown> | undefined)?.message,
		(
			(record.error as Record<string, unknown> | undefined)?.json as
				| Record<string, unknown>
				| undefined
		)?.message,
		(
			(record.json as Record<string, unknown> | undefined)?.data as
				| Record<string, unknown>
				| undefined
		)?.message,
	];

	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim()) {
			return candidate.trim();
		}
	}
	return undefined;
}

function statusToCode(status: number): ExitCodeValue {
	if (status === 401 || status === 403) return ExitCode.Auth;
	if (status === 400 || status === 409 || status === 422) return ExitCode.Usage;
	return ExitCode.Api;
}

function statusHint(status: number): string | undefined {
	switch (status) {
		case 400:
			return "Check the command options and the server's API expectations.";
		case 401:
			return "Check your API key with 'notploy auth status' or NOTPLOY_API_KEY.";
		case 403:
			return "The API key is valid but lacks permission for this operation.";
		case 404:
			return "The endpoint is unavailable. The server may run an incompatible Notploy version.";
		case 409:
			return "The resource is in a conflicting state; refresh its status and retry.";
		case 422:
			return "The server rejected the input. Check the option values and types.";
		case 429:
			return "The server is rate limiting requests; wait and retry.";
		default:
			if (status >= 500) {
				return "The Notploy server reported an internal error; retry or inspect its logs.";
			}
			return undefined;
	}
}

/**
 * Converts any thrown value into a CliError with a stable exit code.
 *
 * The original Axios config (headers included) is never copied into the
 * message, so API keys cannot leak through error output.
 */
export function normalizeError(
	error: unknown,
	secrets: string[] = [],
): CliError {
	if (error instanceof CliError) {
		return new CliError(redactSecrets(error.message, secrets), {
			code: error.code,
			hint: error.hint ? redactSecrets(error.hint, secrets) : undefined,
			cause: error,
		});
	}

	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		const timeoutMs = error.config?.timeout;

		if (
			error.code === "ECONNABORTED" ||
			error.code === "ETIMEDOUT" ||
			error.name === "AbortError"
		) {
			return new CliError(
				timeoutMs
					? `Request timed out after ${timeoutMs}ms.`
					: "Request timed out.",
				{
					code: ExitCode.Timeout,
					hint: "Increase --timeout or NOTPLOY_TIMEOUT, or check the server.",
					cause: error,
				},
			);
		}

		if (!error.response) {
			const networkCode = error.code ?? "NETWORK_ERROR";
			const baseURL = error.config?.baseURL ?? "the Notploy server";
			return new CliError(
				redactSecrets(`Cannot reach ${baseURL} (${networkCode}).`, secrets),
				{
					code: ExitCode.Api,
					hint: "Check NOTPLOY_URL/server URL, network access and that the server is running.",
					cause: error,
				},
			);
		}

		const serverMessage =
			extractServerMessage(error.response.data) ??
			error.response.statusText ??
			error.message;
		const code = statusToCode(status ?? 0);
		const suffix = status ? ` (HTTP ${status})` : "";
		return new CliError(redactSecrets(`${serverMessage}${suffix}`, secrets), {
			code,
			hint: statusHint(status ?? 0),
			cause: error,
		});
	}

	if (error instanceof SyntaxError) {
		return new CliError(`Invalid JSON value: ${error.message}`, {
			code: ExitCode.Usage,
			hint: "Array and object options must be valid JSON.",
			cause: error,
		});
	}

	if (error instanceof Error) {
		return new CliError(redactSecrets(error.message, secrets), {
			code: ExitCode.General,
			cause: error,
		});
	}

	return new CliError(redactSecrets(String(error), secrets), {
		code: ExitCode.General,
	});
}

export function errorType(error: CliError): ErrorType {
	switch (error.code) {
		case ExitCode.Usage:
			return "usage";
		case ExitCode.Auth:
			return "auth";
		case ExitCode.Api:
			return "api";
		case ExitCode.Timeout:
			return "timeout";
		case ExitCode.Interrupted:
			return "interrupted";
		default:
			return "general";
	}
}
