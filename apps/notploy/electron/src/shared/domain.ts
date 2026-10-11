/**
 * Domain model shared by the three Electron layers.
 *
 * This module must stay free of `node:` and `electron` imports: the renderer
 * bundle imports it through the `@/shared/domain` alias and runs in a sandboxed
 * browser context.
 *
 * The generated `@notploy/sdk` types describe request parameters precisely, but
 * the OpenAPI responses for most procedures are declared as empty objects
 * (`{ "type": "object", "properties": {} }`), so response shapes have no
 * generated types. The interfaces below mirror what the Notploy routers return
 * and must be kept in sync with the server implementation. Everything is
 * optional except the identifiers, because an instance is free to return fewer
 * fields — a trimmed-down self-hosted install does.
 */

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/**
 * How a connection was created. Presentation only: the client never decides
 * what an instance supports from this value, it asks the instance itself (see
 * `CapabilityReport`).
 */
export type ConnectionKind = "cloud" | "self-hosted" | "local" | "custom";

export type ConnectionStatus =
	| "unknown"
	| "checking"
	| "connected"
	| "disconnected"
	| "unavailable";

export interface InstanceCapabilities {
	/** `deployment.*` and `application.deploy` are usable. */
	deployments: boolean;
	/** Logs are exposed (`application.readLogs`, `deployment.readLogs`). */
	logs: boolean;
	/** `docker.*` container management is exposed. */
	docker: boolean;
	/** `dockerImage.*` is exposed. */
	dockerImages: boolean;
	/** `dockerVolume.*` is exposed. */
	dockerVolumes: boolean;
	/** `network.*` is exposed. */
	networks: boolean;
	/** `server.*` is exposed. */
	servers: boolean;
	/** `swarm.*` / `cluster.*` (Docker Swarm) is exposed. */
	swarm: boolean;
	/** `compose.*` is exposed. */
	compose: boolean;
	/** `environment.*` is exposed. */
	environments: boolean;
	/** `notification.*` is exposed. */
	notifications: boolean;
	/**
	 * Managed databases. One flag per engine, because the Notploy API routes
	 * them separately (`postgres.*`, `mysql.*`, …) and a self-hosted install may
	 * expose a subset. `databases` is the aggregate, for the navigation entry.
	 */
	databases: boolean;
	/** `postgres.*` is exposed. */
	postgres: boolean;
	/** `mysql.*` is exposed. */
	mysql: boolean;
	/** `mariadb.*` is exposed. */
	mariadb: boolean;
	/** `mongo.*` is exposed. */
	mongo: boolean;
	/** `redis.*` is exposed. */
	redis: boolean;
	/** `libsql.*` is exposed. */
	libsql: boolean;
	/** `schedule.*` is exposed. */
	schedules: boolean;
	/** `tag.*` is exposed. */
	tags: boolean;
	/** `certificates.*` is exposed. */
	certificates: boolean;
	/** `sshKey.*` is exposed. */
	sshKeys: boolean;
	/** `registry.*` is exposed. */
	registries: boolean;
	/** `destination.*` is exposed. */
	destinations: boolean;
	/** `auditLog.*` is exposed (enterprise/Cloud builds). */
	auditLogs: boolean;
	/** The instance reports itself as Notploy Cloud. */
	cloud: boolean;
	/**
	 * Kubernetes. There is no Kubernetes router in the Notploy API, so this is
	 * always `false` until one exists. The client never invents endpoints to
	 * make it look otherwise.
	 */
	kubernetes: boolean;
}

export const EMPTY_CAPABILITIES: InstanceCapabilities = {
	deployments: false,
	logs: false,
	docker: false,
	dockerImages: false,
	dockerVolumes: false,
	networks: false,
	servers: false,
	swarm: false,
	compose: false,
	environments: false,
	notifications: false,
	databases: false,
	postgres: false,
	mysql: false,
	mariadb: false,
	mongo: false,
	redis: false,
	libsql: false,
	schedules: false,
	tags: false,
	certificates: false,
	sshKeys: false,
	registries: false,
	destinations: false,
	auditLogs: false,
	cloud: false,
	kubernetes: false,
};

export interface CapabilityReport {
	capabilities: InstanceCapabilities;
	/** Router names the instance exposes, sorted. */
	routers: string[];
	source: "openapi" | "probe";
	version?: string;
	/** Routers that answered with a permission error while probing. */
	restricted: string[];
	/** Human-readable notes about anything that could not be determined. */
	notes: string[];
}

