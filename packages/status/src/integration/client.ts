/**
 * Status Publisher — the integration client any Notploy backend (Console, the
 * monitoring agent, CI) uses to talk to a Status instance.
 *
 * Characteristics:
 * - machine-to-machine: a scoped bearer token, never a user session;
 * - idempotent: every mutating call sends an `Idempotency-Key`, so network
 *   retries cannot duplicate a public incident;
 * - resilient: transient failures (5xx, network) are retried with backoff,
 *   and every outcome is returned to the caller for logging;
 * - zero dependency: plain `fetch`.
 *
 * This client never publishes implicitly: `publishIncident` and `publish`
 * are explicit calls, matching the platform's rule that only configured
 * rules may go public.
 */

export interface StatusPublisherOptions {
	/** Base URL of the status instance, e.g. `https://status.notploy.com`. */
	baseUrl: string;
	/** Bearer token with the appropriate scopes. */
	token: string;
	/** Override for tests. */
	fetchImpl?: typeof fetch;
	/** Attempts for transient failures (default 3). */
	retries?: number;
	/** Base delay between attempts in ms (default 500, doubled per retry). */
	retryDelayMs?: number;
	/** Logger hook; receives method, path, status and attempt count. */
	onResult?: (result: {
		method: string;
		path: string;
		status: number;
		attempt: number;
		ok: boolean;
	}) => void;
}

export interface PublisherIncidentInput {
	pageRef: string;
	title: string;
	description?: string;
	severity?: "minor" | "major" | "critical";
	visibility?: "public" | "private";
	published?: boolean;
	componentIds?: string[];
	correlationKey?: string;
	updateMessage?: string;
}

