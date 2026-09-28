import type { InstanceStore } from "../core/instance-store";
import type { Logger } from "../core/logger";
import type { AuthenticationService } from "./authentication-service";
import type { DeploymentService } from "./deployment-service";
import type { InfrastructureService } from "./infrastructure-service";
import type { InstanceManager } from "./instance-manager";
import type { LogService } from "./log-service";
import type { ProjectService } from "./project-service";
import type { WorkspaceService } from "./workspace-service";

/**
 * Everything the UI and the commands need, built once in `activate()`.
 *
 * Passing this container around — instead of reaching for singletons — is what
 * keeps the TreeDataProviders and the command handlers free of API calls.
 */
export interface Services {
	logger: Logger;
	store: InstanceStore;
	instances: InstanceManager;
	auth: AuthenticationService;
	projects: ProjectService;
	deployments: DeploymentService;
	infrastructure: InfrastructureService;
	workspace: WorkspaceService;
	logs: LogService;
}

export type ServiceName = keyof Services;
