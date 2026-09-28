import * as vscode from "vscode";
import type {
	ApplicationSummary,
	Deployment,
	NotployInstance,
} from "../core/domain";
import { isNotployError, NotployError, notConfigured } from "../core/errors";
import type { Services } from "../services/container";
import {
	ApplicationNode,
	DeploymentApplicationNode,
	DeploymentNode,
	EnvironmentNode,
	type NotployNode,
	ProjectNode,
} from "../ui/nodes";
import {
	applicationPickable,
	deploymentPickable,
	pickFrom,
} from "../ui/pickers";

export interface CommandDeps {
	services: Services;
	refresh(element?: NotployNode): void;
	refreshInstances(): void;
}

/**
 * Everything a command needs when it is triggered from a context menu, plus the
 * fallbacks used when it comes from the Command Palette with no node.
 */
export class CommandTarget {
	private readonly deps: CommandDeps;

	constructor(deps: CommandDeps) {
		this.deps = deps;
	}

	async activeInstance(): Promise<NotployInstance> {
		const instance = this.deps.services.instances.active();
		if (!instance) throw notConfigured();
		return instance;
	}

	/** Instance origin (no `/api`), used to build dashboard links. */
	async origin(): Promise<string> {
		return (await this.activeInstance()).url;
	}

	/** An application id from a node, or a quick pick of every application. */
	async applicationId(
		arg: unknown,
		options: { placeHolder?: string } = {},
	): Promise<ApplicationSummary | undefined> {
		const fromNode = applicationFromNode(arg);
		if (fromNode) return fromNode;

		const applications = await this.deps.services.projects.allApplications();
		if (applications.length === 0) {
			await vscode.window.showInformationMessage(
				"No application found on this instance.",
			);
			return undefined;
		}
		return await pickFrom(
			applications,
			applicationPickable,
			options.placeHolder ?? "Select an application",
		);
	}

	/** Candidates for an environment or project node. */
	async applicationsForNode(arg: unknown): Promise<ApplicationSummary[]> {
		if (arg instanceof EnvironmentNode) {
			return arg.environment.applications ?? [];
		}
		if (arg instanceof ProjectNode) {
			const applications: ApplicationSummary[] = [];
			for (const environment of arg.project.environments ?? []) {
				applications.push(...(environment.applications ?? []));
			}
			return applications;
		}
		const single = applicationFromNode(arg);
		return single ? [single] : [];
	}

	async deploymentId(arg: unknown): Promise<Deployment | undefined> {
		if (arg instanceof DeploymentNode) return arg.deployment;
		const deployments = await this.deps.services.deployments.deployments();
		if (deployments.length === 0) {
			await vscode.window.showInformationMessage(
				"No deployment found on this instance.",
			);
			return undefined;
		}
		return await pickFrom(
			deployments,
			deploymentPickable,
			"Select a deployment",
		);
	}

	instance(): NotployInstance | undefined {
		return this.deps.services.instances.active();
	}

	refresh(element?: NotployNode): void {
		this.deps.refresh(element);
	}

	refreshInstances(): void {
		this.deps.refreshInstances();
	}
}

function applicationFromNode(arg: unknown): ApplicationSummary | undefined {
	if (arg instanceof ApplicationNode) return arg.application;
	if (arg instanceof DeploymentApplicationNode) return arg.application;
	return undefined;
}

/**
 * Runs a command body, turning any failure into a readable notification.
 * Stack traces only ever reach the Notploy (Debug) output channel.
 */
export async function runCommand(
	deps: CommandDeps,
	label: string,
	body: () => Promise<void>,
): Promise<void> {
	try {
		await body();
	} catch (error) {
		const notployError: NotployError = isNotployError(error)
			? error
			: new NotployError({
					code: "unknown",
					userMessage: `“${label}” failed. See the Notploy output channel for details.`,
					cause: error,
				});
		deps.services.logger.error(`Command ${label} failed`, error);
		const actions = notployError.isRetryable ? ["Show Logs"] : ["Show Logs"];
		const choice = await vscode.window.showErrorMessage(
			notployError.userMessage,
			...actions,
		);
		if (choice === "Show Logs") {
			deps.services.logger.show();
		}
	}
}

/** Runs a mutation with a progress notification and a success toast. */
export async function withFeedback(
	message: string,
	task: () => Promise<void>,
	successMessage?: string,
): Promise<void> {
	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: message },
		async () => {
			await task();
		},
	);
	if (successMessage) {
		void vscode.window.showInformationMessage(successMessage);
	}
}

/** Opens a URL in the default browser. Never used for API keys. */
export async function openExternal(url: string): Promise<void> {
	await vscode.env.openExternal(vscode.Uri.parse(url));
}

export async function copyToClipboard(
	value: string,
	label: string,
): Promise<void> {
	await vscode.env.clipboard.writeText(value);
	void vscode.window.showInformationMessage(
		`${label} copied to the clipboard.`,
	);
}
