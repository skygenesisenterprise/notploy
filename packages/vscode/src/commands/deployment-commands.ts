import * as vscode from "vscode";
import type { ApplicationSummary, Deployment } from "../core/domain";
import {
	ApplicationNode,
	DeploymentApplicationNode,
	DeploymentNode,
	type NotployNode,
} from "../ui/nodes";
import {
	applicationPickable,
	confirmDestructive,
	pickFrom,
} from "../ui/pickers";
import {
	type CommandDeps,
	CommandTarget,
	openExternal,
	runCommand,
} from "./helpers";
import { dashboardForNode } from "./project-commands";

/**
 * Deployments: the operational half of the extension.
 *
 * Every mutation refreshes the views afterwards, and anything destructive asks
 * for confirmation first (unless the user turned the modal off).
 */
export function registerDeploymentCommands(
	deps: CommandDeps,
): vscode.Disposable[] {
	const target = new CommandTarget(deps);
	const { services } = deps;

	/** Resolves the application a command should act on. */
	async function resolveApplication(
		arg: unknown,
		placeHolder: string,
	): Promise<ApplicationSummary | undefined> {
		const fromNode = await target.applicationsForNode(arg);
		if (fromNode.length === 1) return fromNode[0];
		if (fromNode.length > 1) {
			return await pickFrom(fromNode, applicationPickable, placeHolder);
		}
		return await target.applicationId(arg, { placeHolder });
	}

	async function act(
		label: string,
		arg: unknown,
		placeHolder: string,
		action: (application: ApplicationSummary) => Promise<void>,
	): Promise<void> {
		await runCommand(deps, label, async () => {
			const application = await resolveApplication(arg, placeHolder);
			if (!application) return;
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `${label.replace("Notploy: ", "")} — ${application.name}…`,
				},
				async () => {
					await action(application);
				},
			);
			deps.refresh();
		});
	}

	return [
		vscode.commands.registerCommand("notploy.deploy", async (arg?: unknown) => {
			await runCommand(deps, "Notploy: Deploy", async () => {
				const application = await resolveApplication(
					arg,
					"Deploy which application?",
				);
				if (!application) return;

				const title = await vscode.window.showInputBox({
					title: `Notploy: Deploy ${application.name}`,
					prompt: "Optional title recorded on the deployment.",
					placeHolder: "Release 1.2.0",
					ignoreFocusOut: true,
				});
				if (title === undefined) return;

				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: `Queuing deployment for ${application.name}…`,
					},
					async () => {
						await services.deployments.deploy(
							application.applicationId,
							title.trim() || undefined,
						);
					},
				);
				deps.refresh();
				void vscode.window
					.showInformationMessage(
						`Deployment queued for ${application.name}.`,
						"Follow Logs",
						"Refresh",
					)
					.then(async (choice) => {
						if (choice === "Follow Logs") {
							await startFollowing(application);
						} else if (choice === "Refresh") {
							deps.refresh();
						}
					});
			});
		}),

		vscode.commands.registerCommand(
			"notploy.redeploy",
			async (arg?: unknown) => {
				await act(
					"Notploy: Redeploy",
					arg,
					"Redeploy which application?",
					async (application) => {
						await services.deployments.redeploy(application.applicationId);
						void vscode.window.showInformationMessage(
							`Redeploy queued for ${application.name}.`,
						);
					},
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.restartDeployment",
			async (arg?: unknown) => {
				await act(
					"Notploy: Restart Deployment",
					arg,
					"Restart which application?",
					async (application) => {
						await services.deployments.restart(application.applicationId);
						void vscode.window.showInformationMessage(
							`${application.name} restarted.`,
						);
					},
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.stopDeployment",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Stop Deployment", async () => {
					const application = await resolveApplication(
						arg,
						"Stop which application?",
					);
					if (!application) return;
					const confirmed = await confirmDestructive(
						`Stop ${application.name}?`,
						"Its containers are stopped. Deploy or start it again to bring it back.",
					);
					if (!confirmed) return;
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Stopping ${application.name}…`,
						},
						async () => {
							await services.deployments.stop(application.applicationId);
						},
					);
					deps.refresh();
					void vscode.window.showInformationMessage(
						`${application.name} stopped.`,
					);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.startDeployment",
			async (arg?: unknown) => {
				await act(
					"Notploy: Start Deployment",
					arg,
					"Start which application?",
					async (application) => {
						await services.deployments.start(application.applicationId);
						void vscode.window.showInformationMessage(
							`${application.name} started.`,
						);
					},
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.cancelDeployment",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Cancel Deployment", async () => {
					const application = await resolveApplication(
						arg,
						"Cancel the deployment of which application?",
					);
					if (!application) return;
					const confirmed = await confirmDestructive(
						`Cancel the running deployment of ${application.name}?`,
						"The build or deploy process is interrupted.",
					);
					if (!confirmed) return;
					await services.deployments.cancel(application.applicationId);
					deps.refresh();
					void vscode.window.showInformationMessage(
						`Deployment cancelled for ${application.name}.`,
					);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.removeDeployment",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Remove Deployment", async () => {
					const deployment = await target.deploymentId(arg);
					if (!deployment) return;
					const confirmed = await confirmDestructive(
						`Remove the deployment record “${deployment.title}”?`,
						"This deletes the deployment history entry and its logs. The application itself is kept.",
					);
					if (!confirmed) return;
					await services.deployments.removeDeployment(deployment.deploymentId);
					deps.refresh();
					void vscode.window.showInformationMessage(
						"Deployment record removed.",
					);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.openDeployment",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Open Deployment", async () => {
					const instance = services.instances.active();
					if (!instance) return;
					const deployment = await target.deploymentId(arg);
					if (!deployment) return;
					const url =
						dashboardForNode(instance.url, new DeploymentNode(deployment)) ??
						`${instance.url.replace(/\/+$/, "")}/dashboard`;
					await openExternal(url);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.viewLogs",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: View Logs", async () => {
					const logTarget = await resolveLogTarget(deps, arg);
					if (!logTarget) return;
					await services.logs.open(logTarget);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.followLogs",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Follow Logs", async () => {
					const logTarget = await resolveLogTarget(deps, arg);
					if (!logTarget) return;
					await services.logs.follow(logTarget);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.stopFollowingLogs",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Stop Following Logs", async () => {
					const key = await resolveLogKey(deps, arg);
					if (!key) return;
					await services.logs.unfollow(key);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.clearLogs",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Clear Logs", async () => {
					const key = await resolveLogKey(deps, arg);
					if (!key) return;
					await services.logs.clear(key);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.copyLogs",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Copy Logs", async () => {
					const key = await resolveLogKey(deps, arg);
					if (!key) return;
					await services.logs.copy(key);
					void vscode.window.showInformationMessage(
						"Logs copied to the clipboard.",
					);
				});
			},
		),
	];

	async function startFollowing(
		application: ApplicationSummary,
	): Promise<void> {
		await services.logs.follow({
			key: `application:${application.applicationId}`,
			label: `Notploy: ${application.name}`,
			fetch: async () =>
				await services.deployments.logsForApplication(
					application.applicationId,
					{ tail: 200, since: "10m" },
				),
		});
	}
}

export interface LogTargetLike {
	key: string;
	label: string;
	fetch: () => Promise<string>;
}

/**
 * Maps a tree node — or the Command Palette's lack of one — to a log target.
 *
 * Application nodes stream container logs (`application.readLogs`); deployment
 * nodes read the build log file written by the runner (`deployment.readLogs`).
 * Docker containers have no log endpoint, so they are not offered.
 */
export async function resolveLogTarget(
	deps: CommandDeps,
	arg: unknown,
): Promise<LogTargetLike | undefined> {
	const target = new CommandTarget(deps);
	const { services } = deps;

	if (arg instanceof DeploymentNode) {
		const deployment = arg.deployment;
		return {
			key: `deployment:${deployment.deploymentId}`,
			label: `Notploy: ${deployment.title || "deployment"} (build)`,
			fetch: async () =>
				await services.deployments.logsForDeployment(
					deployment.deploymentId,
					500,
				),
		};
	}

	let application: ApplicationSummary | undefined;
	if (
		arg instanceof ApplicationNode ||
		arg instanceof DeploymentApplicationNode
	) {
		application = arg.application;
	} else {
		application = await target.applicationId(arg, {
			placeHolder: "View logs for which application?",
		});
	}
	if (!application) return undefined;

	return {
		key: `application:${application.applicationId}`,
		label: `Notploy: ${application.name}`,
		fetch: async () =>
			await services.deployments.logsForApplication(application.applicationId, {
				tail: 500,
			}),
	};
}

async function resolveLogKey(
	deps: CommandDeps,
	arg: unknown,
): Promise<string | undefined> {
	if (arg instanceof DeploymentNode)
		return `deployment:${arg.deployment.deploymentId}`;
	if (
		arg instanceof ApplicationNode ||
		arg instanceof DeploymentApplicationNode
	) {
		return `application:${arg.application.applicationId}`;
	}
	const target = await resolveLogTarget(deps, arg);
	return target?.key;
}

/** Used by other modules to build a deployment node from a raw record. */
export function toDeploymentNode(deployment: Deployment): NotployNode {
	return new DeploymentNode(deployment);
}
