/**
 * Background state manager.
 *
 * Owns the in-memory snapshot the popup renders: the active instance, its
 * connection status, and the last fetched projects / deployments. Cached
 * resources are keyed per instance and **cleared on instance switch and on
 * logout** so a session never leaks into another one (acceptance criterion).
 *
 * Transport is HTTPS by default; `http:` origins are rejected unless they are
 * loopback (see `shared/url.ts`). The manager never fetches an origin that is
 * not a configured instance.
 */

import { NotployBrowserClient } from "../api/client.js";
import { NotployError } from "../shared/errors.js";
import type { ConnectionView, ExtensionSnapshot } from "../shared/messages.js";
import type {
	Deployment,
	NotployInstance,
	ProjectSummary,
} from "../shared/types.js";
import { validateInstanceUrl } from "../shared/url.js";
import type { InstanceStorage } from "./storage.js";

export const REQUEST_TIMEOUT = 30_000;
export const RECENT_DEPLOYMENTS_LIMIT = 20;

interface CachedResources {
	instanceId: string;
	projects: ProjectSummary[];
	deployments: Deployment[];
	lastRefresh?: string;
	connection: ConnectionView | undefined;
}

export class BackgroundState {
	private cache: CachedResources | undefined;

	constructor(private readonly store: InstanceStorage) {}

	async snapshot(): Promise<ExtensionSnapshot> {
		const instances = await this.store.listInstances();
		const active = await this.store.active();
		const cache = this.cache;
		const isActiveCache = Boolean(
			cache && active && cache.instanceId === active.id,
		);
		if (cache && active && cache.instanceId !== active.id) {
			this.cache = undefined;
		}
		return {
			instances,
			activeId: active?.id,
			connection: isActiveCache
				? (cache as CachedResources).connection
				: undefined,
			projects: isActiveCache
				? ((cache as CachedResources).projects ?? [])
				: [],
			deployments: isActiveCache
				? ((cache as CachedResources).deployments ?? [])
				: [],
			lastRefresh: isActiveCache
				? (cache as CachedResources).lastRefresh
				: undefined,
		};
	}

	async addInstance(
		name: string,
		url: string,
		label: NotployInstance["label"],
	): Promise<NotployInstance> {
		const trimmedName = name.trim();
		if (!trimmedName)
			throw new NotployError({
				code: "bad-request",
				userMessage: "Give the instance a name.",
			});
		const validation = validateInstanceUrl(url);
		if (!validation.valid || !validation.normalized) {
			throw new NotployError({
				code: "bad-request",
				userMessage: validation.error ?? "Invalid instance URL.",
			});
		}
		const existing = await this.store.findByUrl(validation.normalized);
		if (existing) {
			throw new NotployError({
				code: "bad-request",
				userMessage: `An instance with this URL already exists: ${existing.name}.`,
			});
		}
		const { createInstanceId } = await import("./storage.js");
		const instance: NotployInstance = {
			id: createInstanceId(),
			name: trimmedName,
			url: validation.normalized,
			label,
			lastStatus: "unknown",
			hasCredential: false,
		};
		await this.store.saveInstance(instance);
		const active = await this.store.active();
		if (!active || (await this.store.listInstances()).length === 1) {
			await this.store.setActiveId(instance.id);
		}
		return instance;
	}

	async removeInstance(instanceId: string): Promise<void> {
		await this.store.removeInstance(instanceId);
		if (this.cache?.instanceId === instanceId) this.cache = undefined;
	}

	async selectInstance(instanceId: string): Promise<void> {
		const instance = await this.store.getInstance(instanceId);
		if (!instance)
			throw new NotployError({
				code: "not-found",
				userMessage: "Unknown Notploy instance.",
			});
		// Clear cached resources before switching so the popup never renders
		// the previous instance's projects while the new one loads.
		this.cache = undefined;
		await this.store.setActiveId(instanceId);
	}

	private clientFor(
		instance: NotployInstance,
		token: string | undefined,
	): NotployBrowserClient {
		return new NotployBrowserClient({
			origin: instance.url,
			token,
			timeout: REQUEST_TIMEOUT,
			instanceName: instance.name,
		});
	}

