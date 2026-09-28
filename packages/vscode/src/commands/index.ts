import * as vscode from "vscode";
import { registerDeploymentCommands } from "./deployment-commands";
import type { CommandDeps } from "./helpers";
import { registerInfrastructureCommands } from "./infrastructure-commands";
import { registerInstanceCommands } from "./instance-commands";
import { registerProjectCommands } from "./project-commands";
import { registerWorkspaceCommands } from "./workspace-commands";

export { resolveLogTarget } from "./deployment-commands";
export type { CommandDeps } from "./helpers";
export { CommandTarget, runCommand, withFeedback } from "./helpers";
export { dashboardForNode } from "./project-commands";

/** Registers every Notploy command. Returns one disposable for all of them. */
export function registerCommandHandlers(deps: CommandDeps): vscode.Disposable {
	return vscode.Disposable.from(
		...registerInstanceCommands(deps),
		...registerProjectCommands(deps),
		...registerDeploymentCommands(deps),
		...registerInfrastructureCommands(deps),
		...registerWorkspaceCommands(deps),
	);
}
