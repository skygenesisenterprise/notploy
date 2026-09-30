import * as vscode from "vscode";
import { describeCapabilities } from "../core/capabilities";
import {
	CLOUD_INSTANCE_URL,
	DEFAULT_INSTANCE_URL,
	VIEW_IDS,
} from "../core/constants";
import type { NotployInstance, NotployInstanceKind } from "../core/domain";
import { normalizeInstanceUrl } from "../core/formatting";
import type { InstanceNode } from "../ui/nodes";
import { confirmDestructive, pickInstance, promptText } from "../ui/pickers";
import {
	type CommandDeps,
	CommandTarget,
	copyToClipboard,
	openExternal,
	runCommand,
} from "./helpers";

interface KindChoice extends vscode.QuickPickItem {
	/** Kept out of `kind`, which VS Code reserves for separators. */
	instanceKind: NotployInstanceKind;
	defaultUrl: string;
}

const KIND_CHOICES: KindChoice[] = [
	{
		label: "$(cloud) Notploy Cloud",
		description: "A managed instance operated by Notploy",
		instanceKind: "cloud",
		defaultUrl: CLOUD_INSTANCE_URL,
	},
	{
		label: "$(server) Self-hosted",
		description: "Your own instance, on a domain or a private network",
		instanceKind: "self-hosted",
		defaultUrl: "https://notploy.example.com",
	},
	{
		label: "$(device-desktop) Local",
		description: "An instance running on this machine",
		instanceKind: "local",
		defaultUrl: DEFAULT_INSTANCE_URL,
	},
];

