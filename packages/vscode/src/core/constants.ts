export const EXTENSION_ID = "notploy";

/** Ids of the views contributed by the extension. */
export const VIEW_IDS = {
	instances: "notploy.instances",
	projects: "notploy.projects",
	deployments: "notploy.deployments",
	infrastructure: "notploy.infrastructure",
	workspace: "notploy.workspace",
} as const;

/** All tree view ids, in the order they appear in the Activity Bar. */
export const ALL_VIEW_IDS: string[] = Object.values(VIEW_IDS);

/** `globalState` keys. Secrets never use these — see `SecretStorage` keys. */
export const STORAGE = {
	instances: "notploy.instances",
	activeInstance: "notploy.activeInstance",
	workspaceBindings: "notploy.workspaceBindings",
} as const;

/** `SecretStorage` keys are namespaced per instance. */
export function secretKeyFor(instanceId: string): string {
	return `notploy.token.${instanceId}`;
}

/**
 * `contextValue` values attached to tree items. Menus in `package.json`
 * key off these, so the two files must stay in sync.
 */
export const CONTEXT = {
	instance: "notploy.instance",
	instanceAuthenticated: "notploy.instance.authenticated",
	project: "notploy.project",
	environment: "notploy.environment",
	application: "notploy.application",
	deploymentApplication: "notploy.deployment.application",
	deployment: "notploy.deployment",
	deploymentRunning: "notploy.deployment.running",
	dockerGroup: "notploy.docker.group",
	dockerContainer: "notploy.docker.container",
	dockerImage: "notploy.docker.image",
	dockerVolume: "notploy.docker.volume",
	dockerNetwork: "notploy.docker.network",
	server: "notploy.server",
	node: "notploy.node",
	kubernetesUnavailable: "notploy.kubernetes.unavailable",
	info: "notploy.info",
	workspaceBinding: "notploy.workspace.binding",
} as const;

/** Number of items fetched per page when an endpoint supports pagination. */
export const PAGE_SIZE = 100;

/** Characters that end up in URLs twice; trimmed from instance URLs. */
export const DEFAULT_INSTANCE_URL = "http://localhost:3000";
export const CLOUD_INSTANCE_URL = "https://app.notploy.com";
