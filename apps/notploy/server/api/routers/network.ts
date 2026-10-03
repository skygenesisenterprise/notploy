import {
	createNetwork,
	findNetworkById,
	findNetworksToSync,
	findServerById,
	getAccessibleServerIds,
	getRemoteDocker,
	IS_CLOUD,
	importDockerNetworks,
	inspectNetwork,
	recreateNetwork,
	removeNetwork,
	resyncNetwork,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import {
	apiCreateNetwork,
	apiFindOneNetwork,
	apiRemoveNetwork,
	network as networkTable,
} from "@/server/db/schema";
import { audit } from "../utils/audit";

const assertServerAccess = async (
	session: Parameters<typeof getAccessibleServerIds>[0],
	serverId?: string,
) => {
	if (!serverId) {
		if (IS_CLOUD) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Select a server to inspect its Docker networks.",
			});
		}
		return;
	}

	const target = await findServerById(serverId);
	const accessibleServerIds = await getAccessibleServerIds(session);
	if (
		target.organizationId !== session.activeOrganizationId ||
		!accessibleServerIds.has(target.serverId)
	) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });
	}
	if (!target.sshKeyId) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "This server has no Docker SSH connection configured.",
		});
	}
};

const assertNetworkAccess = async (
	session: Parameters<typeof getAccessibleServerIds>[0],
	networkId: string,
) => {
	const row = await findNetworkById(networkId);
	if (row.organizationId !== session.activeOrganizationId) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Network not found" });
	}
	if (row.serverId) {
		await assertServerAccess(session, row.serverId);
	}
	return row;
};

