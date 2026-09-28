import * as vscode from "vscode";
import { CONTEXT } from "../core/constants";
import type {
	ApplicationStatus,
	ApplicationSummary,
	Deployment,
	DockerContainer,
	DockerImage,
	DockerNetwork,
	DockerVolume,
	EnvironmentSummary,
	InstanceCapabilities,
	NotployInstance,
	NotployServer,
	ProjectSummary,
	SwarmNode,
} from "../core/domain";
import type { NotployError } from "../core/errors";
import {
	absoluteTime,
	applicationStatusIcon,
	applicationStatusLabel,
	type connectionStatusIcon,
	connectionStatusLabel,
	dashboardUrl,
	deploymentStatusIcon,
	deploymentStatusLabel,
	projectDashboardUrl,
	relativeTime,
	shorten,
} from "../core/formatting";

/**
 * Every tree item in the extension is a {@link NotployNode}.
 *
 * A node owns its children loader, which keeps the TreeDataProviders down to a
 * few lines each and makes lazy loading the default: a node that has never been
 * expanded has never caused a request.
 */
export class NotployNode extends vscode.TreeItem {
	loadChildren?: () => Promise<NotployNode[]>;
	/** Extra context appended to `contextValue`, e.g. `running`. */
	contextSuffix?: string;

	setContextValue(value: string): this {
		this.contextValue = this.contextSuffix
			? `${value}.${this.contextSuffix}`
			: value;
		return this;
	}

	setChildren(loader: () => Promise<NotployNode[]>): this {
		this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		this.loadChildren = loader;
		return this;
	}
}

/** A non-interactive line: empty states, section headers, hints. */
export class MessageNode extends NotployNode {
	constructor(
		label: string,
		options: {
			icon?: string;
			tooltip?: string;
			description?: string;
			contextValue?: string;
			children?: () => Promise<NotployNode[]>;
		} = {},
	) {
		super(
			label,
			options.children
				? vscode.TreeItemCollapsibleState.Collapsed
				: vscode.TreeItemCollapsibleState.None,
		);
		this.contextValue = options.contextValue ?? CONTEXT.info;
		if (options.description) this.description = options.description;
		if (options.icon) {
			this.iconPath = new vscode.ThemeIcon(options.icon);
		}
		if (options.tooltip) {
			this.tooltip = options.tooltip;
		}
		if (options.children) {
			this.loadChildren = options.children;
		}
	}
}

/** A failed load, rendered in place of the children it could not produce. */
export class ErrorNode extends NotployNode {
	readonly error: NotployError;

	constructor(error: NotployError) {
		super("Could not load", vscode.TreeItemCollapsibleState.None);
		this.error = error;
		this.contextValue = "notploy.error";
		this.iconPath = new vscode.ThemeIcon(
			"warning",
			new vscode.ThemeColor("charts.yellow"),
		);
		this.description = shorten(error.userMessage, 80);
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${escapeMarkdown(error.userMessage)}**\n\n`);
		if (error.detail) {
			tooltip.appendMarkdown(`\`${escapeMarkdown(error.detail)}\`\n\n`);
		}
		tooltip.appendMarkdown("Run **Notploy: Refresh** to try again.");
		this.tooltip = tooltip;
	}
}

export class LoadingNode extends NotployNode {
	constructor(label = "Loading…") {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.contextValue = CONTEXT.info;
		this.iconPath = new vscode.ThemeIcon("loading~spin");
	}
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

export class InstanceNode extends NotployNode {
	readonly instance: NotployInstance;

