/**
 * Instance Storage Service for Notploy Voyager
 *
 * This service manages the storage of Notploy instance connections.
 * It separates metadata (stored in AsyncStorage) from credentials (stored securely).
 *
 * This mirrors the ConnectionStore from the Desktop app but adapted for React Native.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clientManager, normalizeInstanceUrl } from "@/lib/sdk-client";
import { secureStorage } from "@/services/secure-storage";
import type {
	Connection,
	ConnectionInput,
	ConnectionSummary,
	ConnectionUpdate,
} from "@/types/domain";

// ============================================================================
// Configuration
// ============================================================================

/** Storage key for connections */
const CONNECTIONS_KEY = "@notploy_voyager_connections";

/** Storage key for active connection ID */
const ACTIVE_CONNECTION_KEY = "@notploy_voyager_active_connection";

/** Default connection state */
const DEFAULT_STATE = {
	connections: [] as Connection[],
	activeId: undefined as string | undefined,
};

// ============================================================================
// Types
// ============================================================================

/** Internal storage state */
interface StorageState {
	connections: Connection[];
	activeId?: string;
}

/** Instance with authentication status */
export interface InstanceWithAuth extends ConnectionSummary {
	/** API token for this instance (if available) */
	hasToken: boolean;
	/** Whether we're currently checking the connection */
	isChecking: boolean;
}

// ============================================================================
// Instance Storage Service
// ============================================================================

/**
 * Instance Storage Service
 *
 * Manages the storage and retrieval of Notploy instance connections.
 * Handles both metadata (AsyncStorage) and credentials (SecureStorage).
 */
export class InstanceStorageService {
	private cache: StorageState | null = null;
	private cachePromise: Promise<StorageState> | null = null;

	/**
	 * Load the connections from storage.
	 * Uses a cache to avoid multiple concurrent reads.
	 */
	async load(): Promise<StorageState> {
		// Return cached value if available
		if (this.cache) {
			return this.cache;
		}

		// If a read is already in progress, wait for it
		if (this.cachePromise) {
			return this.cachePromise;
		}

		this.cachePromise = this.readFromStorage();

		try {
			this.cache = await this.cachePromise;
			return this.cache;
		} finally {
			this.cachePromise = null;
		}
	}

	/**
	 * Read connections from AsyncStorage.
	 */
	private async readFromStorage(): Promise<StorageState> {
		try {
			const raw = await AsyncStorage.getItem(CONNECTIONS_KEY);
			if (!raw) {
				return { ...DEFAULT_STATE };
			}

			const parsed = JSON.parse(raw) as Partial<StorageState>;
			if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.connections)) {
				return { ...DEFAULT_STATE };
			}