	async login(
		instanceId: string,
		token: string,
	): Promise<{ apiKeysUrl?: string }> {
		const instance = await this.store.getInstance(instanceId);
		if (!instance)
			throw new NotployError({
				code: "not-found",
				userMessage: "Unknown Notploy instance.",
			});
		const trimmed = token.trim();
		if (!trimmed) {
			const { apiKeysUrl } = await import("../shared/url.js");
			throw Object.assign(
				new NotployError({
					code: "unauthorized",
					userMessage: "The API key is empty.",
				}),
				{ apiKeysUrl: apiKeysUrl(instance.url) },
			);
		}
		// Store first, verify, remove on rejection: an invalid key is never
		// left behind (same contract as the VS Code extension).
		await this.store.setToken(instance.id, trimmed);
		try {
			const client = this.clientFor(instance, trimmed);
			const session = await client.session();
			if (!session) {
				throw new NotployError({
					code: "unauthorized",
					userMessage: `${instance.name} did not accept this API key.`,
				});
			}
			await this.store.updateInstance(instance.id, {
				lastStatus: "connected",
				hasCredential: true,
			});
			this.cache = undefined;
			return {};
		} catch (error) {
			await this.store.deleteToken(instance.id);
			await this.store.updateInstance(instance.id, {
				lastStatus: "disconnected",
			});
			throw error;
		}
	}

	async logout(instanceId: string): Promise<void> {
		await this.store.deleteToken(instanceId);
		await this.store.updateInstance(instanceId, { lastStatus: "disconnected" });
		if (this.cache?.instanceId === instanceId) this.cache = undefined;
	}

	async testConnection(instanceId: string): Promise<ConnectionView> {
		const instance = await this.store.getInstance(instanceId);
		if (!instance)
			throw new NotployError({
				code: "not-found",
				userMessage: "Unknown Notploy instance.",
			});
		const token = await this.store.getToken(instance.id);
		const client = this.clientFor(instance, token);
		try {
			await client.health();
			if (!token) {
				const view: ConnectionView = { status: "disconnected" };
				await this.store.updateInstance(instance.id, {
					lastStatus: "disconnected",
				});
				return view;
			}
			const session = await client.session();
			if (!session) {
				const view: ConnectionView = {
					status: "disconnected",
					error: "The stored API key was rejected.",
				};
				await this.store.updateInstance(instance.id, {
					lastStatus: "disconnected",
				});
				return view;
			}
			const [version, cloud] = await Promise.all([
				client.version().catch(() => undefined),
				client.isCloud().catch(() => false),
			]);
			const view: ConnectionView = { status: "connected", version, cloud };
			await this.store.updateInstance(instance.id, {
				lastStatus: "connected",
				version,
				cloud,
			});
			return view;
		} catch (error) {
			const code = (error as NotployError).code;
			const status =
				code === "unauthorized" || code === "forbidden"
					? "disconnected"
					: "unavailable";
			await this.store.updateInstance(instance.id, { lastStatus: status });
			if (error instanceof NotployError) {
				return { status, error: error.userMessage };
			}
			return { status, error: "Unable to reach the instance." };
		}
	}

	async refresh(): Promise<ExtensionSnapshot> {
		const active = await this.store.active();
		if (!active)
			throw new NotployError({
				code: "not-configured",
				userMessage: "No Notploy instance is selected.",
			});
		const token = await this.store.getToken(active.id);
		if (!token) {
			this.cache = {
				instanceId: active.id,
				projects: [],
				deployments: [],
				connection: { status: "disconnected" },
				lastRefresh: undefined,
			};
			await this.store.updateInstance(active.id, {
				lastStatus: "disconnected",
			});
			return await this.snapshot();
		}
		const client = this.clientFor(active, token);
		try {
			const [projects, deployments] = await Promise.all([
				client.projects(),
				client.recentDeployments(RECENT_DEPLOYMENTS_LIMIT),
			]);
			const [version, cloud] = await Promise.all([
				client.version().catch(() => undefined),
				client.isCloud().catch(() => false),
			]);
			const connection: ConnectionView = {
				status: "connected",
				version,
				cloud,
			};
			this.cache = {
				instanceId: active.id,
				projects,
				deployments,
				connection,
				lastRefresh: new Date().toISOString(),
			};
			await this.store.updateInstance(active.id, {
				lastStatus: "connected",
				version,
				cloud,
				hasCredential: true,
			});
		} catch (error) {
			if (error instanceof NotployError && error.isSessionExpired) {
				this.cache = {
					instanceId: active.id,
					projects: [],
					deployments: [],
					connection: { status: "disconnected", error: error.userMessage },
					lastRefresh: undefined,
				};
				await this.store.updateInstance(active.id, {
					lastStatus: "disconnected",
				});
			} else {
				const message =
					error instanceof NotployError
						? error.userMessage
						: "Unable to reach the instance.";
				this.cache = {
					instanceId: active.id,
					projects:
						this.cache?.instanceId === active.id
							? (this.cache.projects ?? [])
							: [],
					deployments:
						this.cache?.instanceId === active.id
							? (this.cache.deployments ?? [])
							: [],
					connection: { status: "unavailable", error: message },
					lastRefresh: this.cache?.lastRefresh,
				};
				await this.store.updateInstance(active.id, {
					lastStatus: "unavailable",
				});
			}
			throw error;
		}
		return await this.snapshot();
	}
}
