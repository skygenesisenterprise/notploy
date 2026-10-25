/**
 * Persistence for the browser extension.
 *
 * - Instance metadata (id, name, url, label) lives in `chrome.storage.local`
 *   under `notploy.instances`; the active id under `notploy.activeInstance`.
 * - API keys live in `chrome.storage.local` under `notploy.tokens` (a map).
 *   Browsers expose no OS-keychain equivalent to VS Code `SecretStorage`, so
 *   this is explicitly documented as "not a vault": keys are never synced
 *   (`storage.sync` is never used), never logged, and removed on logout /
 *   instance removal.
 *
 * The `MemoryStorage` fallback keeps unit tests hermetic and documents the
 * exact key layout without touching a real browser.
 */

import type { NotployInstance } from "../shared/types.js";

export const STORAGE_KEYS = {
	instances: "notploy.instances",
	activeInstance: "notploy.activeInstance",
	tokens: "notploy.tokens",
} as const;

export interface StorageArea {
	get(keys: string[]): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string[]): Promise<void>;
}

export function chromeLocalStorage(): StorageArea | undefined {
	try {
		const storage = (globalThis as unknown as { chrome?: typeof chrome }).chrome
			?.storage?.local;
		if (!storage) return undefined;
		return {
			async get(keys: string[]) {
				return await storage.get(keys);
			},
			async set(items: Record<string, unknown>) {
				await storage.set(items);
			},
			async remove(keys: string[]) {
				await storage.remove(keys);
			},
		};
	} catch {
		return undefined;
	}
}

export class MemoryStorage implements StorageArea {
	private data = new Map<string, unknown>();

	async get(keys: string[]): Promise<Record<string, unknown>> {
		const out: Record<string, unknown> = {};
		for (const key of keys) {
			if (this.data.has(key)) out[key] = this.data.get(key);
		}
		return out;
	}

	async set(items: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(items)) this.data.set(key, value);
	}

	async remove(keys: string[]): Promise<void> {
		for (const key of keys) this.data.delete(key);
	}
}

function asInstances(value: unknown): NotployInstance[] {
	return Array.isArray(value) ? (value as NotployInstance[]) : [];
}

function asRecord(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return {};
	const out: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (typeof entry === "string" && entry.trim()) out[key] = entry;
	}
	return out;
}

export class InstanceStorage {
	constructor(private readonly area: StorageArea) {}

	async listInstances(): Promise<NotployInstance[]> {
		const raw = await this.area.get([STORAGE_KEYS.instances]);
		return asInstances(raw[STORAGE_KEYS.instances]);
	}

	async getInstance(id: string): Promise<NotployInstance | undefined> {
		return (await this.listInstances()).find((instance) => instance.id === id);
	}

	async findByUrl(url: string): Promise<NotployInstance | undefined> {
		return (await this.listInstances()).find(
			(instance) => instance.url === url,
		);
	}

	async saveInstance(instance: NotployInstance): Promise<void> {
		const instances = (await this.listInstances()).filter(
			(entry) => entry.id !== instance.id,
		);
		instances.push(instance);
		await this.area.set({ [STORAGE_KEYS.instances]: instances });
	}

	async updateInstance(
		id: string,
		patch: Partial<NotployInstance>,
	): Promise<NotployInstance | undefined> {
		const instances = await this.listInstances();
		const existing = instances.find((entry) => entry.id === id);
		if (!existing) return undefined;
		const updated: NotployInstance = { ...existing, ...patch, id };
		await this.area.set({
			[STORAGE_KEYS.instances]: instances.map((entry) =>
				entry.id === id ? updated : entry,
			),
		});
		return updated;
	}

	async removeInstance(id: string): Promise<void> {
		const instances = (await this.listInstances()).filter(
			(entry) => entry.id !== id,
		);
		await this.area.set({ [STORAGE_KEYS.instances]: instances });
		const activeId = await this.getActiveId();
		if (activeId === id) await this.area.remove([STORAGE_KEYS.activeInstance]);
		await this.deleteToken(id);
	}

	async getActiveId(): Promise<string | undefined> {
		const raw = await this.area.get([STORAGE_KEYS.activeInstance]);
		const value = raw[STORAGE_KEYS.activeInstance];
		return typeof value === "string" && value.trim() ? value : undefined;
	}

	async setActiveId(id: string): Promise<void> {
		await this.area.set({ [STORAGE_KEYS.activeInstance]: id });
	}

	async active(): Promise<NotployInstance | undefined> {
		const instances = await this.listInstances();
		if (instances.length === 0) return undefined;
		const activeId = await this.getActiveId();
		if (activeId) {
			const found = instances.find((entry) => entry.id === activeId);
			if (found) return found;
		}
		if (instances.length === 1) return instances[0];
		return undefined;
	}

	async getToken(id: string): Promise<string | undefined> {
		const raw = await this.area.get([STORAGE_KEYS.tokens]);
		const tokens = asRecord(raw[STORAGE_KEYS.tokens]);
		const token = tokens[id];
		return token?.trim() ? token : undefined;
	}

	async setToken(id: string, token: string): Promise<void> {
		const raw = await this.area.get([STORAGE_KEYS.tokens]);
		const tokens = asRecord(raw[STORAGE_KEYS.tokens]);
		tokens[id] = token;
		await this.area.set({ [STORAGE_KEYS.tokens]: tokens });
		await this.updateInstance(id, { hasCredential: true });
	}

	async deleteToken(id: string): Promise<void> {
		const raw = await this.area.get([STORAGE_KEYS.tokens]);
		const tokens = asRecord(raw[STORAGE_KEYS.tokens]);
		if (tokens[id]) {
			delete tokens[id];
			await this.area.set({ [STORAGE_KEYS.tokens]: tokens });
		}
		await this.updateInstance(id, { hasCredential: false });
	}
}

export function createInstanceId(): string {
	return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
