/**
 * One client per Notploy connection.
 *
 * The SDK ships a process-wide `client` singleton; the desktop app never uses
 * it, because a single window is routinely connected to several instances at
 * once (Cloud, staging, a home lab). Every call goes through
 * {@link NotployClient.request}, which:
 *
 * - passes the connection-scoped SDK client explicitly,
 * - enforces a per-request timeout,
 * - converts every failure into a {@link NotployError},
 * - never lets a token reach a log line.
 *
 * This is the desktop's own client layer, built directly on `@notploy/sdk` (per
 * the agreed architecture: no shared client package). It is the only module
 * allowed to import generated SDK operations; everything above it deals in
 * `@/shared/domain` types.
 */

import {
	applicationCancelDeployment,
	applicationDeploy,
	applicationOne,
	applicationReadLogs,
	applicationRedeploy,
	applicationReload,
	applicationSearch,
	applicationStart,
	applicationStop,
	type Client,
	clusterGetNodes,
	composeSearch,
	createClient,
	deploymentAll,
	deploymentAllCentralized,
	deploymentKillProcess,
	deploymentQueueList,
	deploymentReadLogs,
	deploymentRemoveDeployment,
	dockerGetConfig,
	dockerGetContainers,
	dockerGetServerHealth,
	dockerImageGetImages,
	dockerKillContainer,
	dockerRemoveContainer,
	dockerRestartContainer,
	dockerStartContainer,
	dockerStopContainer,
	dockerVolumeGetVolumes,
	dockerVolumeGetVolumesSize,
	environmentByProjectId,
	networkAll,
	notificationAll,
	overviewServices,
	projectAll,
	serverAll,
	settingsGetDockerDiskUsage,
	settingsGetNotployVersion,
	settingsGetOpenApiDocument,
	settingsHealth,
	settingsIsCloud,
	swarmGetNodes,
	userSession,
} from "@notploy/sdk";
import type {
	ApplicationSummary,
	ComposeSummary,
	ContainerHealth,
	Deployment,
	DeploymentQueueEntry,
	DiskUsage,
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	EnvironmentSummary,
	NotployServer,
	OverviewService,
	ProjectSummary,
	SessionUser,
	SwarmNode,
} from "@/shared/domain";
import type { NotployNotification } from "@/shared/ipc";
import type { Logger } from "../logging";
import { toNotployError } from "./errors";
import { createTimeoutFetch } from "./fetch";

export interface NotployClientOptions {
	/** Instance origin, e.g. `https://notploy.example.com`. No trailing slash. */
	origin: string;
	/** API key. May be absent while the connection is not authenticated yet. */
	token?: string;
	/** Milliseconds before a request is aborted. */
	timeout: number;
	/** True when the user accepted a self-signed certificate for this instance. */
	allowInsecureTls?: boolean;
	connectionName?: string;
	/** Injected by the main process for the `allowInsecureTls` case. */
	fetchImpl?: typeof globalThis.fetch;
	logger: Logger;
}

export interface LogRequest {
	tail?: number;
	since?: string;
	search?: string;
}

export interface OpenApiDocument {
	info?: { title?: string; version?: string };
	paths?: Record<string, unknown>;
}

export interface ApplicationSearchQuery {
	q?: string;
	projectId?: string;
	environmentId?: string;
	limit?: number;
	offset?: number;
}

export class NotployClient {
	readonly origin: string;
	readonly apiBaseUrl: string;
	readonly connectionName?: string;
	readonly allowInsecureTls: boolean;
	private readonly client: Client;
	private readonly logger: Logger;
	private readonly timeout: number;
	private readonly token?: string;

	constructor(options: NotployClientOptions) {
		this.origin = options.origin.replace(/\/+$/, "");
		this.apiBaseUrl = `${this.origin}/api`;
		this.connectionName = options.connectionName;
		this.allowInsecureTls = options.allowInsecureTls ?? false;
		this.logger = options.logger;
		this.timeout = options.timeout;
		this.token = options.token;

		const baseFetch =
			options.fetchImpl ?? (globalThis.fetch as typeof globalThis.fetch);

		this.client = createClient({
			baseUrl: this.apiBaseUrl,
			responseStyle: "fields",
			headers: this.buildHeaders(options.token),
			fetch: createTimeoutFetch(baseFetch, this.timeout),
		});
	}

	/** True when a credential is available for this client. */
	get authenticated(): boolean {
		return Boolean(this.token);
	}

