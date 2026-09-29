/**
 * Renderer hardening.
 *
 * The renderer never needs the network: every Notploy request is made by the
 * main process and crosses the IPC boundary as data. So the renderer session is
 * allowed to load only its own bundle, and every other request is cancelled.
 *
 * That is what turns the CSP into a second line of defence instead of the only
 * one — even if a dependency injected a script that tried to exfiltrate a token,
 * there would be no route out of the process.
 *
 * Permission requests (camera, microphone, geolocation, clipboard-read,
 * notifications from the page) are all denied for the same reason: the app has
 * no feature that needs them.
 */

import type { Session } from "electron";

export interface ContentPolicyOptions {
	session: Session;
	/**
	 * Origins the renderer may load from. In production this is the app's own
	 * `file://` bundle; in development, the Vite dev server.
	 */
	allowedOrigins: readonly string[];
	/** Logs a rejected request. Never logs the full URL of an API call — the
	 * renderer has none — so this is safe by construction. */
	onBlocked?: (url: string) => void;
}

const WEB_REQUEST_FILTER = { urls: ["<all_urls>"] };

/**
 * The dev server's WebSocket origin, derived from its HTTP origin.
 *
 * Vite's HMR client connects over `ws://` (or `wss://`), which does not match an
 * `http://` prefix — so without this the policy silently cancels the socket and
 * hot reload never works. The trailing slash is kept so that
 * `ws://localhost:5273.example.com` cannot match `ws://localhost:5273/`.
 */
function websocketOrigins(allowedOrigins: readonly string[]): string[] {
	return allowedOrigins.map((origin) => {
		if (origin.startsWith("https://")) return `wss://${origin.slice(8)}`;
		if (origin.startsWith("http://")) return `ws://${origin.slice(7)}`;
		return origin;
	});
}

/** True when the URL belongs to the renderer's own bundle or dev server. */
export function isAllowedRendererUrl(
	url: string,
	allowedOrigins: readonly string[],
): boolean {
	if (url.startsWith("devtools://")) return true;
	if (url.startsWith("file://")) return true;
	const permitted = [...allowedOrigins, ...websocketOrigins(allowedOrigins)];
	return permitted.some((origin) => url.startsWith(origin));
}

export function applyContentPolicy(options: ContentPolicyOptions): void {
	const { session, allowedOrigins, onBlocked } = options;

	session.webRequest.onBeforeRequest(
		WEB_REQUEST_FILTER,
		(details, callback) => {
			if (isAllowedRendererUrl(details.url, allowedOrigins)) {
				callback({ cancel: false });
				return;
			}
			onBlocked?.(details.url);
			callback({ cancel: true });
		},
	);

	// Everything is denied explicitly rather than left to Chromium's defaults,
	// which differ per platform.
	session.setPermissionRequestHandler((_contents, _permission, callback) => {
		callback(false);
	});
	session.setPermissionCheckHandler(() => false);

	// The app does not use device APIs (USB, serial, HID, Bluetooth).
	session.setDevicePermissionHandler(() => false);
}

/** Origins the renderer is loaded from, for the policy above. */
export function allowedOriginsFor(devServerUrl: string | undefined): string[] {
	return devServerUrl ? [devServerUrl] : [];
}
