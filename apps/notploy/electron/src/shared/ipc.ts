/**
 * The IPC contract between the main process, the preload and the documents
 * the window loads.
 *
 * The window loads two very different kinds of document, and the contract says
 * so explicitly:
 *
 * - **The Notploy application** (an instance dashboard, Notploy Cloud, or the
 *   local dev server) is *remote content served by an instance*. It needs no
 *   bridge to work — it talks to its own API with the user's session — so it
 *   receives only {@link NativeBridge}: version info, `openExternal`,
 *   `copyText`. Nothing else is exposed, because a page that can reach the
 *   main process can reach every configured instance's credentials through it.
 *
 * - **The connection gate** is the app's own bundled page (`file://`), shown
 *   when no instance is configured. It is the only document that receives
 *   {@link GateBridge}: the connection list, its mutations, and the local
 *   preferences. The main process re-checks the sender's frame URL for every
 *   gate channel, so this split holds even if the preload were rewritten.
 *
 * `IpcInvokeMap` remains the single source of truth: the main process
 * registers handlers against it and the preload implements the bridges from
 * it, so adding a channel without a handler is a type error.
 *
 * Like `domain.ts`, this module must stay free of `node:` and `electron`
 * imports — both bridges are typed from it.
 */

import type { DeepLinkTarget } from "./deep-link";
import type {
	CapabilityReport,
	ConnectionInput,
	ConnectionSummary,
	ConnectionUpdate,
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
	/** Milliseconds before a main-process API request is aborted. */
	requestTimeout: number;
}

export const DEFAULT_PREFERENCES: DesktopPreferences = {
	notifyDeploymentOutcomes: true,
	deploymentWatchSeconds: 30,
	closeToTray: false,
	requestTimeout: 30_000,
};

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
	// --- Native surface: callable by any document in the app window. ---
	appInfo: "app:info",
	/** Clipboard writes go through the main process: the renderer's clipboard
	 * permission is denied by the content policy. */
	appOpenExternal: "app:open-external",
	appCopyText: "app:copy-text",

	// --- Gate surface: callable only by the bundled `file://` gate page. ---
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
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const IPC_EVENTS = {
	/** The connection list changed; the gate re-reads it. */
	connectionsChanged: "event:connections-changed",
} as const;

/**
 * Channels a remote document (the loaded application) may invoke.
 *
 * Everything not listed here requires the sender frame to be the local gate
 * page — see `isTrustedLocalFrame` in the main process.
 */
export const NATIVE_CHANNELS: readonly IpcChannel[] = [
	IPC_CHANNELS.appInfo,
	IPC_CHANNELS.appOpenExternal,
	IPC_CHANNELS.appCopyText,
];

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
}

export type IpcChannelName = keyof IpcInvokeMap;
export type IpcArgs<K extends IpcChannelName> = IpcInvokeMap[K]["args"];
export type IpcResultOf<K extends IpcChannelName> = IpcInvokeMap[K]["result"];

// ---------------------------------------------------------------------------
// The bridges exposed through `contextBridge`
// ---------------------------------------------------------------------------

/**
 * The surface every document in the app window receives.
 *
 * Deliberately tiny: the loaded Notploy application is remote content, and
 * these three operations are the only ones it cannot perform itself (reading
 * the app's own version, opening a link in the *system* browser, and writing
 * to the OS clipboard through a permission-denied session).
 */
export interface NativeBridge {
	app: {
		info(): Promise<AppInfo>;
		/** Opens an `http(s)` URL in the system browser. */
		openExternal(url: string): Promise<void>;
		/** Copies to the OS clipboard, through the main process. */
		copyText(text: string): Promise<void>;
	};
}

/**
 * The surface of the bundled connection gate — the native bridge plus the
 * connection list and the local preferences. Exposed only on `file://`.
 */
export interface GateBridge extends NativeBridge {
	preferences: {
		get(): Promise<DesktopPreferences>;
		update(patch: Partial<DesktopPreferences>): Promise<DesktopPreferences>;
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
}

/**
 * Deep links are resolved by the main process, which owns the connection list;
 * the type is re-exported so a bridge consumer can type a listener without
 * importing the codec.
 */
export type { DeepLinkTarget };
