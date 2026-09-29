/**
 * The IPC contract between the main process, the preload and the renderer.
 *
 * One place defines the channel names and the payload types, so a handler and
 * its caller cannot drift apart: `IpcInvokeMap` is the single source of truth,
 * the main process registers handlers against it and the preload implements
 * {@link DesktopBridge} from it.
 *
 * Like `domain.ts`, this module must stay free of `node:` and `electron`
 * imports — the renderer imports the types directly.
 */

import type {
	ApplicationSummary,
	CapabilityReport,
	ComposeSummary,
	Connection,
	ConnectionInput,
	ConnectionKind,
	ConnectionStatus,
	ConnectionSummary,
	ConnectionUpdate,
	ContainerHealth,
	Deployment,
	DeploymentQueueEntry,
	DiskUsage,
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	EnvironmentSummary,
	InstanceCapabilities,
	NotployServer,
	OverviewService,
	ProjectSummary,
	SessionUser,
	SwarmNode,
} from "./domain";

// ---------------------------------------------------------------------------
// Local (non-instance) types
// ---------------------------------------------------------------------------

export type SecureStorageBackend =
	/** Windows DPAPI (via Electron `safeStorage`). */
	| "dpapi"
	/** macOS Keychain (via Electron `safeStorage`). */
	| "keychain"
	/** Linux Secret Service / libsecret (via Electron `safeStorage`). */
	| "libsecret"
	/** `safeStorage` is present but the OS keyring is not usable. */
	| "unavailable"
	/** Not Electron's `safeStorage`: only used by tests. */
	| "memory";

export interface SecureStorageInfo {
	/** False when the OS keyring is missing; credentials cannot be persisted. */
	available: boolean;
	backend: SecureStorageBackend;
	/** Why the keyring is unusable, when it is. Safe to show to the user. */
	reason?: string;
}

export interface AppInfo {
	name: string;
	version: string;
	electron: string;
	chrome: string;
	node: string;
	platform: NodeJS.Platform | string;
	arch: string;
	secureStorage: SecureStorageInfo;
}

/** Local UI preferences. Never holds a credential. */
export interface DesktopPreferences {
	/** Ask before stop, cancel, remove and container actions. */
	confirmDestructiveActions: boolean;
	/** Seconds between automatic refreshes of the active view. 0 disables it. */
	autoRefreshSeconds: number;
	/** Number of log lines fetched per request. */
	logTailLines: number;
	/** Milliseconds before a request is aborted, overridable per connection. */
	requestTimeout: number;
}

export const DEFAULT_PREFERENCES: DesktopPreferences = {
	confirmDestructiveActions: true,
	autoRefreshSeconds: 0,
	logTailLines: 300,
	requestTimeout: 30_000,
};

/** Commands the native menu sends to the renderer. */
export type MenuCommand =
	| "navigate:overview"
	| "navigate:connections"
	| "navigate:settings"
	| "refresh"
	| "add-connection";

export interface OverviewSummary {
	connectionId: string;
	status: ConnectionStatus;
	version?: string;
	cloud?: boolean;
	capabilities?: InstanceCapabilities;
	checkedAt: string;
	counts: {
		projects: number;
		applications: number;
		composes: number;
		deployments: number;
		runningDeployments: number;
		servers: number;
		containers: number;
	};
	/** Newest deployments first, bounded by the caller's request. */
	recentDeployments: Deployment[];
	/** Aggregate from `overview.services`, when the instance exposes it. */
	services?: OverviewService[];
	/** Anything that could not be read, explained instead of hidden. */
	notes: string[];
}

export type DeploymentAction =
	| "deploy"
	| "redeploy"
	| "restart"
	| "start"
	| "stop"
	| "cancel"
	| "remove";

export interface DeploymentActionRequest {
	action: DeploymentAction;
	/** Required for every action except `deploy` and `redeploy`. */
	deploymentId?: string;
	/** Required for every action except `remove`. */
	applicationId?: string;
	/** `application.reload` needs the generated name; read by the main process. */
	appName?: string;
}

export type ContainerAction = "start" | "stop" | "restart" | "kill" | "remove";

export interface ContainerActionRequest {
	action: ContainerAction;
	containerId: string;
	serverId?: string;
}

export interface ApplicationActionRequest {
	action: "deploy" | "redeploy" | "restart" | "start" | "stop" | "cancel";
	applicationId: string;
	appName?: string;
}

/**
 * Disk usage, plus why it may be missing.
 *
 * `settings.getDockerDiskUsage` is admin-only, so "empty" and "not permitted"
 * have to be distinguishable — an empty chart and a permission error must not
 * look the same to an operator.
 */
export interface DiskUsageResult {
	usage: DiskUsage;
	restricted: boolean;
	serviceUnavailable: boolean;
}

export interface NotployNotification {
	notificationId?: string;
	name?: string;
	type?: string;
	createdAt?: string;
	[key: string]: unknown;
}

