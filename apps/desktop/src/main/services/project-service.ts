/**
 * Projects, environments, applications and Compose projects.
 *
 * Every method reads through the active connection's authenticated client, so a
 * missing or rejected API key surfaces as a `NotployError` the UI can explain
 * rather than as an empty list.
 */

import type {
	ApplicationSummary,
	ComposeSummary,
	EnvironmentSummary,
	ProjectSummary,
} from "@/shared/domain";
import type { ApplicationActionRequest } from "@/shared/ipc";
import type { ConnectionManager } from "../connection/connection-manager";

export class ProjectService {
	constructor(private readonly manager: ConnectionManager) {}

	async projects(): Promise<ProjectSummary[]> {
		const client = await this.manager.authenticatedClient();
		return await client.projects();
	}

	async environments(projectId: string): Promise<EnvironmentSummary[]> {
		const client = await this.manager.authenticatedClient();
		return await client.environments(projectId);
	}

	async applications(query?: {
		projectId?: string;
		environmentId?: string;
		q?: string;
	}): Promise<ApplicationSummary[]> {
		const client = await this.manager.authenticatedClient();

		// A scoped query is filtered by the instance; an unscoped one needs every
		// page, so `allApplications` walks the pagination.
		if (query?.projectId || query?.environmentId || query?.q) {
			const { items } = await client.applications({
				projectId: query.projectId,
				environmentId: query.environmentId,
				q: query.q,
				limit: 100,
			});
			return items;
		}

		return await client.allApplications();
	}

	/**
	 * Compose projects, scoped to a project or an environment.
	 *
	 * `compose.search` accepts the same scoping as `application.search`, so the
	 * projects view can list the Compose services of the environment it opened.
	 */
	async composes(query?: {
		projectId?: string;
		environmentId?: string;
	}): Promise<ComposeSummary[]> {
		const client = await this.manager.authenticatedClient();
		return await client.composes(query);
	}

	async logs(applicationId: string, tail?: number): Promise<string> {
		const client = await this.manager.authenticatedClient();
		return await client.applicationLogs(applicationId, { tail });
	}

	/**
	 * Deploy, redeploy, restart, start, stop and cancel for an application.
	 *
	 * `restart` is `application.reload`, which needs the generated `appName` as
	 * well as the id. The caller usually has it from the listing; when it does
	 * not, it is read here rather than failing the action.
	 */
	async action(request: ApplicationActionRequest): Promise<void> {
		const client = await this.manager.authenticatedClient();
		switch (request.action) {
			case "deploy":
				await client.deploy(request.applicationId);
				return;
			case "redeploy":
				await client.redeploy(request.applicationId);
				return;
			case "start":
				await client.startApplication(request.applicationId);
				return;
			case "stop":
				await client.stopApplication(request.applicationId);
				return;
			case "cancel":
				await client.cancelDeployment(request.applicationId);
				return;
			case "restart": {
				const appName =
					request.appName ??
					(await client.application(request.applicationId)).appName;
				if (!appName) {
					throw new Error(
						"The instance did not report the generated application name required to restart it.",
					);
				}
				await client.restartApplication(request.applicationId, appName);
				return;
			}
		}
	}
}
