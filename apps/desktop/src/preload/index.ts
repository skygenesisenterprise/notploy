/**
 * The IPC bridge.
 *
 * This is the *only* thing the renderer can reach in the main process, and it
 * is deliberately a closed list of operations — no generic `invoke(channel)`,
 * no `ipcRenderer` handle, no Node API. A renderer-side vulnerability therefore
 * has exactly the surface below and nothing more.
 *
 * Failures are re-thrown as errors carrying the main process's error `code`, so
 * the UI can branch on `unauthorized` / `forbidden` / `timeout` without parsing
 * a message string.
 *
 * Runs sandboxed: it may only use Electron's IPC primitives, which is all it
 * does.
 */

import { contextBridge, ipcRenderer } from "electron";
import type { DeepLinkTarget } from "@/shared/deep-link";
import {
	IPC_CHANNELS,
	IPC_EVENTS,
	type IpcArgs,
	type IpcChannelName,
	type IpcResult,
	type IpcResultOf,
	type MenuCommand,
	type NotployBridge,
	type SerializedError,
} from "@/shared/ipc";

/** An error that crossed the IPC boundary, with its code preserved. */
export class BridgeError extends Error {
	readonly code: string;
	readonly detail?: string;
	readonly status?: number;

	constructor(error: SerializedError) {
		super(error.message);
		this.name = "NotployError";
		this.code = error.code;
		this.detail = error.detail;
		this.status = error.status;
	}
}

async function invoke<K extends IpcChannelName>(
	channel: K,
	...args: IpcArgs<K>
): Promise<IpcResultOf<K>> {
	const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<
		IpcResultOf<K>
	>;

	if (result.ok) return result.data;
	throw new BridgeError(result.error);
}

const bridge: NotployBridge = {
	app: {
		info: () => invoke(IPC_CHANNELS.appInfo),
		openExternal: (url) => invoke(IPC_CHANNELS.appOpenExternal, url),
		copyText: (text) => invoke(IPC_CHANNELS.appCopyText, text),
		getPreferences: () => invoke(IPC_CHANNELS.preferencesGet),
		updatePreferences: (patch) => invoke(IPC_CHANNELS.preferencesUpdate, patch),
	},

	connections: {
		list: () => invoke(IPC_CHANNELS.connectionsList),
		add: (input) => invoke(IPC_CHANNELS.connectionsAdd, input),
		update: (id, patch) => invoke(IPC_CHANNELS.connectionsUpdate, id, patch),
		remove: (id) => invoke(IPC_CHANNELS.connectionsRemove, id),
		setActive: (id) => invoke(IPC_CHANNELS.connectionsSetActive, id),
		test: (id) => invoke(IPC_CHANNELS.connectionsTest, id),
		login: (id, apiKey) => invoke(IPC_CHANNELS.connectionsLogin, id, apiKey),
		logout: (id) => invoke(IPC_CHANNELS.connectionsLogout, id),
		capabilities: (id) => invoke(IPC_CHANNELS.connectionsCapabilities, id),
		onChanged: (listener) => {
			const handler = (
				_event: unknown,
				connections: Parameters<typeof listener>[0],
			) => listener(connections);
			ipcRenderer.on(IPC_EVENTS.connectionsChanged, handler);
			return () => {
				ipcRenderer.removeListener(IPC_EVENTS.connectionsChanged, handler);
			};
		},
	},

	overview: {
		summary: (connectionId) =>
			invoke(IPC_CHANNELS.overviewSummary, connectionId),
	},

	projects: {
		list: () => invoke(IPC_CHANNELS.projectsList),
		environments: (projectId) =>
			invoke(IPC_CHANNELS.environmentsList, projectId),
	},

	applications: {
		list: (query) => invoke(IPC_CHANNELS.applicationsList, query),
		logs: (applicationId, tail) =>
			invoke(IPC_CHANNELS.applicationsLogs, applicationId, tail),
		action: (request) => invoke(IPC_CHANNELS.applicationsAction, request),
	},

	deployments: {
		list: (query) => invoke(IPC_CHANNELS.deploymentsList, query),
		queue: () => invoke(IPC_CHANNELS.deploymentsQueue),
		logs: (deploymentId, tail) =>
			invoke(IPC_CHANNELS.deploymentsLogs, deploymentId, tail),
		action: (request) => invoke(IPC_CHANNELS.deploymentsAction, request),
	},

	infrastructure: {
		servers: () => invoke(IPC_CHANNELS.infrastructureServers),
		containers: (serverId) =>
			invoke(IPC_CHANNELS.infrastructureContainers, serverId),
		containerConfig: (containerId, serverId) =>
			invoke(IPC_CHANNELS.infrastructureContainerConfig, containerId, serverId),
		containerAction: (request) =>
			invoke(IPC_CHANNELS.infrastructureContainerAction, request),
		images: (serverId) => invoke(IPC_CHANNELS.infrastructureImages, serverId),
		volumes: (serverId) => invoke(IPC_CHANNELS.infrastructureVolumes, serverId),
		networks: (serverId) =>
			invoke(IPC_CHANNELS.infrastructureNetworks, serverId),
		swarmNodes: (serverId) =>
			invoke(IPC_CHANNELS.infrastructureSwarm, serverId),
	},

	monitoring: {
		serverHealth: (serverId) =>
			invoke(IPC_CHANNELS.monitoringServerHealth, serverId),
		diskUsage: () => invoke(IPC_CHANNELS.monitoringDiskUsage),
	},

	databases: {
		list: (query) => invoke(IPC_CHANNELS.databasesList, query),
		one: (engine, databaseId) =>
			invoke(IPC_CHANNELS.databasesOne, engine, databaseId),
		action: (request) => invoke(IPC_CHANNELS.databasesAction, request),
		logs: (engine, databaseId, tail) =>
			invoke(IPC_CHANNELS.databasesLogs, engine, databaseId, tail),
		changePassword: (engine, databaseId, password) =>
			invoke(
				IPC_CHANNELS.databasesChangePassword,
				engine,
				databaseId,
				password,
			),
	},

	notifications: {
		list: () => invoke(IPC_CHANNELS.notificationsList),
	},

	operations: {
		tags: () => invoke(IPC_CHANNELS.operationsTags),
		certificates: () => invoke(IPC_CHANNELS.operationsCertificates),
		sshKeys: () => invoke(IPC_CHANNELS.operationsSshKeys),
		registries: () => invoke(IPC_CHANNELS.operationsRegistries),
		destinations: () => invoke(IPC_CHANNELS.operationsDestinations),
	},

	onMenuCommand: (listener) => {
		const handler = (_event: unknown, command: MenuCommand) =>
			listener(command);
		ipcRenderer.on(IPC_EVENTS.menuCommand, handler);
		return () => {
			ipcRenderer.removeListener(IPC_EVENTS.menuCommand, handler);
		};
	},

	onDeepLink: (listener) => {
		const handler = (_event: unknown, target: DeepLinkTarget) =>
			listener(target);
		ipcRenderer.on(IPC_EVENTS.deepLink, handler);
		return () => {
			ipcRenderer.removeListener(IPC_EVENTS.deepLink, handler);
		};
	},
};

contextBridge.exposeInMainWorld("notploy", bridge);
