import { TtlCache } from "../core/cache";
import type {
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	NotployServer,
	SwarmNode,
} from "../core/domain";
import type { Logger } from "../core/logger";
import type { InstanceManager } from "./instance-manager";
import {
	createKubernetesAdapter,
	type KubernetesAdapter,
} from "./kubernetes-adapter";

const TTL_MS = 8_000;

/**
 * Everything under the Infrastructure view.
 *
 * Each section is loaded on demand — expanding "Docker" issues one request, not
 * one per section — and cached briefly so re-renders are free.
 *
 * Docker container logs are deliberately absent: the Notploy API exposes no
 * container-log procedure (`docker.*` only offers list/inspect/start/stop/
 * restart/kill/remove/upload). Application logs are available through
 * `application.readLogs`.
 */
export class InfrastructureService {
	private readonly serversCache: TtlCache<NotployServer[]>;
	private readonly containersCache = new Map<
		string,
		TtlCache<DockerContainer[]>
	>();
	private readonly imagesCache = new Map<string, TtlCache<DockerImage[]>>();
	private readonly volumesCache = new Map<string, TtlCache<DockerVolume[]>>();
	private readonly networksCache = new Map<string, TtlCache<DockerNetwork[]>>();
	private readonly nodesCache: TtlCache<SwarmNode[]>;

	constructor(
		private readonly instances: InstanceManager,
		private readonly logger: Logger,
	) {
		this.serversCache = new TtlCache(TTL_MS, async () => {
			const client = await this.instances.authenticatedClient();
			return await client.servers();
		});
		this.nodesCache = new TtlCache(TTL_MS, async () => {
			const client = await this.instances.authenticatedClient();
			try {
				return await client.swarmNodes();
			} catch (error) {
				this.logger.debug("Swarm node listing unavailable", error);
				return [];
			}
		});
	}

	private perServer<T>(
		map: Map<string, TtlCache<T>>,
		key: string,
		loader: (serverId: string | undefined) => Promise<T>,
	): TtlCache<T> {
		let cache = map.get(key);
		if (!cache) {
			cache = new TtlCache(TTL_MS, () =>
				loader(key === "__local__" ? undefined : key),
			);
			map.set(key, cache);
		}
		return cache;
	}

	private serverKey(serverId?: string): string {
		return serverId ?? "__local__";
	}

	async servers(force = false): Promise<NotployServer[]> {
		return await this.serversCache.get(force);
	}

	async containers(
		serverId?: string,
		force = false,
	): Promise<DockerContainer[]> {
		const cache = this.perServer(
			this.containersCache,
			this.serverKey(serverId),
			(id) => this.loadContainers(id),
		);
		return await cache.get(force);
	}

	private async loadContainers(serverId?: string): Promise<DockerContainer[]> {
		const client = await this.instances.authenticatedClient();
		return await client.containers(serverId);
	}

	async images(serverId?: string, force = false): Promise<DockerImage[]> {
		const cache = this.perServer(
			this.imagesCache,
			this.serverKey(serverId),
			async (id) => {
				const client = await this.instances.authenticatedClient();
				return await client.images(id);
			},
		);
		return await cache.get(force);
	}

	async volumes(serverId?: string, force = false): Promise<DockerVolume[]> {
		const cache = this.perServer(
			this.volumesCache,
			this.serverKey(serverId),
			async (id) => {
				const client = await this.instances.authenticatedClient();
				return await client.volumes(id);
			},
		);
		return await cache.get(force);
	}

	/** Per-volume sizes from `docker system df`; best-effort only. */
	async volumesSize(
		serverId?: string,
	): Promise<Array<{ name: string; size: string | null }>> {
		const client = await this.instances.authenticatedClient();
		return await client.volumesSize(serverId);
	}

	async networks(serverId?: string, force = false): Promise<DockerNetwork[]> {
		const cache = this.perServer(
			this.networksCache,
			this.serverKey(serverId),
			async (id) => {
				const client = await this.instances.authenticatedClient();
				return await client.networks(id);
			},
		);
		return await cache.get(force);
	}

	async swarmNodes(force = false): Promise<SwarmNode[]> {
		return await this.nodesCache.get(force);
	}

	async containerConfig(
		containerId: string,
		serverId?: string,
	): Promise<unknown> {
		const client = await this.instances.authenticatedClient();
		return await client.containerConfig(containerId, serverId);
	}

	async startContainer(containerId: string, serverId?: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.startContainer(containerId, serverId);
		this.containersCache.clear();
	}

	async stopContainer(containerId: string, serverId?: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.stopContainer(containerId, serverId);
		this.containersCache.clear();
	}

	async restartContainer(
		containerId: string,
		serverId?: string,
	): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.restartContainer(containerId, serverId);
		this.containersCache.clear();
	}

	/** Kubernetes is served through an adapter, currently always unavailable. */
	kubernetesAdapter(): KubernetesAdapter {
		return createKubernetesAdapter(
			this.instances.active()?.capabilities ?? undefined,
		);
	}

	invalidate(): void {
		this.serversCache.invalidate();
		this.nodesCache.invalidate();
		this.containersCache.clear();
		this.imagesCache.clear();
		this.volumesCache.clear();
		this.networksCache.clear();
	}
}
