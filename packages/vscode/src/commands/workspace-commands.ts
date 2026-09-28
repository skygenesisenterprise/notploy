import * as vscode from "vscode";
import { MANIFEST_FILENAMES } from "../services/workspace-service";
import {
	applicationPickable,
	confirmDestructive,
	pickFrom,
} from "../ui/pickers";
import { type CommandDeps, openExternal, runCommand } from "./helpers";

/**
 * Workspace linking.
 *
 * The binding lives in `workspaceState` and can optionally be written to a
 * `notploy.yaml` manifest so a team shares it. Nothing here creates resources
 * on the server: connecting to an existing project is what the extension
 * promises, and creating one is a dashboard action.
 */
export function registerWorkspaceCommands(
	deps: CommandDeps,
): vscode.Disposable[] {
	const { services } = deps;

	return [
		vscode.commands.registerCommand("notploy.workspace.bind", async () => {
			await runCommand(
				deps,
				"Notploy: Create / Connect Notploy Project",
				async () => {
					if (!services.workspace.workspaceRoot()) {
						void vscode.window.showInformationMessage(
							"Open a folder before linking it to a Notploy project.",
						);
						return;
					}
					const instance = services.instances.active();
					if (!instance) {
						void vscode.window.showInformationMessage(
							"Add a Notploy instance first with “Notploy: Add Instance”.",
						);
						return;
					}

					const { projects } = await services.projects.model(true);
					if (projects.length === 0) {
						const choice = await vscode.window.showInformationMessage(
							`No project exists on ${instance.name} yet. Create one in the Notploy dashboard, then link it here.`,
							"Open Dashboard",
						);
						if (choice === "Open Dashboard") {
							await openExternal(
								`${instance.url.replace(/\/+$/, "")}/dashboard`,
							);
						}
						return;
					}

					const project = await pickFrom(
						projects,
						(entry) => ({
							label: entry.name,
							description: `${entry.environments?.length ?? 0} environment(s)`,
							detail: entry.projectId,
						}),
						"Link this workspace to which project?",
					);
					if (!project) return;

					const environments = project.environments ?? [];
					const environment = environments.length
						? await pickFrom(
								environments,
								(entry) => ({
									label: entry.name,
									description: entry.isDefault ? "default" : undefined,
									detail: entry.environmentId,
								}),
								"Which environment?",
							)
						: undefined;
					if (environments.length > 0 && !environment) return;

					const applications = environment?.applications ?? [];
					const application = applications.length
						? await pickFrom(
								applications,
								applicationPickable,
								"Link to which application? (optional — press Escape to skip)",
							)
						: undefined;

					await services.workspace.setBinding({
						instanceId: instance.id,
						projectId: project.projectId,
						projectName: project.name,
						environmentId: environment?.environmentId,
						environmentName: environment?.name,
						applicationId: application?.applicationId,
						applicationName: application?.name,
						source: "user",
					});

					const existingManifest = await services.workspace.detectManifest();
					if (!existingManifest) {
						const writeManifest = await vscode.window.showInformationMessage(
							"Workspace linked for this window.",
							`Also write ${MANIFEST_FILENAMES[0]}?`,
						);
						if (writeManifest === `Also write ${MANIFEST_FILENAMES[0]}?`) {
							await writeManifestFile(deps, {
								instance: instance.name,
								project: project.name,
								environment: environment?.name,
								application: application?.name,
							});
						}
					}

					deps.refresh();
					void vscode.window.showInformationMessage(
						`Workspace linked to ${project.name}${environment ? ` / ${environment.name}` : ""}.`,
					);
				},
			);
		}),

		vscode.commands.registerCommand("notploy.workspace.unbind", async () => {
			await runCommand(deps, "Notploy: Unlink Workspace Project", async () => {
				const binding = services.workspace.storedBinding();
				if (!binding) {
					void vscode.window.showInformationMessage(
						"This workspace is not linked to a Notploy project.",
					);
					return;
				}
				const confirmed = await confirmDestructive(
					"Unlink this workspace from its Notploy project?",
					"Only the local link is removed; nothing on the server changes.",
				);
				if (!confirmed) return;
				await services.workspace.clearBinding();
				deps.refresh();
				void vscode.window.showInformationMessage("Workspace unlinked.");
			});
		}),

		vscode.commands.registerCommand("notploy.workspace.showInfo", async () => {
			await runCommand(deps, "Notploy: Show Workspace Info", async () => {
				const snapshot = await services.workspace.snapshot();
				const lines: string[] = [];
				lines.push(`Folder: ${snapshot.root ?? "(none)"}`);
				if (snapshot.git) {
					lines.push(
						`Repository: ${snapshot.git.slug ?? snapshot.git.repositoryRoot}`,
					);
					lines.push(`Branch: ${snapshot.git.branch ?? "detached"}`);
					lines.push(`Commit: ${snapshot.git.commit ?? "unknown"}`);
				} else {
					lines.push("Repository: none detected");
				}
				lines.push(`Manifest: ${snapshot.manifest?.relativePath ?? "none"}`);
				const binding = snapshot.binding;
				lines.push(
					`Binding: ${
						binding?.projectId
							? `${binding.projectName ?? binding.projectId}${
									binding.environmentName ? ` / ${binding.environmentName}` : ""
								}${binding.applicationName ? ` / ${binding.applicationName}` : ""} (via ${binding.source})`
							: "none"
					}`,
				);
				if (snapshot.deployHints.length > 0) {
					lines.push(`Deployable files: ${snapshot.deployHints.join(", ")}`);
				}
				services.logger.info("Workspace information", ...lines);
				const choice = await vscode.window.showInformationMessage(
					lines.join(" · "),
					"Show Logs",
				);
				if (choice === "Show Logs") services.logger.show();
			});
		}),
	];
}

interface ManifestInput {
	instance: string;
	project: string;
	environment?: string;
	application?: string;
}

/** Writes `notploy.yaml` at the workspace root. */
export async function writeManifestFile(
	deps: CommandDeps,
	input: ManifestInput,
): Promise<vscode.Uri | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) return undefined;

	const lines = [
		"# Notploy workspace manifest.",
		"# It binds this folder to an existing Notploy project; it is not a deployment format.",
		"version: 1",
		`instance: ${quote(input.instance)}`,
		`project: ${quote(input.project)}`,
	];
	if (input.environment) lines.push(`environment: ${quote(input.environment)}`);
	if (input.application) lines.push(`application: ${quote(input.application)}`);
	lines.push("");

	const uri = vscode.Uri.joinPath(folder.uri, MANIFEST_FILENAMES[0]);
	await vscode.workspace.fs.writeFile(
		uri,
		Buffer.from(lines.join("\n"), "utf8"),
	);
	deps.services.logger.info(`Wrote ${MANIFEST_FILENAMES[0]}`);
	return uri;
}

function quote(value: string): string {
	return `"${value.replace(/"/g, '\\"')}"`;
}
