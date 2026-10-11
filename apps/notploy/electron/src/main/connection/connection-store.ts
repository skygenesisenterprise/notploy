/**
 * Persistence for Notploy connections.
 *
 * Split in two, on purpose:
 *
 * - **Metadata** (id, name, URL, kind, TLS opt-out, timeout) lives in a JSON
 *   file in the app's user-data directory. It is not secret.
 * - **Credentials** — the API key of each connection — live in the OS keychain
 *   through `SecureStorage`, keyed per connection. Nothing writes a token to the
 *   config file, to a log line, or to the renderer.
 *
 * `ConnectionStore` is the only module allowed to touch either side, so a change
 * of storage strategy stays inside this file.
 */

import path from "node:path";
import type {
	Connection,
	ConnectionInput,
	ConnectionUpdate,
} from "@/shared/domain";
import { notConfigured } from "../client/errors";
import type { Logger } from "../logging";
import type { SecureStorage } from "../security/secure-storage";
import { credentialKey } from "../security/secure-storage";
import { JsonStore } from "../store/json-store";

interface ConnectionsFile {
	connections: Connection[];
	activeId?: string;
}

const DEFAULT_STATE: ConnectionsFile = { connections: [], activeId: undefined };

/** Origin normalisation: a bare host gets `https://`, paths are dropped. */
export function normalizeInstanceUrl(input: string): string {
	let candidate = input.trim();
	if (!candidate) return "";
	if (!/^https?:\/\//i.test(candidate)) {
		candidate = `https://${candidate}`;
	}
	try {
		const parsed = new URL(candidate);
		// Users frequently paste the API base or a deep dashboard URL.
		parsed.pathname = "";
		parsed.search = "";
		parsed.hash = "";
		return parsed.origin;
	} catch {
		return "";
	}
}

function newId(): string {
	// `crypto.randomUUID` is available in Electron's Node runtime and in tests.
	return globalThis.crypto.randomUUID();
}

export class ConnectionStore {
	private readonly config: JsonStore<ConnectionsFile>;

	constructor(
		userDataPath: string,
		private readonly secrets: SecureStorage,
		private readonly logger: Logger,
	) {
		this.config = new JsonStore<ConnectionsFile>(
			path.join(userDataPath, "connections.json"),
			DEFAULT_STATE,
		);
	}

	list(): Connection[] {
		return this.config.read().connections;
	}

	get(id: string | undefined): Connection | undefined {
		if (!id) return undefined;
		return this.list().find((connection) => connection.id === id);
	}

	findByNameOrId(reference: string): Connection | undefined {
		const needle = reference.trim().toLowerCase();
		if (!needle) return undefined;
		return (
			this.list().find(
				(connection) => connection.id.toLowerCase() === needle,
			) ??
			this.list().find(
				(connection) => connection.name.trim().toLowerCase() === needle,
			)
		);
	}

	/**
	 * The selected connection, resolved with this precedence:
	 * stored selection → the only configured connection → nothing.
	 */
	active(): Connection | undefined {
		const state = this.config.read();
		const stored = this.get(state.activeId);
		if (stored) return stored;
		if (state.connections.length === 1) return state.connections[0];
		return undefined;
	}

	activeId(): string | undefined {
		return this.active()?.id;
	}

	async add(input: ConnectionInput): Promise<Connection> {
		const now = new Date().toISOString();
		const connection: Connection = {
			id: newId(),
			name: input.name.trim() || "Notploy",
			url: normalizeInstanceUrl(input.url),
			kind: input.kind ?? "self-hosted",
			allowInsecureTls: input.allowInsecureTls ?? false,
			timeout: input.timeout ?? 30_000,
			createdAt: now,
			updatedAt: now,
		};
		this.config.update((state) => ({
			connections: [...state.connections, connection],
			// The first connection added becomes the active one.
			activeId: state.activeId ?? connection.id,
		}));
		if (input.apiKey) {
			await this.setCredential(connection.id, input.apiKey);
		}
		this.logger.info(
			`Connection registered: ${connection.name} (${connection.url})`,
		);
		return connection;
	}

	async update(
		id: string,
		patch: ConnectionUpdate,
	): Promise<Connection | undefined> {
		const existing = this.get(id);
		if (!existing) return undefined;

		const updated: Connection = {
			...existing,
			name: patch.name?.trim() ? patch.name.trim() : existing.name,
			url: patch.url
				? normalizeInstanceUrl(patch.url) || existing.url
				: existing.url,
			kind: patch.kind ?? existing.kind,
			allowInsecureTls: patch.allowInsecureTls ?? existing.allowInsecureTls,
			timeout: patch.timeout ?? existing.timeout,
			updatedAt: new Date().toISOString(),
		};

		this.config.update((state) => ({
			...state,
			connections: state.connections.map((connection) =>
				connection.id === id ? updated : connection,
			),
		}));

		// `apiKey: null` clears the credential, `undefined` leaves it untouched.
		if (patch.apiKey === null) {
			await this.deleteCredential(id);
		} else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
			await this.setCredential(id, patch.apiKey);
		}

		return updated;
	}

	async remove(id: string): Promise<void> {
		const existing = this.get(id);
		this.config.update((state) => ({
			connections: state.connections.filter(
				(connection) => connection.id !== id,
			),
			activeId: state.activeId === id ? undefined : state.activeId,
		}));
		// Removing a connection is local: the instance itself is never touched.
		await this.deleteCredential(id);
		if (existing) this.logger.info(`Connection removed: ${existing.name}`);
	}

	setActive(id: string): void {
		if (!this.get(id)) throw notConfigured();
		this.config.update((state) => ({ ...state, activeId: id }));
	}

	async getCredential(id: string): Promise<string | undefined> {
		return await this.secrets.get(credentialKey(id));
	}

	async setCredential(id: string, apiKey: string): Promise<void> {
		await this.secrets.set(credentialKey(id), apiKey.trim());
	}

	async deleteCredential(id: string): Promise<void> {
		await this.secrets.delete(credentialKey(id));
	}

	/** Refreshes the `hasCredential` view of every connection, in parallel. */
	async credentialFlags(): Promise<Record<string, boolean>> {
		const entries = await Promise.all(
			this.list().map(
				async (connection) =>
					[
						connection.id,
						Boolean(await this.getCredential(connection.id)),
					] as const,
			),
		);
		return Object.fromEntries(entries);
	}
}
