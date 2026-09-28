/**
 * Domain models used by the extension.
 *
 * The generated `@notploy/sdk` types describe request parameters precisely, but
 * the OpenAPI responses for most procedures are declared as empty objects
 * (`{ "type": "object", "properties": {} }`), so the response shapes have no
 * generated types. These interfaces mirror what the Notploy routers actually
 * return — they were derived from the server implementation and must be kept in
 * sync with it.
 *
 * Everything is optional except the identifiers: a Notploy instance is free to
 * return fewer fields (for example `project.all` only embeds a name and a status
 * for each application).
 */

export interface NotployInstance {
	/** Stable id used in settings, storage keys and the tree. */
	readonly id: string;
	/** Display name chosen by the user ("Notploy Cloud", "Staging", …). */
	name: string;
	/** Origin of the instance, without a trailing slash and without `/api`. */
	url: string;
	/** How the instance was added; only used for presentation. */
	label: NotployInstanceKind;
	/** True when the user asked to skip TLS verification for this instance. */
	allowInsecureTls: boolean;
	/** Last known connection state, refreshed by the connection checks. */
	lastStatus?: InstanceConnectionStatus;
	/** Version reported by `settings.getNotployVersion`. */
	version?: string;
	/** True when `settings.isCloud` reports a managed instance. */
	cloud?: boolean;
	/** Whether a secret is stored in `SecretStorage` for this instance. */
	hasCredential?: boolean;
	/** Cached capability report, refreshed on demand. */
	capabilities?: InstanceCapabilities;
}

export type NotployInstanceKind = "cloud" | "self-hosted" | "local" | "custom";

export type InstanceConnectionStatus =
	| "unknown"
	| "connected"
	| "disconnected"
	| "unavailable"
	| "authenticating";

export interface InstanceCapabilities {
	/** `deployment.*` and `application.deploy` are usable. */
	deployments: boolean;
	/** Log streams are exposed (`application.readLogs`, `deployment.readLogs`). */
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
	/** The instance reports itself as Notploy Cloud. */
	cloud: boolean;
	/**
	 * Kubernetes. There is no Kubernetes router in the Notploy API today, so
	 * this is always `false` until one exists — the extension never invents
	 * endpoints to make it look otherwise.
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
	cloud: false,
	kubernetes: false,
};

export interface NotployUser {
	id: string;
	email?: string;
	role?: string;
}

export interface SessionInfo {
	user: { id: string };
	session: { activeOrganizationId: string };
}

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

export type ApplicationStatus = "idle" | "running" | "done" | "error";

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

/**
 * A deployment record, as returned by `deployment.allCentralized`,
 * `deployment.all`, `deployment.allByCompose` and `deployment.allByServer`.
 */
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

export interface SwarmNode {
	ID: string;
	Description?: { Hostname?: string; Platform?: { OS?: string } };
	Spec?: { Role?: string; Availability?: string };
	Status?: { State?: string; Addr?: string };
}

export interface DeploymentImageSource {
	/** Docker image reference, when the application deploys from an image. */
	dockerImage?: string | null;
	repository?: string | null;
	owner?: string | null;
	branch?: string | null;
}

/** A candidate deployment found for the workspace's Git repository. */
export interface DeploymentMatch {
	deployment: Deployment;
	application: DeploymentApplicationRef;
	projectId?: string;
	projectName?: string;
	environmentName?: string;
}
