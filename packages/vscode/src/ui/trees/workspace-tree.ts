import { CONTEXT } from "../../core/constants";
import { relativeTime, shorten } from "../../core/formatting";
import type { Logger } from "../../core/logger";
import type { DeploymentService } from "../../services/deployment-service";
import type { InstanceManager } from "../../services/instance-manager";
import type {
	WorkspaceService,
	WorkspaceSnapshot,
} from "../../services/workspace-service";
import { MessageNode, type NotployNode, WorkspaceBindingNode } from "../nodes";
import { NotployTreeProvider } from "./base-tree";

/**
 * Workspace view.
 *
 * Answers one question: which Notploy deployment does the folder open in VS Code
 * belong to? It reads the Git repository through the built-in Git extension and
 * an optional `notploy.yaml` / `notploy.yml` / `notploy.json` manifest. GitHub
 * is never required and never assumed.
 */
export class WorkspaceTreeProvider extends NotployTreeProvider {
	constructor(
		logger: Logger,
		private readonly instances: InstanceManager,
		private readonly workspace: WorkspaceService,
		private readonly deployments: DeploymentService,
	) {
		super(logger);
	}

	protected async loadRoots(): Promise<NotployNode[]> {
		const root = this.workspace.workspaceRoot();
		if (!root) {
			return [
				new MessageNode("No folder is open in this window.", {
					icon: "info",
					tooltip: "Open a folder to link it to a Notploy project.",
				}),
			];
		}

		const snapshot = await this.workspace.snapshot();
		const nodes: NotployNode[] = [repositoryNode(snapshot)];

		if (snapshot.git?.branch) {
			nodes.push(
				new WorkspaceBindingNode("Branch", snapshot.git.branch, {
					icon: "git-branch",
					tooltip: snapshot.git.commit
						? `Commit: ${snapshot.git.commit}`
						: undefined,
				}),
			);
		}

		nodes.push(manifestNode(snapshot));
		nodes.push(bindingNode(snapshot));
		nodes.push(
			new MessageNode("Deployments matching this repository", {
				icon: "rocket",
				children: () => this.loadMatches(snapshot),
			}),
		);

		if (snapshot.deployHints.length > 0) {
			nodes.push(
				new MessageNode("Deployable files detected", {
					icon: "check",
					description: snapshot.deployHints.join(", "),
					tooltip:
						"These files do not identify a Notploy project by themselves; they only indicate the folder can be deployed.",
				}),
			);
		}

		return nodes;
	}

	private async loadMatches(
		snapshot: WorkspaceSnapshot,
	): Promise<NotployNode[]> {
		if (!this.instances.active()) {
			return [
				new MessageNode("No instance selected.", {
					icon: "info",
					tooltip: "Run “Notploy: Select Instance” first.",
				}),
			];
		}
		const matches = await this.deployments.matchApplicationsForRepository(
			snapshot.git,
		);
		if (matches.length === 0) {
			return [
				new MessageNode("No Notploy application deploys this repository yet.", {
					icon: "info",
					tooltip:
						"Link the workspace with “Notploy: Create / Connect Notploy Project”, or create the application from the Notploy dashboard.",
				}),
			];
		}
		return matches.map((match) => {
			const node = new WorkspaceBindingNode(
				match.application.name,
				[
					match.projectName,
					match.environmentName,
					relativeTime(match.deployment.createdAt),
				]
					.filter(Boolean)
					.join(" · "),
				{
					icon: "rocket",
					contextValue: CONTEXT.deploymentApplication,
					tooltip: `Deployment ${match.deployment.deploymentId}`,
				},
			);
			node.id = `workspace-match:${match.application.applicationId}`;
			return node;
		});
	}
}

function repositoryNode(snapshot: WorkspaceSnapshot): NotployNode {
	const label = snapshot.git?.slug ?? folderName(snapshot.root ?? "");
	const node = new WorkspaceBindingNode(label, "repository", {
		icon: "repo",
		tooltip: snapshot.git
			? `Remote: ${snapshot.git.remoteUrl ?? "none"}`
			: "No Git repository detected. Notploy does not require Git to be hosted on GitHub.",
	});
	node.id = "workspace:repository";
	return node;
}

function manifestNode(snapshot: WorkspaceSnapshot): NotployNode {
	if (snapshot.manifest) {
		const node = new WorkspaceBindingNode(
			snapshot.manifest.relativePath,
			[
				snapshot.manifest.manifest.project,
				snapshot.manifest.manifest.environment,
				snapshot.manifest.manifest.application,
			]
				.filter(Boolean)
				.join(" · ") || "no target defined",
			{
				icon: "file-code",
				tooltip:
					"Workspace manifest. It only binds this folder to an existing Notploy project — it is not a deployment format understood by the server.",
			},
		);
		node.id = "workspace:manifest";
		return node;
	}
	return new WorkspaceBindingNode("No notploy.yaml manifest", undefined, {
		icon: "file",
		tooltip:
			"Optional. Add notploy.yaml (or notploy.json) to bind this folder to a project, or use “Notploy: Create / Connect Notploy Project”.",
	});
}

function bindingNode(snapshot: WorkspaceSnapshot): NotployNode {
	const binding = snapshot.binding;
	if (!binding?.projectId) {
		return new WorkspaceBindingNode(
			"Not linked to a Notploy project",
			undefined,
			{
				icon: "link",
				tooltip: "Run “Notploy: Create / Connect Notploy Project”.",
			},
		);
	}
	const node = new WorkspaceBindingNode(
		binding.projectName ?? binding.projectId,
		[binding.environmentName, binding.applicationName]
			.filter(Boolean)
			.join(" · ") || binding.source,
		{
			icon: "link",
			contextValue: CONTEXT.workspaceBinding,
			tooltip: shorten(
				`Linked via ${binding.source}${binding.manifestPath ? ` (${binding.manifestPath})` : ""}`,
				200,
			),
		},
	);
	node.id = "workspace:binding";
	return node;
}

function folderName(root: string): string {
	const parts = root.replace(/[\\/]+$/, "").split(/[\\/]/);
	return parts[parts.length - 1] || root;
}