	constructor(
		instance: NotployInstance,
		options: {
			active: boolean;
			status: ReturnType<typeof connectionStatusIcon>;
		},
		onExpand: () => Promise<NotployNode[]>,
	) {
		super(instance.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.instance = instance;
		this.id = `instance:${instance.id}`;
		this.resourceUri = vscode.Uri.parse(instance.url);
		this.description = buildInstanceDescription(instance, options.active);
		this.iconPath = new vscode.ThemeIcon(
			options.status.id,
			options.status.color
				? new vscode.ThemeColor(options.status.color)
				: undefined,
		);
		this.contextValue = CONTEXT.instance;
		if (instance.hasCredential) {
			this.contextSuffix = "authenticated";
			this.setContextValue(CONTEXT.instance);
		} else {
			this.contextValue = CONTEXT.instance;
		}
		this.tooltip = buildInstanceTooltip(instance, options.active);
		this.loadChildren = onExpand;
	}
}

function buildInstanceDescription(
	instance: NotployInstance,
	active: boolean,
): string {
	const parts: string[] = [];
	if (active) parts.push("active");
	const status = connectionStatusLabel(instance.lastStatus);
	if (status !== "Not checked") parts.push(status.toLowerCase());
	if (instance.version) parts.push(`v${instance.version}`);
	return parts.join(" · ");
}

function buildInstanceTooltip(
	instance: NotployInstance,
	active: boolean,
): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(
		`**${escapeMarkdown(instance.name)}**${active ? " (active)" : ""}\n\n`,
	);
	tooltip.appendMarkdown(`URL: \`${escapeMarkdown(instance.url)}\`\n\n`);
	tooltip.appendMarkdown(
		`Credential: ${instance.hasCredential ? "stored in secret storage" : "none"}\n\n`,
	);
	tooltip.appendMarkdown(
		`Connection: ${connectionStatusLabel(instance.lastStatus)}\n\n`,
	);
	if (instance.version) {
		tooltip.appendMarkdown(
			`Version: \`${escapeMarkdown(instance.version)}\`\n\n`,
		);
	}
	if (instance.cloud !== undefined) {
		tooltip.appendMarkdown(
			`Managed Cloud: ${instance.cloud ? "yes" : "no"}\n\n`,
		);
	}
	if (instance.capabilities) {
		tooltip.appendMarkdown(
			`\nCapabilities: ${describeCapabilityFlags(instance.capabilities)}`,
		);
	}
	return tooltip;
}

function describeCapabilityFlags(capabilities: InstanceCapabilities): string {
	return Object.entries(capabilities)
		.map(([name, enabled]) => `${enabled ? "✓" : "✗"} ${name}`)
		.join(" · ");
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export class ProjectNode extends NotployNode {
	readonly project: ProjectSummary;

	constructor(project: ProjectSummary, onExpand: () => Promise<NotployNode[]>) {
		super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.project = project;
		this.id = `project:${project.projectId}`;
		this.iconPath = new vscode.ThemeIcon("project");
		this.contextValue = CONTEXT.project;
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${escapeMarkdown(project.name)}**\n\n`);
		if (project.description) {
			tooltip.appendMarkdown(`${escapeMarkdown(project.description)}\n\n`);
		}
		tooltip.appendMarkdown(`\`${project.projectId}\`\n\n`);
		tooltip.appendMarkdown(`Created ${relativeTime(project.createdAt)}`);
		this.tooltip = tooltip;
		this.loadChildren = onExpand;
	}
}

export class EnvironmentNode extends NotployNode {
	readonly project: ProjectSummary;
	readonly environment: EnvironmentSummary;

	constructor(
		project: ProjectSummary,
		environment: EnvironmentSummary,
		onExpand: () => Promise<NotployNode[]>,
	) {
		super(environment.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.project = project;
		this.environment = environment;
		this.id = `environment:${environment.environmentId}`;
		this.iconPath = new vscode.ThemeIcon("server-environment");
		this.contextValue = CONTEXT.environment;
		this.description = environment.isDefault ? "default" : undefined;
		this.tooltip = new vscode.MarkdownString(
			`**${escapeMarkdown(environment.name)}**  \n\`${environment.environmentId}\``,
		);
		this.loadChildren = onExpand;
	}
}

export class ApplicationNode extends NotployNode {
	readonly project: ProjectSummary;
	readonly environment: EnvironmentSummary;
	readonly application: ApplicationSummary;