export class StatusPublisherError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, body: unknown) {
		super(`Status API responded ${status}`);
		this.name = "StatusPublisherError";
		this.status = status;
		this.body = body;
	}
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const randomKey = (): string =>
	`pub_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export class StatusPublisher {
	private readonly options: Required<
		Pick<StatusPublisherOptions, "retries" | "retryDelayMs">
	> &
		StatusPublisherOptions;

	constructor(options: StatusPublisherOptions) {
		this.options = { retries: 3, retryDelayMs: 500, ...options };
	}

	private async request(
		method: string,
		path: string,
		body?: unknown,
		idempotencyKey?: string,
	): Promise<unknown> {
		const doFetch = this.options.fetchImpl ?? fetch;
		let attempt = 0;
		let lastError: unknown = null;
		while (attempt < this.options.retries) {
			attempt += 1;
			try {
				const headers: Record<string, string> = {
					authorization: `Bearer ${this.options.token}`,
					accept: "application/json",
				};
				if (body !== undefined) {
					headers["content-type"] = "application/json";
				}
				if (idempotencyKey) {
					headers["idempotency-key"] = idempotencyKey;
				}
				const response = await doFetch(
					`${this.options.baseUrl.replace(/\/$/, "")}${path}`,
					{
						method,
						headers,
						...(body !== undefined ? { body: JSON.stringify(body) } : {}),
					},
				);
				const text = await response.text();
				const parsed = text ? (JSON.parse(text) as unknown) : null;
				this.options.onResult?.({
					method,
					path,
					status: response.status,
					attempt,
					ok: response.ok,
				});
				if (response.ok) {
					return parsed;
				}
				if (response.status < 500) {
					// Client errors will not get better by retrying.
					throw new StatusPublisherError(response.status, parsed);
				}
				lastError = new StatusPublisherError(response.status, parsed);
			} catch (error) {
				if (error instanceof StatusPublisherError && error.status < 500) {
					throw error;
				}
				lastError = error;
			}
			await sleep(this.options.retryDelayMs * 2 ** (attempt - 1));
		}
		throw lastError instanceof Error
			? lastError
			: new StatusPublisherError(0, { message: String(lastError) });
	}

	/** Create an incident (optionally published immediately). */
	createIncident(input: PublisherIncidentInput): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/admin/pages/${encodeURIComponent(input.pageRef)}/incidents`,
			{
				title: input.title,
				description: input.description ?? "",
				severity: input.severity ?? "minor",
				visibility: input.visibility ?? "private",
				published: input.published ?? false,
				componentIds: input.componentIds ?? [],
				correlationKey: input.correlationKey,
				update: input.updateMessage
					? { message: input.updateMessage }
					: undefined,
			},
			randomKey(),
		);
	}

	/** Publish (or withdraw) an incident. */
	publish(
		incidentId: string,
		published: boolean,
		visibility?: "public" | "private",
	): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/admin/incidents/${encodeURIComponent(incidentId)}/publish`,
			{ published, visibility },
			randomKey(),
		);
	}

	/** Append a timeline update (public by default). */
	addUpdate(
		incidentId: string,
		message: string,
		options: { state?: string; visibility?: "public" | "private" } = {},
	): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/admin/incidents/${encodeURIComponent(incidentId)}/updates`,
			{
				message,
				state: options.state,
				visibility: options.visibility ?? "public",
			},
			randomKey(),
		);
	}

	/** Transition state; `resolved` resolves the incident. */
	setState(
		incidentId: string,
		state: string,
		message?: string,
	): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/admin/incidents/${encodeURIComponent(incidentId)}/state`,
			{ state, message },
			randomKey(),
		);
	}

	/** Resolve an incident with an optional public message. */
	resolve(incidentId: string, message?: string): Promise<unknown> {
		return this.setState(incidentId, "resolved", message);
	}

	/** Schedule a maintenance window. */
	scheduleMaintenance(input: {
		pageRef: string;
		title: string;
		description?: string;
		startAt: string;
		endAt: string;
		timeZone?: string;
		componentIds?: string[];
		visibility?: "public" | "private";
		published?: boolean;
	}): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/admin/pages/${encodeURIComponent(input.pageRef)}/maintenances`,
			{
				title: input.title,
				description: input.description ?? "",
				startAt: input.startAt,
				endAt: input.endAt,
				timeZone: input.timeZone ?? "UTC",
				componentIds: input.componentIds ?? [],
				visibility: input.visibility ?? "private",
				published: input.published ?? false,
			},
			randomKey(),
		);
	}

	/** Ingest a monitoring alert (deduplicated by `eventId`). */
	ingestEvent(input: {
		eventId?: string;
		pageSlug: string;
		componentId?: string;
		correlationKey: string;
		title: string;
		message?: string;
		severity?: "minor" | "major" | "critical";
		observedStatus?: "operational" | "degraded" | "outage" | "unknown";
		source?: string;
		updateComponentState?: boolean;
	}): Promise<unknown> {
		return this.request(
			"POST",
			"/api/v1/integration/events",
			{ updateComponentState: false, ...input },
			input.eventId ? `evt_${input.eventId}` : randomKey(),
		);
	}

	/** Report the observed state of a component. */
	reportComponentState(input: {
		pageSlug: string;
		componentId: string;
		observedStatus: "operational" | "degraded" | "outage" | "unknown";
		note?: string;
	}): Promise<unknown> {
		return this.request(
			"POST",
			`/api/v1/integration/pages/${encodeURIComponent(input.pageSlug)}/components/${encodeURIComponent(input.componentId)}/state`,
			{ observedStatus: input.observedStatus, note: input.note },
		);
	}

	/** Current public state of a component. */
	getComponentState(pageSlug: string, componentId: string): Promise<unknown> {
		return this.request(
			"GET",
			`/api/v1/integration/pages/${encodeURIComponent(pageSlug)}/components/${encodeURIComponent(componentId)}/state`,
		);
	}
}

export const createStatusPublisher = (options: StatusPublisherOptions): StatusPublisher =>
	new StatusPublisher(options);
