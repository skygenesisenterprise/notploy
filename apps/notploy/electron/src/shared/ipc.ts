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

import type { DeepLinkTarget } from "./deep-link";
import type {
	ApplicationSummary,
	CapabilityReport,
	Certificate,
	ComposeSummary,
	Connection,
	ConnectionInput,
	ConnectionKind,
	ConnectionStatus,
	ConnectionSummary,
	ConnectionUpdate,
	ContainerHealth,
	DatabaseAction,
	DatabaseEngine,
	DatabaseSummary,
	Deployment,
	DeploymentQueueEntry,
	Destination,
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
	Registry,
	SessionUser,
	SshKey,
	SwarmNode,
	Tag,
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
	/**
	 * Notify natively when a deployment of the active instance succeeds or
	 * fails. The watcher polls in the main process, so a long build reports its
	 * outcome even while the window is in the background.
	 */
	notifyDeploymentOutcomes: boolean;
	/** Seconds between deployment-watcher polls. 0 disables the watcher. */
	deploymentWatchSeconds: number;
	/**
	 * Close the window to the system tray instead of quitting. Only meaningful
	 * on platforms that show a tray icon.
	 */
	closeToTray: boolean;
}

export const DEFAULT_PREFERENCES: DesktopPreferences = {
	confirmDestructiveActions: true,
	autoRefreshSeconds: 0,
	logTailLines: 300,
	requestTimeout: 30_000,
	notifyDeploymentOutcomes: true,
	deploymentWatchSeconds: 30,
	closeToTray: false,
};

/**
 * Commands the native menu and the tray send to the renderer.
 *
 * Structured rather than a flat string union: navigation carries a section and
 * an optional resource, so adding a destination never means adding a channel
 * name that both sides have to agree on by hand.
 */
export type MenuCommand =
	| { type: "navigate"; target: DeepLinkTarget }
	| { type: "refresh" }
	| { type: "add-connection" }
	| { type: "command-palette" };

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
	/** `application.cancelDeployment`: drops a deployment that is waiting. */
	| "cancel"
	/** `deployment.killProcess`: kills the build process of a running one. */
	| "kill"
	/** Removes the history record. The application is untouched. */
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
 * A database operation.
 *
 * `reload`, `rebuild` and `remove` are destructive and the UI confirms them;
 * `remove` additionally destroys the data volume, which is why it is a separate
 * choice in the confirmation rather than a second click on "Delete".
 */
export interface DatabaseActionRequest {
	engine: DatabaseEngine;
	databaseId: string;
	action: DatabaseAction;
	/** `reload` needs the generated name; read by the main process when absent. */
	appName?: string;
}

/** What a list request can be scoped by. */
export interface DatabaseQuery {
	/** Restrict to one engine. Absent means every engine the instance exposes. */
	engine?: DatabaseEngine;
	projectId?: string;
	environmentId?: string;
	q?: string;
}

/**
 * A database list plus why entries may be missing.
 *
 * LibSQL has no `search` procedure, so its services are only reachable through
 * the project environment tree. When that tree was not read, the page has to say
 * so instead of implying the instance runs no LibSQL service.
 */
export interface DatabaseListResult {
	databases: DatabaseSummary[];
	/** Engines that could not be enumerated, with the reason. */
	notes: string[];
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
	/** Clipboard writes go through the main process: the renderer's clipboard
	 * permission is denied by the content policy. */
	appCopyText: "app:copy-text",
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

	databasesList: "databases:list",
	databasesOne: "databases:one",
	databasesAction: "databases:action",
	databasesLogs: "databases:logs",
	databasesChangePassword: "databases:change-password",

	notificationsList: "notifications:list",

