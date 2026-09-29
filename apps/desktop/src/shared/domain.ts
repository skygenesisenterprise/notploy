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
	applications?: ApplicationSummary[];
	compose?: ComposeSummary[];
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
