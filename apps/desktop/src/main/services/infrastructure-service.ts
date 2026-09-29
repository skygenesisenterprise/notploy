/**
 * Infrastructure: servers, Docker containers, images, volumes, networks and
 * Docker Swarm nodes.
 *
 * Two properties of the API shape this service:
 *
 * - Most reads accept an optional `serverId`, so the same call lists the local
 *   server or a remote one.
 * - Destruction is explicit. `remove` is the only action here that can lose
 *   data, and the caller is expected to have confirmed it with the user first
 *   (see `preferences.confirmDestructiveActions`).
 */

import type {
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	NotployServer,
	SwarmNode,
} from "@/shared/domain";
import type { ContainerActionRequest } from "@/shared/ipc";
import type { ConnectionManager } from "../connection/connection-manager";

export class InfrastructureService {
	constructor(private readonly manager: ConnectionManager) {}

	async servers(): Promise<NotployServer[]> {
		const client = await this.manager.authenticatedClient();
		return await client.servers();
	}

	async containers(serverId?: string): Promise<DockerContainer[]> {
		const client = await this.manager.authenticatedClient();
		return await client.containers(serverId);
	}

	async containerConfig(
		containerId: string,
		serverId?: string,
	): Promise<unknown> {
		const client = await this.manager.authenticatedClient();
		return await client.containerConfig(containerId, serverId);
	}

	async containerAction(request: ContainerActionRequest): Promise<void> {
		const client = await this.manager.authenticatedClient();
		switch (request.action) {
			case "start":
				await client.startContainer(request.containerId, request.serverId);
				return;
			case "stop":
				await client.stopContainer(request.containerId, request.serverId);
				return;
			case "restart":
				await client.restartContainer(request.containerId, request.serverId);
				return;
			case "kill":
				await client.killContainer(request.containerId, request.serverId);
				return;
			case "remove":
				await client.removeContainer(request.containerId, request.serverId);
				return;
		}
	}

	async images(serverId?: string): Promise<DockerImage[]> {
		const client = await this.manager.authenticatedClient();
		return await client.images(serverId);
	}

	/**
	 * Volumes, with their size when the instance can compute it.
	 *
	 * `dockerVolume.getVolumes` returns a size only on some instances, and
	 * `dockerVolume.getVolumesSize` is the dedicated (and expensive) call for it.
	 * The cheap listing is used first and the sizes merged in when they are
	 * already available, so opening the page never blocks on a disk-wide scan.
	 */
	async volumes(serverId?: string): Promise<DockerVolume[]> {
		const client = await this.manager.authenticatedClient();
		const volumes = await client.volumes(serverId);
		if (volumes.every((volume) => volume.Size)) return volumes;

		const sizes = await client
			.volumesSize(serverId)
			.catch(() => [] as Array<{ name: string; size: string | null }>);
		if (sizes.length === 0) return volumes;

		const byName = new Map(sizes.map((entry) => [entry.name, entry.size]));
		return volumes.map((volume) => ({
			...volume,
			Size: volume.Size ?? byName.get(volume.Name) ?? null,
		}));
	}

	async networks(serverId?: string): Promise<DockerNetwork[]> {
		const client = await this.manager.authenticatedClient();
		return await client.networks(serverId);
	}

	/**
	 * Docker Swarm nodes.
	 *
	 * `cluster.getNodes` is the older route and `swarm.getNodes` the current
	 * one, so the current route is tried first and the legacy one is used as a
	 * fallback rather than reporting an empty manager.
	 */
	async swarmNodes(serverId?: string): Promise<SwarmNode[]> {
		const client = await this.manager.authenticatedClient();
		try {
			return await client.swarmNodes(serverId);
		} catch {
			return await client.clusterNodes(serverId);
		}
	}
}
