import * as vscode from "vscode";
import type { DockerContainer } from "../core/domain";
import { ContainerNode, type NotployNode } from "../ui/nodes";
import { confirmDestructive, pickFrom } from "../ui/pickers";
import { type CommandDeps, runCommand } from "./helpers";

/**
 * Docker and infrastructure actions.
 *
 * Only what the Notploy API exposes is offered: list, inspect, start, stop and
 * restart. There is no container-log or exec procedure in the API, so neither is
 * presented.
 */
export function registerInfrastructureCommands(
	deps: CommandDeps,
): vscode.Disposable[] {
	const { services } = deps;

	async function resolveContainer(
		arg: unknown,
	): Promise<DockerContainer | undefined> {
		if (arg instanceof ContainerNode) return arg.container;
		const containers = await services.infrastructure.containers();
		if (containers.length === 0) {
			void vscode.window.showInformationMessage("No container found.");
			return undefined;
		}
		return await pickFrom(
			containers,
			(container) => ({
				label: container.name,
				description: container.state,
				detail: container.image,
			}),
			"Select a container",
		);
	}

	async function act(
		label: string,
		arg: unknown,
		confirmMessage: ((container: DockerContainer) => string) | undefined,
		action: (container: DockerContainer) => Promise<void>,
		successMessage: (container: DockerContainer) => string,
	): Promise<void> {
		await runCommand(deps, label, async () => {
			const container = await resolveContainer(arg);
			if (!container) return;
			if (confirmMessage) {
				const confirmed = await confirmDestructive(
					confirmMessage(container),
					container.image,
				);
				if (!confirmed) return;
			}
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `${label.replace("Notploy: ", "")} — ${container.name}…`,
				},
				async () => {
					await action(container);
				},
			);
			deps.refresh();
			void vscode.window.showInformationMessage(successMessage(container));
		});
	}

	const refreshInfrastructure = async (): Promise<void> => {
		services.infrastructure.invalidate();
		deps.refresh();
	};

	return [
		vscode.commands.registerCommand(
			"notploy.infrastructure.refresh",
			async () => {
				await runCommand(
					deps,
					"Notploy: Refresh Infrastructure",
					refreshInfrastructure,
				);
			},
		),

		vscode.commands.registerCommand("notploy.docker.refresh", async () => {
			await runCommand(deps, "Notploy: Refresh Docker", refreshInfrastructure);
		}),

		vscode.commands.registerCommand(
			"notploy.docker.startContainer",
			async (arg?: unknown) => {
				await act(
					"Notploy: Start Container",
					arg,
					undefined,
					async (container) => {
						await services.infrastructure.startContainer(
							container.containerId,
							container.serverId ?? undefined,
						);
					},
					(container) => `${container.name} started.`,
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.docker.stopContainer",
			async (arg?: unknown) => {
				await act(
					"Notploy: Stop Container",
					arg,
					(container) => `Stop the container “${container.name}”?`,
					async (container) => {
						await services.infrastructure.stopContainer(
							container.containerId,
							container.serverId ?? undefined,
						);
					},
					(container) => `${container.name} stopped.`,
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.docker.restartContainer",
			async (arg?: unknown) => {
				await act(
					"Notploy: Restart Container",
					arg,
					(container) => `Restart the container “${container.name}”?`,
					async (container) => {
						await services.infrastructure.restartContainer(
							container.containerId,
							container.serverId ?? undefined,
						);
					},
					(container) => `${container.name} restarted.`,
				);
			},
		),

		vscode.commands.registerCommand(
			"notploy.docker.inspectContainer",
			async (arg?: unknown) => {
				await runCommand(deps, "Notploy: Inspect Container", async () => {
					const container = await resolveContainer(arg);
					if (!container) return;
					const config = await services.infrastructure.containerConfig(
						container.containerId,
						container.serverId ?? undefined,
					);
					// Inspect output is JSON and can be large: an untitled editor
					// document is the native way to present it without a webview.
					const document = await vscode.workspace.openTextDocument({
						content: JSON.stringify(config, null, 2),
						language: "json",
					});
					await vscode.window.showTextDocument(document, { preview: true });
				});
			},
		),
	];
}

/** Kept for symmetry with the other command modules. */
export type { NotployNode };
