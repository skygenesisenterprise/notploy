/**
 * The IPC bridge.
 *
 * This is the *only* thing a page can reach in the main process, and it is a
 * closed list of operations — no generic `invoke(channel)`, no `ipcRenderer`
 * handle, no Node API. A renderer-side vulnerability therefore has exactly the
 * surface below and nothing more.
 *
 * **Two surfaces, decided by the document's own origin** (this code runs in the
 * preload before any page script, and `location` is readable even in a sandboxed
 * preload):
 *
 * - `file://` — the bundled connection gate, the app's own code: the full
 *   {@link GateBridge} (connections, preferences) plus the native surface.
 * - anything else — the loaded Notploy instance or dev server: only
 *   {@link NativeBridge} (info, openExternal, copyText). An instance page must
 *   not be able to list, switch or mutate the user's other connections.
 *
 * This is a belt to the suspenders worn by the main process, which re-checks
 * the *sender frame's* URL for every gate channel: even a preload that exposed
 * everything would get `forbidden` when called from remote content.
 *
 * Failures are re-thrown as errors carrying the main process's error `code`, so
 * the UI can branch on `unauthorized` / `forbidden` / `timeout` without parsing
 * a message string.
 *
 * Runs sandboxed: it may only use Electron's IPC primitives, which is all it
 * does.
 */

import { contextBridge, ipcRenderer } from "electron";
import type {
	GateBridge,
	IpcArgs,
	IpcChannelName,
	IpcResult,
	IpcResultOf,
	NativeBridge,
	SerializedError,
} from "@/shared/ipc";
import { IPC_CHANNELS, IPC_EVENTS } from "@/shared/ipc";

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

/** The surface every document gets: version info and the two OS round-trips. */
const native: NativeBridge = {
	app: {
		info: () => invoke(IPC_CHANNELS.appInfo),
		openExternal: (url) => invoke(IPC_CHANNELS.appOpenExternal, url),
		copyText: (text) => invoke(IPC_CHANNELS.appCopyText, text),
	},
};

/**
 * True when this document is the app's own bundled gate page.
 *
 * `location.protocol` is available before any page script runs, and a `file://`
 * document can only be the gate: the content policy cancels every other local
 * load, and no navigation to `file://` is ever allowed from http(s) content.
 */
function isLocalGate(): boolean {
	try {
		return window.location.protocol === "file:";
	} catch {
		// A preload that cannot read its own document must assume the worst.
		return false;
	}
}

const gate: GateBridge = {
	...native,

	preferences: {
		get: () => invoke(IPC_CHANNELS.preferencesGet),
		update: (patch) => invoke(IPC_CHANNELS.preferencesUpdate, patch),
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
};

contextBridge.exposeInMainWorld(
	"notploy",
	isLocalGate() ? gate : (native satisfies NativeBridge),
);
