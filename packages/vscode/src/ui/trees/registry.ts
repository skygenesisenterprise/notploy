import type { NotployNode } from "../nodes";
import type { DeploymentsTreeProvider } from "./deployments-tree";
import type { InfrastructureTreeProvider } from "./infrastructure-tree";
import type { InstancesTreeProvider } from "./instances-tree";
import type { ProjectsTreeProvider } from "./projects-tree";
import type { WorkspaceTreeProvider } from "./workspace-tree";

export interface TreeRegistry {
	instances: InstancesTreeProvider;
	projects: ProjectsTreeProvider;
	deployments: DeploymentsTreeProvider;
	infrastructure: InfrastructureTreeProvider;
	workspace: WorkspaceTreeProvider;
}

/** Refreshes the content-bearing views after a mutation. */
export function refreshDataViews(
	trees: TreeRegistry,
	element?: NotployNode,
): void {
	trees.projects.refresh(element);
	trees.deployments.refresh(element);
	trees.infrastructure.refresh(element);
	trees.workspace.refresh(element);
}

/** Refreshes every view, including Instances and the status bar. */
export function refreshAllViews(trees: TreeRegistry): void {
	trees.instances.refresh();
	refreshDataViews(trees);
}
