import {
	containerKill,
	containerRemove,
	containerRestart,
	containerStart,
	containerStop,
	deleteContainerFile,
	findServerById,
	getConfig,
	getContainers,
	getContainersByAppLabel,
	getContainersByAppNameMatch,
	getDockerEvents,
	getAccessibleServerIds,
	getServerHealth as getServerHealthData,
	getRemoteDocker,
	IS_CLOUD,
	getServiceContainersByAppName,
	getStackContainersByAppName,
	listContainerFiles,
	readContainerFile,
	uploadFileToContainer,
	writeContainerFile,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { checkPermission } from "@notploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { server } from "@/server/db/schema";
import { uploadFileToContainerSchema } from "@/utils/schema";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

export const containerIdRegex = /^[a-zA-Z0-9.\-_]+$/;

const containerPathSchema = z
	.string()
	.min(1)
	.max(4096)
	.refine(
		(path) => path.startsWith("/") && !path.includes("\0"),
		"Path must be absolute.",
	);

export const dockerRouter = createTRPCRouter({
	getEngineInfo: withPermission("docker", "read")
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			const docker = await getRemoteDocker(input.serverId);
			const [info, version, containers, images, networks, volumes] =
				await Promise.all([
					docker.info(),
					docker.version(),
					docker.listContainers({ all: true }),
					docker.listImages(),
					docker.listNetworks(),
					docker.listVolumes(),
				]);
			const running = containers.filter((container) => container.State === "running")
				.length;
			const paused = containers.filter((container) => container.State === "paused")
				.length;

			return {
				engine: {
					version: version.Version,
					apiVersion: version.ApiVersion,
					minimumApiVersion: version.MinAPIVersion,
					hostname: info.Name,
					operatingSystem: info.OperatingSystem,
					osType: info.OSType,
					architecture: info.Architecture,
					kernelVersion: info.KernelVersion,
					dockerRootDir: info.DockerRootDir,
					storageDriver: info.Driver,
					loggingDriver: info.LoggingDriver,
					cgroupDriver: info.CgroupDriver,
					defaultRuntime: info.DefaultRuntime,
					runtimes: info.Runtimes ? Object.keys(info.Runtimes) : [],
					securityOptions: info.SecurityOptions ?? [],
					liveRestoreEnabled: info.LiveRestoreEnabled,
					experimentalBuild: info.ExperimentalBuild,
				},
				capacity: {
					containers: containers.length,
					running,
					paused,
					stopped: containers.length - running - paused,
					images: images.length,
					networks: networks.length,
					volumes: volumes.Volumes?.length,
				},
				swarm: {
					state: info.Swarm?.LocalNodeState,
					isManager: info.Swarm?.ControlAvailable,
				},
				checkedAt: new Date().toISOString(),
			};
		}),

	getContainers: withPermission("docker", "read")
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
			return await getContainers(input.serverId);
		}),

	getFleetContainers: withPermission("docker", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleServerIds(ctx.session);
		const configuredServers = await db.query.server.findMany({
			columns: {
				serverId: true,
				name: true,
				sshKeyId: true,
			},
			where: eq(server.organizationId, ctx.session.activeOrganizationId),
			orderBy: desc(server.createdAt),
		});
		const targets = [
			...(!IS_CLOUD
				? [{ serverId: null, name: "Notploy instance", local: true }]
				: []),
			...configuredServers
				.filter((item) => accessibleIds.has(item.serverId) && item.sshKeyId)
				.map((item) => ({
					serverId: item.serverId,
					name: item.name,
					local: false,
				})),
		];

		return Promise.all(
			targets.map(async (target) => {
				try {
					const containers = await getContainers(target.serverId);
					return { ...target, containers, error: null };
				} catch (error) {
					return {
						...target,
						containers: [],
						error:
							error instanceof Error
								? error.message
								: "Could not connect to the Docker Engine.",
					};
				}
			}),
		);
	}),

	// Host-level diagnostics, so this requires docker.read AND server.read.
	getServerHealth: protectedProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
				sinceHours: z.number().int().min(1).max(168).optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			await checkPermission(ctx, { docker: ["read"], server: ["read"] });
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			return await getServerHealthData(
				ctx.session.activeOrganizationId,
				input.serverId,
				input.sinceHours,
			);
		}),

	restartContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await containerRestart(input.containerId, input.serverId);
			await audit(ctx, {
				action: "start",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	startContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await containerStart(input.containerId, input.serverId);
			await audit(ctx, {
				action: "start",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	stopContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await containerStop(input.containerId, input.serverId);
			await audit(ctx, {
				action: "stop",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	killContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await containerKill(input.containerId, input.serverId);
			await audit(ctx, {
				action: "stop",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	removeContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await containerRemove(input.containerId, input.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	getConfig: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
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
			return await getConfig(input.containerId, input.serverId);
		}),

	getContainersByAppNameMatch: withPermission("service", "read")
		.input(
			z.object({
				appType: z.enum(["stack", "docker-compose"]).optional(),
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getContainersByAppNameMatch(
				input.appName,
				input.appType,
				input.serverId,
			);
		}),

	getContainersByAppLabel: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
				serverId: z.string().optional(),
				type: z.enum(["standalone", "swarm"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			return await getContainersByAppLabel(
				input.appName,
				input.type,
				input.serverId,
			);
		}),

	getStackContainersByAppName: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getStackContainersByAppName(input.appName, input.serverId);
		}),

	getServiceContainersByAppName: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getServiceContainersByAppName(input.appName, input.serverId);
		}),

	uploadFileToContainer: withPermission("docker", "read")
		.input(uploadFileToContainerSchema)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			const file = input.file;
			if (!(file instanceof File)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid file provided",
				});
			}

			// Convert File to Buffer
			const arrayBuffer = await file.arrayBuffer();
			const fileBuffer = Buffer.from(arrayBuffer);

			await uploadFileToContainer(
				input.containerId,
				fileBuffer,
				file.name,
				input.destinationPath,
				input.serverId || null,
			);

			return { success: true, message: "File uploaded successfully" };
		}),

	listContainerFiles: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				path: containerPathSchema,
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
			return await listContainerFiles(
				input.containerId,
				input.path,
				input.serverId,
			);
		}),

	readContainerFile: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				path: containerPathSchema,
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
			return await readContainerFile(
				input.containerId,
				input.path,
				input.serverId,
			);
		}),

	writeContainerFile: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				path: containerPathSchema,
				content: z.string(),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await writeContainerFile(
				input.containerId,
				input.path,
				input.content,
				input.serverId,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: `${input.containerId}:${input.path}`,
			});
		}),

	deleteContainerFile: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				path: containerPathSchema.refine(
					(path) => path !== "/",
					"Cannot delete the container root.",
				),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			await deleteContainerFile(input.containerId, input.path, input.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: `${input.containerId}:${input.path}`,
			});
		}),

	getEvents: withPermission("docker", "read")
		.input(
			z.object({
				serverId: z.string().optional(),
				minutes: z.number().min(1).max(1440).default(15),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			return await getDockerEvents(input.serverId, input.minutes);
		}),
});
