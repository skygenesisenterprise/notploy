/**
 * Owns one {@link NotployClient} per configured connection and the connection
 * state the UI renders.
 *
 * Two things this class is careful about:
 *
 * - **Clients are cached.** A client is rebuilt only when its URL, credential,
 *   timeout or TLS setting changes, so switching connection — or merely
 *   re-rendering a view — never re-reads the keychain or re-creates a client.
 *   The cache key embeds the credential but is only ever compared, never
 *   logged.
 * - **State changes are pushed.** Every mutation emits the full connection list
 *   to subscribers, so the renderer keeps a single source of truth instead of
 *   polling.
 *
 * `fetchImpl` is injected for the `allowInsecureTls` case, which keeps this
 * module free of Electron imports and therefore unit-testable.
 */

import type {
	CapabilityReport,
	Connection,
	ConnectionStatus,
	ConnectionSummary,
	InstanceCapabilities,
} from "@/shared/domain";
import { detectCapabilities } from "../client/capabilities";
import { NotployError, notConfigured, toNotployError } from "../client/errors";
import { NotployClient } from "../client/notploy-client";
import type { Logger } from "../logging";
import type { ConnectionStore } from "./connection-store";

interface ConnectionState {
	status: ConnectionStatus;
	hasCredential: boolean;
	version?: string;
	cloud?: boolean;
	capabilities?: InstanceCapabilities;
	lastCheckedAt?: string;
	error?: string;
}

export interface ConnectionManagerOptions {
	store: ConnectionStore;
	logger: Logger;
	/** Default request timeout when a connection does not override it. */
	defaultTimeout: () => number;
	/** Builds a TLS-skipping fetch for one connection, when requested. */
	insecureFetchFactory?: (connectionId: string) => typeof globalThis.fetch;
}

export interface ConnectionCheckResult {
	summary: ConnectionSummary;
	report?: CapabilityReport;
}

export class ConnectionManager {
	private readonly clients = new Map<string, NotployClient>();
	/** url + credential + timeout + TLS flags. Never logged, only compared. */
	private readonly clientKeys = new Map<string, string>();
	private readonly states = new Map<string, ConnectionState>();
	private readonly listeners = new Set<
		(summary: ConnectionSummary[]) => void
	>();

	constructor(private readonly options: ConnectionManagerOptions) {}

	// ---------------------------------------------------------------------
	// Subscriptions
	// ---------------------------------------------------------------------

