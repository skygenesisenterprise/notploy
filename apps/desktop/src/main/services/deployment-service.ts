/**
 * Deployments: history, build logs, the deploy queue, and lifecycle actions.
 *
 * The Notploy API has no streaming endpoint — there is no WebSocket or
 * server-sent-events route — so "following" a deployment is polling
 * `deployment.readLogs` on an interval from the renderer. That is stated in the
 * UI rather than hidden, and the main process holds no timer of its own.
 */

import type { Deployment, DeploymentQueueEntry } from "@/shared/domain";
import type { DeploymentActionRequest } from "@/shared/ipc";
import { NotployError } from "../client/errors";
import type { ConnectionManager } from "../connection/connection-manager";

export class DeploymentService {
	constructor(private readonly manager: ConnectionManager) {}

	async list(query?: { applicationId?: string }): Promise<Deployment[]> {
		const client = await this.manager.authenticatedClient();
		if (query?.applicationId) {
			return await client.deploymentsForApplication(query.applicationId);
		}
		return await client.allDeployments();
	}

	async queue(): Promise<DeploymentQueueEntry[]> {
		const client = await this.manager.authenticatedClient();
		return await client.deploymentQueue();
	}

	async logs(deploymentId: string, tail?: number): Promise<string> {
		const client = await this.manager.authenticatedClient();
		return await client.deploymentLogs(deploymentId, tail);
	}

	async action(request: DeploymentActionRequest): Promise<void> {
		const client = await this.manager.authenticatedClient();

		switch (request.action) {
			case "deploy":
				if (!request.applicationId) throw this.missing("an application id");
				await client.deploy(request.applicationId);
				return;
			case "redeploy":
				if (!request.applicationId) throw this.missing("an application id");
				await client.redeploy(request.applicationId);
				return;
			case "cancel":
				if (!request.applicationId) throw this.missing("an application id");
				await client.cancelDeployment(request.applicationId);
				return;
			case "start":
				if (!request.applicationId) throw this.missing("an application id");
				await client.startApplication(request.applicationId);
				return;
			case "stop":
				if (!request.applicationId) throw this.missing("an application id");
				await client.stopApplication(request.applicationId);
				return;
			case "restart": {
				if (!request.applicationId) throw this.missing("an application id");
				// `application.reload` requires the generated name too.
				const appName =
					request.appName ??
					(await client.application(request.applicationId)).appName;
				if (!appName) {
					throw new NotployError({
						code: "bad-request",
						userMessage:
							"The instance did not report the generated application name required to restart it.",
						detail: `missing appName for ${request.applicationId}`,
					});
				}
				await client.restartApplication(request.applicationId, appName);
				return;
			}
			case "remove":
				if (!request.deploymentId) throw this.missing("a deployment id");
				await client.removeDeployment(request.deploymentId);
				return;
		}
	}

	private missing(what: string): NotployError {
		return new NotployError({
			code: "bad-request",
			userMessage: `This action requires ${what}.`,
			detail: `missing required argument: ${what}`,
		});
	}
}
