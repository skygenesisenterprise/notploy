/**
 * Access to the preload bridge.
 *
 * The renderer only ever runs inside Electron, but failing loudly with an
 * explanatory error beats a `TypeError: cannot read properties of undefined`
 * when someone opens the bundle in a browser to inspect it.
 */

import type { NotployBridge } from "@/shared/ipc";

export function getBridge(): NotployBridge {
	const bridge = window.notploy;
	if (!bridge) {
		throw new Error(
			"The Notploy desktop bridge is unavailable. The renderer must be loaded by the Electron main process.",
		);
	}
	return bridge;
}

/** True when running inside Electron with the bridge injected. */
export function hasBridge(): boolean {
	return Boolean(window.notploy);
}

/**
 * Errors thrown by the bridge carry a `code` from the main process's error
 * taxonomy, which the UI branches on instead of parsing messages.
 */
export interface BridgeFailure {
	message: string;
	code: string;
	detail?: string;
	status?: number;
}

export function asFailure(error: unknown): BridgeFailure {
	if (error instanceof Error) {
		const candidate = error as Error & { code?: string; detail?: string };
		return {
			message: error.message,
			code: typeof candidate.code === "string" ? candidate.code : "unknown",
			detail: candidate.detail,
		};
	}
	return { message: String(error), code: "unknown" };
}

/** A stable, human-readable hint for the common failure codes. */
export function failureHint(code: string): string | undefined {
	switch (code) {
		case "unauthorized":
			return "Add or refresh the API key for this connection.";
		case "forbidden":
			return "The API key does not have permission for this operation.";
		case "not-configured":
			return "Add a connection and select it.";
		case "connection":
			return "The instance could not be reached. Check the URL and that the server is running.";
		case "timeout":
			return "The instance did not answer in time. Increase the request timeout in Settings if it is slow.";
		case "unsupported":
			return "This instance does not expose the required API router.";
		case "storage":
			return "Credentials require an OS keyring on this machine.";
		default:
			return undefined;
	}
}