/** A serialized failure. Carries a message that is safe to display. */
export interface SerializedError {
	code: string;
	message: string;
	detail?: string;
	status?: number;
}

export type IpcResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: SerializedError };

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const IPC_CHANNELS = {
	appInfo: "app:info",
	appOpenExternal: "app:open-external",
	preferencesGet: "preferences:get",
	preferencesUpdate: "preferences:update",

	connectionsList: "connections:list",
	connectionsAdd: "connections:add",
	connectionsUpdate: "connections:update",
	connectionsRemove: "connections:remove",
	connectionsSetActive: "connections:set-active",
	connectionsTest: "connections:test",
	connectionsLogin: "connections:login",
	connectionsLogout: "connections:logout",
	connectionsCapabilities: "connections:capabilities",

	overviewSummary: "overview:summary",

	projectsList: "projects:list",
	environmentsList: "environments:list",

	applicationsList: "applications:list",
	applicationsLogs: "applications:logs",
	applicationsAction: "applications:action",

	deploymentsList: "deployments:list",
	deploymentsQueue: "deployments:queue",
	deploymentsLogs: "deployments:logs",
	deploymentsAction: "deployments:action",

	infrastructureServers: "infrastructure:servers",
	infrastructureContainers: "infrastructure:containers",
	infrastructureContainerConfig: "infrastructure:container-config",
	infrastructureContainerAction: "infrastructure:container-action",
	infrastructureImages: "infrastructure:images",
	infrastructureVolumes: "infrastructure:volumes",
	infrastructureNetworks: "infrastructure:networks",
	infrastructureSwarm: "infrastructure:swarm",

	monitoringServerHealth: "monitoring:server-health",
	monitoringDiskUsage: "monitoring:disk-usage",

	notificationsList: "notifications:list",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const IPC_EVENTS = {
	connectionsChanged: "event:connections-changed",
	menuCommand: "event:menu-command",
} as const;

/**
 * Channel → `[arguments, result]`. The main process and the preload are both
 * typed from this map, so adding a channel without a handler is a type error.
 */
export interface IpcInvokeMap {
	[IPC_CHANNELS.appInfo]: { args: []; result: AppInfo };
	[IPC_CHANNELS.appOpenExternal]: { args: [url: string]; result: void };

	[IPC_CHANNELS.preferencesGet]: { args: []; result: DesktopPreferences };
	[IPC_CHANNELS.preferencesUpdate]: {
		args: [patch: Partial<DesktopPreferences>];
		result: DesktopPreferences;
	};

	[IPC_CHANNELS.connectionsList]: { args: []; result: ConnectionSummary[] };
	[IPC_CHANNELS.connectionsAdd]: {
		args: [input: ConnectionInput];
		result: ConnectionSummary;
	};
	[IPC_CHANNELS.connectionsUpdate]: {
		args: [id: string, patch: ConnectionUpdate];
		result: ConnectionSummary;
	};
	[IPC_CHANNELS.connectionsRemove]: { args: [id: string]; result: void };
	[IPC_CHANNELS.connectionsSetActive]: { args: [id: string]; result: void };
	[IPC_CHANNELS.connectionsTest]: {
		args: [id: string];
		result: ConnectionSummary;
	};
	[IPC_CHANNELS.connectionsLogin]: {
		args: [id: string, apiKey: string];
		result: ConnectionSummary;
	};
	[IPC_CHANNELS.connectionsLogout]: {
		args: [id: string];
		result: ConnectionSummary;
	};
	[IPC_CHANNELS.connectionsCapabilities]: {
		args: [id: string];
		result: CapabilityReport;
	};

	[IPC_CHANNELS.overviewSummary]: {
		args: [connectionId?: string];
		result: OverviewSummary;
	};

	[IPC_CHANNELS.projectsList]: { args: []; result: ProjectSummary[] };
	[IPC_CHANNELS.environmentsList]: {
		args: [projectId: string];
		result: EnvironmentSummary[];
	};

	[IPC_CHANNELS.applicationsList]: {
		args: [query?: { projectId?: string; environmentId?: string; q?: string }];
		result: ApplicationSummary[];
	};
	[IPC_CHANNELS.applicationsLogs]: {
		args: [applicationId: string, tail?: number];
		result: string;
	};
	[IPC_CHANNELS.applicationsAction]: {
		args: [request: ApplicationActionRequest];
		result: void;
	};

	[IPC_CHANNELS.deploymentsList]: {
		args: [query?: { applicationId?: string }];
		result: Deployment[];
	};
	[IPC_CHANNELS.deploymentsQueue]: { args: []; result: DeploymentQueueEntry[] };
	[IPC_CHANNELS.deploymentsLogs]: {
		args: [deploymentId: string, tail?: number];
		result: string;
	};
	[IPC_CHANNELS.deploymentsAction]: {
		args: [request: DeploymentActionRequest];
		result: void;
	};

	[IPC_CHANNELS.infrastructureServers]: { args: []; result: NotployServer[] };
	[IPC_CHANNELS.infrastructureContainers]: {
		args: [serverId?: string];
		result: DockerContainer[];
	};
	[IPC_CHANNELS.infrastructureContainerConfig]: {
		args: [containerId: string, serverId?: string];
		result: unknown;
	};
	[IPC_CHANNELS.infrastructureContainerAction]: {
		args: [request: ContainerActionRequest];
		result: void;
	};
	[IPC_CHANNELS.infrastructureImages]: {
		args: [serverId?: string];
		result: DockerImage[];
	};
	[IPC_CHANNELS.infrastructureVolumes]: {
		args: [serverId?: string];
		result: DockerVolume[];
	};
	[IPC_CHANNELS.infrastructureNetworks]: {
		args: [serverId?: string];
		result: DockerNetwork[];
	};
	[IPC_CHANNELS.infrastructureSwarm]: {
		args: [serverId?: string];
		result: SwarmNode[];
	};

	[IPC_CHANNELS.monitoringServerHealth]: {
		args: [serverId?: string];
		result: ContainerHealth[];
	};
	[IPC_CHANNELS.monitoringDiskUsage]: { args: []; result: DiskUsageResult };

	[IPC_CHANNELS.notificationsList]: {
		args: [];
		result: NotployNotification[];
	};
}

export type IpcChannelName = keyof IpcInvokeMap;
export type IpcArgs<K extends IpcChannelName> = IpcInvokeMap[K]["args"];
export type IpcResultOf<K extends IpcChannelName> = IpcInvokeMap[K]["result"];

// ---------------------------------------------------------------------------
// The API exposed to the renderer through `contextBridge`
// ---------------------------------------------------------------------------

export interface NotployBridge {
	app: {
		info(): Promise<AppInfo>;
		/** Opens an `http(s)` URL in the system browser. */
		openExternal(url: string): Promise<void>;
		getPreferences(): Promise<DesktopPreferences>;
		updatePreferences(
			patch: Partial<DesktopPreferences>,
		): Promise<DesktopPreferences>;
	};

	connections: {
		list(): Promise<ConnectionSummary[]>;
		add(input: ConnectionInput): Promise<ConnectionSummary>;
		update(id: string, patch: ConnectionUpdate): Promise<ConnectionSummary>;
		remove(id: string): Promise<void>;
		setActive(id: string): Promise<void>;
		test(id: string): Promise<ConnectionSummary>;
		/** Stores an API key after the instance has accepted it. */
		login(id: string, apiKey: string): Promise<ConnectionSummary>;
		logout(id: string): Promise<ConnectionSummary>;
		capabilities(id: string): Promise<CapabilityReport>;
		/** Subscribes to connection changes; returns an unsubscribe function. */
		onChanged(listener: (connections: ConnectionSummary[]) => void): () => void;
	};

	overview: {
		summary(connectionId?: string): Promise<OverviewSummary>;
	};

	projects: {
		list(): Promise<ProjectSummary[]>;
		environments(projectId: string): Promise<EnvironmentSummary[]>;
	};

	applications: {
		list(query?: {
			projectId?: string;
			environmentId?: string;
			q?: string;
		}): Promise<ApplicationSummary[]>;
		logs(applicationId: string, tail?: number): Promise<string>;
		action(request: ApplicationActionRequest): Promise<void>;
	};

	deployments: {
		list(query?: { applicationId?: string }): Promise<Deployment[]>;
		queue(): Promise<DeploymentQueueEntry[]>;
		logs(deploymentId: string, tail?: number): Promise<string>;
		action(request: DeploymentActionRequest): Promise<void>;
	};

	infrastructure: {
		servers(): Promise<NotployServer[]>;
		containers(serverId?: string): Promise<DockerContainer[]>;
		containerConfig(containerId: string, serverId?: string): Promise<unknown>;
		containerAction(request: ContainerActionRequest): Promise<void>;
		images(serverId?: string): Promise<DockerImage[]>;
		volumes(serverId?: string): Promise<DockerVolume[]>;
		networks(serverId?: string): Promise<DockerNetwork[]>;
		swarmNodes(serverId?: string): Promise<SwarmNode[]>;
	};

	monitoring: {
		serverHealth(serverId?: string): Promise<ContainerHealth[]>;
		/** Total, plus `restricted` / `serviceUnavailable` when there is none. */
		diskUsage(): Promise<DiskUsageResult>;
	};

	notifications: {
		list(): Promise<NotployNotification[]>;
	};

	/** Subscribes to native menu commands; returns an unsubscribe function. */
	onMenuCommand(listener: (command: MenuCommand) => void): () => void;
}

/** Re-exported so the renderer can hold a connection without importing the map. */
export type {
	ComposeSummary,
	Connection,
	ConnectionKind,
	ConnectionSummary,
	SessionUser,
};