	constructor(
		project: ProjectSummary,
		environment: EnvironmentSummary,
		application: ApplicationSummary,
		onExpand: () => Promise<NotployNode[]>,
	) {
		super(application.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.project = project;
		this.environment = environment;
		this.application = application;
		this.id = `application:${application.applicationId}`;
		this.applyStatus(application.applicationStatus);
		this.contextValue = CONTEXT.application;
		this.description = applicationStatusLabel(application.applicationStatus);
		this.tooltip = applicationTooltip(application, project, environment);
		this.loadChildren = onExpand;
	}

	protected applyStatus(status: ApplicationStatus | undefined): void {
		const icon = applicationStatusIcon(status);
		this.iconPath = new vscode.ThemeIcon(
			icon.id,
			icon.color ? new vscode.ThemeColor(icon.color) : undefined,
		);
	}
}

/** An application as listed in the Deployments view. */
export class DeploymentApplicationNode extends ApplicationNode {
	readonly deployments: Deployment[];

	constructor(
		project: ProjectSummary | undefined,
		environment: EnvironmentSummary | undefined,
		application: ApplicationSummary,
		deployments: Deployment[],
		onExpand: () => Promise<NotployNode[]>,
	) {
		super(
			project ?? EMPTY_PROJECT,
			environment ?? EMPTY_ENVIRONMENT,
			application,
			onExpand,
		);
		this.deployments = deployments;
		this.id = `deployment-application:${application.applicationId}`;
		this.contextValue = CONTEXT.deploymentApplication;
		const latest = deployments[0];
		this.description = latest
			? `${deploymentStatusLabel(latest.status)} · ${relativeTime(latest.createdAt)}`
			: "No deployments yet";
		if (latest) {
			const icon = deploymentStatusIcon(latest.status);
			this.iconPath = new vscode.ThemeIcon(
				icon.id,
				icon.color ? new vscode.ThemeColor(icon.color) : undefined,
			);
		}
	}
}

const EMPTY_PROJECT: ProjectSummary = { projectId: "", name: "" };
const EMPTY_ENVIRONMENT: EnvironmentSummary = { environmentId: "", name: "" };

function applicationTooltip(
	application: ApplicationSummary,
	project?: ProjectSummary,
	environment?: EnvironmentSummary,
): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(`**${escapeMarkdown(application.name)}**\n\n`);
	if (application.description) {
		tooltip.appendMarkdown(`${escapeMarkdown(application.description)}\n\n`);
	}
	if (project?.name)
		tooltip.appendMarkdown(`Project: ${escapeMarkdown(project.name)}\n\n`);
	if (environment?.name) {
		tooltip.appendMarkdown(
			`Environment: ${escapeMarkdown(environment.name)}\n\n`,
		);
	}
	if (application.appName) {
		tooltip.appendMarkdown(
			`App name: \`${escapeMarkdown(application.appName)}\`\n\n`,
		);
	}
	if (application.sourceType) {
		tooltip.appendMarkdown(
			`Source: \`${escapeMarkdown(application.sourceType)}\`\n\n`,
		);
	}
	tooltip.appendMarkdown(
		`Status: ${applicationStatusLabel(application.applicationStatus)}\n\n`,
	);
	tooltip.appendMarkdown(`\`${application.applicationId}\``);
	return tooltip;
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

export class DeploymentNode extends NotployNode {
	readonly deployment: Deployment;