export function registerInstanceCommands(
	deps: CommandDeps,
): vscode.Disposable[] {
	const target = new CommandTarget(deps);
	const { services } = deps;

	return [
		vscode.commands.registerCommand("notploy.open", async () => {
			await vscode.commands.executeCommand(`${VIEW_IDS.instances}.focus`);
		}),

		vscode.commands.registerCommand("notploy.refresh", async () => {
			await runCommand(deps, "Notploy: Refresh", async () => {
				services.projects.invalidate();
				services.deployments.invalidate();
				services.infrastructure.invalidate();
				deps.refresh();
				await services.instances.checkAll();
				deps.refresh();
			});
		}),

		vscode.commands.registerCommand("notploy.instance.add", async () => {
			await runCommand(deps, "Notploy: Add Instance", async () => {
				const kindChoice = await vscode.window.showQuickPick(KIND_CHOICES, {
					placeHolder: "Which kind of Notploy instance?",
					ignoreFocusOut: true,
				});
				if (!kindChoice) return;

				const url = await promptText(
					"Notploy: Instance URL",
					"Base URL of the instance. Plain HTTP is fine on localhost or a private network; TLS certificates are always verified.",
					{
						value: kindChoice.defaultUrl,
						placeHolder: "https://notploy.example.com",
					},
				);
				if (!url) return;
				const normalized = normalizeInstanceUrl(url);
				if (!normalized) {
					void vscode.window.showErrorMessage(
						"That is not a valid URL. Expected something like https://notploy.example.com.",
					);
					return;
				}

				const existing = services.instances
					.list()
					.find((instance) => instance.url === normalized);
				if (existing) {
					void vscode.window.showInformationMessage(
						`An instance with this URL already exists: ${existing.name}.`,
					);
					return;
				}

				const name = await promptText(
					"Notploy: Instance name",
					"A short label used in the Notploy views.",
					{ value: suggestName(kindChoice, normalized) },
				);
				if (!name) return;

				const instance: NotployInstance = {
					id: `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
					name,
					url: normalized,
					label: kindChoice.instanceKind,
					allowInsecureTls: false,
					lastStatus: "unknown",
					hasCredential: false,
				};
				await services.store.add(instance);
				if (!services.instances.active()) {
					await services.store.setActive(instance.id);
				}
				deps.refreshInstances();

				const connectNow = await vscode.window.showInformationMessage(
					`Instance "${name}" added.`,
					"Test Connection",
					"Login",
				);
				if (connectNow === "Test Connection") {
					await vscode.commands.executeCommand(
						"notploy.instance.testConnection",
					);
				} else if (connectNow === "Login") {
					await vscode.commands.executeCommand("notploy.login", instance.id);
				}
			});
		}),

		vscode.commands.registerCommand(
			"notploy.instance.remove",
			async (node?: InstanceNode) => {
				await runCommand(deps, "Notploy: Remove Instance", async () => {
					const instance =
						node?.instance ?? (await pickInstance(services.instances.list()));
					if (!instance) return;

					const confirmed = await confirmDestructive(
						`Remove the Notploy instance "${instance.name}"?`,
						`Its stored API key is deleted from VS Code secret storage. Projects and deployments on the server are not touched.`,
					);
					if (!confirmed) return;

					await services.store.remove(instance.id);
					services.instances.invalidate(instance.id);
					services.projects.invalidate();
					services.deployments.invalidate();
					services.infrastructure.invalidate();
					deps.refreshInstances();
					deps.refresh();
					void vscode.window.showInformationMessage(
						`Instance "${instance.name}" removed.`,
					);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.instance.select",
			async (node?: InstanceNode) => {
				await runCommand(deps, "Notploy: Select Instance", async () => {
					const instance =
						node?.instance ??
						(await pickInstance(services.instances.list(), {
							activeId: services.instances.active()?.id,
						}));
					if (!instance) return;
					await services.store.setActive(instance.id);
					services.instances.invalidate();
					services.projects.invalidate();
					services.deployments.invalidate();
					services.infrastructure.invalidate();
					deps.refreshInstances();
					deps.refresh();
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Notploy: checking ${instance.name}…`,
						},
						async () => {
							await services.instances.checkConnection(instance);
						},
					);
					deps.refreshInstances();
					deps.refresh();
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.instance.testConnection",
			async (node?: InstanceNode) => {
				await runCommand(deps, "Notploy: Test Connection", async () => {
					const instance =
						node?.instance ??
						(await pickInstance(services.instances.list(), {
							activeId: services.instances.active()?.id,
						}));
					if (!instance) {
						void vscode.window.showInformationMessage(
							"Add a Notploy instance first.",
						);
						return;
					}

					const result = await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Notploy: contacting ${instance.name}…`,
						},
						async () => await services.instances.checkConnection(instance),
					);
					deps.refreshInstances();

					if (result.status === "connected") {
						void vscode.window.showInformationMessage(
							`Connected to ${instance.name}${result.version ? ` (v${result.version})` : ""}.`,
						);
						return;
					}
					const message =
						result.error?.userMessage ??
						`${instance.name} answered but did not accept the stored credential.`;
					void vscode.window
						.showWarningMessage(message, "Login", "Show Logs")
						.then(async (choice) => {
							if (choice === "Login") {
								await vscode.commands.executeCommand(
									"notploy.login",
									instance.id,
								);
							} else if (choice === "Show Logs") {
								services.logger.show();
							}
						});
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.instance.openDashboard",
			async (node?: InstanceNode) => {
				await runCommand(deps, "Notploy: Open Dashboard", async () => {
					const instance = node?.instance ?? (await target.activeInstance());
					await openExternal(`${instance.url.replace(/\/+$/, "")}/dashboard`);
				});
			},
		),

		vscode.commands.registerCommand(
			"notploy.instance.showCapabilities",
			async (node?: InstanceNode) => {
				await runCommand(
					deps,
					"Notploy: Show Instance Capabilities",
					async () => {
						const instance =
							node?.instance ??
							(await pickInstance(services.instances.list(), {
								activeId: services.instances.active()?.id,
							}));
						if (!instance) return;
						const report = await services.instances.refreshCapabilities(
							instance.id,
						);
						services.logger.info(
							`Capabilities for ${instance.name}:\n${describeCapabilities(report)}`,
						);
						deps.refreshInstances();
						services.infrastructure.invalidate();
						deps.refresh();
						const choice = await vscode.window.showInformationMessage(
							describeCapabilities(report).split("\n")[0] ??
								"Capabilities read.",
							"Show Details",
						);
						if (choice === "Show Details") services.logger.show();
					},
				);
			},
		),

		vscode.commands.registerCommand("notploy.login", async (arg?: unknown) => {
			await runCommand(deps, "Notploy: Login", async () => {
				const instanceId =
					typeof arg === "string"
						? arg
						: (arg as InstanceNode | undefined)?.instance?.id;
				if (!instanceId && services.instances.list().length === 0) {
					void vscode.window.showInformationMessage(
						"Add a Notploy instance first with “Notploy: Add Instance”.",
					);
					return;
				}
				const result = await services.auth.login(instanceId);
				if (result.ok) {
					deps.refreshInstances();
					deps.refresh();
					void vscode.window.showInformationMessage(result.message);
					return;
				}
				// A rejected or missing key is only half a problem: the fix lives
				// on the dashboard, so offer the page that issues keys rather than
				// only logging the failure.
				const actions = ["Show Logs"];
				if (result.apiKeysUrl) actions.unshift("Open API Keys Page");
				void vscode.window
					.showWarningMessage(result.message, ...actions)
					.then(async (choice) => {
						if (choice === "Open API Keys Page" && result.apiKeysUrl) {
							await openExternal(result.apiKeysUrl);
						} else if (choice === "Show Logs") {
							services.logger.show();
						}
					});
			});
		}),

		vscode.commands.registerCommand("notploy.logout", async (arg?: unknown) => {
			await runCommand(deps, "Notploy: Logout", async () => {
				const instanceId =
					typeof arg === "string"
						? arg
						: (arg as InstanceNode | undefined)?.instance?.id;
				const instance =
					(instanceId ? services.instances.get(instanceId) : undefined) ??
					(await pickInstance(services.instances.list(), {
						activeId: services.instances.active()?.id,
						placeHolder: "Sign out of which instance?",
					}));
				if (!instance) return;
				await services.auth.logout(instance.id);
				services.projects.invalidate();
				services.deployments.invalidate();
				services.infrastructure.invalidate();
				deps.refreshInstances();
				deps.refresh();
				void vscode.window.showInformationMessage(
					`Signed out of ${instance.name}.`,
				);
			});
		}),

		vscode.commands.registerCommand("notploy.copyId", async (arg?: unknown) => {
			await runCommand(deps, "Notploy: Copy ID", async () => {
				const id = idFromNode(arg);
				if (!id) {
					void vscode.window.showInformationMessage(
						"Select a project, environment, application or deployment first.",
					);
					return;
				}
				await copyToClipboard(id, "ID");
			});
		}),
	];
}

function idFromNode(arg: unknown): string | undefined {
	const node = arg as {
		project?: { projectId?: string };
		environment?: { environmentId?: string };
		application?: { applicationId?: string };
		deployment?: { deploymentId?: string };
		server?: { serverId?: string };
		node?: { ID?: string };
	} | null;
	if (!node) return undefined;
	return (
		node.deployment?.deploymentId ??
		node.application?.applicationId ??
		node.environment?.environmentId ??
		node.project?.projectId ??
		node.server?.serverId ??
		node.node?.ID
	);
}

function suggestName(choice: KindChoice, url: string): string {
	if (choice.instanceKind === "cloud") return "Notploy Cloud";
	if (choice.instanceKind === "local") return "Local";
	try {
		return new URL(url).hostname;
	} catch {
		return "Self-hosted";
	}
}
