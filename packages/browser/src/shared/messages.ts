/**
 * Message protocol between popup / options pages and the service worker.
 *
 * Every message is validated in the background before use: unknown kinds are
 * rejected and URLs are re-validated so a compromised page can never trigger
 * an arbitrary fetch.
 */

import type { Deployment, NotployInstance, ProjectSummary } from "./types.js";

export type MessageKind =
	| "getState"
	| "addInstance"
	| "removeInstance"
	| "selectInstance"
	| "login"
	| "logout"
	| "refresh"
	| "testConnection";

export interface BaseMessage {
	kind: MessageKind;
}

export interface GetStateMessage extends BaseMessage {
	kind: "getState";
}

export interface AddInstanceMessage extends BaseMessage {
	kind: "addInstance";
	name: string;
	url: string;
	label: NotployInstance["label"];
}

export interface RemoveInstanceMessage extends BaseMessage {
	kind: "removeInstance";
	instanceId: string;
}

export interface SelectInstanceMessage extends BaseMessage {
	kind: "selectInstance";
	instanceId: string;
}

export interface LoginMessage extends BaseMessage {
	kind: "login";
	instanceId: string;
	token: string;
}

export interface LogoutMessage extends BaseMessage {
	kind: "logout";
	instanceId: string;
}

export interface RefreshMessage extends BaseMessage {
	kind: "refresh";
}

export interface TestConnectionMessage extends BaseMessage {
	kind: "testConnection";
	instanceId: string;
}

export type ExtensionMessage =
	| GetStateMessage
	| AddInstanceMessage
	| RemoveInstanceMessage
	| SelectInstanceMessage
	| LoginMessage
	| LogoutMessage
	| RefreshMessage
	| TestConnectionMessage;

export interface ConnectionView {
	status: string;
	version?: string;
	cloud?: boolean;
	error?: string;
}

export interface ExtensionSnapshot {
	instances: NotployInstance[];
	activeId?: string;
	connection: ConnectionView | undefined;
	projects: ProjectSummary[];
	deployments: Deployment[];
	lastRefresh?: string;
}

export interface MessageResponse {
	ok: boolean;
	message?: string;
	snapshot?: ExtensionSnapshot;
	apiKeysUrl?: string;
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
	if (typeof value !== "object" || value === null) return false;
	const kind = (value as { kind?: unknown }).kind;
	return (
		kind === "getState" ||
		kind === "addInstance" ||
		kind === "removeInstance" ||
		kind === "selectInstance" ||
		kind === "login" ||
		kind === "logout" ||
		kind === "refresh" ||
		kind === "testConnection"
	);
}
