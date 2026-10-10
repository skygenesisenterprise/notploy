import {
	createServer,
	defaultCommand,
	deleteServer,
	findServerById,
	findServersByUserId,
	findUserById,
	generateSSHKey,
	getAccessibleServerIds,
	getPublicIpWithFallback,
	getServicesByServerId,
	haveActiveServices,
	IS_CLOUD,
	provisionSshKey,
	redactServerSshKey,
	removeDeploymentsByServerId,
	removeSshKeyWithPassword,
	serverAudit,
	serverSetup,
	serverValidate,
	setupMonitoring,
	SshError,
	updateServerById,
	verifySshKeyConnection,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { findMemberByUserId } from "@notploy/server/services/permission";
import { getWebServerSettings } from "@notploy/server/services/web-server-settings";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, desc, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { updateServersBasedOnQuantity } from "@/pages/api/stripe/webhook";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateServer,
	apiFindOneServer,
	apiRemoveServer,
	apiUpdateServer,
	apiUpdateServerBuildsConcurrency,
	apiUpdateServerMonitoring,
	applications,
	compose,
	mariadb,
	mongo,
	mysql,
	organization,
	postgres,
	redis,
	server,
	sshKeys,
} from "@/server/db/schema";
import { applyDockerCleanupSchedule } from "@/server/utils/docker-cleanup";

export interface ServerMetrics {
	cpu: string;
	cpuModel: string;
	cpuCores: number;
	cpuPhysicalCores: number;
	cpuSpeed: number;
	os: string;
	distro: string;
	kernel: string;
	arch: string;
	memUsed: string;
	memUsedGB: string;
	memTotal: string;
	uptime: number;
	diskUsed: string;
	totalDisk: string;
	networkIn: string;
	networkOut: string;
	timestamp: string;
}

