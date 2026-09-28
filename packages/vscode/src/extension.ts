import * as vscode from "vscode";
import { type CommandDeps, registerCommandHandlers } from "./commands";
import { VIEW_IDS } from "./core/constants";
import { InstanceStore } from "./core/instance-store";
import { Logger } from "./core/logger";
import { AuthenticationService } from "./services/authentication-service";
import type { Services } from "./services/container";
import { DeploymentService } from "./services/deployment-service";
import { InfrastructureService } from "./services/infrastructure-service";
import { InstanceManager } from "./services/instance-manager";
import { LogService } from "./services/log-service";
import { ProjectService } from "./services/project-service";
import { WorkspaceService } from "./services/workspace-service";
import { NotployStatusBar } from "./ui/status-bar";
import { DeploymentsTreeProvider } from "./ui/trees/deployments-tree";
import { InfrastructureTreeProvider } from "./ui/trees/infrastructure-tree";
import { InstancesTreeProvider } from "./ui/trees/instances-tree";
import { ProjectsTreeProvider } from "./ui/trees/projects-tree";
import {
	refreshAllViews,
	refreshDataViews,
	type TreeRegistry,
} from "./ui/trees/registry";
import { WorkspaceTreeProvider } from "./ui/trees/workspace-tree";

let activeRefreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): {
	dispose: () => void;
} {
	const logger = new Logger();
	context.subscriptions.push(logger);
	logger.info("Activating Notploy extension.");

	const store = new InstanceStore(context, logger);
	context.subscriptions.push(store);

	const instances = new InstanceManager(store, logger);
	const projects = new ProjectService(instances);
	const deployments = new DeploymentService(instances, projects, logger);
	const infrastructure = new InfrastructureService(instances, logger);
	const workspace = new WorkspaceService(context, logger);
	const logs = new LogService(logger);
	const auth = new AuthenticationService(instances, store, logger);

	const services: Services = {
		logger,
		store,
		instances,
		auth,
		projects,
		deployments,
		infrastructure,
		workspace,
		logs,
	};

	const trees: TreeRegistry = {
		instances: new InstancesTreeProvider(logger, services.instances),
		projects: new ProjectsTreeProvider(
			logger,
			services.projects,
			services.deployments,
		),
		deployments: new DeploymentsTreeProvider(
			logger,
			services.projects,
			services.deployments,
		),
		infrastructure: new InfrastructureTreeProvider(
			logger,
			services.instances,
			services.infrastructure,
		),
		workspace: new WorkspaceTreeProvider(
			logger,
			services.instances,
			services.workspace,
			services.deployments,
		),
	};

	context.subscriptions.push(
		vscode.window.createTreeView(VIEW_IDS.instances, {
			treeDataProvider: trees.instances,
			showCollapseAll: false,
		}),
		vscode.window.createTreeView(VIEW_IDS.projects, {
			treeDataProvider: trees.projects,
			showCollapseAll: true,
		}),
		vscode.window.createTreeView(VIEW_IDS.deployments, {
			treeDataProvider: trees.deployments,
			showCollapseAll: true,
		}),
		vscode.window.createTreeView(VIEW_IDS.infrastructure, {
			treeDataProvider: trees.infrastructure,
			showCollapseAll: true,
		}),
		vscode.window.createTreeView(VIEW_IDS.workspace, {
			treeDataProvider: trees.workspace,
			showCollapseAll: false,
		}),
	);
	context.subscriptions.push(
		trees.instances,
		trees.projects,
		trees.deployments,
		trees.infrastructure,
		trees.workspace,
	);

	const statusBar = new NotployStatusBar(services.instances);
	context.subscriptions.push(statusBar);

	const deps: CommandDeps = {
		services,
		refresh: (element) => refreshDataViews(trees, element),
		refreshInstances: () => trees.instances.refresh(),
	};
	context.subscriptions.push(registerCommandHandlers(deps));

	// Instance or connection state changed: keep the status bar and views honest.
	context.subscriptions.push(
		services.instances.onDidChange(() => {
			statusBar.update();
		}),
		store.onDidChange(() => {
			statusBar.update();
			refreshAllViews(trees);
		}),
	);

	// Configuration changes invalidate cached clients (timeout) and views.
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration("notploy")) return;
			services.instances.invalidate();
			services.projects.invalidate();
			services.deployments.invalidate();
			services.infrastructure.invalidate();
			restartAutoRefresh(services, trees);
			statusBar.update();
			refreshAllViews(trees);
			void checkActiveInstanceInBackground(services);
		}),
	);

	// Manifests can be created or edited outside VS Code.
	const manifestWatcher = vscode.workspace.createFileSystemWatcher(
		"**/{notploy.json,notploy.yaml,notploy.yml}",
	);
	context.subscriptions.push(
		manifestWatcher,
		manifestWatcher.onDidCreate(() => trees.workspace.refresh()),
		manifestWatcher.onDidChange(() => trees.workspace.refresh()),
		manifestWatcher.onDidDelete(() => trees.workspace.refresh()),
	);

	restartAutoRefresh(services, trees);

	// Startup work is deliberately off the critical path: the extension is
	// activated on `onStartupFinished`, and a slow or unreachable instance must
	// not delay the window.
	void bootstrap(services, trees, statusBar);

	return {
		dispose: () => {
			if (activeRefreshTimer) clearInterval(activeRefreshTimer);
			activeRefreshTimer = undefined;
		},
	};
}

export function deactivate(): void {
	if (activeRefreshTimer) clearInterval(activeRefreshTimer);
	activeRefreshTimer = undefined;
}

async function bootstrap(
	services: Services,
	trees: TreeRegistry,
	statusBar: NotployStatusBar,
): Promise<void> {
	try {
		await services.store.syncCredentialFlags();
		statusBar.update();
		trees.instances.refresh();
		refreshDataViews(trees);
		await checkActiveInstanceInBackground(services);
		trees.instances.refresh();
		refreshDataViews(trees);
		statusBar.update();
	} catch (error) {
		services.logger.error("Notploy bootstrap failed", error);
	}
}

async function checkActiveInstanceInBackground(
	services: Services,
): Promise<void> {
	const active = services.instances.active();
	if (!active) return;
	// An unreachable instance is normal (offline, VPN down); the status bar
	// reports it and the user keeps working. Only the active instance is
	// checked automatically, never every configured instance.
	await services.instances.checkConnection(active).catch(() => undefined);
}

/**
 * Background polling is opt-in (`notploy.autoRefreshInterval`, default 0) so the
 * extension never hammers an instance the user is not looking at.
 */
function restartAutoRefresh(services: Services, trees: TreeRegistry): void {
	if (activeRefreshTimer) {
		clearInterval(activeRefreshTimer);
		activeRefreshTimer = undefined;
	}
	const seconds = vscode.workspace
		.getConfiguration("notploy")
		.get<number>("autoRefreshInterval", 0);
	if (!Number.isFinite(seconds) || seconds <= 0) return;

	activeRefreshTimer = setInterval(() => {
		services.projects.invalidate();
		services.deployments.invalidate();
		services.infrastructure.invalidate();
		refreshDataViews(trees);
	}, Math.min(seconds, 3600) * 1_000);
}