	/**
	 * Read-only instance configuration: the things services on the instance
	 * share. One channel per kind rather than one parameterised channel, because
	 * each returns a different type and the invoke map is what keeps the two
	 * sides of the bridge honest.
	 */
	operationsTags: "operations:tags",
	operationsCertificates: "operations:certificates",
	operationsSshKeys: "operations:ssh-keys",
	operationsRegistries: "operations:registries",
	operationsDestinations: "operations:destinations",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const IPC_EVENTS = {
	connectionsChanged: "event:connections-changed",
	menuCommand: "event:menu-command",
	/** A `notploy://` link arrived from the operating system. */
	deepLink: "event:deep-link",
} as const;

/**
 * Channel → `[arguments, result]`. The main process and the preload are both
 * typed from this map, so adding a channel without a handler is a type error.
 */
export interface IpcInvokeMap {
	[IPC_CHANNELS.appInfo]: { args: []; result: AppInfo };
	[IPC_CHANNELS.appOpenExternal]: { args: [url: string]; result: void };
	[IPC_CHANNELS.appCopyText]: { args: [text: string]; result: void };

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

	[IPC_CHANNELS.databasesList]: {
		args: [query?: DatabaseQuery];
		result: DatabaseListResult;
	};
	[IPC_CHANNELS.databasesOne]: {
		args: [engine: DatabaseEngine, databaseId: string];
		result: DatabaseSummary;
	};
	[IPC_CHANNELS.databasesAction]: {
		args: [request: DatabaseActionRequest];
		result: void;
	};
	[IPC_CHANNELS.databasesLogs]: {
		args: [engine: DatabaseEngine, databaseId: string, tail?: number];
		result: string;
	};
	[IPC_CHANNELS.databasesChangePassword]: {
		args: [engine: DatabaseEngine, databaseId: string, password: string];
		result: void;
	};

	[IPC_CHANNELS.notificationsList]: {
		args: [];
		result: NotployNotification[];
	};

	[IPC_CHANNELS.operationsTags]: { args: []; result: Tag[] };
	[IPC_CHANNELS.operationsCertificates]: {
		args: [];
		result: Certificate[];
	};
	[IPC_CHANNELS.operationsSshKeys]: { args: []; result: SshKey[] };
	[IPC_CHANNELS.operationsRegistries]: { args: []; result: Registry[] };
	[IPC_CHANNELS.operationsDestinations]: {
		args: [];
		result: Destination[];
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
		/** Copies to the OS clipboard, through the main process. */
		copyText(text: string): Promise<void>;
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

	databases: {
		list(query?: DatabaseQuery): Promise<DatabaseListResult>;
		one(engine: DatabaseEngine, databaseId: string): Promise<DatabaseSummary>;
		action(request: DatabaseActionRequest): Promise<void>;
		logs(
			engine: DatabaseEngine,
			databaseId: string,
			tail?: number,
		): Promise<string>;
		/**
		 * Rotates the service password. The new password is sent once and never
		 * stored: the instance is the only place that needs to keep it.
		 */
		changePassword(
			engine: DatabaseEngine,
			databaseId: string,
			password: string,
		): Promise<void>;
	};

	notifications: {
		list(): Promise<NotployNotification[]>;
	};

	/**
	 * Instance configuration shared by services. Every payload has had its
	 * credential material removed by the main process before it got here — see
	 * the normalizers in `@/shared/domain`.
	 */
	operations: {
		tags(): Promise<Tag[]>;
		certificates(): Promise<Certificate[]>;
		sshKeys(): Promise<SshKey[]>;
		registries(): Promise<Registry[]>;
		destinations(): Promise<Destination[]>;
	};

	/** Subscribes to native menu commands; returns an unsubscribe function. */
	onMenuCommand(listener: (command: MenuCommand) => void): () => void;

	/** Subscribes to `notploy://` links; returns an unsubscribe function. */
	onDeepLink(listener: (target: DeepLinkTarget) => void): () => void;
}

/** Re-exported so the renderer can hold a connection without importing the map. */
export type {
	ComposeSummary,
	Connection,
	ConnectionKind,
	ConnectionSummary,
	DatabaseAction,
	DatabaseEngine,
	DatabaseSummary,
	SessionUser,
};
