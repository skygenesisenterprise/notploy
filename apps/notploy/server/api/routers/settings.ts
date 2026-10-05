import {
	CLEANUP_CRON_JOB,
	checkGPUStatus,
	checkPortInUse,
	checkPostgresHealth,
	checkTraefikHealth,
	cleanupAll,
	cleanupAllBackground,
	cleanupBuilders,
	cleanupContainers,
	cleanupImages,
	cleanupSystem,
	cleanupVolumes,
	DEFAULT_UPDATE_DATA,
	findServerById,
	getDockerDiskUsage,
	getNotployImageTag,
	getLogCleanupStatus,
	getUpdateData,
	getUpdateStatus,
	getWebServerSettings,
	isUpdateInstallable,
	getAccessibleServerIds,
	getRemoteDocker,
	IS_CLOUD,
	NOTPLOY_IMAGE,
	normalizeVersion,
	parseRawConfig,
	paths,
	prepareEnvironmentVariables,
	processLogs,
	readConfig,
	readConfigInPath,
	readDirectory,
	readEnvironmentVariables,
	readMainConfig,
	readMonitoringConfig,
	readPorts,
	recreateDirectory,
	reloadDockerResource,
	sendDockerCleanupNotifications,
	setupGPUSupport,
	spawnAsync,
	startLogCleanup,
	stopLogCleanup,
	updateLetsEncryptEmail,
	updateServerById,
	updateServerTraefik,
	updateWebServerSettings,
	writeConfig,
	writeMainConfig,
	writeTraefikConfigInPath,
	writeTraefikSetup,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { checkPermission } from "@notploy/server/services/permission";
import { generateOpenApiDocument } from "@notploy/trpc-openapi";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import {
	apiAssignDomain,
	apiEnableDashboard,
	apiModifyTraefikConfig,
	apiReadStatsLogs,
	apiReadTraefikConfig,
	apiSaveSSHKey,
	apiServerSchema,
	apiTraefikConfig,
	apiUpdateDockerCleanup,
	apiUpdateWebServerBuildsConcurrency,
	projects,
	server,
} from "@/server/db/schema";
import { cleanAllDeploymentQueue } from "@/server/queues/queueSetup";
import { removeJob, schedule } from "@/server/utils/backup";
import packageInfo from "../../../package.json";
import { appRouter } from "../root";
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "../trpc";

export const settingsRouter = createTRPCRouter({
	getWebServerSettings: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}
		const settings = await getWebServerSettings();
		return settings;
	}),
	getControlPlaneRuntime: adminProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}
		const settings = await db.query.webServerSettings.findFirst({
			orderBy: (webServerSettings, { asc }) => [
				asc(webServerSettings.createdAt),
			],
			columns: {
				serverIp: true,
				host: true,
				https: true,
				certificateType: true,
				letsEncryptEmail: true,
			},
		});

		return {
			bindAddress: process.env.HOST || "0.0.0.0",
			httpPort: Number.parseInt(process.env.PORT || "3000", 10),
			uptimeSeconds: Math.floor(process.uptime()),
			version: packageInfo.version,
			serverIp: settings?.serverIp ?? null,
			host: settings?.host ?? null,
			https: settings?.https ?? false,
			certificateType: settings?.certificateType ?? "none",
			letsEncryptEmail: settings?.letsEncryptEmail ?? null,
		};
	}),
	reloadServer: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			return true;
		}
		await reloadDockerResource("notploy", undefined, packageInfo.version);
		await audit(ctx, {
			action: "reload",
			resourceType: "settings",
			resourceName: "notploy",
		});
		return true;
	}),
	cleanAllDeploymentQueue: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			return true;
		}
		const result = cleanAllDeploymentQueue();
		await audit(ctx, {
			action: "update",
			resourceType: "settings",
			resourceName: "clean-deployment-queue",
		});
		return result;
	}),
	reloadTraefik: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			// Run in background so the request returns immediately; avoids proxy timeouts.
			void reloadDockerResource("notploy-traefik", input?.serverId).catch(
				(err) => {
					console.error("reloadTraefik background:", err);
				},
			);
			await audit(ctx, {
				action: "reload",
				resourceType: "settings",
				resourceName: "notploy-traefik",
			});
			return true;
		}),
	toggleDashboard: adminProcedure
		.input(apiEnableDashboard)
		.mutation(async ({ input, ctx }) => {
			const ports = await readPorts("notploy-traefik", input.serverId);
			const env = await readEnvironmentVariables(
				"notploy-traefik",
				input.serverId,
			);
			const preparedEnv = prepareEnvironmentVariables(env);
			let newPorts = ports;
			// If receive true, add 8080 to ports
			if (input.enableDashboard) {
				// Check if port 8080 is already in use before enabling dashboard
				const portCheck = await checkPortInUse(8080, input.serverId);
				if (portCheck.isInUse) {
					const conflictInfo = portCheck.conflictingContainer
						? ` by ${portCheck.conflictingContainer}`
						: "";
					throw new TRPCError({
						code: "CONFLICT",
						message: `Port 8080 is already in use${conflictInfo}. Please stop the conflicting service or use a different port for the Traefik dashboard.`,
					});
				}
				newPorts.push({
					targetPort: 8080,
					publishedPort: 8080,
					protocol: "tcp",
				});
			} else {
				newPorts = ports.filter((port) => port.targetPort !== 8080);
			}

			// Run in background so the request returns immediately; client polls /api/health.
			// Avoids proxy timeouts (520) while Traefik is recreated.
			void writeTraefikSetup({
				env: preparedEnv,
				additionalPorts: newPorts,
				serverId: input.serverId,
			}).catch((err) => {
				console.error("toggleDashboard background writeTraefikSetup:", err);
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "toggle-dashboard",
			});
			return true;
		}),
	cleanUnusedImages: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupImages(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-unused-images",
			});
			return true;
		}),
	cleanUnusedVolumes: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupVolumes(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-unused-volumes",
			});
			return true;
		}),
	cleanStoppedContainers: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupContainers(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-stopped-containers",
			});
			return true;
		}),
	cleanDockerBuilder: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupBuilders(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-docker-builder",
			});
		}),
	cleanDockerPrune: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupSystem(input?.serverId);
			await cleanupBuilders(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-docker-prune",
			});
			return true;
		}),
	cleanAll: adminProcedure
		.input(apiServerSchema)
		.mutation(async ({ input, ctx }) => {
			// Execute cleanup in background and return immediately to avoid gateway timeouts
			const result = await cleanupAllBackground(input?.serverId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-all",
			});
			return result;
		}),
	cleanMonitoring: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			return true;
		}
		const { MONITORING_PATH } = paths();
		await recreateDirectory(MONITORING_PATH);
		await audit(ctx, {
			action: "delete",
			resourceType: "settings",
			resourceName: "clean-monitoring",
		});
		return true;
	}),
	getDockerDiskUsage: adminProcedure.query(async () => {
		if (IS_CLOUD) {
			return [];
		}
		return getDockerDiskUsage();
	}),
	saveSSHPrivateKey: adminProcedure
		.input(apiSaveSSHKey)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			await updateWebServerSettings({
				sshPrivateKey: input.sshPrivateKey,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "ssh-private-key",
			});
			return true;
		}),
	assignDomainServer: adminProcedure
		.input(apiAssignDomain)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			const settings = await updateWebServerSettings({
				host: input.host,
				letsEncryptEmail: input.letsEncryptEmail,
				certificateType: input.certificateType,
				https: input.https,
			});

			if (!settings) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Web server settings not found",
				});
			}

			updateServerTraefik(settings, input.host);
			if (input.letsEncryptEmail) {
				updateLetsEncryptEmail(input.letsEncryptEmail);
			}

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "assign-domain-server",
			});
			return {
				host: settings.host,
				https: settings.https,
				certificateType: settings.certificateType,
			};
		}),
	cleanSSHPrivateKey: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			return true;
		}
		await updateWebServerSettings({
			sshPrivateKey: null,
		});
		await audit(ctx, {
			action: "delete",
			resourceType: "settings",
			resourceName: "ssh-private-key",
		});
		return true;
	}),
	updateDockerCleanup: adminProcedure
		.input(apiUpdateDockerCleanup)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				await updateServerById(input.serverId, {
					enableDockerCleanup: input.enableDockerCleanup,
				});

				const server = await findServerById(input.serverId);

				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}

				if (server.enableDockerCleanup) {
					const server = await findServerById(input.serverId);
					if (server.serverStatus === "inactive") {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Server is inactive",
						});
					}
					if (IS_CLOUD) {
						await schedule({
							cronSchedule: CLEANUP_CRON_JOB,
							serverId: input.serverId,
							type: "server",
						});
					} else {
						scheduleJob(server.serverId, CLEANUP_CRON_JOB, async () => {
							console.log(
								`Docker Cleanup ${new Date().toLocaleString()}] Running...`,
							);

							await cleanupAll(server.serverId);

							await sendDockerCleanupNotifications(server.organizationId);
						});
					}
				} else {
					if (IS_CLOUD) {
						await removeJob({
							cronSchedule: CLEANUP_CRON_JOB,
							serverId: input.serverId,
							type: "server",
						});
					} else {
						const currentJob = scheduledJobs[server.serverId];
						currentJob?.cancel();
					}
				}
			} else if (!IS_CLOUD) {
				const settingsUpdated = await updateWebServerSettings({
					enableDockerCleanup: input.enableDockerCleanup,
				});

				if (settingsUpdated?.enableDockerCleanup) {
					scheduleJob("docker-cleanup", CLEANUP_CRON_JOB, async () => {
						console.log(
							`Docker Cleanup ${new Date().toLocaleString()}] Running...`,
						);

						await cleanupAll();

						await sendDockerCleanupNotifications(
							ctx.session.activeOrganizationId,
						);
					});
				} else {
					const currentJob = scheduledJobs["docker-cleanup"];
					currentJob?.cancel();
				}
			}

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "docker-cleanup",
			});
			return true;
		}),

	updateRemoteServersOnly: adminProcedure
		.input(z.object({ remoteServersOnly: z.boolean() }))
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This feature is only available for self-hosted instances",
				});
			}

			await updateWebServerSettings({
				remoteServersOnly: input.remoteServersOnly,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "remote-servers-only",
			});
			return true;
		}),

	updateBuildsConcurrency: adminProcedure
		.input(apiUpdateWebServerBuildsConcurrency)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This feature is only available for self-hosted instances",
				});
			}

			await updateWebServerSettings({
				buildsConcurrency: input.buildsConcurrency,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "builds-concurrency",
			});
			return true;
		}),

	updateEnforceSSO: adminProcedure
		.input(z.object({ enforceSSO: z.boolean() }))
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This feature is only available for self-hosted instances",
				});
			}

			await updateWebServerSettings({
				enforceSSO: input.enforceSSO,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "enforce-sso",
			});
			return true;
		}),

	readTraefikConfig: adminProcedure.query(() => {
		if (IS_CLOUD) {
			return true;
		}
		const traefikConfig = readMainConfig();
		return traefikConfig;
	}),

	updateTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			writeMainConfig(input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-config",
			});
			return true;
		}),

	readWebServerTraefikConfig: adminProcedure.query(() => {
		if (IS_CLOUD) {
			return true;
		}
		const traefikConfig = readConfig("notploy");
		return traefikConfig;
	}),
	updateWebServerTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			writeConfig("notploy", input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "web-server-traefik-config",
			});
			return true;
		}),

	readMiddlewareTraefikConfig: adminProcedure.query(() => {
		if (IS_CLOUD) {
			return true;
		}
		const traefikConfig = readConfig("middlewares");
		return traefikConfig;
	}),

	updateMiddlewareTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			writeConfig("middlewares", input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "middleware-traefik-config",
			});
			return true;
		}),
	/**
	 * Backward-compatible shape kept for the existing SDK, CLI and desktop
	 * clients. Prefer `getUpdateStatus` in the UI.
	 */
	getUpdateData: protectedProcedure.mutation(async () => {
		if (IS_CLOUD) {
			return DEFAULT_UPDATE_DATA;
		}

		return await getUpdateData(packageInfo.version);
	}),
	/**
	 * Full update status: running/latest version, release metadata and whether
	 * the release is actually installable (its assets are published).
	 */
	getUpdateStatus: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}

		return await getUpdateStatus(packageInfo.version);
	}),
	updateServer: adminProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			return true;
		}

		const data = await getUpdateStatus(packageInfo.version);
		// A release whose assets are still being published is not an update: it
		// must not be installed, and it is not an error either.
		if (!isUpdateInstallable(data) || !data.latestVersion) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "No installable update is available right now.",
			});
		}

		void spawnAsync("docker", [
			"service",
			"update",
			"--force",
			"--image",
			`${NOTPLOY_IMAGE}:${data.latestVersion}`,
			"notploy",
		]);
		await audit(ctx, {
			action: "update",
			resourceType: "settings",
			resourceName: "notploy-version",
		});

		return true;
	}),

	getNotployVersion: protectedProcedure.query(() => {
		// The UI shows a clean version (`1.0.1`), not the raw package/tag value.
		return normalizeVersion(packageInfo.version) ?? packageInfo.version;
	}),
	getReleaseTag: protectedProcedure.query(() => {
		return getNotployImageTag();
	}),
	readDirectories: protectedProcedure
		.input(apiServerSchema)
		.query(async ({ ctx, input }) => {
			try {
				await checkPermission(ctx, { traefikFiles: ["read"] });
				const { MAIN_TRAEFIK_PATH } = paths(!!input?.serverId);
				const result = await readDirectory(MAIN_TRAEFIK_PATH, input?.serverId);
				return result || [];
			} catch (error) {
				throw error;
			}
		}),
	getTraefikOverview: protectedProcedure
		.input(apiServerSchema)
		.query(async ({ ctx, input }) => {
			await checkPermission(ctx, { traefikFiles: ["read"] });
			const serverId = input?.serverId;

			if (serverId) {
				const accessibleServerIds = await getAccessibleServerIds({
					userId: ctx.session.userId,
					activeOrganizationId: ctx.session.activeOrganizationId,
				});
				if (!accessibleServerIds.has(serverId)) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			const { MAIN_TRAEFIK_PATH, DYNAMIC_TRAEFIK_PATH } = paths(!!serverId);
			const mainConfig = await readConfigInPath(
				`${MAIN_TRAEFIK_PATH}/traefik.yml`,
				serverId,
			);
			let staticConfig: Record<string, unknown> = {};
			let configParseErrors = 0;
			if (mainConfig) {
				try {
					staticConfig = (parse(mainConfig) as Record<string, unknown>) ?? {};
				} catch {
					configParseErrors++;
				}
			}
			const rawEntryPoints = staticConfig.entryPoints;
			const entryPoints =
				rawEntryPoints && typeof rawEntryPoints === "object"
					? Object.entries(rawEntryPoints).map(([name, value]) => {
							const address =
								value && typeof value === "object"
									? (value as Record<string, unknown>).address
									: undefined;
							return {
								name,
								address: typeof address === "string" ? address : null,
							};
						})
					: [];

			const flattenFiles = (
				nodes: Awaited<ReturnType<typeof readDirectory>>,
			): string[] =>
				nodes.flatMap((node) => {
					if (node.type === "directory") {
						return flattenFiles(node.children ?? []);
					}
					return /\.(yaml|yml)$/i.test(node.name) ? [node.id] : [];
				});
			const dynamicRoot = await readDirectory(DYNAMIC_TRAEFIK_PATH, serverId);
			const allConfigFiles = flattenFiles(dynamicRoot);
			const configFiles = allConfigFiles.slice(0, 200);
			const configs = await Promise.all(
				configFiles.map(async (file) => {
					const content = await readConfigInPath(file, serverId);
					if (!content) return null;
					try {
						const parsed = parse(content);
						return parsed && typeof parsed === "object"
							? (parsed as Record<string, unknown>)
							: null;
					} catch {
						configParseErrors++;
						return null;
					}
				}),
			);

			const routers: Array<{
				name: string;
				rule: string | null;
				entryPoints: string[];
				service: string | null;
				middlewares: string[];
				tls: boolean;
				provider: string;
			}> = [];
			const services: Array<{
				name: string;
				provider: string;
				type: string;
				serverCount: number | null;
			}> = [];
			const middlewares: Array<{ name: string; type: string }> = [];
			const objectEntries = (value: unknown) =>
				value && typeof value === "object" && !Array.isArray(value)
					? Object.entries(value as Record<string, unknown>)
					: [];

			for (const config of configs) {
				if (!config) continue;
				const http =
					config.http && typeof config.http === "object"
						? (config.http as Record<string, unknown>)
						: {};
				for (const [name, rawRouter] of objectEntries(http.routers)) {
					if (!rawRouter || typeof rawRouter !== "object") continue;
					const router = rawRouter as Record<string, unknown>;
					routers.push({
						name,
						rule: typeof router.rule === "string" ? router.rule : null,
						entryPoints: Array.isArray(router.entryPoints)
							? router.entryPoints.filter(
									(value): value is string => typeof value === "string",
								)
							: [],
						service: typeof router.service === "string" ? router.service : null,
						middlewares: Array.isArray(router.middlewares)
							? router.middlewares.filter(
									(value): value is string => typeof value === "string",
								)
							: [],
						tls: Boolean(router.tls),
						provider: "file",
					});
				}
				for (const [name, rawService] of objectEntries(http.services)) {
					if (!rawService || typeof rawService !== "object") continue;
					const service = rawService as Record<string, unknown>;
					const type = Object.keys(service)[0] ?? "unknown";
					const loadBalancer = service.loadBalancer;
					const servers =
						loadBalancer && typeof loadBalancer === "object"
							? (loadBalancer as Record<string, unknown>).servers
							: undefined;
					services.push({
						name,
						provider: "file",
						type,
						serverCount: Array.isArray(servers) ? servers.length : null,
					});
				}
				for (const [name, rawMiddleware] of objectEntries(http.middlewares)) {
					if (!rawMiddleware || typeof rawMiddleware !== "object") continue;
					middlewares.push({
						name,
						type: Object.keys(rawMiddleware as Record<string, unknown>)[0] ?? "unknown",
					});
				}
			}

			let status: "running" | "unavailable" = "unavailable";
			let version: string | null = null;
			try {
				const docker = await getRemoteDocker(serverId);
				const containers = await docker.listContainers({ all: true });
				for (const container of containers) {
					const labels = container.Labels ?? {};
					const routerNames = new Set<string>();
					for (const key of Object.keys(labels)) {
						const match = key.match(
							/^traefik\.http\.routers\.([^.]+)\.(?:rule|entrypoints|service|middlewares|tls(?:\..*)?)$/i,
						);
						if (match) routerNames.add(match[1]);
					}
					for (const name of routerNames) {
						const prefix = `traefik.http.routers.${name}.`;
						const label = (key: string) => labels[`${prefix}${key}`];
						routers.push({
							name,
							rule: label("rule") ?? null,
							entryPoints: (label("entrypoints") ?? "")
								.split(",")
								.map((value) => value.trim())
								.filter(Boolean),
							service: label("service") ?? null,
							middlewares: (label("middlewares") ?? "")
								.split(",")
								.map((value) => value.trim())
								.filter(Boolean),
							tls: label("tls") === "true" || Object.keys(labels).some(
								(key) => key.startsWith(`${prefix}tls.`),
							),
							provider: "docker",
						});
					}
				}
				try {
					const container = await docker
						.getContainer("notploy-traefik")
						.inspect();
					if (container.State?.Running) {
						status = "running";
						version = container.Config?.Image ?? null;
					}
				} catch {
					const service = await docker
						.getService("notploy-traefik")
						.inspect();
					const replicas = service.Spec?.Mode?.Replicated?.Replicas;
					const tasks = await docker.listTasks({
						filters: { service: [service.ID], desiredState: ["running"] },
					});
					if (tasks.length > 0) {
						status = "running";
						version = service.Spec?.TaskTemplate?.ContainerSpec?.Image ?? null;
					}
					if (replicas === 0) status = "unavailable";
				}
			} catch {
				status = "unavailable";
			}

			return {
				status,
				version,
				entryPoints,
				routers,
				services,
				middlewares,
				configFileCount: configFiles.length,
				configFileLimitReached: allConfigFiles.length > 200,
				configParseErrors,
			};
		}),

	updateTraefikFile: protectedProcedure
		.input(apiModifyTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			await checkPermission(ctx, { traefikFiles: ["write"] });

			if (input.serverId) {
				const server = await findServerById(input.serverId);

				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			// writeTraefikConfigInPath rejects any path outside the Traefik
			// dynamic directory; surface that as a validation error.
			try {
				await writeTraefikConfigInPath(
					input.path,
					input.traefikConfig,
					input?.serverId,
				);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: (error as Error).message,
				});
			}
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-file",
			});
			return true;
		}),

	readTraefikFile: protectedProcedure
		.input(apiReadTraefikConfig)
		.query(async ({ input, ctx }) => {
			await checkPermission(ctx, { traefikFiles: ["read"] });

			if (input.serverId) {
				const server = await findServerById(input.serverId);

				if (server.organizationId !== ctx.session?.activeOrganizationId) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			try {
				return await readConfigInPath(input.path, input.serverId);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: (error as Error).message,
				});
			}
		}),
	getIp: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return "";
		}
		const settings = await getWebServerSettings();
		return settings?.serverIp || "";
	}),
	updateServerIp: adminProcedure
		.input(
			z.object({
				serverIp: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			const settings = await updateWebServerSettings({
				serverIp: input.serverIp,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "server-ip",
			});
			return settings;
		}),

	getOpenApiDocument: protectedProcedure.query(
		async ({ ctx }): Promise<unknown> => {
			const protocol = ctx.req.headers["x-forwarded-proto"];
			const url = `${protocol}://${ctx.req.headers.host}/api`;
			const openApiDocument = generateOpenApiDocument(appRouter, {
				title: "tRPC OpenAPI",
				version: packageInfo.version,
				baseUrl: url,
				docsUrl: `${url}/settings.getOpenApiDocument`,
				tags: [
					"admin",
					"docker",
					"compose",
					"registry",
					"cluster",
					"user",
					"domain",
					"destination",
					"backup",
					"deployment",
					"mounts",
					"certificates",
					"settings",
					"security",
					"redirects",
					"port",
					"project",
					"application",
					"mysql",
					"postgres",
					"redis",
					"mongo",
					"libsql",
					"mariadb",
					"sshRouter",
					"gitProvider",
					"bitbucket",
					"ai",
					"github",
					"gitlab",
					"gitea",
					"tag",
					"patch",
					"server",
					"volumeBackups",
					"environment",
					"auditLog",
					"customRole",
					"whitelabeling",
					"sso",
					"organization",
					"previewDeployment",
				],
			});

			openApiDocument.info = {
				title: "Notploy API",
				description: "Endpoints for notploy",
				version: packageInfo.version,
			};

			// Add security schemes configuration
			openApiDocument.components = {
				...openApiDocument.components,
				securitySchemes: {
					apiKey: {
						type: "apiKey",
						in: "header",
						name: "x-api-key",
						description: "API key authentication",
					},
				},
			};

			// Apply security globally to all endpoints
			openApiDocument.security = [
				{
					apiKey: [],
				},
			];
			return openApiDocument;
		},
	),
	readTraefikEnv: adminProcedure
		.input(apiServerSchema)
		.query(async ({ input }) => {
			const envVars = await readEnvironmentVariables(
				"notploy-traefik",
				input?.serverId,
			);
			return envVars;
		}),

	writeTraefikEnv: adminProcedure
		.input(z.object({ env: z.string(), serverId: z.string().optional() }))
		.mutation(async ({ input, ctx }) => {
			const envs = prepareEnvironmentVariables(input.env);
			const ports = await readPorts("notploy-traefik", input?.serverId);

			// Run in background so the request returns immediately; client polls /api/health.
			void writeTraefikSetup({
				env: envs,
				additionalPorts: ports,
				serverId: input.serverId,
			}).catch((err) => {
				console.error("writeTraefikEnv background writeTraefikSetup:", err);
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-env",
			});
			return true;
		}),
	haveTraefikDashboardPortEnabled: adminProcedure
		.input(apiServerSchema)
		.query(async ({ input }) => {
			const ports = await readPorts("notploy-traefik", input?.serverId);
			return ports.some((port) => port.targetPort === 8080);
		}),

	readStatsLogs: protectedProcedure
		.meta({
			openapi: {
				path: "/read-stats-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiReadStatsLogs)
		.query(async ({ input }) => {
			if (IS_CLOUD) {
				return {
					data: [],
					totalCount: 0,
				};
			}
			const rawConfig = await readMonitoringConfig(
				!!input.dateRange?.start && !!input.dateRange?.end,
			);

			const parsedConfig = parseRawConfig(
				rawConfig as string,
				input.page,
				input.sort,
				input.search,
				input.status,
				input.dateRange,
			);

			return parsedConfig;
		}),
	readStats: adminProcedure
		.meta({
			openapi: {
				path: "/read-stats",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(
			z
				.object({
					dateRange: z
						.object({
							start: z.string().optional(),
							end: z.string().optional(),
						})
						.optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			if (IS_CLOUD) {
				return [];
			}
			const rawConfig = await readMonitoringConfig(
				!!input?.dateRange?.start || !!input?.dateRange?.end,
			);
			const processedLogs = processLogs(rawConfig as string, input?.dateRange);
			return processedLogs || [];
		}),
	haveActivateRequests: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return true;
		}
		const config = readMainConfig();

		if (!config) return false;
		const parsedConfig = parse(config) as {
			accessLog?: {
				filePath: string;
			};
		};

		return !!parsedConfig?.accessLog?.filePath;
	}),
	toggleRequests: protectedProcedure
		.input(
			z.object({
				enable: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			const mainConfig = readMainConfig();
			if (!mainConfig) return false;

			const currentConfig = parse(mainConfig) as {
				accessLog?: {
					filePath: string;
				};
			};

			if (input.enable) {
				const config = {
					accessLog: {
						filePath: "/etc/notploy/traefik/dynamic/access.log",
						format: "json",
						bufferingSize: 100,
					},
				};
				currentConfig.accessLog = config.accessLog;
			} else {
				currentConfig.accessLog = undefined;
			}

			writeMainConfig(stringify(currentConfig));
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "toggle-requests",
			});
			return true;
		}),
	isCloud: publicProcedure.query(async () => {
		return IS_CLOUD;
	}),
	isUserSubscribed: protectedProcedure.query(async ({ ctx }) => {
		const haveServers = await db.query.server.findMany({
			where: eq(server.organizationId, ctx.session?.activeOrganizationId || ""),
		});
		const haveProjects = await db.query.projects.findMany({
			where: eq(
				projects.organizationId,
				ctx.session?.activeOrganizationId || "",
			),
		});
		return haveServers.length > 0 || haveProjects.length > 0;
	}),
	health: publicProcedure.query(async () => {
		try {
			await db.execute(sql`SELECT 1`);
			return { status: "ok" };
		} catch (error) {
			console.error("Database connection error:", error);
			throw error;
		}
	}),
	checkInfrastructureHealth: adminProcedure.query(async () => {
		if (IS_CLOUD) {
			return {
				postgres: { status: "healthy" as const },
				traefik: { status: "healthy" as const },
			};
		}

		const [postgres, traefik] = await Promise.all([
			checkPostgresHealth(),
			checkTraefikHealth(),
		]);

		return { postgres, traefik };
	}),
	setupGPU: adminProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD && !input.serverId) {
				throw new Error("Select a server to enable the GPU Setup");
			}

			try {
				await setupGPUSupport(input.serverId);
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceName: "setup-gpu",
				});
				return { success: true };
			} catch (error) {
				console.error("GPU Setup Error:", error);
				throw error;
			}
		}),
	checkGPUStatus: adminProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			if (IS_CLOUD && !input.serverId) {
				return {
					driverInstalled: false,
					driverVersion: undefined,
					gpuModel: undefined,
					runtimeInstalled: false,
					runtimeConfigured: false,
					cudaSupport: undefined,
					cudaVersion: undefined,
					memoryInfo: undefined,
					availableGPUs: 0,
					swarmEnabled: false,
					gpuResources: 0,
				};
			}

			try {
				return await checkGPUStatus(input.serverId || "");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to check GPU status";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
	updateTraefikPorts: adminProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
				additionalPorts: z.array(
					z.object({
						targetPort: z.number(),
						publishedPort: z.number(),
						protocol: z.enum(["tcp", "udp", "sctp"]),
					}),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				if (IS_CLOUD && !input.serverId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Please set a serverId to update Traefik ports",
					});
				}
				const env = await readEnvironmentVariables(
					"notploy-traefik",
					input?.serverId,
				);

				for (const port of input.additionalPorts) {
					const portCheck = await checkPortInUse(
						port.publishedPort,
						input.serverId,
					);
					if (portCheck.isInUse) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `Port ${port.targetPort} is already in use by ${portCheck.conflictingContainer}`,
						});
					}
				}
				const preparedEnv = prepareEnvironmentVariables(env);

				// Run in background so the request returns immediately; client polls /api/health.
				void writeTraefikSetup({
					env: preparedEnv,
					additionalPorts: input.additionalPorts,
					serverId: input.serverId,
				}).catch((err) => {
					console.error(
						"updateTraefikPorts background writeTraefikSetup:",
						err,
					);
				});
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceName: "traefik-ports",
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error updating Traefik ports",
					cause: error,
				});
			}
		}),
	getTraefikPorts: adminProcedure
		.input(apiServerSchema)
		.query(async ({ input }) => {
			const ports = await readPorts("notploy-traefik", input?.serverId);
			return ports;
		}),
	updateLogCleanup: protectedProcedure
		.input(
			z.object({
				cronExpression: z.string().nullable(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				return true;
			}
			let result: boolean;
			if (input.cronExpression) {
				result = await startLogCleanup(input.cronExpression);
			} else {
				result = await stopLogCleanup();
			}
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "log-cleanup",
			});
			return result;
		}),

	getLogCleanupStatus: protectedProcedure.query(async () => {
		return getLogCleanupStatus();
	}),

	getNotployCloudIps: adminProcedure.query(async () => {
		if (!IS_CLOUD) {
			return [];
		}
		const ips = process.env.NOTPLOY_CLOUD_IPS?.split(",");
		return ips;
	}),
});
