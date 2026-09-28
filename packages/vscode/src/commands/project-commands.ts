import * as vscode from "vscode";
import { dashboardUrl, projectDashboardUrl } from "../core/formatting";
import {
	ApplicationNode,
	DeploymentApplicationNode,
	DeploymentNode,
	EnvironmentNode,
	ProjectNode,
} from "../ui/nodes";
import { type CommandDeps, openExternal, runCommand } from "./helpers";

/**
 * Navigation commands. They only ever open the Notploy dashboard in the browser
 * — nothing is mutated.
 */
export function registerProjectCommands(
	deps: CommandDeps,
): vscode.Disposable[] {
	return [
		vscode.commands.registerCommand(
			"notploy.openProject",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Open Project", async () => {
					const instance = deps.services.instances.active();
					if (!instance) return;
					const url = dashboardForNode(instance.url, arg);
					if (!url) return;
					await openExternal(url);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.openInBrowser",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Open in Browser", async () => {
					const instance = deps.services.instances.active();
					if (!instance) return;
					const url = dashboardForNode(instance.url, arg);
					if (!url) return;
					await openExternal(url);
				});
			},
		),
	];
}

/**
 * Resolves the dashboard URL for a node, from data already in the tree. No
 * request is made: the project/environment/application ids are on the nodes.
 */
export function dashboardForNode(
	origin: string,
	arg: unknown,
): string | undefined {
	if (arg instanceof ProjectNode) {
		return projectDashboardUrl(origin, arg.project.projectId);
	}
	if (arg instanceof EnvironmentNode) {
		return projectDashboardUrl(
			origin,
			arg.project.projectId,
			arg.environment.environmentId,
		);
	}
	if (arg instanceof ApplicationNode) {
		return projectDashboardUrl(
			origin,
			arg.project.projectId,
			arg.environment.environmentId,
			arg.application.applicationId,
		);
	}
	if (arg instanceof DeploymentApplicationNode) {
		return projectDashboardUrl(
			origin,
			arg.project.projectId,
			arg.environment.environmentId,
			arg.application.applicationId,
		);
	}
	if (arg instanceof DeploymentNode) {
		const application = arg.deployment.application;
		const projectId = application?.environment?.project?.projectId;
		const environmentId = application?.environment?.environmentId;
		if (projectId && environmentId && application?.applicationId) {
			return projectDashboardUrl(
				origin,
				projectId,
				environmentId,
				application.applicationId,
			);
		}
		return dashboardUrl(origin);
	}
	return undefined;
}