	onChanged(listener: (summary: ConnectionSummary[]) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private async emit(): Promise<void> {
		const summaries = await this.summaries();
		for (const listener of this.listeners) {
			try {
				listener(summaries);
			} catch (error) {
				this.options.logger.error("A connection listener threw", error);
			}
		}
	}

	// ---------------------------------------------------------------------
	// Reads
	// ---------------------------------------------------------------------

	list(): readonly Connection[] {
		return this.options.store.list();
	}

	get(id: string | undefined): Connection | undefined {
		return this.options.store.get(id);
	}

	active(): Connection | undefined {
		return this.options.store.active();
	}

	private stateFor(id: string): ConnectionState {
		const existing = this.states.get(id);
		if (existing) return existing;
		const initial: ConnectionState = {
			status: "unknown",
			hasCredential: false,
		};
		this.states.set(id, initial);
		return initial;
	}

	/** One summary per connection, with credential presence resolved. */
	async summaries(): Promise<ConnectionSummary[]> {
		const connections = this.options.store.list();
		return await Promise.all(
			connections.map(async (connection) => {
				const state = this.stateFor(connection.id);
				state.hasCredential = Boolean(
					await this.options.store.getCredential(connection.id),
				);
				return this.toSummary(connection, state);
			}),
		);
	}

	private toSummary(
		connection: Connection,
		state: ConnectionState,
	): ConnectionSummary {
		const activeId = this.options.store.active()?.id;
		return {
			...connection,
			active: connection.id === activeId,
			hasCredential: state.hasCredential,
			status: state.status,
			version: state.version,
			cloud: state.cloud,
			capabilities: state.capabilities,
			lastCheckedAt: state.lastCheckedAt,
			error: state.error,
		};
	}

	async summary(id: string): Promise<ConnectionSummary> {
		const connection = this.options.store.get(id);
		if (!connection) throw notConfigured();
		const state = this.stateFor(connection.id);
		state.hasCredential = Boolean(
			await this.options.store.getCredential(connection.id),
		);
		return this.toSummary(connection, state);
	}

	// ---------------------------------------------------------------------
	// Clients
	// ---------------------------------------------------------------------

	/** Builds, or returns a cached, client for a connection. */
	async clientFor(connectionId?: string): Promise<NotployClient> {
		const connection = connectionId
			? this.options.store.get(connectionId)
			: this.options.store.active();
		if (!connection) throw notConfigured();

		const token = await this.options.store.getCredential(connection.id);
		const timeout = connection.timeout || this.options.defaultTimeout();
		const cacheKey = [
			connection.url,
			connection.allowInsecureTls ? "insecure" : "secure",
			String(timeout),
			token ?? "anonymous",
		].join("\u0000");

		const cached = this.clients.get(connection.id);
		if (cached && this.clientKeys.get(connection.id) === cacheKey) {
			return cached;
		}

		const client = new NotployClient({
			origin: connection.url,
			token,
			timeout,
			allowInsecureTls: connection.allowInsecureTls,
			connectionName: connection.name,
			fetchImpl: connection.allowInsecureTls
				? this.options.insecureFetchFactory?.(connection.id)
				: undefined,
			logger: this.options.logger,
		});
		this.clients.set(connection.id, client);
		this.clientKeys.set(connection.id, cacheKey);
		return client;
	}

	/** Client for the active connection. */
	async activeClient(): Promise<NotployClient> {
		return await this.clientFor(this.options.store.active()?.id);
	}

	/** Client for the active connection, requiring a stored credential. */
	async authenticatedClient(): Promise<NotployClient> {
		const connection = this.options.store.active();
		if (!connection) throw notConfigured();
		const client = await this.clientFor(connection.id);
		if (!client.authenticated) {
			throw new NotployError({
				code: "unauthorized",
				userMessage: `No API key is stored for "${connection.name}". Add one to sign in.`,
				detail: `missing credential for ${connection.id}`,
			});
		}
		return client;
	}

	/** Drops cached clients so the next call re-reads the credential. */
	invalidate(connectionId?: string): void {
		if (connectionId) {
			this.clients.delete(connectionId);
			this.clientKeys.delete(connectionId);
			return;
		}
		this.clients.clear();
		this.clientKeys.clear();
	}

	// ---------------------------------------------------------------------
	// Mutations
	// ---------------------------------------------------------------------

	async add(
		input: Parameters<ConnectionStore["add"]>[0],
	): Promise<ConnectionSummary> {
		const connection = await this.options.store.add(input);
		this.states.set(connection.id, { status: "unknown", hasCredential: false });
		await this.emit();
		return await this.summary(connection.id);
	}

	async update(
		id: string,
		patch: Parameters<ConnectionStore["update"]>[1],
	): Promise<ConnectionSummary> {
		const updated = await this.options.store.update(id, patch);
		if (!updated) throw notConfigured();
		// URL, credential or TLS may have changed: never reuse the old client.
		this.invalidate(id);
		await this.emit();
		return await this.summary(id);
	}

	async remove(id: string): Promise<void> {
		await this.options.store.remove(id);
		this.invalidate(id);
		this.states.delete(id);
		await this.emit();
	}

	async setActive(id: string): Promise<void> {
		this.options.store.setActive(id);
		await this.emit();
	}

	/**
	 * Stores an API key only after the instance has accepted it.
	 *
	 * A key that the instance rejects is never written: it would otherwise be
	 * picked up silently by the next request and produce a confusing failure far
	 * from the place the user typed it.
	 */
	async login(id: string, apiKey: string): Promise<ConnectionSummary> {
		const connection = this.options.store.get(id);
		if (!connection) throw notConfigured();
		const candidate = apiKey.trim();
		if (!candidate) {
			throw new NotployError({
				code: "bad-request",
				userMessage: "The API key is empty.",
				detail: "empty api key",
			});
		}

		const probe = new NotployClient({
			origin: connection.url,
			token: candidate,
			timeout: connection.timeout || this.options.defaultTimeout(),
			allowInsecureTls: connection.allowInsecureTls,
			connectionName: connection.name,
			fetchImpl: connection.allowInsecureTls
				? this.options.insecureFetchFactory?.(connection.id)
				: undefined,
			logger: this.options.logger,
		});

		const session = await probe.session();
		if (!session) {
			throw new NotployError({
				code: "unauthorized",
				userMessage: `"${connection.name}" did not accept that API key.`,
				detail: `session rejected for ${connection.id}`,
			});
		}

		await this.options.store.setCredential(id, candidate);
		this.invalidate(id);
		await this.checkConnection(id);
		return await this.summary(id);
	}

	async logout(id: string): Promise<ConnectionSummary> {
		await this.options.store.deleteCredential(id);
		this.invalidate(id);
		const state = this.stateFor(id);
		state.hasCredential = false;
		state.status = "unknown";
		state.capabilities = undefined;
		state.version = undefined;
		state.cloud = undefined;
		state.error = undefined;
		state.lastCheckedAt = undefined;
		await this.emit();
		return await this.summary(id);
	}

	// ---------------------------------------------------------------------
	// Connection checks
	// ---------------------------------------------------------------------

	/**
	 * Verifies that an instance answers, reads its version and cloud flag, and
	 * refreshes the capability report.
	 */
	async checkConnection(connectionId?: string): Promise<ConnectionCheckResult> {
		const connection = connectionId
			? this.options.store.get(connectionId)
			: this.options.store.active();
		if (!connection) throw notConfigured();

		const state = this.stateFor(connection.id);
		state.status = "checking";

		const client = await this.clientFor(connection.id);
		let status: ConnectionStatus = "unavailable";
		let report: CapabilityReport | undefined;
		let error: NotployError | undefined;

		try {
			await client.health();
			if (client.authenticated) {
				const session = await client.session();
				if (!session) {
					status = "disconnected";
					error = new NotployError({
						code: "unauthorized",
						userMessage: `"${connection.name}" did not accept the stored API key. Add a new one.`,
						detail: `session rejected for ${connection.id}`,
					});
				} else {
					status = "connected";
				}
			} else {
				// The instance answers but there is no credential yet.
				status = "disconnected";
			}

			if (status === "connected") {
				report = await detectCapabilities(client);
			}
		} catch (caught) {
			error =
				caught instanceof NotployError
					? caught
					: toNotployError(caught, {
							operation: "check connection",
							connectionName: connection.name,
							baseUrl: connection.url,
						});

			// The Notploy REST API gates every procedure behind authentication, so
			// a credential error still proves the server answered. Only a
			// transport failure means the instance is genuinely unreachable.
			status =
				error.code === "unauthorized" || error.code === "forbidden"
					? "disconnected"
					: "unavailable";
		}

		state.status = status;
		state.hasCredential = client.authenticated;
		state.version = report?.version;
		state.cloud = report?.capabilities.cloud;
		state.capabilities = report?.capabilities;
		state.lastCheckedAt = new Date().toISOString();
		state.error = error
			? error.userMessage
			: status === "disconnected" && !client.authenticated
				? "No API key is stored for this connection."
				: undefined;

		await this.emit();
		return { summary: await this.summary(connection.id), report };
	}

	/** Re-checks every configured connection, in parallel. */
	async checkAll(): Promise<ConnectionSummary[]> {
		await Promise.all(
			this.options.store
				.list()
				.map(async (connection) => await this.checkConnection(connection.id)),
		);
		return await this.summaries();
	}

	async refreshCapabilities(connectionId?: string): Promise<CapabilityReport> {
		const connection = connectionId
			? this.options.store.get(connectionId)
			: this.options.store.active();
		if (!connection) throw notConfigured();
		const client = await this.clientFor(connection.id);
		const report = await detectCapabilities(client);
		const state = this.stateFor(connection.id);
		state.capabilities = report.capabilities;
		state.version = report.version;
		state.cloud = report.capabilities.cloud;
		await this.emit();
		return report;
	}

	/** The capability set of the active connection, or an empty one. */
	async activeCapabilities(): Promise<InstanceCapabilities | undefined> {
		const active = this.options.store.active();
		if (!active) return undefined;
		return this.stateFor(active.id).capabilities;
	}
}
