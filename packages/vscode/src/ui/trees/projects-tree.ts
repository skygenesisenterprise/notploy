import * as vscode from "vscode";
import type {
	ApplicationSummary,
	Deployment,
	EnvironmentSummary,
	ProjectSummary,
} from "../../core/domain";
import type { Logger } from "../../core/logger";
import type { DeploymentService } from "../../services/deployment-service";
import type { ProjectService } from "../../services/project-service";
import {
	ApplicationNode,
	DeploymentNode,
	EnvironmentNode,
	MessageNode,
	type NotployNode,
	ProjectNode,
} from "../nodes";
import { NotployTreeProvider } from "./base-tree";

/**
 * Projects view: Project → Environment → Application, with each application
 * expanding into its most recent deployments.
 *
 * The whole hierarchy comes from a single `project.all` request. Expanding an
 * application reuses the cached deployment list; only when that cache is cold
 * does another request happen, and it is shared by every expanded application.
 */
export class ProjectsTreeProvider extends NotployTreeProvider {
	constructor(
		logger: Logger,
		private readonly projects: ProjectService,
		private readonly deployments: DeploymentService,
	) {
		super(logger);
	}

	protected async loadRoots(): Promise<NotployNode[]> {
		const { projects } = await this.projects.model();
		if (projects.length === 0) {
			return [
				new MessageNode("No projects found on this instance.", {
					icon: "project",
					tooltip: "Create a project in the Notploy dashboard first.",
				}),
			];
		}
		return projects.map(
			(project) =>
				new ProjectNode(project, () => this.loadEnvironments(project)),
		);
	}

	private async loadEnvironments(
		project: ProjectSummary,
	): Promise<NotployNode[]> {
		const environments = project.environments ?? [];
		if (environments.length === 0) {
			return [new MessageNode("No environments.", { icon: "info" })];
		}
		return environments.map(
			(environment) =>
				new EnvironmentNode(project, environment, () =>
					this.loadApplications(project, environment),
				),
		);
	}

	private async loadApplications(
		project: ProjectSummary,
		environment: EnvironmentSummary,
	): Promise<NotployNode[]> {
		const applications = environment.applications ?? [];
		if (applications.length === 0) {
			return [
				new MessageNode("No applications in this environment.", {
					icon: "info",
				}),
			];
		}
		return applications.map(
			(application) =>
				new ApplicationNode(project, environment, application, () =>
					this.loadApplicationDeployments(application),
				),
		);
	}

	private async loadApplicationDeployments(
		application: ApplicationSummary,
	): Promise<NotployNode[]> {
		let deployments: Deployment[] = [];
		try {
			deployments = (await this.deployments.deployments()).filter(
				(entry) =>
					(entry.applicationId ?? entry.application?.applicationId) ===
					application.applicationId,
			);
		} catch (error) {
			this.logger.debug("Deployment list unavailable for application", error);
		}

		if (deployments.length === 0) {
			return [
				new MessageNode("No deployments found.", {
					icon: "rocket",
					tooltip: "Run “Notploy: Deploy” to start the first deployment.",
				}),
			];
		}
		return deployments
			.slice(0, deploymentHistoryLimit())
			.map((entry) => new DeploymentNode(entry));
	}
}

/** How many past deployments to show per application. */
export function deploymentHistoryLimit(): number {
	const value = vscode.workspace
		.getConfiguration("notploy")
		.get<number>("deploymentHistoryLimit", 10);
	return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 10;
}
