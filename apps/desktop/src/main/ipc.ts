/**
 * IPC handlers.
 *
 * The renderer is treated as untrusted input, in both directions:
 *
 * - **In.** Every argument is validated here (`assertId`, `assertHttpUrl`, …).
 *   A renderer bug — or a compromised one — must not be able to make the main
 *   process read an arbitrary path or open a `file://` URL.
 * - **Out.** Only `NotployError.toSerialized()` crosses the boundary, so a raw
 *   SDK error body, a stack trace or a token can never reach the renderer.
 *
 * Senders are checked against the window(s) the app created, so a frame that is
 * not ours cannot invoke a channel even if it somehow got a handle to the
 * preload bridge.
 */

import type { IpcMain, IpcMainInvokeEvent } from "electron";
import type { ConnectionKind, ConnectionUpdate } from "@/shared/domain";
import type {
	AppInfo,
	ApplicationActionRequest,
	ContainerActionRequest,
	DeploymentActionRequest,
	DesktopPreferences,
	IpcArgs,
	IpcChannelName,
	IpcResult,
	IpcResultOf,
	SerializedError,
} from "@/shared/ipc";
import { DEFAULT_PREFERENCES, IPC_CHANNELS } from "@/shared/ipc";
import { NotployError, toNotployError } from "./client/errors";
import type { ConnectionManager } from "./connection/connection-manager";
import type { Logger } from "./logging";
import type { PreferencesService } from "./preferences";
import type { DeploymentService } from "./services/deployment-service";
import type { InfrastructureService } from "./services/infrastructure-service";
import type { MonitoringService } from "./services/monitoring-service";
import type { OverviewService } from "./services/overview-service";
import type { ProjectService } from "./services/project-service";

export interface IpcHandlersOptions {
	ipcMain: IpcMain;
	logger: Logger;
	getAppInfo: () => AppInfo;
	preferences: PreferencesService;
	manager: ConnectionManager;
	overview: OverviewService;
	projects: ProjectService;
	deployments: DeploymentService;
	infrastructure: InfrastructureService;
	monitoring: MonitoringService;
	/** Opens an `http(s)` URL in the system browser. */
	openExternal: (url: string) => Promise<void>;
	/** True when the invoking frame belongs to one of our windows. */
	isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function invalid(reason: string): NotployError {
	return new NotployError({
		code: "bad-request",
		userMessage: "The request was rejected because it was malformed.",
		detail: reason,
	});
}

function requireId(value: unknown, name: string): string {
	if (typeof value !== "string" || !value.trim() || value.length > 256) {
		throw invalid(`invalid ${name}`);
	}
	return value;
}

function optionalId(value: unknown, name: string): string | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	return requireId(value, name);
}

function optionalNumber(value: unknown, name: string): number | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw invalid(`invalid ${name}`);
	}
	return value;
}

/** Only `http(s)` URLs ever reach `shell.openExternal`. */
function requireHttpUrl(value: unknown, name: string): string {
	if (typeof value !== "string" || value.length > 2048) {
		throw invalid(`invalid ${name}`);
	}
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw invalid(`invalid ${name}`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw invalid(`unsupported protocol for ${name}`);
	}
	return parsed.toString();
}

function requireObject<T extends object>(value: unknown, name: string): T {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw invalid(`invalid ${name}`);
	}
	return value as T;
}

/** API keys are longer than ids, so they get their own (larger) bound. */
function optionalSecret(value: unknown, name: string): string | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	if (typeof value !== "string" || !value.trim() || value.length > 4096) {
		throw invalid(`invalid ${name}`);
	}
	return value.trim();
}

const CONNECTION_KINDS: ReadonlySet<string> = new Set([
	"cloud",
	"self-hosted",
	"local",
	"custom",
]);

