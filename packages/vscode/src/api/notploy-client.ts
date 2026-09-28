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
	projectAll,
	serverAll,
	settingsGetNotployVersion,
	settingsGetOpenApiDocument,
	settingsHealth,
	settingsIsCloud,
	swarmGetNodes,
	userSession,
} from "@notploy/sdk";
import type {
	ApplicationStatus,
	ApplicationSummary,
	ComposeSummary,
	Deployment,
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	EnvironmentSummary,
	NotployServer,
	ProjectSummary,
	SessionInfo,
	SwarmNode,
} from "../core/domain";
import { toNotployError } from "../core/errors";
import type { Logger } from "../core/logger";

export interface NotployClientOptions {
	/** Instance origin, e.g. `https://notploy.example.com`. No trailing slash. */
	origin: string;
	/** API key. May be absent while the instance is not authenticated yet. */
	token?: string;
	/** Milliseconds before a request is aborted. */
	timeout: number;
	instanceName?: string;
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

/**
 * One client per Notploy instance.
 *
 * The SDK ships a process-wide `client` singleton; the extension never uses it,
 * because a single VS Code window can be connected to several instances at
 * once. Every call goes through {@link NotployClient.request}, which:
 *
 * - passes the instance-scoped SDK client explicitly,
 * - enforces a per-request timeout,
 * - converts every failure into a {@link NotployError},
 * - never lets a token reach a log line.
 */
export class NotployClient {
	readonly origin: string;
	readonly apiBaseUrl: string;
	private readonly client: Client;
	private readonly instanceName?: string;
	private readonly logger: Logger;
	private readonly timeout: number;
	private readonly token?: string;

	constructor(options: NotployClientOptions) {
		this.origin = options.origin.replace(/\/+$/, "");
		this.apiBaseUrl = `${this.origin}/api`;
		this.instanceName = options.instanceName;
		this.logger = options.logger;
		this.timeout = options.timeout;
		this.token = options.token;

		this.client = createClient({
			baseUrl: this.apiBaseUrl,
			responseStyle: "fields",
			headers: this.buildHeaders(options.token),
			fetch: this.buildFetch(),
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

	private buildFetch(): typeof globalThis.fetch {
		const timeout = this.timeout;
		return async (input, init) => {
			const timeoutSignal = AbortSignal.timeout(timeout);
			const callerSignal = init?.signal ?? undefined;
			const signal = callerSignal
				? combineSignals(callerSignal, timeoutSignal)
				: timeoutSignal;
			return await fetch(input, { ...init, signal });
		};
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
				instanceName: this.instanceName,
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
	 * The instance's own OpenAPI document. This is the authoritative list of
	 * routers and procedures the running instance exposes, which is how the
	 * extension discovers its capabilities instead of guessing from a version
	 * number or a cloud/self-hosted flag.
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
	async session(): Promise<SessionInfo | null> {
		const value = await this.request<SessionInfo | null>(
			"user.session",
			userSession({ client: this.client, throwOnError: true }),
		);
		return value && typeof value === "object" && "user" in value ? value : null;
	}

	// ---------------------------------------------------------------------
	// Projects, environments and applications
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
			items: Array.isArray(value?.items) ? value!.items : [],
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
		return Array.isArray(value?.items) ? value!.items : [];
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
	async deploymentQueue(): Promise<unknown[]> {
		const value = await this.request<unknown[] | null>(
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
	 * `DeploymentService.restart`).
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
		// The volumes endpoint returns Docker's PascalCase fields; be tolerant of
		// instances that normalise them.
		return value.map((entry) => ({
			Name: entry.Name ?? entry.name ?? "",
			Driver: entry.Driver ?? "",
			Scope: entry.Scope ?? "",
			Mountpoint: entry.Mountpoint ?? "",
			Labels: entry.Labels ?? "",
			Size: entry.Size ?? entry.size ?? null,
		}));
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
}

/**
 * Combines two signals without `AbortSignal.any` so the extension keeps
 * working on older Node runtimes shipped with VS Code.
 */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
	const controller = new AbortController();
	const abort = (signal: AbortSignal) => () => {
		controller.abort(signal.reason);
	};
	if (a.aborted) controller.abort(a.reason);
	else a.addEventListener("abort", abort(a), { once: true });
	if (b.aborted) controller.abort(b.reason);
	else b.addEventListener("abort", abort(b), { once: true });
	return controller.signal;
}

/** Re-exported for tests and services that need the status union. */
export type { ApplicationStatus };
