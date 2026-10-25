/**
 * Domain models for Notploy Browser.
 *
 * Mirrors `packages/vscode/src/core/domain.ts` where it matters for the MVP
 * (instances, projects, deployments) so the two clients stay conceptually in
 * sync. The OpenAPI responses for most procedures are untyped
 * (`{ type: "object", properties: {} }`), hence the optional fields.
 */

export type NotployInstanceKind = "cloud" | "self-hosted" | "local" | "custom";

export type InstanceConnectionStatus =
	| "unknown"
	| "connected"
	| "disconnected"
	| "unavailable"
	| "authenticating";

export interface NotployInstance {
	/** Stable id used in storage keys and messages. */
	readonly id: string;
	/** Display name chosen by the user ("Notploy Cloud", "Staging", …). */
	name: string;
	/** Origin of the instance, without trailing slash and without `/api`. */
	url: string;
	label: NotployInstanceKind;
	lastStatus?: InstanceConnectionStatus;
	version?: string;
	cloud?: boolean;
	hasCredential?: boolean;
}

export interface ProjectSummary {
	projectId: string;
	name: string;
	description?: string | null;
	createdAt?: string;
	environments?: Array<{
		environmentId: string;
		name: string;
	}>;
}

export interface DeploymentApplicationRef {
	applicationId: string;
	name: string;
	appName?: string;
	environment?: {
		environmentId: string;
		name: string;
		project?: { projectId: string; name: string };
	} | null;
	server?: { serverId: string; name: string } | null;
}

export type DeploymentStatus = "running" | "done" | "error" | "cancelled";

export interface Deployment {
	deploymentId: string;
	title: string;
	description?: string | null;
	status?: DeploymentStatus;
	createdAt?: string;
	startedAt?: string | null;
	finishedAt?: string | null;
	errorMessage?: string | null;
	applicationId?: string | null;
	application?: DeploymentApplicationRef | null;
}

export type ExtensionState =
	| "unconfigured"
	| "disconnected"
	| "authenticating"
	| "loading"
	| "ready"
	| "empty"
	| "error"
	| "session-expired";

export interface SessionInfo {
	user: { id: string };
	session: { activeOrganizationId: string };
}