/** Only the four known kinds are accepted; anything else is left undefined. */
function optionalKind(value: unknown): ConnectionKind | undefined {
	return typeof value === "string" && CONNECTION_KINDS.has(value)
		? (value as ConnectionKind)
		: undefined;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerIpcHandlers(options: IpcHandlersOptions): void {
	const { ipcMain, logger, manager, preferences } = options;

	const serialize = (error: unknown, channel: string): SerializedError => {
		if (error instanceof NotployError) return error.toSerialized();
		const normalized = toNotployError(error, { operation: channel });
		// A non-NotployError is a bug here, not a server problem: it is worth a
		// log line, while the renderer only sees the normalized message.
		logger.error(`Unhandled failure in ${channel}`, error);
		return normalized.toSerialized();
	};

	const handle = <K extends IpcChannelName>(
		channel: K,
		handler: (...args: IpcArgs<K>) => Promise<IpcResultOf<K>> | IpcResultOf<K>,
	): void => {
		ipcMain.handle(channel, async (event, ...args) => {
			if (!options.isTrustedSender(event)) {
				return {
					ok: false,
					error: {
						code: "forbidden",
						message: "This window is not allowed to call the Notploy API.",
					},
				} satisfies IpcResult<IpcResultOf<K>>;
			}
			try {
				const data = await handler(...(args as IpcArgs<K>));
				return { ok: true, data } satisfies IpcResult<IpcResultOf<K>>;
			} catch (error) {
				return {
					ok: false,
					error: serialize(error, channel),
				} satisfies IpcResult<IpcResultOf<K>>;
			}
		});
	};

	// -------------------------------------------------------------------
	// App
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.appInfo, () => options.getAppInfo());

	handle(IPC_CHANNELS.appOpenExternal, async (url) => {
		await options.openExternal(requireHttpUrl(url, "url"));
	});

	handle(IPC_CHANNELS.preferencesGet, () => preferences.get());

	handle(IPC_CHANNELS.preferencesUpdate, (patch) => {
		const input = requireObject<Partial<DesktopPreferences>>(
			patch,
			"preferences",
		);
		// Only known keys are considered; anything else is dropped by
		// `normalizePreferences`.
		return preferences.update({
			confirmDestructiveActions: input.confirmDestructiveActions,
			autoRefreshSeconds: input.autoRefreshSeconds,
			logTailLines: input.logTailLines,
			requestTimeout: input.requestTimeout,
		});
	});

	// -------------------------------------------------------------------
	// Connections
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.connectionsList, async () => await manager.summaries());

	handle(IPC_CHANNELS.connectionsAdd, async (input) => {
		const candidate = requireObject<Record<string, unknown>>(
			input,
			"connection",
		);
		const name =
			typeof candidate.name === "string" ? candidate.name.trim() : "";
		if (!name) throw invalid("a connection name is required");
		const url = requireHttpUrl(candidate.url, "url");
		return await manager.add({
			name,
			url,
			kind: optionalKind(candidate.kind),
			allowInsecureTls: candidate.allowInsecureTls === true,
			timeout: optionalNumber(candidate.timeout, "timeout"),
			apiKey: optionalSecret(candidate.apiKey, "apiKey"),
		});
	});

	handle(IPC_CHANNELS.connectionsUpdate, async (id, patch) => {
		const connectionId = requireId(id, "connection id");
		const candidate = requireObject<Record<string, unknown>>(
			patch,
			"connection",
		);
		const update: ConnectionUpdate = {
			name: typeof candidate.name === "string" ? candidate.name : undefined,
			url:
				typeof candidate.url === "string"
					? requireHttpUrl(candidate.url, "url")
					: undefined,
			kind: optionalKind(candidate.kind),
			allowInsecureTls:
				typeof candidate.allowInsecureTls === "boolean"
					? candidate.allowInsecureTls
					: undefined,
			timeout: optionalNumber(candidate.timeout, "timeout"),
			// `null` clears the stored credential; absent leaves it untouched.
			apiKey:
				candidate.apiKey === null
					? null
					: optionalSecret(candidate.apiKey, "apiKey"),
		};
		return await manager.update(connectionId, update);
	});

	handle(IPC_CHANNELS.connectionsRemove, async (id) => {
		await manager.remove(requireId(id, "connection id"));
	});

	handle(IPC_CHANNELS.connectionsSetActive, async (id) => {
		await manager.setActive(requireId(id, "connection id"));
	});

	handle(IPC_CHANNELS.connectionsTest, async (id) => {
		const result = await manager.checkConnection(
			requireId(id, "connection id"),
		);
		return result.summary;
	});

	handle(IPC_CHANNELS.connectionsLogin, async (id, apiKey) => {
		const connectionId = requireId(id, "connection id");
		if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 4096) {
			throw invalid("invalid API key");
		}
		return await manager.login(connectionId, apiKey);
	});

	handle(IPC_CHANNELS.connectionsLogout, async (id) => {
		return await manager.logout(requireId(id, "connection id"));
	});

	handle(IPC_CHANNELS.connectionsCapabilities, async (id) => {
		return await manager.refreshCapabilities(requireId(id, "connection id"));
	});

	// -------------------------------------------------------------------
	// Overview
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.overviewSummary, async (connectionId) => {
		const scoped = optionalId(connectionId, "connection id");
		if (scoped && scoped !== manager.active()?.id) {
			// Reading another connection's overview would silently use the active
			// client, so the selection is followed instead of guessed.
			await manager.setActive(scoped);
		}
		return await options.overview.summary();
	});

	// -------------------------------------------------------------------
	// Projects and applications
	// -------------------------------------------------------------------

	handle(
		IPC_CHANNELS.projectsList,
		async () => await options.projects.projects(),
	);

	handle(
		IPC_CHANNELS.environmentsList,
		async (projectId) =>
			await options.projects.environments(requireId(projectId, "project id")),
	);

	handle(IPC_CHANNELS.applicationsList, async (query) => {
		const scoped = query
			? {
					projectId: optionalId(query.projectId, "project id"),
					environmentId: optionalId(query.environmentId, "environment id"),
					q:
						typeof query.q === "string" && query.q.trim()
							? query.q.trim().slice(0, 200)
							: undefined,
				}
			: undefined;
		return await options.projects.applications(scoped);
	});

	handle(
		IPC_CHANNELS.applicationsLogs,
		async (applicationId, tail) =>
			await options.projects.logs(
				requireId(applicationId, "application id"),
				optionalNumber(tail, "tail"),
			),
	);

	handle(IPC_CHANNELS.applicationsAction, async (request) => {
		const input = requireObject<ApplicationActionRequest>(request, "action");
		return await options.projects.action({
			action: input.action,
			applicationId: requireId(input.applicationId, "application id"),
			appName: optionalId(input.appName, "application name"),
		});
	});

	// -------------------------------------------------------------------
	// Deployments
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.deploymentsList, async (query) => {
		const scoped = query
			? { applicationId: optionalId(query.applicationId, "application id") }
			: undefined;
		return await options.deployments.list(scoped);
	});

	handle(
		IPC_CHANNELS.deploymentsQueue,
		async () => await options.deployments.queue(),
	);

	handle(
		IPC_CHANNELS.deploymentsLogs,
		async (deploymentId, tail) =>
			await options.deployments.logs(
				requireId(deploymentId, "deployment id"),
				optionalNumber(tail, "tail"),
			),
	);

	handle(IPC_CHANNELS.deploymentsAction, async (request) => {
		const input = requireObject<DeploymentActionRequest>(request, "action");
		return await options.deployments.action({
			action: input.action,
			deploymentId: optionalId(input.deploymentId, "deployment id"),
			applicationId: optionalId(input.applicationId, "application id"),
			appName: optionalId(input.appName, "application name"),
		});
	});

	// -------------------------------------------------------------------
	// Infrastructure
	// -------------------------------------------------------------------

	handle(
		IPC_CHANNELS.infrastructureServers,
		async () => await options.infrastructure.servers(),
	);

	handle(
		IPC_CHANNELS.infrastructureContainers,
		async (serverId) =>
			await options.infrastructure.containers(
				optionalId(serverId, "server id"),
			),
	);

	handle(
		IPC_CHANNELS.infrastructureContainerConfig,
		async (containerId, serverId) =>
			await options.infrastructure.containerConfig(
				requireId(containerId, "container id"),
				optionalId(serverId, "server id"),
			),
	);

	handle(IPC_CHANNELS.infrastructureContainerAction, async (request) => {
		const input = requireObject<ContainerActionRequest>(request, "action");
		return await options.infrastructure.containerAction({
			action: input.action,
			containerId: requireId(input.containerId, "container id"),
			serverId: optionalId(input.serverId, "server id"),
		});
	});

	handle(
		IPC_CHANNELS.infrastructureImages,
		async (serverId) =>
			await options.infrastructure.images(optionalId(serverId, "server id")),
	);

	handle(
		IPC_CHANNELS.infrastructureVolumes,
		async (serverId) =>
			await options.infrastructure.volumes(optionalId(serverId, "server id")),
	);

	handle(
		IPC_CHANNELS.infrastructureNetworks,
		async (serverId) =>
			await options.infrastructure.networks(optionalId(serverId, "server id")),
	);

	handle(
		IPC_CHANNELS.infrastructureSwarm,
		async (serverId) =>
			await options.infrastructure.swarmNodes(
				optionalId(serverId, "server id"),
			),
	);

	// -------------------------------------------------------------------
	// Monitoring and notifications
	// -------------------------------------------------------------------

	handle(
		IPC_CHANNELS.monitoringServerHealth,
		async (serverId) =>
			await options.monitoring.serverHealth(optionalId(serverId, "server id")),
	);

	handle(
		IPC_CHANNELS.monitoringDiskUsage,
		async () => await options.monitoring.diskUsage(),
	);

	handle(
		IPC_CHANNELS.notificationsList,
		async () => await options.monitoring.notifications(),
	);

	logger.debug(
		`IPC handlers registered (timeout default ${DEFAULT_PREFERENCES.requestTimeout}ms)`,
	);
}
