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
	certificatesAll,
	clusterGetNodes,
	composeSearch,
	createClient,
	deploymentAll,
	deploymentAllCentralized,
	deploymentKillProcess,
	deploymentQueueList,
	deploymentReadLogs,
	deploymentRemoveDeployment,
	destinationAll,
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
	libsqlDeploy,
	libsqlOne,
	libsqlReadLogs,
	libsqlRebuild,
	libsqlReload,
	libsqlRemove,
	libsqlStart,
	libsqlStop,
	mariadbChangePassword,
	mariadbDeploy,
	mariadbOne,
	mariadbReadLogs,
	mariadbRebuild,
	mariadbReload,
	mariadbRemove,
	mariadbSearch,
	mariadbStart,
	mariadbStop,
	mongoChangePassword,
	mongoDeploy,
	mongoOne,
	mongoReadLogs,
	mongoRebuild,
	mongoReload,
	mongoRemove,
	mongoSearch,
	mongoStart,
	mongoStop,
	mysqlChangePassword,
	mysqlDeploy,
	mysqlOne,
	mysqlReadLogs,
	mysqlRebuild,
	mysqlReload,
	mysqlRemove,
	mysqlSearch,
	mysqlStart,
	mysqlStop,
	networkAll,
	notificationAll,
	overviewServices,
	postgresChangePassword,
	postgresDeploy,
	postgresOne,
	postgresReadLogs,
	postgresRebuild,
	postgresReload,
	postgresRemove,
	postgresSearch,
	postgresStart,
	postgresStop,
	projectAll,
	redisChangePassword,
	redisDeploy,
	redisOne,
	redisReadLogs,
	redisRebuild,
	redisReload,
	redisRemove,
	redisSearch,
	redisStart,
	redisStop,
	registryAll,
	serverAll,
	settingsGetDockerDiskUsage,
	settingsGetNotployVersion,
	settingsGetOpenApiDocument,
	settingsHealth,
	settingsIsCloud,
	sshKeyAll,
	swarmGetNodes,
	tagAll,
	userSession,
} from "@notploy/sdk";
import {
	type ApplicationSummary,
	type Certificate,
	type ComposeSummary,
	type ContainerHealth,
	type DatabaseEngine,
	type DatabaseSummary,
	type Deployment,
	type DeploymentQueueEntry,
	type Destination,
	type DiskUsage,
	type DockerContainer,
	type DockerImage,
	type DockerNetwork,
	type DockerVolume,
	type EnvironmentSummary,
	type NotployServer,
	normalizeCatalog,
	type OverviewService,
	type ProjectSummary,
	type Registry,
	type SessionUser,
	type SshKey,
	type SwarmNode,
	type Tag,
	toCertificate,
	toDatabaseSummary,
	toDestination,
	toRegistry,
	toSshKey,
	toTag,
} from "@/shared/domain";
import type { NotployNotification } from "@/shared/ipc";
import type { Logger } from "../logging";
import { NotployError, toNotployError } from "./errors";
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

/**
 * One engine's worth of generated operations, behind a uniform signature.
 *
 * The six database routers expose the same procedure names but the generated
 * operations are six separate, differently-typed functions. Erasing the option
 * type once here is what lets {@link DATABASE_OPERATIONS} be a table instead of
 * six near-identical methods on this class — and because the entries are the
 * *real* generated functions, a renamed or removed SDK export is still a
 * compile error.
 */