async function fetchServerMetrics(input: {
	url: string;
	token: string;
	dataPoints: string;
}): Promise<ServerMetrics[]> {
	const url = new URL(input.url);
	url.searchParams.append("limit", input.dataPoints);
	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${input.token}`,
		},
	});
	if (!response.ok) {
		throw new Error(
			`Error ${response.status}: ${response.statusText}. Ensure the container is running and this service is included in the monitoring configuration.`,
		);
	}

	const data = await response.json();
	if (!Array.isArray(data) || data.length === 0) {
		throw new Error(
			[
				"No monitoring data available. This could be because:",
				"",
				"1. You don't have setup the monitoring service, you can do in web server section.",
				"2. If you already have setup the monitoring service, wait a few minutes and refresh the page.",
			].join("\n"),
		);
	}
	return data as ServerMetrics[];
}

/**
 * Maps an SSH-layer failure into an actionable, secrets-free tRPC error. The
 * `SshError` message is already categorized and safe to display; anything else
 * is reported generically so raw host/credential details never leak.
 */
const toServerOnboardingError = (
	error: unknown,
	phase: "provision" | "verify",
): TRPCError => {
	if (error instanceof SshError) {
		return new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
			cause: error,
		});
	}
	return new TRPCError({
		code: "BAD_REQUEST",
		message:
			phase === "provision"
				? "Could not connect to the server or install Notploy's SSH key. Check the address, port, credentials, and that this account has root or passwordless sudo access."
				: "Notploy's SSH key was installed but could not be verified. Ensure public key authentication is enabled for this account.",
		cause: error,
	});
};

export const serverRouter = createTRPCRouter({
	create: withPermission("server", "create")
		.input(apiCreateServer)
		.mutation(async ({ ctx, input }) => {
			try {
				const user = await findUserById(ctx.user.ownerId);
				const servers = await findServersByUserId(user.id);
				if (IS_CLOUD && servers.length >= user.serversQuantity) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "You cannot create more servers",
					});
				}
				const project = await createServer(
					input,
					ctx.session.activeOrganizationId,
				);
				try {
					await applyDockerCleanupSchedule(
						project.serverId,
						ctx.session.activeOrganizationId,
						input.enableDockerCleanup,
					);
				} catch (error) {
					console.error("Failed to schedule docker cleanup:", error);
				}
				await audit(ctx, {
					action: "create",
					resourceType: "server",
					resourceId: project.serverId,
					resourceName: project.name,
				});
				return project;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating the server",
					cause: error,
				});
			}
		}),
	createWithPassword: withPermission("server", "create")
		.input(
			apiCreateServer.omit({ sshKeyId: true }).extend({
				sshPassword: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { sshPassword, ...serverInput } = input;
			const user = await findUserById(ctx.user.ownerId);
			const servers = await findServersByUserId(user.id);
			if (IS_CLOUD && servers.length >= user.serversQuantity) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You cannot create more servers",
				});
			}

			const keyPair = await generateSSHKey("ed25519");
			let publicKeyInstalled = false;
			let hostKeyFingerprint: string | undefined;

			const cleanupInstalledKey = async () => {
				if (!publicKeyInstalled) return;
				try {
					await removeSshKeyWithPassword({
						host: serverInput.ipAddress,
						port: serverInput.port,
						username: serverInput.username,
						password: sshPassword,
						publicKey: keyPair.publicKey,
					});
				} catch (cleanupError) {
					console.error(
						"Failed to remove automatically provisioned SSH key after server creation failed",
						cleanupError,
					);
				}
			};

			// 1. Reach the server, authenticate, and install Notploy's public key.
			// Connectivity, authentication, authorization and host-key failures are
			// distinguished so the error shown to the user is actionable.
			try {
				const { hostKey } = await provisionSshKey({
					host: serverInput.ipAddress,
					port: serverInput.port,
					username: serverInput.username,
					password: sshPassword,
					publicKey: keyPair.publicKey,
				});
				publicKeyInstalled = true;
				hostKeyFingerprint = hostKey?.sha256;
			} catch (error) {
				throw toServerOnboardingError(error, "provision");
			}

			// 2. Prove the generated key grants access through a second SSH
			// connection. A successful password session is not enough.
			try {
				await verifySshKeyConnection({
					host: serverInput.ipAddress,
					port: serverInput.port,
					username: serverInput.username,
					privateKey: keyPair.privateKey,
				});
			} catch (error) {
				await cleanupInstalledKey();
				throw toServerOnboardingError(error, "verify");
			}

			// 3. Persist the server and its key atomically. If persistence fails,
			// remove the installed key so onboarding leaves no orphaned state.
			let createdServer: typeof server.$inferSelect;
			try {
				const result = await db.transaction(async (tx) => {
					const [sshKey] = await tx
						.insert(sshKeys)
						.values({
							name: `${serverInput.name} managed key`,
							description:
								"Provisioned automatically when this server was connected.",
							privateKey: keyPair.privateKey,
							publicKey: keyPair.publicKey,
							organizationId: ctx.session.activeOrganizationId,
						})
						.returning({ sshKeyId: sshKeys.sshKeyId });
					if (!sshKey) {
						throw new Error("Failed to save the generated SSH key");
					}

					const [newServer] = await tx
						.insert(server)
						.values({
							...serverInput,
							sshKeyId: sshKey.sshKeyId,
							organizationId: ctx.session.activeOrganizationId,
							createdAt: new Date().toISOString(),
						})
						.returning();
					if (!newServer) {
						throw new Error("Failed to save the server");
					}
					return newServer;
				});
				createdServer = result;
			} catch (error) {
				await cleanupInstalledKey();
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Server was connected but could not be saved.",
					cause: error,
				});
			}

			try {
				await applyDockerCleanupSchedule(
					createdServer.serverId,
					ctx.session.activeOrganizationId,
					serverInput.enableDockerCleanup,
				);
			} catch (error) {
				console.error("Failed to schedule docker cleanup:", error);
			}
			await audit(ctx, {
				action: "create",
				resourceType: "server",
				resourceId: createdServer.serverId,
				resourceName: createdServer.name,
			});
			return { ...createdServer, hostKeyFingerprint };
		}),

	one: withPermission("server", "read")
		.input(apiFindOneServer)
		.query(async ({ input, ctx }) => {
			const server = await findServerById(input.serverId);
			if (server.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this server",
				});
			}

			const accessibleIds = await getAccessibleServerIds(ctx.session);
			if (!accessibleIds.has(input.serverId)) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this server",
				});
			}

			return redactServerSshKey(server);
		}),
	getDefaultCommand: withPermission("server", "read")
		.input(apiFindOneServer)
		.query(async ({ input }) => {
			const server = await findServerById(input.serverId);
			const isBuildServer = server.serverType === "build";
			return defaultCommand(isBuildServer);
		}),
	getServices: withPermission("server", "read")
		.input(apiFindOneServer)
		.query(async ({ input, ctx }) => {
			const currentServer = await findServerById(input.serverId);
			if (currentServer.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this server",
				});
			}

			const accessibleIds = await getAccessibleServerIds(ctx.session);
			if (!accessibleIds.has(input.serverId)) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this server",
				});
			}

			const services = await getServicesByServerId(input.serverId);

			const isPrivileged =
				ctx.user.role === "owner" || ctx.user.role === "admin";
			if (isPrivileged) {
				return services;
			}

			const { accessedServices } = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			return services.filter((service) =>
				accessedServices.includes(service.id),
			);
		}),
	all: withPermission("server", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleServerIds(ctx.session);

		const result = await db
			.select({
				...getTableColumns(server),
				totalSum: sql<number>`cast(
					count(distinct ${applications.applicationId}) +
					count(distinct ${compose.composeId}) +
					count(distinct ${redis.redisId}) +
					count(distinct ${mariadb.mariadbId}) +
					count(distinct ${mongo.mongoId}) +
					count(distinct ${mysql.mysqlId}) +
					count(distinct ${postgres.postgresId})
					as integer
				)`,
			})
			.from(server)
			.leftJoin(applications, eq(applications.serverId, server.serverId))
			.leftJoin(compose, eq(compose.serverId, server.serverId))
			.leftJoin(redis, eq(redis.serverId, server.serverId))
			.leftJoin(mariadb, eq(mariadb.serverId, server.serverId))
			.leftJoin(mongo, eq(mongo.serverId, server.serverId))
			.leftJoin(mysql, eq(mysql.serverId, server.serverId))
			.leftJoin(postgres, eq(postgres.serverId, server.serverId))
			.where(eq(server.organizationId, ctx.session.activeOrganizationId))
			.orderBy(desc(server.createdAt))
			.groupBy(server.serverId);

		return result.filter((s) => accessibleIds.has(s.serverId));
	}),
	allForPermissions: withPermission("member", "update").query(
		async ({ ctx }) => {
			return await db.query.server.findMany({
				columns: {
					serverId: true,
					name: true,
					ipAddress: true,
					serverType: true,
				},
				orderBy: desc(server.createdAt),
				where: eq(server.organizationId, ctx.session.activeOrganizationId),
			});
		},
	),
	count: protectedProcedure.query(async ({ ctx }) => {
		const organizations = await db.query.organization.findMany({
			where: eq(organization.ownerId, ctx.user.id),
			with: {
				servers: true,
			},
		});

		const servers = organizations.flatMap((org) => org.servers);

		return servers.length ?? 0;
	}),
	withSSHKey: withPermission("server", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleServerIds(ctx.session);

		const result = await db.query.server.findMany({
			orderBy: desc(server.createdAt),
			where: IS_CLOUD
				? and(
						isNotNull(server.sshKeyId),
						eq(server.organizationId, ctx.session.activeOrganizationId),
						eq(server.serverStatus, "active"),
						eq(server.serverType, "deploy"),
					)
				: and(
						isNotNull(server.sshKeyId),
						eq(server.organizationId, ctx.session.activeOrganizationId),
						eq(server.serverType, "deploy"),
					),
		});
		return result.filter((s) => accessibleIds.has(s.serverId));
	}),
	buildServers: withPermission("server", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleServerIds(ctx.session);

		const result = await db.query.server.findMany({
			orderBy: desc(server.createdAt),
			where: IS_CLOUD
				? and(
						isNotNull(server.sshKeyId),
						eq(server.organizationId, ctx.session.activeOrganizationId),
						eq(server.serverStatus, "active"),
						eq(server.serverType, "build"),
					)
				: and(
						isNotNull(server.sshKeyId),
						eq(server.organizationId, ctx.session.activeOrganizationId),
						eq(server.serverType, "build"),
					),
		});
		return result.filter((s) => accessibleIds.has(s.serverId));
	}),
	getMonitoringWorkspaces: withPermission("monitoring", "read").query(
		async ({ ctx }) => {
			const accessibleIds = await getAccessibleServerIds(ctx.session);
			const servers = await db.query.server.findMany({
				columns: {
					serverId: true,
					name: true,
				},
				where: eq(server.organizationId, ctx.session.activeOrganizationId),
				orderBy: desc(server.createdAt),
			});

			return servers.filter((item) => accessibleIds.has(item.serverId));
		},
	),
	getWorkspaceMetrics: withPermission("monitoring", "read")
		.input(
			z.object({
				workspace: z.discriminatedUnion("type", [
					z.object({ type: z.literal("global") }),
					z.object({
						type: z.literal("server"),
						serverId: z.string().min(1),
					}),
				]),
				dataPoints: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const accessibleIds = await getAccessibleServerIds(ctx.session);
			const servers = await db.query.server.findMany({
				columns: {
					serverId: true,
					name: true,
					ipAddress: true,
					metricsConfig: true,
				},
				where: eq(server.organizationId, ctx.session.activeOrganizationId),
			});
			const accessibleServers = servers.filter((item) =>
				accessibleIds.has(item.serverId),
			);
			const workspace = input.workspace;
			const selectedServers =
				workspace.type === "global"
					? accessibleServers
					: accessibleServers.filter(
							(item) => item.serverId === workspace.serverId,
						);

			if (workspace.type === "server" && selectedServers.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "The selected monitoring server is unavailable.",
				});
			}

			const metricTargets = selectedServers.map((item) => ({
				serverId: item.serverId,
				name: item.name,
				ipAddress: item.ipAddress,
				metricsConfig: item.metricsConfig,
			}));

			if (workspace.type === "global") {
				const webServerSettings = await getWebServerSettings();
				if (webServerSettings) {
					metricTargets.unshift({
						serverId: "notploy-instance",
						name: "Notploy instance",
						ipAddress: webServerSettings.serverIp ?? "",
						metricsConfig: webServerSettings.metricsConfig,
					});
				}
			}

			return Promise.all(
				metricTargets.map(async (item) => {
					const port = item.metricsConfig?.server?.port;
					const token = item.metricsConfig?.server?.token;
					if (!port || !token) {
						return {
							serverId: item.serverId,
							name: item.name,
							data: null,
							error: "Monitoring is not configured for this server.",
						};
					}
					if (!item.ipAddress) {
						return {
							serverId: item.serverId,
							name: item.name,
							data: null,
							error: "No metrics IP address is configured for this server.",
						};
					}

					const hostname =
						item.ipAddress.includes(":") && !item.ipAddress.startsWith("[")
							? `[${item.ipAddress}]`
							: item.ipAddress;
					const url = `http://${hostname}:${port}/metrics`;

					try {
						const data = await fetchServerMetrics({
							url,
							token,
							dataPoints: input.dataPoints,
						});
						return {
							serverId: item.serverId,
							name: item.name,
							data,
							error: null,
						};
					} catch (error) {
						return {
							serverId: item.serverId,
							name: item.name,
							data: null,
							error:
								error instanceof Error
									? error.message
									: "Failed to fetch monitoring data.",
						};
					}
				}),
			);
		}),
	setup: withPermission("server", "create")
		.input(apiFindOneServer)
		.mutation(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to setup this server",
					});
				}
				const currentServer = await serverSetup(input.serverId);
				await audit(ctx, {
					action: "update",
					resourceType: "server",
					resourceId: input.serverId,
					resourceName: server.name,
				});
				return currentServer;
			} catch (error) {
				throw error;
			}
		}),
	setupWithLogs: withPermission("server", "create")
		.meta({
			openapi: {
				path: "/deploy/server-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiFindOneServer)
		.subscription(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to setup this server",
					});
				}
				return observable<string>((emit) => {
					serverSetup(input.serverId, (log) => {
						emit.next(log);
					});
				});
			} catch (error) {
				throw error;
			}
		}),
	validate: withPermission("server", "read")
		.input(apiFindOneServer)
		.query(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to validate this server",
					});
				}
				const response = await serverValidate(input.serverId);
				return response as unknown as {
					docker: {
						enabled: boolean;
						version: string;
					};
					rclone: {
						enabled: boolean;
						version: string;
					};
					nixpacks: {
						enabled: boolean;
						version: string;
					};
					buildpacks: {
						enabled: boolean;
						version: string;
					};
					railpack: {
						enabled: boolean;
						version: string;
					};
					isNotployNetworkInstalled: boolean;
					isSwarmInstalled: boolean;
					isMainDirectoryInstalled: boolean;
					privilegeMode: string;
					dockerGroupMember: boolean;
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
					cause: error as Error,
				});
			}
		}),

	security: withPermission("server", "read")
		.input(apiFindOneServer)
		.query(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to validate this server",
					});
				}
				const response = await serverAudit(input.serverId);
				return response as unknown as {
					ufw: {
						installed: boolean;
						active: boolean;
						defaultIncoming: string;
					};
					ssh: {
						enabled: boolean;
						keyAuth: boolean;
						permitRootLogin: string;
						passwordAuth: string;
						usePam: string;
					};
					nonRootUser: {
						hasValidSudoUser: boolean;
					};
					unattendedUpgrades: {
						installed: boolean;
						active: boolean;
						updateEnabled: number;
						upgradeEnabled: number;
					};
					fail2ban: {
						installed: boolean;
						enabled: boolean;
						active: boolean;
						sshEnabled: string;
						sshMode: string;
					};
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
					cause: error as Error,
				});
			}
		}),
	setupMonitoring: withPermission("server", "create")
		.input(apiUpdateServerMonitoring)
		.mutation(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to setup this server",
					});
				}

				await updateServerById(input.serverId, {
					metricsConfig: {
						server: {
							type: "Remote",
							refreshRate: input.metricsConfig.server.refreshRate,
							retentionDays: input.metricsConfig.server.retentionDays,
							port: input.metricsConfig.server.port,
							token: input.metricsConfig.server.token,
							urlCallback: input.metricsConfig.server.urlCallback,
							cronJob: input.metricsConfig.server.cronJob,
							thresholds: {
								cpu: input.metricsConfig.server.thresholds.cpu,
								memory: input.metricsConfig.server.thresholds.memory,
							},
						},
						containers: {
							refreshRate: input.metricsConfig.containers.refreshRate,
							services: {
								include: input.metricsConfig.containers.services.include || [],
								exclude: input.metricsConfig.containers.services.exclude || [],
							},
						},
					},
				});
				const currentServer = await setupMonitoring(input.serverId);
				await audit(ctx, {
					action: "update",
					resourceType: "server",
					resourceId: input.serverId,
					resourceName: server.name,
				});
				return currentServer;
			} catch (error) {
				throw error;
			}
		}),
	remove: withPermission("server", "delete")
		.input(apiRemoveServer)
		.mutation(async ({ input, ctx }) => {
			try {
				const currentServer = await findServerById(input.serverId);
				if (currentServer.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to delete this server",
					});
				}

				const activeServers = await haveActiveServices(input.serverId);

				if (activeServers) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Server has active services, please delete them first",
					});
				}
				await audit(ctx, {
					action: "delete",
					resourceType: "server",
					resourceId: currentServer.serverId,
					resourceName: currentServer.name,
				});
				await removeDeploymentsByServerId(currentServer);
				await deleteServer(input.serverId);

				if (IS_CLOUD) {
					const admin = await findUserById(ctx.user.ownerId);

					await updateServersBasedOnQuantity(admin.id, admin.serversQuantity);
				}

				return redactServerSshKey(currentServer);
			} catch (error) {
				throw error;
			}
		}),
	update: withPermission("server", "create")
		.input(apiUpdateServer)
		.mutation(async ({ input, ctx }) => {
			try {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to update this server",
					});
				}

				if (server.serverStatus === "inactive") {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Server is inactive",
					});
				}
				const currentServer = await updateServerById(input.serverId, {
					...input,
				});

				await applyDockerCleanupSchedule(
					input.serverId,
					ctx.session.activeOrganizationId,
					input.enableDockerCleanup,
				);

				await audit(ctx, {
					action: "update",
					resourceType: "server",
					resourceId: input.serverId,
					resourceName: server.name,
				});
				return currentServer;
			} catch (error) {
				throw error;
			}
		}),
	updateBuildsConcurrency: withPermission("server", "create")
		.input(apiUpdateServerBuildsConcurrency)
		.mutation(async ({ input, ctx }) => {
			const currentServer = await findServerById(input.serverId);
			if (currentServer.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to update this server",
				});
			}
			return await updateServerById(input.serverId, {
				buildsConcurrency: input.buildsConcurrency,
			});
		}),
	publicIp: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return "";
		}
		const ip = await getPublicIpWithFallback();
		return ip;
	}),
	getServerTime: protectedProcedure.query(() => {
		return {
			time: new Date(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};
	}),
	getServerMetrics: withPermission("monitoring", "read")
		.input(
			z.object({
				url: z.string(),
				token: z.string(),
				dataPoints: z.string(),
			}),
		)
		.query(async ({ input }) => {
			try {
				return await fetchServerMetrics(input);
			} catch (error) {
				throw error;
			}
		}),
});
