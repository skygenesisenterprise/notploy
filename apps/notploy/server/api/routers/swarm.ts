import {
	findServerById,
	getAccessibleServerIds,
	getAllContainerStats,
	getApplicationInfo,
	getNodeApplications,
	getNodeInfo,
	getRemoteDocker,
	getSwarmNodes,
	IS_CLOUD,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "../trpc";
import { containerIdRegex } from "./docker";

export const swarmRouter = createTRPCRouter({
	getConsole: withPermission("docker", "read")
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const target = await findServerById(input.serverId);
				const accessibleServerIds = await getAccessibleServerIds(ctx.session);
				if (
					target.organizationId !== ctx.session.activeOrganizationId ||
					!accessibleServerIds.has(target.serverId)
				) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Server not found",
					});
				}
				if (!target.sshKeyId) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "This server has no Docker SSH connection configured.",
					});
				}
			} else if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Select a server to inspect its Swarm cluster.",
				});
			}

			const docker = await getRemoteDocker(input.serverId);
			const [info, version] = await Promise.all([
				docker.info(),
				docker.version(),
			]);
			const swarmInfo = info.Swarm;
			const state = swarmInfo?.LocalNodeState ?? "unknown";
			const checkedAt = new Date().toISOString();

			if (state !== "active") {
				return {
					state,
					isManager: false,
					nodeId: swarmInfo?.NodeID ?? null,
					clusterId: null,
					engineVersion: version.Version ?? null,
					checkedAt,
					nodes: [],
					services: [],
					tasks: [],
					controlPlaneAvailable: false,
				};
			}

			if (!swarmInfo?.ControlAvailable) {
				return {
					state,
					isManager: false,
					nodeId: swarmInfo.NodeID ?? null,
					clusterId: null,
					engineVersion: version.Version ?? null,
					checkedAt,
					nodes: [],
					services: [],
					tasks: [],
					controlPlaneAvailable: false,
				};
			}

			const [rawNodes, rawServices, rawTasks, rawSwarm] = await Promise.all([
				docker.listNodes(),
				docker.listServices({ status: true }),
				docker.listTasks({}),
				docker.swarmInspect(),
			]);
			const nodes = rawNodes.map((node) => ({
				id: node.ID,
				version: node.Version?.Index ?? null,
				createdAt: node.CreatedAt ?? null,
				updatedAt: node.UpdatedAt ?? null,
				hostname: node.Description?.Hostname ?? null,
				role: node.Spec?.Role ?? "worker",
				availability: node.Spec?.Availability ?? null,
				state: node.Status?.State ?? "unknown",
				address: node.Status?.Addr ?? null,
				managerStatus: node.ManagerStatus
					? {
							leader: node.ManagerStatus.Leader ?? false,
							reachability: node.ManagerStatus.Reachability ?? null,
							address: node.ManagerStatus.Addr ?? null,
						}
					: null,
				engineVersion: node.Description?.Engine?.EngineVersion ?? null,
				os: node.Description?.Platform?.OS ?? null,
				architecture: node.Description?.Platform?.Architecture ?? null,
				cpuNano: node.Description?.Resources?.NanoCPUs ?? null,
				memoryBytes: node.Description?.Resources?.MemoryBytes ?? null,
			}));
			const nodeNames = new Map(
				nodes.map((node) => [node.id, node.hostname ?? node.id]),
			);
			const services = rawServices.map((service) => {
				const spec = service.Spec;
				const mode = spec?.Mode;
				const desiredReplicas = mode?.Replicated
					? (mode.Replicated.Replicas ?? 0)
					: null;
				const tasks = rawTasks.filter((task) => task.ServiceID === service.ID);
				const runningReplicas = tasks.filter(
					(task) => task.Status?.State === "running",
				).length;
				return {
					id: service.ID,
					name: spec?.Name ?? service.ID,
					image: spec?.TaskTemplate?.ContainerSpec?.Image ?? null,
					mode: mode?.Global
						? "global"
						: mode?.Replicated
							? "replicated"
							: "unknown",
					desiredReplicas,
					runningReplicas,
					updateStatus: service.UpdateStatus?.State ?? null,
					ports: (spec?.EndpointSpec?.Ports ?? []).map((port) => ({
						published: port.PublishedPort ?? null,
						target: port.TargetPort ?? null,
						protocol: port.Protocol ?? null,
						mode: port.PublishMode ?? null,
					})),
					networks: (spec?.Networks ?? []).map((network) => ({
						target: network.Target ?? null,
					})),
					placementConstraints:
						spec?.TaskTemplate?.Placement?.Constraints ?? [],
					placementPreferences:
						spec?.TaskTemplate?.Placement?.Preferences?.map(
							(preference) => preference.Spread?.SpreadDescriptor,
						).filter((preference): preference is string =>
							Boolean(preference),
						) ?? [],
					resources: {
						reservations: {
							cpuNano:
								spec?.TaskTemplate?.Resources?.Reservations?.NanoCPUs ?? null,
							memoryBytes:
								spec?.TaskTemplate?.Resources?.Reservations?.MemoryBytes ??
								null,
						},
						limits: {
							cpuNano: spec?.TaskTemplate?.Resources?.Limits?.NanoCPUs ?? null,
							memoryBytes:
								spec?.TaskTemplate?.Resources?.Limits?.MemoryBytes ?? null,
						},
					},
					restartPolicy: spec?.TaskTemplate?.RestartPolicy
						? {
								condition: spec.TaskTemplate.RestartPolicy.Condition ?? null,
								delay: spec.TaskTemplate.RestartPolicy.Delay ?? null,
								maxAttempts:
									spec.TaskTemplate.RestartPolicy.MaxAttempts ?? null,
							}
						: null,
					updateConfig: spec?.UpdateConfig
						? {
								parallelism: spec.UpdateConfig.Parallelism ?? null,
								order: spec.UpdateConfig.Order ?? null,
								failureAction: spec.UpdateConfig.FailureAction ?? null,
							}
						: null,
					runningByNode: Object.entries(
						tasks
							.filter((task) => task.Status?.State === "running")
							.reduce<Record<string, number>>((counts, task) => {
								const name =
									nodeNames.get(task.NodeID ?? "") ??
									task.NodeID ??
									"Not assigned";
								counts[name] = (counts[name] ?? 0) + 1;
								return counts;
							}, {}),
					).map(([node, count]) => ({ node, count })),
				};
			});
			const serviceNames = new Map(
				services.map((service) => [service.id, service.name]),
			);
			const tasks = rawTasks.map((task) => ({
				id: task.ID,
				serviceId: task.ServiceID ?? null,
				serviceName: serviceNames.get(task.ServiceID ?? "") ?? null,
				nodeId: task.NodeID ?? null,
				nodeName: nodeNames.get(task.NodeID ?? "") ?? null,
				slot: task.Slot ?? null,
				desiredState: task.DesiredState ?? null,
				state: task.Status?.State ?? "unknown",
				error: task.Status?.Err ?? null,
				message: task.Status?.Message ?? null,
				containerId: task.Status?.ContainerStatus?.ContainerID ?? null,
				createdAt: task.CreatedAt ?? null,
				updatedAt: task.UpdatedAt ?? null,
			}));

			return {
				state,
				isManager: true,
				nodeId: swarmInfo.NodeID ?? null,
				clusterId: rawSwarm?.ID ?? null,
				engineVersion: version.Version ?? null,
				checkedAt,
				nodes,
				services,
				tasks,
				controlPlaneAvailable: true,
			};
		}),

	getNodes: withPermission("docker", "read")
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}
			}
			return await getSwarmNodes(input.serverId);
		}),
	getNodeInfo: withPermission("docker", "read")
		.input(z.object({ nodeId: z.string(), serverId: z.string().optional() }))
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}
			}
			return await getNodeInfo(input.nodeId, input.serverId);
		}),
	getNodeApps: withPermission("docker", "read")
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}
			}
			return getNodeApplications(input.serverId);
		}),
	getAppInfos: withPermission("docker", "read")
		.meta({
			openapi: {
				path: "/drop-deployment",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(
			z.object({
				appName: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid app name.")
					.array(),
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}
			}
			return await getApplicationInfo(input.appName, input.serverId);
		}),
	getContainerStats: withPermission("docker", "read")
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			return await getAllContainerStats(input.serverId);
		}),
});