	private buildHeaders(token: string | undefined): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: "application/json",
		};
		if (token) {
			// The Notploy REST API authenticates with an API key header. See
			// `validateRequest` in @notploy/server.
			headers["x-api-key"] = token;
		}
		return headers;
	}

	/** Runs an SDK operation, normalising results and failures. */
	private async request<T>(
		operation: string,
		promise: Promise<{ data: unknown }>,
	): Promise<T> {
		const started = Date.now();
		try {
			const result = await promise;
			this.logger.debug(`${operation} ok in ${Date.now() - started}ms`);
			return result.data as T;
		} catch (error) {
			this.logger.error(`${operation} failed after ${Date.now() - started}ms`);
			throw toNotployError(error, {
				operation,
				connectionName: this.connectionName,
				baseUrl: this.origin,
			});
		}
	}

	// ---------------------------------------------------------------------
	// Connectivity and identity
	// ---------------------------------------------------------------------

	/** Public endpoint: proves the instance answers even without a credential. */
	async health(): Promise<{ status: string }> {
		return await this.request(
			"settings.health",
			settingsHealth({ client: this.client, throwOnError: true }),
		);
	}

	async version(): Promise<string | undefined> {
		const value = await this.request<unknown>(
			"settings.getNotployVersion",
			settingsGetNotployVersion({ client: this.client, throwOnError: true }),
		);
		return typeof value === "string" ? value : undefined;
	}

	/** Public endpoint; true for managed Notploy Cloud instances. */
	async isCloud(): Promise<boolean> {
		const value = await this.request<unknown>(
			"settings.isCloud",
			settingsIsCloud({ client: this.client, throwOnError: true }),
		);
		return value === true;
	}

	/**
	 * The instance's own OpenAPI document: the authoritative list of routers and
	 * procedures the running instance exposes, which is how capabilities are
	 * discovered instead of guessed from a version number or a cloud flag.
	 */
	async openApiDocument(): Promise<OpenApiDocument | undefined> {
		const value = await this.request<OpenApiDocument | null>(
			"settings.getOpenApiDocument",
			settingsGetOpenApiDocument({ client: this.client, throwOnError: true }),
		);
		if (!value || typeof value !== "object") return undefined;
		return value;
	}

	/** Resolves to `null` when the credential is not accepted. */
	async session(): Promise<SessionUser | null> {
		const value = await this.request<SessionUser | null>(
			"user.session",
			userSession({ client: this.client, throwOnError: true }),
		);
		return value && typeof value === "object" && "user" in value ? value : null;
	}

	// ---------------------------------------------------------------------
	// Projects, environments, applications, compose
	// ---------------------------------------------------------------------

	async projects(): Promise<ProjectSummary[]> {
		const value = await this.request<ProjectSummary[] | null>(
			"project.all",
			projectAll({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	async environments(projectId: string): Promise<EnvironmentSummary[]> {
		const value = await this.request<EnvironmentSummary[] | null>(
			"environment.byProjectId",
			environmentByProjectId({
				client: this.client,
				throwOnError: true,
				query: { projectId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async applications(
		query: ApplicationSearchQuery = {},
	): Promise<{ items: ApplicationSummary[]; total: number }> {
		const value = await this.request<{
			items?: ApplicationSummary[];
			total?: number;
		} | null>(
			"application.search",
			applicationSearch({
				client: this.client,
				throwOnError: true,
				query: {
					q: query.q,
					projectId: query.projectId,
					environmentId: query.environmentId,
					limit: query.limit,
					offset: query.offset,
				},
			}),
		);
		return {
			items: Array.isArray(value?.items) ? value.items : [],
			total: typeof value?.total === "number" ? value.total : 0,
		};
	}

	/** Every page of applications the credential can see. */
	async allApplications(pageSize = 100): Promise<ApplicationSummary[]> {
		const collected: ApplicationSummary[] = [];
		let offset = 0;
		for (;;) {
			const { items, total } = await this.applications({
				limit: pageSize,
				offset,
			});
			collected.push(...items);
			offset += pageSize;
			if (items.length === 0 || collected.length >= total) break;
			// Defensive: never loop forever on an instance reporting a bogus total.
			if (offset > 10_000) break;
		}
		return collected;
	}

	async application(applicationId: string): Promise<ApplicationSummary> {
		return await this.request(
			"application.one",
			applicationOne({
				client: this.client,
				throwOnError: true,
				query: { applicationId },
			}),
		);
	}

	async composes(
		query: { projectId?: string; environmentId?: string } = {},
	): Promise<ComposeSummary[]> {
		const value = await this.request<{ items?: ComposeSummary[] } | null>(
			"compose.search",
			composeSearch({
				client: this.client,
				throwOnError: true,
				query: {
					projectId: query.projectId,
					environmentId: query.environmentId,
					limit: 100,
				},
			}),
		);
		return Array.isArray(value?.items) ? value.items : [];
	}

	// ---------------------------------------------------------------------
	// Deployments
	// ---------------------------------------------------------------------

	async allDeployments(): Promise<Deployment[]> {
		const value = await this.request<Deployment[] | null>(
			"deployment.allCentralized",
			deploymentAllCentralized({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	async deploymentsForApplication(
		applicationId: string,
	): Promise<Deployment[]> {
		const value = await this.request<Deployment[] | null>(
			"deployment.all",
			deploymentAll({
				client: this.client,
				throwOnError: true,
				query: { applicationId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	/** Jobs waiting in the deploy queue (or being processed). */
	async deploymentQueue(): Promise<DeploymentQueueEntry[]> {
		const value = await this.request<DeploymentQueueEntry[] | null>(
			"deployment.queueList",
			deploymentQueueList({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	async deploy(
		applicationId: string,
		title?: string,
		description?: string,
	): Promise<void> {
		await this.request(
			"application.deploy",
			applicationDeploy({
				client: this.client,
				throwOnError: true,
				body: { applicationId, title, description },
			}),
		);
	}

	async redeploy(applicationId: string): Promise<void> {
		await this.request(
			"application.redeploy",
			applicationRedeploy({
				client: this.client,
				throwOnError: true,
				body: { applicationId },
			}),
		);
	}

	async startApplication(applicationId: string): Promise<void> {
		await this.request(
			"application.start",
			applicationStart({
				client: this.client,
				throwOnError: true,
				body: { applicationId },
			}),
		);
	}

	async stopApplication(applicationId: string): Promise<void> {
		await this.request(
			"application.stop",
			applicationStop({
				client: this.client,
				throwOnError: true,
				body: { applicationId },
			}),
		);
	}

	/**
	 * "Restart": recreates the containers without rebuilding.
	 *
	 * `application.reload` requires both the id and the generated `appName`, so
	 * callers must have read the application first (see
	 * `ConnectionService.restartApplication`).
	 */
	async restartApplication(
		applicationId: string,
		appName: string,
	): Promise<void> {
		await this.request(
			"application.reload",
			applicationReload({
				client: this.client,
				throwOnError: true,
				body: { applicationId, appName },
			}),
		);
	}

	async cancelDeployment(applicationId: string): Promise<void> {
		await this.request(
			"application.cancelDeployment",
			applicationCancelDeployment({
				client: this.client,
				throwOnError: true,
				body: { applicationId },
			}),
		);
	}

	async removeDeployment(deploymentId: string): Promise<void> {
		await this.request(
			"deployment.removeDeployment",
			deploymentRemoveDeployment({
				client: this.client,
				throwOnError: true,
				body: { deploymentId },
			}),
		);
	}

	async killDeploymentProcess(deploymentId: string): Promise<void> {
		await this.request(
			"deployment.killProcess",
			deploymentKillProcess({
				client: this.client,
				throwOnError: true,
				body: { deploymentId },
			}),
		);
	}

	// ---------------------------------------------------------------------
	// Logs
	// ---------------------------------------------------------------------

	/** Container logs for an application, as a raw string. */
	async applicationLogs(
		applicationId: string,
		request: LogRequest = {},
	): Promise<string> {
		const value = await this.request<string | null>(
			"application.readLogs",
			applicationReadLogs({
				client: this.client,
				throwOnError: true,
				query: {
					applicationId,
					tail: request.tail ?? 100,
					since: request.since ?? "all",
					search: request.search,
				},
			}),
		);
		return typeof value === "string" ? value : "";
	}

	/** Build/deploy log file written by the deployment runner. */
	async deploymentLogs(deploymentId: string, tail = 500): Promise<string> {
		const value = await this.request<string | null>(
			"deployment.readLogs",
			deploymentReadLogs({
				client: this.client,
				throwOnError: true,
				query: { deploymentId, tail },
			}),
		);
		return typeof value === "string" ? value : "";
	}

	// ---------------------------------------------------------------------
	// Infrastructure
	// ---------------------------------------------------------------------

	async servers(): Promise<NotployServer[]> {
		const value = await this.request<NotployServer[] | null>(
			"server.all",
			serverAll({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	async swarmNodes(serverId?: string): Promise<SwarmNode[]> {
		const value = await this.request<SwarmNode[] | null>(
			"swarm.getNodes",
			swarmGetNodes({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async clusterNodes(serverId?: string): Promise<SwarmNode[]> {
		const value = await this.request<SwarmNode[] | null>(
			"cluster.getNodes",
			clusterGetNodes({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async containers(serverId?: string): Promise<DockerContainer[]> {
		const value = await this.request<DockerContainer[] | null>(
			"docker.getContainers",
			dockerGetContainers({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async containerConfig(
		containerId: string,
		serverId?: string,
	): Promise<unknown> {
		return await this.request(
			"docker.getConfig",
			dockerGetConfig({
				client: this.client,
				throwOnError: true,
				query: { containerId, serverId },
			}),
		);
	}

	async startContainer(containerId: string, serverId?: string): Promise<void> {
		await this.request(
			"docker.startContainer",
			dockerStartContainer({
				client: this.client,
				throwOnError: true,
				body: { containerId, serverId },
			}),
		);
	}

	async stopContainer(containerId: string, serverId?: string): Promise<void> {
		await this.request(
			"docker.stopContainer",
			dockerStopContainer({
				client: this.client,
				throwOnError: true,
				body: { containerId, serverId },
			}),
		);
	}

	async restartContainer(
		containerId: string,
		serverId?: string,
	): Promise<void> {
		await this.request(
			"docker.restartContainer",
			dockerRestartContainer({
				client: this.client,
				throwOnError: true,
				body: { containerId, serverId },
			}),
		);
	}

	async killContainer(containerId: string, serverId?: string): Promise<void> {
		await this.request(
			"docker.killContainer",
			dockerKillContainer({
				client: this.client,
				throwOnError: true,
				body: { containerId, serverId },
			}),
		);
	}

	async removeContainer(containerId: string, serverId?: string): Promise<void> {
		await this.request(
			"docker.removeContainer",
			dockerRemoveContainer({
				client: this.client,
				throwOnError: true,
				body: { containerId, serverId },
			}),
		);
	}

	async images(serverId?: string): Promise<DockerImage[]> {
		const value = await this.request<DockerImage[] | null>(
			"dockerImage.getImages",
			dockerImageGetImages({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async volumes(serverId?: string): Promise<DockerVolume[]> {
		const value = await this.request<Array<
			Partial<DockerVolume> & { name?: string; size?: string | null }
		> | null>(
			"dockerVolume.getVolumes",
			dockerVolumeGetVolumes({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		if (!Array.isArray(value)) return [];
		// The volumes endpoint returns Docker's PascalCase fields verbatim, while
		// some instances normalise them to camelCase. Both are accepted rather
		// than losing every field but the name.
		return value.map((entry) => {
			const record = entry as Record<string, unknown>;
			const text = (pascal: string, camel: string): string => {
				const candidate = record[pascal] ?? record[camel];
				return typeof candidate === "string" ? candidate : "";
			};
			const size = record.Size ?? record.size;
			return {
				Name: text("Name", "name"),
				Driver: text("Driver", "driver"),
				Scope: text("Scope", "scope"),
				Mountpoint: text("Mountpoint", "mountpoint"),
				Labels: text("Labels", "labels"),
				Size: typeof size === "string" ? size : null,
			};
		});
	}

	async volumesSize(
		serverId?: string,
	): Promise<Array<{ name: string; size: string | null }>> {
		const value = await this.request<Array<{
			name: string;
			size: string | null;
		}> | null>(
			"dockerVolume.getVolumesSize",
			dockerVolumeGetVolumesSize({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	async networks(serverId?: string): Promise<DockerNetwork[]> {
		const value = await this.request<DockerNetwork[] | null>(
			"network.all",
			networkAll({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	// ---------------------------------------------------------------------
	// Monitoring and notifications
	// ---------------------------------------------------------------------

	async serverHealth(serverId?: string): Promise<ContainerHealth[]> {
		const value = await this.request<ContainerHealth[] | null>(
			"docker.getServerHealth",
			dockerGetServerHealth({
				client: this.client,
				throwOnError: true,
				query: { serverId },
			}),
		);
		return Array.isArray(value) ? value : [];
	}

	/**
	 * Docker disk usage. Admin-only on the server: a non-admin credential gets a
	 * `forbidden`, which callers report instead of failing the whole page.
	 */
	async diskUsage(): Promise<DiskUsage> {
		const value = await this.request<DiskUsage | null>(
			"settings.getDockerDiskUsage",
			settingsGetDockerDiskUsage({
				client: this.client,
				throwOnError: true,
			}),
		);
		return value && typeof value === "object" ? value : {};
	}

	async notifications(): Promise<NotployNotification[]> {
		const value = await this.request<NotployNotification[] | null>(
			"notification.all",
			notificationAll({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	/** Aggregate of the services an instance runs, used by the overview. */
	async services(): Promise<OverviewService[]> {
		const value = await this.request<OverviewService[] | null>(
			"overview.services",
			overviewServices({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}
}

export type { ApplicationStatus } from "@/shared/domain";