export const networkRouter = createTRPCRouter({
	inventory: withPermission("docker", "read")
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			await assertServerAccess(ctx.session, input.serverId);

			const docker = await getRemoteDocker(input.serverId);
			const [dockerNetworks, dockerContainers, trackedNetworks] =
				await Promise.all([
					docker.listNetworks(),
					docker.listContainers({ all: true }),
					db.query.network.findMany({
						where: and(
							eq(networkTable.organizationId, ctx.session.activeOrganizationId),
							input.serverId
								? eq(networkTable.serverId, input.serverId)
								: isNull(networkTable.serverId),
						),
					}),
				]);

			const containersById = new Map(
				dockerContainers.map((container) => [container.Id, container]),
			);
			const trackedByDockerId = new Map(
				trackedNetworks
					.filter((network) => network.dockerId)
					.map((network) => [network.dockerId, network]),
			);
			const trackedByName = new Map(
				trackedNetworks.map((network) => [network.name, network]),
			);
			const matchedTrackedIds = new Set<string>();

			const networks = dockerNetworks.map((dockerNetwork) => {
				const tracked =
					trackedByDockerId.get(dockerNetwork.Id) ??
					trackedByName.get(dockerNetwork.Name);
				if (tracked) matchedTrackedIds.add(tracked.networkId);

				const endpoints = Object.entries(dockerNetwork.Containers ?? {}).map(
					([containerId, endpoint]) => {
						const container = containersById.get(containerId);
						const labels = container?.Labels ?? {};
						return {
							containerId,
							name:
								endpoint.Name ||
								container?.Names?.[0]?.replace(/^\//, "") ||
								containerId.slice(0, 12),
							state: container?.State ?? "unknown",
							ipv4Address: endpoint.IPv4Address || null,
							ipv6Address: endpoint.IPv6Address || null,
							project:
								labels["com.docker.compose.project"] ??
								labels["com.docker.stack.namespace"] ??
								null,
							service:
								labels["com.docker.compose.service"] ??
								labels["com.docker.swarm.service.name"] ??
								null,
						};
					},
				);

				return {
					id: dockerNetwork.Id,
					name: dockerNetwork.Name,
					driver: dockerNetwork.Driver,
					scope: dockerNetwork.Scope,
					createdAt: dockerNetwork.Created,
					internal: dockerNetwork.Internal,
					attachable: dockerNetwork.Attachable,
					enableIPv6: dockerNetwork.EnableIPv6,
					ingress: dockerNetwork.Ingress,
					configOnly: dockerNetwork.ConfigOnly,
					ipam: dockerNetwork.IPAM
						? {
								driver: dockerNetwork.IPAM.Driver,
								config: (dockerNetwork.IPAM.Config ?? []).map((entry) => ({
									subnet: entry.Subnet ?? null,
									gateway: entry.Gateway ?? null,
									ipRange: entry.IPRange ?? null,
								})),
							}
						: null,
					containers: endpoints,
					status: "available" as const,
					networkRecordId: tracked?.networkId ?? null,
				};
			});

			const missingNetworks = trackedNetworks
				.filter((tracked) => !matchedTrackedIds.has(tracked.networkId))
				.map((tracked) => ({
					id: tracked.dockerId ?? tracked.networkId,
					name: tracked.name,
					driver: tracked.driver,
					scope: null,
					createdAt: tracked.createdAt,
					internal: tracked.internal,
					attachable: tracked.attachable,
					enableIPv6: tracked.enableIPv6,
					ingress: false,
					configOnly: false,
					ipam: tracked.ipam
						? {
								driver: tracked.ipam.driver ?? null,
								config: (tracked.ipam.config ?? []).map((entry) => ({
									subnet: entry.subnet ?? null,
									gateway: entry.gateway ?? null,
									ipRange: entry.ipRange ?? null,
								})),
							}
						: null,
					containers: [],
					status: "missing" as const,
					networkRecordId: tracked.networkId,
				}));

			return [...networks, ...missingNetworks].sort((a, b) =>
				a.name.localeCompare(b.name),
			);
		}),

	all: protectedProcedure
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			if (input.serverId) await assertServerAccess(ctx.session, input.serverId);
			const rows = await db.query.network.findMany({
				where: and(
					eq(networkTable.organizationId, ctx.session.activeOrganizationId),
					input.serverId
						? eq(networkTable.serverId, input.serverId)
						: isNull(networkTable.serverId),
				),
				orderBy: desc(networkTable.createdAt),
			});
			return rows;
		}),

	one: protectedProcedure
		.input(apiFindOneNetwork)
		.query(async ({ ctx, input }) => {
			await assertNetworkAccess(ctx.session, input.networkId);
			const row = await findNetworkById(input.networkId);
			return row;
		}),
	create: withPermission("docker", "read")
		.input(apiCreateNetwork)
		.mutation(async ({ ctx, input }) => {
			await assertServerAccess(ctx.session, input.serverId);
			const created = await createNetwork(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "network",
				resourceId: created.networkId,
				resourceName: created.name,
			});
			return created;
		}),
	networksToSync: withPermission("docker", "read")
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			await assertServerAccess(ctx.session, input.serverId);
			return findNetworksToSync(
				ctx.session.activeOrganizationId,
				input.serverId ?? null,
			);
		}),

	import: withPermission("docker", "read")
		.input(
			z.object({
				serverId: z.string().optional(),
				names: z.array(z.string().min(1)).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertServerAccess(ctx.session, input.serverId);
			const result = await importDockerNetworks(
				ctx.session.activeOrganizationId,
				input.serverId ?? null,
				input.names,
			);
			if (result.imported.length > 0) {
				await audit(ctx, {
					action: "create",
					resourceType: "network",
					resourceName: result.imported.join(", "),
					metadata: { imported: result.imported },
				});
			}
			return result;
		}),

	inspect: withPermission("docker", "read")
		.input(apiFindOneNetwork)
		.query(async ({ ctx, input }) => {
			await assertNetworkAccess(ctx.session, input.networkId);
			return inspectNetwork(input.networkId);
		}),

	recreate: withPermission("docker", "read")
		.input(apiFindOneNetwork)
		.mutation(async ({ ctx, input }) => {
			await assertNetworkAccess(ctx.session, input.networkId);
			const recreated = await recreateNetwork(input.networkId);
			await audit(ctx, {
				action: "reload",
				resourceType: "network",
				resourceId: recreated.networkId,
				resourceName: recreated.name,
			});
			return recreated;
		}),

	resync: withPermission("docker", "read")
		.input(apiFindOneNetwork)
		.mutation(async ({ ctx, input }) => {
			await assertNetworkAccess(ctx.session, input.networkId);
			const resynced = await resyncNetwork(
				input.networkId,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "network",
				resourceId: resynced.networkId,
				resourceName: resynced.name,
			});
			return resynced;
		}),

	remove: withPermission("docker", "read")
		.input(apiRemoveNetwork)
		.mutation(async ({ ctx, input }) => {
			await assertNetworkAccess(ctx.session, input.networkId);
			const removed = await removeNetwork(input.networkId);
			await audit(ctx, {
				action: "delete",
				resourceType: "network",
				resourceId: removed.networkId,
				resourceName: removed.name,
			});
			return removed;
		}),
});