/**
 * A connection as stored locally. The API key is never part of this object:
 * it lives in the OS keychain behind `SecureStorage` and is only ever read by
 * the main process.
 */
export interface Connection {
	id: string;
	name: string;
	/** Instance origin, without a trailing slash and without `/api`. */
	url: string;
	kind: ConnectionKind;
	/** True when the user asked to skip TLS verification for this instance. */
	allowInsecureTls: boolean;
	/** Milliseconds before a request to this instance is aborted. */
	timeout: number;
	createdAt: string;
	updatedAt: string;
}

/** A connection plus everything the UI needs to render its state. */
export interface ConnectionSummary extends Connection {
	active: boolean;
	hasCredential: boolean;
	status: ConnectionStatus;
	version?: string;
	cloud?: boolean;
	capabilities?: InstanceCapabilities;
	lastCheckedAt?: string;
	/** User-facing failure message from the last check, when there was one. */
	error?: string;
}

export interface ConnectionInput {
	name: string;
	url: string;
	kind?: ConnectionKind;
	allowInsecureTls?: boolean;
	timeout?: number;
	/** Optional API key; stored in the OS keychain, never in the config file. */
	apiKey?: string;
}

export interface ConnectionUpdate {
	name?: string;
	url?: string;
	kind?: ConnectionKind;
	allowInsecureTls?: boolean;
	timeout?: number;
	/** `null` clears the stored credential; `undefined` leaves it untouched. */
	apiKey?: string | null;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface NotployUser {
	id: string;
	email?: string;
	role?: string;
}

export interface SessionUser {
	user: { id: string; email?: string; role?: string };
	session: { activeOrganizationId?: string };
}

// ---------------------------------------------------------------------------
// Projects, environments, applications
// ---------------------------------------------------------------------------

export type ApplicationStatus = "idle" | "running" | "done" | "error";

export interface ProjectSummary {
	projectId: string;
	name: string;
	description?: string | null;
	createdAt?: string;
	environments?: EnvironmentSummary[];
}

export interface EnvironmentSummary {
	environmentId: string;
	name: string;
	isDefault?: boolean;
	description?: string | null;
	/**
	 * Every service the environment embeds. `environment.byProjectId` returns the
	 * whole tree in one request, which is the only way to enumerate LibSQL
	 * services — the API has no `libsql.search`.
	 */
	applications?: ApplicationSummary[];
	compose?: ComposeSummary[];
	postgres?: DatabaseSummary[];
	mysql?: DatabaseSummary[];
	mariadb?: DatabaseSummary[];
	mongo?: DatabaseSummary[];
	redis?: DatabaseSummary[];
	libsql?: DatabaseSummary[];
}

export interface ApplicationSummary {
	applicationId: string;
	name: string;
	appName?: string;
	description?: string | null;
	applicationStatus?: ApplicationStatus;
	sourceType?: string;
	createdAt?: string;
	environmentId?: string;
}

export interface ComposeSummary {
	composeId: string;
	name: string;
	appName?: string;
	composeStatus?: ApplicationStatus;
	description?: string | null;
	createdAt?: string;
	environmentId?: string;
	serverId?: string | null;
}

// ---------------------------------------------------------------------------
// Managed databases
// ---------------------------------------------------------------------------

/**
 * The database engines Notploy can provision as a service.
 *
 * Each engine has its own router (`postgres.*`, `mysql.*`, …) with a shared
 * procedure vocabulary, which is why the desktop client treats them through one
 * abstraction instead of six near-identical pages.
 */
export const DATABASE_ENGINES = [
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"libsql",
] as const;

export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];

/**
 * The subset of the API's service record the desktop client renders.
 *
 * `id` is the engine-specific identifier (`postgresId`, `mysqlId`, …) flattened
 * to one field, so the UI and the IPC contract do not have to know the
 * difference. `databasePassword` is a live credential the instance returns for
 * the authenticated caller: it is never logged, and the UI only reveals it on
 * request.
 */
export interface DatabaseSummary {
	engine: DatabaseEngine;
	id: string;
	name: string;
	appName?: string;
	description?: string | null;
	/** Engine-specific subtype, e.g. `postgres` vs `supabase` on some builds. */
	databaseType?: string;
	databaseName?: string;
	databaseUser?: string;
	databasePassword?: string;
	dockerImage?: string;
	/** Port published on the host, when one is configured. */
	externalPort?: number | null;
	applicationStatus?: ApplicationStatus;
	createdAt?: string;
	projectId?: string;
	environmentId?: string;
	serverId?: string | null;
	/** Present on `environment.byProjectId` payloads. */
	environment?: {
		environmentId: string;
		name: string;
		project?: { projectId: string; name: string };
	};
	server?: { serverId: string; name: string } | null;
}