			return {
				connections: parsed.connections || [],
				activeId: parsed.activeId,
			};
		} catch {
			return { ...DEFAULT_STATE };
		}
	}

	/**
	 * Write connections to AsyncStorage.
	 */
	private async writeToStorage(state: StorageState): Promise<void> {
		try {
			const json = JSON.stringify(state);
			await AsyncStorage.setItem(CONNECTIONS_KEY, json);
			this.cache = state;
		} catch (error) {
			console.error("Failed to write connections to storage:", error);
			throw new Error("Failed to save connections");
		}
	}

	/**
	 * Write active connection ID to AsyncStorage.
	 */
	private async writeActiveId(activeId: string | undefined): Promise<void> {
		try {
			if (activeId) {
				await AsyncStorage.setItem(ACTIVE_CONNECTION_KEY, activeId);
			} else {
				await AsyncStorage.removeItem(ACTIVE_CONNECTION_KEY);
			}
		} catch (error) {
			console.error("Failed to write active connection ID:", error);
		}
	}

	/**
	 * Get all connections.
	 */
	async getAll(): Promise<Connection[]> {
		const state = await this.load();
		return state.connections;
	}

	/**
	 * Get a specific connection by ID.
	 */
	async get(id: string): Promise<Connection | undefined> {
		const connections = await this.getAll();
		return connections.find((c) => c.id === id);
	}

	/**
	 * Get a connection by name or ID.
	 */
	async getByNameOrId(reference: string): Promise<Connection | undefined> {
		const needle = reference.trim().toLowerCase();
		if (!needle) return undefined;

		const connections = await this.getAll();
		return (
			connections.find((c) => c.id.toLowerCase() === needle) ??
			connections.find((c) => c.name.trim().toLowerCase() === needle)
		);
	}

	/**
	 * Get the active connection.
	 */
	async getActive(): Promise<Connection | undefined> {
		const state = await this.load();
		const activeId = state.activeId || (await this.getActiveIdFromStorage());

		if (!activeId) {
			// If no active connection is set, return the first one if it exists
			const connections = await this.getAll();
			if (connections.length === 1) {
				return connections[0];
			}
			return undefined;
		}

		return this.get(activeId);
	}

	/**
	 * Get the active connection ID from storage.
	 */
	private async getActiveIdFromStorage(): Promise<string | undefined> {
		try {
			const activeId = await AsyncStorage.getItem(ACTIVE_CONNECTION_KEY);
			return activeId || undefined;
		} catch {
			return undefined;
		}
	}

	/**
	 * Get the active connection ID.
	 */
	async getActiveId(): Promise<string | undefined> {
		const state = await this.load();
		return state.activeId || (await this.getActiveIdFromStorage());
	}

	/**
	 * Add a new connection.
	 */
	async add(input: ConnectionInput): Promise<Connection> {
		const state = await this.load();
		const now = new Date().toISOString();

		const connection: Connection = {
			id: this.generateId(),
			name: input.name.trim() || "Notploy",
			url: normalizeInstanceUrl(input.url),
			kind: input.kind ?? "self-hosted",
			allowInsecureTls: input.allowInsecureTls ?? false,
			timeout: input.timeout ?? 30000,
			createdAt: now,
			updatedAt: now,
		};

		// Add to storage
		const newState: StorageState = {
			connections: [...state.connections, connection],
			activeId: state.activeId ?? connection.id,
		};

		await this.writeToStorage(newState);
		await this.writeActiveId(newState.activeId);

		// Store API key if provided
		if (input.apiKey) {
			await secureStorage.setApiToken(connection.id, input.apiKey);
		}

		// Update client manager
		clientManager.removeClient(connection.id);

		return connection;
	}

	/**
	 * Update an existing connection.
	 */
	async update(id: string, patch: ConnectionUpdate): Promise<Connection | undefined> {
		const existing = await this.get(id);
		if (!existing) return undefined;

		const state = await this.load();
		const updated: Connection = {
			...existing,
			name: patch.name?.trim() ? patch.name.trim() : existing.name,
			url: patch.url ? normalizeInstanceUrl(patch.url) || existing.url : existing.url,
			kind: patch.kind ?? existing.kind,
			allowInsecureTls: patch.allowInsecureTls ?? existing.allowInsecureTls,
			timeout: patch.timeout ?? existing.timeout,
			updatedAt: new Date().toISOString(),
		};

		const newState: StorageState = {
			...state,
			connections: state.connections.map((c) => (c.id === id ? updated : c)),
		};

		await this.writeToStorage(newState);

		// Handle API key changes
		if (patch.apiKey === null) {
			await secureStorage.deleteApiToken(id);
		} else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
			await secureStorage.setApiToken(id, patch.apiKey);
		}

		// Update client manager
		clientManager.removeClient(id);

		return updated;
	}

	/**
	 * Remove a connection.
	 */
	async remove(id: string): Promise<void> {
		const state = await this.load();

		const newState: StorageState = {
			connections: state.connections.filter((c) => c.id !== id),
			activeId: state.activeId === id ? undefined : state.activeId,
		};

		await this.writeToStorage(newState);
		await this.writeActiveId(newState.activeId);

		// Remove credentials
		await secureStorage.clearConnection(id);

		// Update client manager
		clientManager.removeClient(id);
	}

	/**
	 * Set the active connection.
	 */
	async setActive(id: string): Promise<void> {
		const existing = await this.get(id);
		if (!existing) {
			throw new Error(`Connection with ID ${id} not found`);
		}

		const state = await this.load();
		const newState: StorageState = {
			...state,
			activeId: id,
		};

		await this.writeToStorage(newState);
		await this.writeActiveId(id);
	}

	/**
	 * Set the active connection by name or ID.
	 */
	async setActiveByNameOrId(reference: string): Promise<void> {
		const connection = await this.getByNameOrId(reference);
		if (!connection) {
			throw new Error(`Connection '${reference}' not found`);
		}
		await this.setActive(connection.id);
	}

	/**
	 * Get connection summaries with authentication status.
	 */
	async getSummaries(): Promise<InstanceWithAuth[]> {
		const connections = await this.getAll();
		const activeId = await this.getActiveId();

		const summaries: InstanceWithAuth[] = [];

		for (const connection of connections) {
			const hasToken = await this.hasToken(connection.id);

			summaries.push({
				...connection,
				active: connection.id === activeId,
				hasCredential: hasToken,
				hasToken,
				status: "unknown",
				isChecking: false,
			});
		}

		return summaries;
	}

	/**
	 * Check if a connection has stored credentials.
	 */
	async hasToken(connectionId: string): Promise<boolean> {
		const token = await secureStorage.getApiToken(connectionId);
		return Boolean(token);
	}

	/**
	 * Get the API token for a connection.
	 */
	async getToken(connectionId: string): Promise<string | null> {
		return secureStorage.getApiToken(connectionId);
	}

	/**
	 * Set the API token for a connection.
	 */
	async setToken(connectionId: string, token: string): Promise<void> {
		await secureStorage.setApiToken(connectionId, token);
		clientManager.removeClient(connectionId);
	}

	/**
	 * Delete the API token for a connection.
	 */
	async deleteToken(connectionId: string): Promise<void> {
		await secureStorage.deleteApiToken(connectionId);
		clientManager.removeClient(connectionId);
	}

	/**
	 * Clear all connection data.
	 */
	async clearAll(): Promise<void> {
		await this.writeToStorage({ ...DEFAULT_STATE });
		await this.writeActiveId(undefined);

		// Clear all credentials
		const connections = await this.getAll();
		await Promise.all(connections.map((c) => secureStorage.clearConnection(c.id)));

		// Clear client manager
		clientManager.clearAll();
		this.cache = null;
	}

	/**
	 * Generate a unique ID.
	 */
	private generateId(): string {
		// Use crypto if available, otherwise fallback to timestamp + random
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton instance storage service */
export const instanceStorage = new InstanceStorageService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize instance URL for storage.
 * This is exposed for use outside the service.
 */
export { normalizeInstanceUrl };
