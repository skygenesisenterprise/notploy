/**
 * IPC handlers.
 *
 * The renderer is treated as untrusted input, in both directions:
 *
 * - **In.** Every argument is validated here (`requireId`, `requireHttpUrl`, …).
 *   A renderer bug — or a compromised one — must not be able to make the main
 *   process read an arbitrary path or open a `file://` URL.
 * - **Out.** Only `NotployError.toSerialized()` crosses the boundary, so a raw
 *   SDK error body, a stack trace or a token can never reach the renderer.
 *
 * **Senders are checked twice, and the second check is the important one.**
 * `isTrustedSender` confirms the frame belongs to a window this app created.
 * On top of that, every channel that is not in {@link NATIVE_CHANNELS} —
 * connections, preferences — additionally requires the sender frame to be the
 * bundled gate page (`file://`). The loaded Notploy instance is remote content
 * with a session cookie: it must never be able to list, switch or delete the
 * user's other connections, or read the local preferences, no matter what the
 * preload happens to expose.
 */

import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
	type ConnectionKind,
	type ConnectionUpdate,
} from "@/shared/domain";
import type {
	AppInfo,
	DesktopPreferences,
	IpcArgs,
	IpcChannelName,
	IpcResult,
	IpcResultOf,
	SerializedError,
} from "@/shared/ipc";
import { DEFAULT_PREFERENCES, IPC_CHANNELS, NATIVE_CHANNELS } from "@/shared/ipc";
import { NotployError, toNotployError } from "./client/errors";
import type { ConnectionManager } from "./connection/connection-manager";
import type { Logger } from "./logging";
import type { PreferencesService } from "./preferences";

export interface IpcHandlersOptions {
	ipcMain: IpcMain;
	logger: Logger;
	getAppInfo: () => AppInfo;
	preferences: PreferencesService;
	manager: ConnectionManager;
	/** Opens an `http(s)` URL in the system browser. */
	openExternal: (url: string) => Promise<void>;
	/** Writes to the OS clipboard. Lives in the main process on purpose: the
	 * renderer's clipboard permission is denied by the content policy. */
	copyText: (text: string) => void;
	/**
	 * Called after a preference write. Preferences drive main-process behaviour
	 * (the deployment watcher's interval, close-to-tray), so the services that
	 * read them have to be told rather than polling the file.
	 */
	onPreferencesChanged?: (preferences: DesktopPreferences) => void;
	/** True when the invoking frame belongs to one of our windows. */
	isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
	/**
	 * True when the invoking frame is the bundled gate page — the only frame
	 * allowed to call the channels outside {@link NATIVE_CHANNELS}.
	 */
	isTrustedLocalFrame: (event: IpcMainInvokeEvent) => boolean;
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

/** True when `channel` may be called by any frame of our windows. */
function isNativeChannel(channel: string): boolean {
	return (NATIVE_CHANNELS as readonly string[]).includes(channel);
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

	const forbidden = (message: string): IpcResult<never> => ({
		ok: false,
		error: { code: "forbidden", message },
	});

	const handle = <K extends IpcChannelName>(
		channel: K,
		handler: (...args: IpcArgs<K>) => Promise<IpcResultOf<K>> | IpcResultOf<K>,
	): void => {
		ipcMain.handle(channel, async (event, ...args) => {
			if (!options.isTrustedSender(event)) {
				return forbidden(
					"This window is not allowed to call the Notploy API.",
				) as IpcResult<IpcResultOf<K>>;
			}
			// Gate channels are for the app's own page only: a remote instance
			// page, however it got a handle to the bridge, stops here.
			if (!isNativeChannel(channel) && !options.isTrustedLocalFrame(event)) {
				return forbidden(
					"Only the local Notploy Desktop gate may manage connections.",
				) as IpcResult<IpcResultOf<K>>;
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
	// Native surface (any frame of our windows)
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.appInfo, () => options.getAppInfo());

	handle(IPC_CHANNELS.appOpenExternal, async (url) => {
		await options.openExternal(requireHttpUrl(url, "url"));
	});

	handle(IPC_CHANNELS.appCopyText, (text) => {
		if (typeof text !== "string" || text.length > 8_192) {
			throw invalid("invalid clipboard payload");
		}
		options.copyText(text);
	});

	// -------------------------------------------------------------------
	// Gate surface (the bundled `file://` page only)
	// -------------------------------------------------------------------

	handle(IPC_CHANNELS.preferencesGet, () => preferences.get());

	handle(IPC_CHANNELS.preferencesUpdate, (patch) => {
		const input = requireObject<Partial<DesktopPreferences>>(
			patch,
			"preferences",
		);
		// Only known keys are considered; anything else is dropped by
		// `normalizePreferences`.
		const next = preferences.update({
			notifyDeploymentOutcomes: input.notifyDeploymentOutcomes,
			deploymentWatchSeconds: input.deploymentWatchSeconds,
			closeToTray: input.closeToTray,
			requestTimeout: input.requestTimeout,
		});
		options.onPreferencesChanged?.(next);
		return next;
	});

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

	logger.debug(
		`IPC handlers registered (timeout default ${DEFAULT_PREFERENCES.requestTimeout}ms)`,
	);
}