type SdkOperation = (options: {
	client: Client;
	throwOnError: true;
	query?: Record<string, unknown>;
	body?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

const asOperation = (operation: unknown): SdkOperation =>
	operation as SdkOperation;

interface DatabaseEngineOperations {
	/** Absent for LibSQL: the API has no `libsql.search`. */
	search?: SdkOperation;
	one: SdkOperation;
	start: SdkOperation;
	stop: SdkOperation;
	deploy: SdkOperation;
	reload: SdkOperation;
	rebuild: SdkOperation;
	remove: SdkOperation;
	readLogs: SdkOperation;
	/** Absent for LibSQL. */
	changePassword?: SdkOperation;
}

const DATABASE_OPERATIONS: Record<DatabaseEngine, DatabaseEngineOperations> = {
	postgres: {
		search: asOperation(postgresSearch),
		one: asOperation(postgresOne),
		start: asOperation(postgresStart),
		stop: asOperation(postgresStop),
		deploy: asOperation(postgresDeploy),
		reload: asOperation(postgresReload),
		rebuild: asOperation(postgresRebuild),
		remove: asOperation(postgresRemove),
		readLogs: asOperation(postgresReadLogs),
		changePassword: asOperation(postgresChangePassword),
	},
	mysql: {
		search: asOperation(mysqlSearch),
		one: asOperation(mysqlOne),
		start: asOperation(mysqlStart),
		stop: asOperation(mysqlStop),
		deploy: asOperation(mysqlDeploy),
		reload: asOperation(mysqlReload),
		rebuild: asOperation(mysqlRebuild),
		remove: asOperation(mysqlRemove),
		readLogs: asOperation(mysqlReadLogs),
		changePassword: asOperation(mysqlChangePassword),
	},
	mariadb: {
		search: asOperation(mariadbSearch),
		one: asOperation(mariadbOne),
		start: asOperation(mariadbStart),
		stop: asOperation(mariadbStop),
		deploy: asOperation(mariadbDeploy),
		reload: asOperation(mariadbReload),
		rebuild: asOperation(mariadbRebuild),
		remove: asOperation(mariadbRemove),
		readLogs: asOperation(mariadbReadLogs),
		changePassword: asOperation(mariadbChangePassword),
	},
	mongo: {
		search: asOperation(mongoSearch),
		one: asOperation(mongoOne),
		start: asOperation(mongoStart),
		stop: asOperation(mongoStop),
		deploy: asOperation(mongoDeploy),
		reload: asOperation(mongoReload),
		rebuild: asOperation(mongoRebuild),
		remove: asOperation(mongoRemove),
		readLogs: asOperation(mongoReadLogs),
		changePassword: asOperation(mongoChangePassword),
	},
	redis: {
		search: asOperation(redisSearch),
		one: asOperation(redisOne),
		start: asOperation(redisStart),
		stop: asOperation(redisStop),
		deploy: asOperation(redisDeploy),
		reload: asOperation(redisReload),
		rebuild: asOperation(redisRebuild),
		remove: asOperation(redisRemove),
		readLogs: asOperation(redisReadLogs),
		changePassword: asOperation(redisChangePassword),
	},
	libsql: {
		// No `libsql.search`: LibSQL services are enumerated from the project
		// environment tree instead.
		one: asOperation(libsqlOne),
		start: asOperation(libsqlStart),
		stop: asOperation(libsqlStop),
		deploy: asOperation(libsqlDeploy),
		reload: asOperation(libsqlReload),
		rebuild: asOperation(libsqlRebuild),
		remove: asOperation(libsqlRemove),
		readLogs: asOperation(libsqlReadLogs),
	},
};

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

	// `compose.deploy` and its siblings are deliberately not used here. The API
	// exposes them, but `compose.readLogs` needs a *container* id and there is no
	// compose-scoped way to enumerate a stack's containers from the compose
	// router alone, so a Compose service is read-only in this client rather than
	// half-implemented. See `docs/desktop/parity.md`.

	// ---------------------------------------------------------------------
	// Managed databases
	// ---------------------------------------------------------------------

	/**
	 * Every service of one engine the credential can see.
	 *
	 * Returns `undefined` — rather than an empty list — when the engine has no
	 * listing procedure or the instance does not expose its router, so the caller
	 * can say "not enumerable here" instead of "none configured".
	 */
	async databasesOf(
		engine: DatabaseEngine,
		query: { projectId?: string; environmentId?: string; q?: string } = {},
	): Promise<DatabaseSummary[] | undefined> {
		const operations = DATABASE_OPERATIONS[engine];
		if (!operations.search) return undefined;

		const value = await this.request<{ items?: unknown[] } | null>(
			`${engine}.search`,
			operations.search({
				client: this.client,
				throwOnError: true,
				query: {
					q: query.q,
					projectId: query.projectId,
					environmentId: query.environmentId,
					limit: 200,
				},
			}),
		);
		const items = Array.isArray(value?.items) ? value.items : [];
		return items
			.map((entry) => toDatabaseSummary(engine, entry))
			.filter((entry): entry is DatabaseSummary => Boolean(entry));
	}

	/** One service, normalised. `one` is the route that always exists. */
	async database(
		engine: DatabaseEngine,
		databaseId: string,
	): Promise<DatabaseSummary> {
		const operations = DATABASE_OPERATIONS[engine];
		const value = await this.request<unknown>(
			`${engine}.one`,
			operations.one({
				client: this.client,
				throwOnError: true,
				query: { [`${engine}Id`]: databaseId },
			}),
		);
		const normalized = toDatabaseSummary(engine, value);
		if (!normalized) {
			throw new NotployError({
				code: "not-found",
				userMessage: `The instance returned no ${engine} service for that identifier.`,
				detail: `${engine}.one returned an unrecognised payload`,
			});
		}
		return normalized;
	}

	/** `start`, `stop`, `deploy`, `reload`, `rebuild` and `remove`. */
	async databaseAction(
		engine: DatabaseEngine,
		databaseId: string,
		action: "start" | "stop" | "deploy" | "reload" | "rebuild" | "remove",
		appName?: string,
	): Promise<void> {
		const operations = DATABASE_OPERATIONS[engine];
		const id = { [`${engine}Id`]: databaseId };

		if (action === "reload") {
			// `*.reload` is the one database procedure that needs the generated
			// name as well as the id.
			const resolved =
				appName ?? (await this.database(engine, databaseId)).appName;
			if (!resolved) {
				throw new NotployError({
					code: "bad-request",
					userMessage:
						"The instance did not report the generated name required to reload this service.",
					detail: `missing appName for ${engine} ${databaseId}`,
				});
			}
			await this.request(
				`${engine}.reload`,
				operations.reload({
					client: this.client,
					throwOnError: true,
					body: { ...id, appName: resolved },
				}),
			);
			return;
		}

		await this.request(
			`${engine}.${action}`,
			operations[action]({
				client: this.client,
				throwOnError: true,
				body: id,
			}),
		);
	}

	async databaseLogs(
		engine: DatabaseEngine,
		databaseId: string,
		tail = 200,
	): Promise<string> {
		const value = await this.request<string | null>(
			`${engine}.readLogs`,
			DATABASE_OPERATIONS[engine].readLogs({
				client: this.client,
				throwOnError: true,
				query: { [`${engine}Id`]: databaseId, tail, since: "all" },
			}),
		);
		return typeof value === "string" ? value : "";
	}

	/**
	 * Rotates a service password.
	 *
	 * The value is sent and then dropped: it is never logged, never cached and
	 * never written anywhere on this machine. LibSQL has no such procedure, so
	 * the call is refused rather than pointed at another engine's route.
	 */
	async databaseChangePassword(
		engine: DatabaseEngine,
		databaseId: string,
		password: string,
	): Promise<void> {
		const operation = DATABASE_OPERATIONS[engine].changePassword;
		if (!operation) {
			throw new NotployError({
				code: "unsupported",
				userMessage: `The instance's ${engine} router has no password procedure.`,
				detail: `${engine}.changePassword is not part of the API`,
			});
		}
		await this.request(
			`${engine}.changePassword`,
			operation({
				client: this.client,
				throwOnError: true,
				body: { [`${engine}Id`]: databaseId, password },
			}),
		);
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

	// ---------------------------------------------------------------------
	// Instance configuration
	// ---------------------------------------------------------------------
	//
	// Every one of these returns a *normalised* list built field by field from
	// the payload, never the raw records: an SSH key, a certificate, a registry
	// and a backup destination all arrive carrying credential material, and the
	// renderer has no use for any of it. See the normalizers in
	// `@/shared/domain`.

	async tags(): Promise<Tag[]> {
		const value = await this.request<unknown>(
			"tag.all",
			tagAll({ client: this.client, throwOnError: true }),
		);
		return normalizeCatalog(value, toTag);
	}

	async certificates(): Promise<Certificate[]> {
		const value = await this.request<unknown>(
			"certificates.all",
			certificatesAll({ client: this.client, throwOnError: true }),
		);
		return normalizeCatalog(value, toCertificate);
	}

	async sshKeys(): Promise<SshKey[]> {
		const value = await this.request<unknown>(
			"sshKey.all",
			sshKeyAll({ client: this.client, throwOnError: true }),
		);
		return normalizeCatalog(value, toSshKey);
	}

	async registries(): Promise<Registry[]> {
		const value = await this.request<unknown>(
			"registry.all",
			registryAll({ client: this.client, throwOnError: true }),
		);
		return normalizeCatalog(value, toRegistry);
	}

	async destinations(): Promise<Destination[]> {
		const value = await this.request<unknown>(
			"destination.all",
			destinationAll({ client: this.client, throwOnError: true }),
		);
		return normalizeCatalog(value, toDestination);
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