	constructor(deployment: Deployment) {
		super(
			deployment.title || "Deployment",
			vscode.TreeItemCollapsibleState.None,
		);
		this.deployment = deployment;
		this.id = `deployment:${deployment.deploymentId}`;
		const icon = deploymentStatusIcon(deployment.status);
		this.iconPath = new vscode.ThemeIcon(
			icon.id,
			icon.color ? new vscode.ThemeColor(icon.color) : undefined,
		);
		this.contextValue = CONTEXT.deployment;
		if (deployment.status === "running") {
			this.contextSuffix = "running";
			this.setContextValue(CONTEXT.deployment);
		}
		this.description = `${deploymentStatusLabel(deployment.status)} · ${relativeTime(
			deployment.createdAt,
		)}`;
		this.tooltip = deploymentTooltip(deployment);
		this.command = {
			command: "notploy.viewLogs",
			title: "View Logs",
			arguments: [this],
		};
	}
}

function deploymentTooltip(deployment: Deployment): vscode.MarkdownString {
	const tooltip = new vscode.MarkdownString();
	tooltip.appendMarkdown(
		`**${escapeMarkdown(deployment.title || "Deployment")}**\n\n`,
	);
	tooltip.appendMarkdown(
		`Status: ${deploymentStatusLabel(deployment.status)}\n\n`,
	);
	tooltip.appendMarkdown(`Created: ${absoluteTime(deployment.createdAt)}\n\n`);
	if (deployment.startedAt) {
		tooltip.appendMarkdown(
			`Started: ${absoluteTime(deployment.startedAt)}\n\n`,
		);
	}
	if (deployment.finishedAt) {
		tooltip.appendMarkdown(
			`Finished: ${absoluteTime(deployment.finishedAt)}\n\n`,
		);
	}
	if (deployment.errorMessage) {
		tooltip.appendMarkdown(
			`Error: ${escapeMarkdown(deployment.errorMessage)}\n\n`,
		);
	}
	if (deployment.application?.name) {
		tooltip.appendMarkdown(
			`Application: ${escapeMarkdown(deployment.application.name)}\n\n`,
		);
	}
	if (deployment.server?.name) {
		tooltip.appendMarkdown(
			`Server: ${escapeMarkdown(deployment.server.name)}\n\n`,
		);
	}
	tooltip.appendMarkdown(`\`${deployment.deploymentId}\``);
	return tooltip;
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export class ServerNode extends NotployNode {
	readonly server: NotployServer;

	constructor(server: NotployServer, onExpand: () => Promise<NotployNode[]>) {
		super(server.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.server = server;
		this.id = `server:${server.serverId}`;
		this.iconPath = new vscode.ThemeIcon(
			server.serverType === "build" ? "tools" : "server",
		);
		this.contextValue = CONTEXT.server;
		this.description = [server.ipAddress, server.serverType]
			.filter(Boolean)
			.join(" · ");
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${escapeMarkdown(server.name)}**\n\n`);
		tooltip.appendMarkdown(
			`Address: \`${escapeMarkdown(server.ipAddress)}\`\n\n`,
		);
		if (server.description) {
			tooltip.appendMarkdown(`${escapeMarkdown(server.description)}\n\n`);
		}
		if (typeof server.totalSum === "number") {
			tooltip.appendMarkdown(`Services: ${server.totalSum}\n\n`);
		}
		tooltip.appendMarkdown(`\`${server.serverId}\``);
		this.tooltip = tooltip;
		this.loadChildren = onExpand;
	}
}

export class ContainerNode extends NotployNode {
	readonly container: DockerContainer;

	constructor(container: DockerContainer) {
		super(container.name, vscode.TreeItemCollapsibleState.None);
		this.container = container;
		this.id = `container:${container.serverId ?? "local"}:${container.containerId}`;
		const running = container.state.toLowerCase() === "running";
		this.iconPath = new vscode.ThemeIcon(
			running ? "vm-running" : "vm-outline",
			new vscode.ThemeColor(running ? "charts.green" : "descriptionForeground"),
		);
		this.contextValue = CONTEXT.dockerContainer;
		this.description = `${container.state} · ${shorten(container.image, 30)}`;
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${escapeMarkdown(container.name)}**\n\n`);
		tooltip.appendMarkdown(`Id: \`${container.containerId}\`\n\n`);
		tooltip.appendMarkdown(`Image: \`${escapeMarkdown(container.image)}\`\n\n`);
		if (container.ports) {
			tooltip.appendMarkdown(
				`Ports: \`${escapeMarkdown(container.ports)}\`\n\n`,
			);
		}
		tooltip.appendMarkdown(
			`Status: ${escapeMarkdown(container.status || container.state)}\n\n`,
		);
		tooltip.appendMarkdown(
			"Docker container logs are not exposed by the Notploy API.",
		);
		this.tooltip = tooltip;
	}
}

export class ImageNode extends NotployNode {
	readonly image: DockerImage;