/** Every action the desktop client can perform on a managed database. */
export type DatabaseAction =
	| "start"
	| "stop"
	| "deploy"
	| "reload"
	| "rebuild"
	| "remove";

/**
 * Per-engine agreement on which procedures exist.
 *
 * This mirrors the OpenAPI document rather than an assumption: LibSQL has no
 * `search` and no `changePassword`, so those entries are absent and the UI
 * degrades instead of calling a route that would 404.
 */
export const DATABASE_ENGINE_FEATURES: Record<
	DatabaseEngine,
	{ search: boolean; changePassword: boolean }
> = {
	postgres: { search: true, changePassword: true },
	mysql: { search: true, changePassword: true },
	mariadb: { search: true, changePassword: true },
	mongo: { search: true, changePassword: true },
	redis: { search: true, changePassword: true },
	libsql: { search: false, changePassword: false },
};

/** Display name and short label per engine, shared by every view. */
export const DATABASE_ENGINE_LABELS: Record<
	DatabaseEngine,
	{ name: string; short: string }
> = {
	postgres: { name: "PostgreSQL", short: "Postgres" },
	mysql: { name: "MySQL", short: "MySQL" },
	mariadb: { name: "MariaDB", short: "MariaDB" },
	mongo: { name: "MongoDB", short: "Mongo" },
	redis: { name: "Redis", short: "Redis" },
	libsql: { name: "LibSQL", short: "LibSQL" },
};

const ENGINE_ID_KEYS: Record<DatabaseEngine, string> = {
	postgres: "postgresId",
	mysql: "mysqlId",
	mariadb: "mariadbId",
	mongo: "mongoId",
	redis: "redisId",
	libsql: "libsqlId",
};

/**
 * Normalises one raw service record into a {@link DatabaseSummary}.
 *
 * The API never sets the engine on the record and names the identifier field
 * after the engine, so this is where the two are flattened. Unknown fields are
 * preserved by omission rather than by inventing defaults — a trimmed-down
 * instance is allowed to return fewer of them.
 */
export function toDatabaseSummary(
	engine: DatabaseEngine,
	raw: unknown,
): DatabaseSummary | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const id = record[ENGINE_ID_KEYS[engine]];
	if (typeof id !== "string" || !id) return undefined;

	const text = (key: string): string | undefined => {
		const value = record[key];
		return typeof value === "string" ? value : undefined;
	};
	const port = record.externalPort;

	return {
		engine,
		id,
		name: text("name") ?? id,
		appName: text("appName"),
		description: text("description") ?? null,
		databaseType: text("databaseType"),
		databaseName: text("databaseName"),
		databaseUser: text("databaseUser"),
		databasePassword: text("databasePassword"),
		dockerImage: text("dockerImage"),
		externalPort:
			typeof port === "number" || port === null
				? (port as number | null)
				: null,
		applicationStatus: text("applicationStatus") as
			| ApplicationStatus
			| undefined,
		createdAt: text("createdAt"),
		projectId: text("projectId"),
		environmentId: text("environmentId"),
		serverId: typeof record.serverId === "string" ? record.serverId : null,
		environment: record.environment as DatabaseSummary["environment"],
		server: record.server as DatabaseSummary["server"],
	};
}

/** Flattens an `environment.byProjectId` payload into database summaries. */
export function databasesFromEnvironment(
	environment: EnvironmentSummary,
): DatabaseSummary[] {
	const collected: DatabaseSummary[] = [];
	for (const engine of DATABASE_ENGINES) {
		const entries = environment[engine];
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			const normalized = toDatabaseSummary(engine, entry);
			if (!normalized) continue;
			collected.push({
				...normalized,
				environmentId: normalized.environmentId ?? environment.environmentId,
				environment: normalized.environment ?? {
					environmentId: environment.environmentId,
					name: environment.name,
				},
			});
		}
	}
	return collected;
}

// ---------------------------------------------------------------------------
// Instance configuration: tags, certificates, SSH keys, registries, destinations
// ---------------------------------------------------------------------------

/**
 * Things configured **on** an instance that several services share.
 *
 * They have one property in common that decides how they are handled here:
 * every one of them carries credential material on the wire. An SSH key arrives
 * with its private half, a certificate with its private key, a registry with its
 * password, a backup destination with its secret access key.
 *
 * The normalizers below therefore **build a new object field by field** instead
 * of spreading the payload. Spreading would be shorter and would silently ship a
 * private key into the renderer the day the API adds a field, so the door is
 * closed structurally rather than by remembering to delete keys. What survives
 * is a boolean saying whether the material is there — enough for the UI to be
 * honest, useless to an attacker.
 */
