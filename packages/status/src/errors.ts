/**
 * Error vocabulary shared by the services and the HTTP layer.
 *
 * Services throw `StatusError`; the API maps it to a JSON problem response.
 * Messages are safe to return to API clients — internal details (stack
 * traces, driver errors, paths) never travel with them.
 */

export type StatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;

export class StatusError extends Error {
	readonly status: StatusCode;
	readonly code: string;
	readonly details: Record<string, unknown> | undefined;

	constructor(
		status: StatusCode,
		code: string,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "StatusError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export const badRequest = (
	message: string,
	details?: Record<string, unknown>,
) => new StatusError(400, "bad_request", message, details);

export const unauthorized = (message = "Missing or invalid credentials") =>
	new StatusError(401, "unauthorized", message);

export const forbidden = (message = "Insufficient scope") =>
	new StatusError(403, "forbidden", message);

export const notFound = (message = "Not found") =>
	new StatusError(404, "not_found", message);

export const conflict = (message: string, details?: Record<string, unknown>) =>
	new StatusError(409, "conflict", message, details);

export const unprocessable = (
	message: string,
	details?: Record<string, unknown>,
) => new StatusError(422, "unprocessable", message, details);

export const tooManyRequests = (message = "Too many requests") =>
	new StatusError(429, "rate_limited", message);

export const unavailable = (message: string) =>
	new StatusError(503, "unavailable", message);