	constructor(image: DockerImage) {
		super(
			`${image.Repository}:${image.Tag}`,
			vscode.TreeItemCollapsibleState.None,
		);
		this.image = image;
		this.id = `image:${image.ID}`;
		this.iconPath = new vscode.ThemeIcon("package");
		this.contextValue = CONTEXT.dockerImage;
		this.description = image.Size;
		this.tooltip = new vscode.MarkdownString(
			`**${escapeMarkdown(image.Repository)}:${escapeMarkdown(image.Tag)}**\n\n` +
				`Id: \`${image.ID}\`  \nSize: ${escapeMarkdown(image.Size)}  \nCreated: ${escapeMarkdown(image.CreatedSince || image.CreatedAt)}`,
		);
	}
}

export class VolumeNode extends NotployNode {
	readonly volume: DockerVolume;

	constructor(volume: DockerVolume) {
		super(volume.Name, vscode.TreeItemCollapsibleState.None);
		this.volume = volume;
		this.id = `volume:${volume.Name}`;
		this.iconPath = new vscode.ThemeIcon("database");
		this.contextValue = CONTEXT.dockerVolume;
		this.description = [volume.Driver, volume.Size].filter(Boolean).join(" · ");
		this.tooltip = new vscode.MarkdownString(
			`**${escapeMarkdown(volume.Name)}**\n\nDriver: \`${escapeMarkdown(volume.Driver)}\`  \nMountpoint: \`${escapeMarkdown(volume.Mountpoint)}\`` +
				(volume.Size ? `  \nSize: ${escapeMarkdown(volume.Size)}` : ""),
		);
	}
}

export class NetworkNode extends NotployNode {
	readonly network: DockerNetwork;

	constructor(network: DockerNetwork) {
		super(
			network.name ?? network.networkId ?? "network",
			vscode.TreeItemCollapsibleState.None,
		);
		this.network = network;
		this.id = `network:${network.networkId ?? network.name ?? "unknown"}`;
		this.iconPath = new vscode.ThemeIcon("plug");
		this.contextValue = CONTEXT.dockerNetwork;
		if (network.driver) this.description = network.driver;
	}
}

export class SwarmNodeItem extends NotployNode {
	readonly node: SwarmNode;

	constructor(node: SwarmNode) {
		const hostname = node.Description?.Hostname ?? node.ID;
		super(hostname, vscode.TreeItemCollapsibleState.None);
		this.node = node;
		this.id = `swarm:${node.ID}`;
		const state = node.Status?.State ?? "unknown";
		this.iconPath = new vscode.ThemeIcon(
			state === "ready" ? "pass" : "warning",
			new vscode.ThemeColor(
				state === "ready" ? "charts.green" : "charts.yellow",
			),
		);
		this.contextValue = CONTEXT.node;
		this.description = [node.Spec?.Role, state].filter(Boolean).join(" · ");
		this.tooltip = new vscode.MarkdownString(
			`**${escapeMarkdown(hostname)}**\n\nId: \`${node.ID}\`  \nRole: ${escapeMarkdown(node.Spec?.Role ?? "unknown")}  \nState: ${escapeMarkdown(state)}` +
				(node.Status?.Addr ? `  \nAddress: \`${node.Status.Addr}\`` : ""),
		);
	}
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export class WorkspaceBindingNode extends NotployNode {
	constructor(
		label: string,
		description: string | undefined,
		options: {
			icon: string;
			contextValue?: string;
			tooltip?: string | vscode.MarkdownString;
		},
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon(options.icon);
		this.contextValue = options.contextValue ?? CONTEXT.info;
		if (description) this.description = description;
		if (options.tooltip) this.tooltip = options.tooltip;
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function instanceUrl(instance: NotployInstance | undefined): string {
	return instance?.url ?? "";
}

export function openInBrowserCommand(url: string): vscode.Command {
	return {
		command: "vscode.open",
		title: "Open in Browser",
		arguments: [vscode.Uri.parse(url)],
	};
}

export { dashboardUrl, projectDashboardUrl };

export function escapeMarkdown(value: string): string {
	return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, (match) => `\\${match}`);
}