export interface Tag {
	tagId: string;
	name: string;
	/** Hex colour, as stored. Absent when the instance never set one. */
	color?: string | null;
	createdAt?: string;
}

export interface Certificate {
	certificateId: string;
	name: string;
	/** Generated path the certificate is written to on the server. */
	certificatePath?: string;
	autoRenew?: boolean | null;
	serverId?: string | null;
	/** True when the payload carried certificate material. Never the material. */
	hasCertificateData: boolean;
	hasPrivateKey: boolean;
}

export interface SshKey {
	sshKeyId: string;
	name: string;
	description?: string | null;
	/** The public half. Safe to show and to copy. */
	publicKey?: string;
	createdAt?: string;
	lastUsedAt?: string | null;
	/** True when the payload carried a private key. Never the key itself. */
	hasPrivateKey: boolean;
}

export interface Registry {
	registryId: string;
	registryName: string;
	username?: string;
	registryUrl?: string;
	imagePrefix?: string;
	registryType?: string;
	createdAt?: string;
}

export interface Destination {
	destinationId: string;
	name: string;
	provider?: string | null;
	bucket?: string;
	region?: string;
	endpoint?: string;
	createdAt?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function optionalText(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function presentText(record: Record<string, unknown>, key: string): boolean {
	const value = record[key];
	return typeof value === "string" && value.length > 0;
}

/**
 * Flattens a list payload.
 *
 * The tRPC procedures behind these routers use both conventions — `findMany`
 * returns a bare array, a paginated procedure returns `{ items, total }` — and a
 * self-hosted build is free to change which one a route uses. Reading both here
 * keeps that difference out of the pages.
 */
export function normalizeCatalog<T>(
	raw: unknown,
	normalize: (entry: unknown) => T | undefined,
): T[] {
	const entries = Array.isArray(raw)
		? raw
		: (() => {
				const items = asRecord(raw)?.items;
				return Array.isArray(items) ? items : [];
			})();

	const collected: T[] = [];
	for (const entry of entries) {
		const normalized = normalize(entry);
		if (normalized) collected.push(normalized);
	}
	return collected;
}

export function toTag(raw: unknown): Tag | undefined {
	const record = asRecord(raw);
	const tagId = record ? optionalText(record, "tagId") : undefined;
	if (!record || !tagId) return undefined;
	return {
		tagId,
		name: optionalText(record, "name") ?? tagId,
		color: optionalText(record, "color") ?? null,
		createdAt: optionalText(record, "createdAt"),
	};
}

export function toCertificate(raw: unknown): Certificate | undefined {
	const record = asRecord(raw);
	const certificateId = record
		? optionalText(record, "certificateId")
		: undefined;
	if (!record || !certificateId) return undefined;
	const autoRenew = record.autoRenew;
	return {
		certificateId,
		name: optionalText(record, "name") ?? certificateId,
		certificatePath: optionalText(record, "certificatePath"),
		autoRenew: typeof autoRenew === "boolean" ? autoRenew : null,
		serverId: optionalText(record, "serverId") ?? null,
		hasCertificateData: presentText(record, "certificateData"),
		hasPrivateKey: presentText(record, "privateKey"),
	};
}

export function toSshKey(raw: unknown): SshKey | undefined {
	const record = asRecord(raw);
	const sshKeyId = record ? optionalText(record, "sshKeyId") : undefined;
	if (!record || !sshKeyId) return undefined;
	return {
		sshKeyId,
		name: optionalText(record, "name") ?? sshKeyId,
		description: optionalText(record, "description") ?? null,
		publicKey: optionalText(record, "publicKey"),
		createdAt: optionalText(record, "createdAt"),
		lastUsedAt: optionalText(record, "lastUsedAt") ?? null,
		hasPrivateKey: presentText(record, "privateKey"),
	};
}

export function toRegistry(raw: unknown): Registry | undefined {
	const record = asRecord(raw);
	const registryId = record ? optionalText(record, "registryId") : undefined;
	if (!record || !registryId) return undefined;
	return {
		registryId,
		registryName: optionalText(record, "registryName") ?? registryId,
		username: optionalText(record, "username"),
		registryUrl: optionalText(record, "registryUrl"),
		imagePrefix: optionalText(record, "imagePrefix"),
		registryType: optionalText(record, "registryType"),
		createdAt: optionalText(record, "createdAt"),
	};
}

export function toDestination(raw: unknown): Destination | undefined {
	const record = asRecord(raw);
	const destinationId = record
		? optionalText(record, "destinationId")
		: undefined;
	if (!record || !destinationId) return undefined;
	return {
		destinationId,
		name: optionalText(record, "name") ?? destinationId,
		provider: optionalText(record, "provider") ?? null,
		bucket: optionalText(record, "bucket"),
		region: optionalText(record, "region"),
		endpoint: optionalText(record, "endpoint"),
		// `destinations.createdAt` is a timestamp column, so it is serialized as
		// a date rather than as the ISO string the other tables use.
		createdAt: (() => {
			const value = record.createdAt;
			if (typeof value === "string") return value;
			if (value instanceof Date) return value.toISOString();
			return undefined;
		})(),
	};
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

export type DeploymentStatus = "running" | "done" | "error" | "cancelled";

export interface DeploymentServerRef {
	serverId: string;
	name: string;
	serverType?: string;
}

export interface DeploymentEnvironmentRef {
	environmentId: string;
	name: string;
	project?: { projectId: string; name: string };
}

export interface DeploymentApplicationRef {
	applicationId: string;
	name: string;
	appName?: string;
	icon?: string | null;
	environment?: DeploymentEnvironmentRef;
	server?: DeploymentServerRef;
	buildServer?: DeploymentServerRef;
}

/** A deployment record, as returned by `deployment.allCentralized`. */
export interface Deployment {
	deploymentId: string;
	title: string;
	description?: string | null;
	status?: DeploymentStatus;
	createdAt?: string;
	startedAt?: string | null;
	finishedAt?: string | null;
	errorMessage?: string | null;
	logPath?: string;
	applicationId?: string | null;
	composeId?: string | null;
	serverId?: string | null;
	isPreviewDeployment?: boolean | null;
	application?: DeploymentApplicationRef | null;
	compose?: {
		composeId: string;
		name: string;
		appName?: string;
		environment?: DeploymentEnvironmentRef;
	} | null;
	server?: { serverId: string; name: string } | null;
}

/** An entry of the deploy queue, as returned by `deployment.queueList`. */
export interface DeploymentQueueEntry {
	applicationId?: string;
	composeId?: string;
	name?: string;
	status?: string;
	createdAt?: string;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export interface NotployServer {
	serverId: string;
	name: string;
	description?: string | null;
	ipAddress: string;
	port?: number;
	username?: string;
	serverType: "deploy" | "build" | string;
	createdAt?: string;
	enableDockerCleanup?: boolean;
	totalSum?: number;
}

export interface DockerContainer {
	containerId: string;
	name: string;
	image: string;
	ports: string;
	state: string;
	status: string;
	serverId?: string | null;
}

export interface DockerImage {
	Repository: string;
	Tag: string;
	ID: string;
	Digest?: string;
	CreatedAt: string;
	CreatedSince: string;
	Size: string;
	SharedSize?: string;
	UniqueSize?: string;
	VirtualSize?: string;
}

export interface DockerVolume {
	Name: string;
	Driver: string;
	Scope: string;
	Mountpoint: string;
	Labels: string;
	Size?: string | null;
}

export interface DockerNetwork {
	networkId?: string;
	name?: string;
	createdAt?: string;
	driver?: string;
	serverId?: string | null;
	[key: string]: unknown;
}

export interface SwarmNode {
	ID: string;
	Description?: { Hostname?: string; Platform?: { OS?: string } };
	Spec?: { Role?: string; Availability?: string };
	Status?: { State?: string; Addr?: string };
}

/** One service of the `overview.services` aggregate. */
export interface OverviewService {
	appName?: string;
	name?: string;
	type?: "application" | "compose" | string;
	status?: string;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export interface DiskUsageEntry {
	Type?: string;
	TotalCount?: number;
	Active?: number;
	Size?: string;
	Reclaimable?: string;
	[key: string]: unknown;
}

export interface DiskUsage {
	/** Total on-disk size, e.g. `"12.4GB"`. */
	diskUsage?: string;
	/** Human-readable total, e.g. `"12.4GB"`. */
	humanDiskUsage?: string;
	containers?: DiskUsageEntry[];
	images?: DiskUsageEntry[];
	volumes?: DiskUsageEntry[];
	buildCache?: DiskUsageEntry[];
	[key: string]: unknown;
}

export interface ContainerHealth {
	Name?: string;
	Status?: string;
}
