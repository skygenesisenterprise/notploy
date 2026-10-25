import { redactSecrets } from "../../utils/security/redact";

/**
 * Typed errors for the Prometheus/Grafana connectors.
 *
 * Messages are safe to surface in the console: credentials and tokens are
 * redacted, hosts stay visible for troubleshooting. `retryable` tells the
 * console whether a retry button makes sense.
 */
export type ObservabilityErrorCategory =
	| "auth"
	| "network"
	| "timeout"
	| "invalid_response"
	| "unsupported"
	| "unknown";

const RETRYABLE: ReadonlySet<ObservabilityErrorCategory> = new Set([
	"network",
	"timeout",
	"unknown",
]);

export class ObservabilityError extends Error {
	readonly category: ObservabilityErrorCategory;
	readonly backend: "prometheus" | "grafana";
	readonly retryable: boolean;
	readonly statusCode?: number;

	constructor({
		category,
		backend,
		message,
		statusCode,
		cause,
	}: {
		category: ObservabilityErrorCategory;
		backend: "prometheus" | "grafana";
		message: string;
		statusCode?: number;
		cause?: unknown;
	}) {
		super(redactSecrets(message), { cause });
		this.name = "ObservabilityError";
		this.category = category;
		this.backend = backend;
		this.retryable = RETRYABLE.has(category);
		this.statusCode = statusCode;
	}
}

const readStatus = (error: unknown): number | undefined => {
	if (!error || typeof error !== "object") return undefined;
	const candidate = error as {
		statusCode?: unknown;
		status?: unknown;
	};
	return typeof candidate.statusCode === "number"
		? candidate.statusCode
		: typeof candidate.status === "number"
			? candidate.status
			: undefined;
};

/** Normalize fetch/HTTP failures into redacted connector errors. */
export const normalizeConnectorError = (
	error: unknown,
	backend: "prometheus" | "grafana",
	timeoutMs: number,
): ObservabilityError => {
	if (error instanceof ObservabilityError) return error;
	const status = readStatus(error);
	const raw = error instanceof Error ? error.message : String(error);
	const lower = raw.toLowerCase();

	if (
		error instanceof Error &&
		(error.name === "AbortError" ||
			error.name === "TimeoutError" ||
			lower.includes("timeout") ||
			lower.includes("aborted"))
	) {
		return new ObservabilityError({
			category: "timeout",
			backend,
			message: `The ${backend} backend did not answer within ${Math.round(timeoutMs / 1000)}s.`,
			statusCode: status,
			cause: error,
		});
	}

	if (status === 401 || status === 403) {
		return new ObservabilityError({
			category: "auth",
			backend,
			message: `The ${backend} backend rejected the credentials.`,
			statusCode: status,
			cause: error,
		});
	}

	if (status !== undefined && status >= 500) {
		return new ObservabilityError({
			category: "network",
			backend,
			message: `The ${backend} backend is temporarily unavailable.`,
			statusCode: status,
			cause: error,
		});
	}

	if (
		lower.includes("fetch failed") ||
		lower.includes("econnrefused") ||
		lower.includes("enotfound") ||
		lower.includes("socket")
	) {
		return new ObservabilityError({
			category: "network",
			backend,
			message: `The ${backend} backend could not be reached.`,
			statusCode: status,
			cause: error,
		});
	}

	return new ObservabilityError({
		category: "unknown",
		backend,
		message: `The ${backend} backend request failed.`,
		statusCode: status,
		cause: error,
	});
};
