import { CONTEXT } from "../../core/constants";
import type { InstanceCapabilities } from "../../core/domain";
import type { Logger } from "../../core/logger";
import type { InfrastructureService } from "../../services/infrastructure-service";
import type { InstanceManager } from "../../services/instance-manager";
import type { KubernetesAdapter } from "../../services/kubernetes-adapter";
import {
	ContainerNode,
	ImageNode,
	MessageNode,
	NetworkNode,
	type NotployNode,
	ServerNode,
	SwarmNodeItem,
	VolumeNode,
} from "../nodes";
import { NotployTreeProvider } from "./base-tree";

/**
 * Infrastructure view: servers, Docker and the Swarm nodes Notploy manages.
 *
 * Sections appear only when the instance's own capability report says the
 * corresponding router exists. When it does not, the section is replaced by a
 * short explanation instead of an empty tree — and nothing is ever fabricated
 * to fill it.
 */
export class InfrastructureTreeProvider extends NotployTreeProvider {
	constructor(
		logger: Logger,
		private readonly instances: InstanceManager,
		private readonly infrastructure: InfrastructureService,
	) {
		super(logger);
	}

	protected async loadRoots(): Promise<NotployNode[]> {
		const capabilities = this.instances.active()?.capabilities;
		if (!capabilities) {
			return [
				new MessageNode(
					"Capabilities are unknown. Run “Notploy: Test Connection” to inspect this instance.",
					{ icon: "info" },
				),
			];
		}

		const nodes: NotployNode[] = [];

		nodes.push(
			capabilities.servers
				? new MessageNode("Servers", {
						icon: "server",
						children: () => this.loadServers(),
					})
				: new MessageNode("Servers are not exposed by this instance.", {
						icon: "circle-slash",
						tooltip: "The instance does not advertise a `server` router.",
					}),
		);

		nodes.push(
			capabilities.docker
				? new MessageNode("Docker", {
						icon: "squirrel",
						contextValue: CONTEXT.dockerGroup,
						children: () => this.loadDockerSections(capabilities),
					})
				: new MessageNode("Docker is not exposed by this instance.", {
						icon: "circle-slash",
						tooltip: "The instance does not advertise a `docker` router.",
					}),
		);

		nodes.push(
			new MessageNode("Nodes", {
				icon: "server-process",
				children: () => this.loadNodes(),
			}),
		);

		nodes.push(await this.loadKubernetesNode());

		return nodes;
	}

	private async loadServers(): Promise<NotployNode[]> {
		const servers = await this.infrastructure.servers();
		if (servers.length === 0) {
			return [
				new MessageNode("No remote server configured; workloads run locally.", {
					icon: "info",
				}),
			];
		}
		return servers.map(
			(server) =>
				new ServerNode(server, () =>
					this.loadServerContainers(server.serverId),
				),
		);
	}

	private async loadServerContainers(serverId: string): Promise<NotployNode[]> {
		const containers = await this.infrastructure.containers(serverId);
		if (containers.length === 0) {
			return [
				new MessageNode("No containers on this server.", { icon: "info" }),
			];
		}
		return containers.map((container) => new ContainerNode(container));
	}

	private async loadDockerSections(
		capabilities: InstanceCapabilities,
	): Promise<NotployNode[]> {
		const sections: NotployNode[] = [
			new MessageNode("Containers", {
				icon: "server-process",
				description: "this instance",
				children: () => this.loadLocalContainers(),
			}),
		];

		if (capabilities.dockerImages) {
			sections.push(
				new MessageNode("Images", {
					icon: "package",
					children: () => this.loadImages(),
				}),
			);
		}
		if (capabilities.dockerVolumes) {
			sections.push(
				new MessageNode("Volumes", {
					icon: "database",
					children: () => this.loadVolumes(),
				}),
			);
		}
		if (capabilities.networks) {
			sections.push(
				new MessageNode("Networks", {
					icon: "plug",
					children: () => this.loadNetworks(),
				}),
			);
		}

		sections.push(
			new MessageNode(
				"Container logs are not exposed by the Notploy API; use an application's logs instead.",
				{ icon: "info" },
			),
		);
		return sections;
	}

	private async loadLocalContainers(): Promise<NotployNode[]> {
		const containers = await this.infrastructure.containers();
		if (containers.length === 0) {
			return [new MessageNode("No containers found.", { icon: "info" })];
		}
		return containers.map((container) => new ContainerNode(container));
	}

	private async loadImages(): Promise<NotployNode[]> {
		const images = await this.infrastructure.images();
		if (images.length === 0) {
			return [new MessageNode("No images found.", { icon: "info" })];
		}
		return images.map((image) => new ImageNode(image));
	}

	private async loadVolumes(): Promise<NotployNode[]> {
		const [volumes, sizes] = await Promise.all([
			this.infrastructure.volumes(),
			this.infrastructure.volumesSize().catch(() => []),
		]);
		if (volumes.length === 0) {
			return [new MessageNode("No volumes found.", { icon: "info" })];
		}
		const sizeByName = new Map(sizes.map((entry) => [entry.name, entry.size]));
		return volumes.map((volume) => {
			const enriched = {
				...volume,
				Size: volume.Size ?? sizeByName.get(volume.Name),
			};
			return new VolumeNode(enriched);
		});
	}

	private async loadNetworks(): Promise<NotployNode[]> {
		const networks = await this.infrastructure.networks();
		if (networks.length === 0) {
			return [
				new MessageNode("No Notploy-managed networks found.", { icon: "info" }),
			];
		}
		return networks.map((network) => new NetworkNode(network));
	}

	private async loadNodes(): Promise<NotployNode[]> {
		const capabilities = this.instances.active()?.capabilities;
		if (!capabilities?.swarm) {
			return [
				new MessageNode(
					"Swarm is not enabled on this instance, so there are no cluster nodes to list.",
					{ icon: "circle-slash" },
				),
			];
		}
		const nodes = await this.infrastructure.swarmNodes();
		if (nodes.length === 0) {
			return [new MessageNode("No swarm nodes reported.", { icon: "info" })];
		}
		return nodes.map((node) => new SwarmNodeItem(node));
	}

	private async loadKubernetesNode(): Promise<NotployNode> {
		const adapter: KubernetesAdapter = this.infrastructure.kubernetesAdapter();
		if (adapter.available) {
			const clusters = await adapter.clusters();
			return new MessageNode("Kubernetes", {
				icon: "symbol-namespace",
				description: `${clusters.length} cluster(s)`,
				children: async () =>
					clusters.map(
						(cluster) =>
							new MessageNode(cluster.name, {
								icon: "symbol-namespace",
								description: cluster.version,
							}),
					),
			});
		}
		return new MessageNode("Kubernetes — not available", {
			icon: "symbol-namespace",
			description: "no Kubernetes router on this instance",
			contextValue: CONTEXT.kubernetesUnavailable,
			tooltip: adapter.unavailableReason,
		});
	}
}
