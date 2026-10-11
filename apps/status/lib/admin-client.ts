"use client";

/**
 * Browser client for the administration API.
 *
 * The operator's bearer token lives only in this browser (never in a cookie,
 * never on the server) and is attached to every `/api/v1/admin/*` call. The
 * engine enforces scopes server-side, so the UI never trusts its own view of
 * what a token may do.
 */
export class AdminApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "AdminApiError";
		this.status = status;
		this.code = code;
	}
}

export const adminRequest = async <T>(
	token: string,
	path: string,
	init: RequestInit = {},
): Promise<T> => {
	const response = await fetch(`/api/v1${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
			...(init.headers ?? {}),
		},
		cache: "no-store",
	});
	const text = await response.text();
	const payload = text ? (JSON.parse(text) as unknown) : null;
	if (!response.ok) {
		const error = (
			payload as { error?: { code?: string; message?: string } } | null
		)?.error;
		throw new AdminApiError(
			response.status,
			error?.code ?? "error",
			error?.message ?? `Request failed (HTTP ${response.status})`,
		);
	}
	return payload as T;
};

export interface Paginated<T> {
	items: T[];
	nextCursor: string | null;
}

/** `2026-01-31T09:00` (datetime-local) → ISO 8601 UTC. */
export const localInputToIso = (value: string): string =>
	new Date(value).toISOString();

/** ISO 8601 → `YYYY-MM-DDTHH:mm` for a `datetime-local` input. */
export const isoToLocalInput = (iso: string): string => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
