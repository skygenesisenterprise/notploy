/**
 * Renderer hardening.
 *
 * The window loads the **real Notploy application** — a self-hosted instance,
 * Notploy Cloud, or the local dev server — so the policy is no longer "cancel
 * everything that is not our bundle": it is "cancel everything that is not one
 * of *our* documents". Concretely the renderer session may load:
 *
 * - the bundled connection gate (`file://`), which is the app's own code;
 * - the dev server, when developing (`NOTPLOY_DEV_SERVER_URL`);
 * - every configured instance origin — the dashboards the user actually asked
 *   the window to show. The list is read through a getter on every request,
 *   because connections are added and removed while the app runs.
 *
 * Everything else — analytics, CDNs, a stray redirect — is cancelled, so a
 * compromised instance page still has no route out of the process beyond the
 * validated `openExternal` bridge. Permission requests (camera, microphone,
 * geolocation, clipboard-read, page notifications) remain denied: the app has
 * no feature that needs them, and native notifications come from the main
 * process.
 */

import { pathToFileURL } from "node:url";
import type { Session } from "electron";

export interface ContentPolicyOptions {
	session: Session;
	/**
	 * Origins the renderer may load from. Read on every request so a connection
	 * added at runtime takes effect without restarting the session.
	 */
	allowedOrigins: () => readonly string[];
	/**
	 * The local gate's `file://` URL prefix, when there is one. Only documents
	 * under this prefix are treated as the app's own code.
	 */
	gateUrlPrefix?: string;
	/** Logs a rejected request. Never logs the full URL of an API call. */
	onBlocked?: (url: string) => void;
}

const WEB_REQUEST_FILTER = { urls: ["<all_urls>"] };

/**
 * The allowed origins' WebSocket forms.
 *
 * The dev server's HMR client and an instance's log streams connect over
 * `ws://` (or `wss://`), which does not match an `http://` prefix — so without
 * this the policy silently cancels the socket. The trailing slash is kept so
 * that `ws://localhost:5273.example.com` cannot match `ws://localhost:5273/`.
 */
function websocketOrigins(allowedOrigins: readonly string[]): string[] {
	return allowedOrigins.map((origin) => {
		if (origin.startsWith("https://")) return `wss://${origin.slice(8)}`;
		if (origin.startsWith("http://")) return `ws://${origin.slice(7)}`;
		return origin;
	});
}

/** True when the URL belongs to the gate, the dev server or an instance. */
export function isAllowedRendererUrl(
	url: string,
	allowedOrigins: readonly string[],
	gateUrlPrefix?: string,
): boolean {
	if (url.startsWith("devtools://")) return true;
	if (gateUrlPrefix && url.startsWith(gateUrlPrefix)) return true;
	const permitted = [...allowedOrigins, ...websocketOrigins(allowedOrigins)];
	return permitted.some((origin) => url.startsWith(origin));
}

export function applyContentPolicy(options: ContentPolicyOptions): void {
	const { session, allowedOrigins, gateUrlPrefix, onBlocked } = options;

	session.webRequest.onBeforeRequest(WEB_REQUEST_FILTER, (details, callback) => {
		if (isAllowedRendererUrl(details.url, allowedOrigins(), gateUrlPrefix)) {
			callback({ cancel: false });
			return;
		}
		onBlocked?.(details.url);
		callback({ cancel: true });
	});

	// Everything is denied explicitly rather than left to Chromium's defaults,
	// which differ per platform.
	session.setPermissionRequestHandler((_contents, _permission, callback) => {
		callback(false);
	});
	session.setPermissionCheckHandler(() => false);

	// The app does not use device APIs (USB, serial, HID, Bluetooth).
	session.setDevicePermissionHandler(() => false);
}

/** The `file://` URL prefix of a bundled page loaded by absolute path. */
export function gateUrlPrefixFor(gatePagePath: string): string {
	// `pathToFileURL` is the only correct way to turn a platform path into a
	// URL (Windows drive letters, spaces, non-ASCII); hand-built `file://`
	// strings break on exactly the machines a desktop app must run on.
	return pathToFileURL(gatePagePath).href.replace(/[^/]*$/, "");
}

/** Origins the renderer is loaded from, for the policy above. */
export function allowedOriginsFor(
	devServerUrl: string | undefined,
	connectionOrigins: readonly string[],
): string[] {
	const origins = new Set(connectionOrigins);
	if (devServerUrl) origins.add(devServerUrl);
	return [...origins];
}
