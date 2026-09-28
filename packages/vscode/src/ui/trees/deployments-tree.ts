import type { Deployment } from "../../core/domain";
import { relativeTime } from "../../core/formatting";
import type { Logger } from "../../core/logger";
import type {
	DeploymentService,
	DeployQueueRow,
} from "../../services/deployment-service";
import type { ProjectService } from "../../services/project-service";
import {
	DeploymentApplicationNode,
	DeploymentNode,
	MessageNode,
	type NotployNode,
} from "../nodes";
import { NotployTreeProvider } from "./base-tree";
import { deploymentHistoryLimit } from "./projects-tree";

/**
 * Deployments view.
 *
 * This is the operational view: one node per application, expanding into its
 * recent deployments, plus the deploy queue the instance reports through
 * `deployment.queueList`.
 */
export class DeploymentsTreeProvider extends NotployTreeProvider {
	constructor(
		logger: Logger,
		private readonly projects: ProjectService,
		private readonly deployments: DeploymentService,
	) {
		super(logger);
	}

	protected async loadRoots(): Promise<NotployNode[]> {
		const [entries, deployments] = await Promise.all([
			this.projects.applicationEntries(),
			this.deployments.deployments(),
		]);

		const byApplication = new Map<string, Deployment[]>();
		for (const deployment of deployments) {
			const applicationId =
				deployment.applicationId ?? deployment.application?.applicationId;
			if (!applicationId) continue;
			const bucket = byApplication.get(applicationId) ?? [];
			bucket.push(deployment);
			byApplication.set(applicationId, bucket);
		}

		const nodes: NotployNode[] = [
			new MessageNode("Queue", {
				icon: "list-ordered",
				children: () => this.loadQueue(),
			}),
		];

		if (entries.length === 0) {
			nodes.push(
				new MessageNode("No applications found.", {
					icon: "info",
					tooltip: "Create an application in the Notploy dashboard first.",
				}),
			);
			return nodes;
		}

		for (const entry of entries) {
			const history = byApplication.get(entry.application.applicationId) ?? [];
			nodes.push(
				new DeploymentApplicationNode(
					entry.project,
					entry.environment,
					entry.application,
					history,
					() =>
						this.loadApplicationDeployments(entry.application.applicationId),
				),
			);
		}
		return nodes;
	}

	private async loadApplicationDeployments(
		applicationId: string,
	): Promise<NotployNode[]> {
		let deployments: Deployment[] = [];
		try {
			// The cached list already holds every deployment; fall back to the
			// per-application endpoint only if it is empty.
			deployments = (await this.deployments.deployments()).filter(
				(entry) =>
					(entry.applicationId ?? entry.application?.applicationId) ===
					applicationId,
			);
			if (deployments.length === 0) {
				deployments = await this.deployments.history(
					applicationId,
					deploymentHistoryLimit(),
				);
			}
		} catch (error) {
			this.logger.debug("Deployment history unavailable", error);
		}

		if (deployments.length === 0) {
			return [new MessageNode("No deployments found.", { icon: "info" })];
		}
		return deployments
			.slice(0, deploymentHistoryLimit())
			.map((entry) => new DeploymentNode(entry));
	}

	private async loadQueue(): Promise<NotployNode[]> {
		let rows: DeployQueueRow[] = [];
		try {
			rows = await this.deployments.queue();
		} catch (error) {
			this.logger.debug("Deploy queue unavailable", error);
			return [
				new MessageNode("The deploy queue could not be read.", {
					icon: "warning",
					tooltip: "The credential may not have permission to read the queue.",
				}),
			];
		}

		if (rows.length === 0) {
			return [new MessageNode("The deploy queue is empty.", { icon: "check" })];
		}
		return rows.slice(0, 50).map((row) => queueNode(row));
	}
}

function queueNode(row: DeployQueueRow): NotployNode {
	const label = row.servicePath?.label ?? row.name ?? `Job ${row.id ?? "?"}`;
	const node = new MessageNode(label, {
		icon: stateIcon(row.state),
		description: [row.state, relativeTime(timestampToIso(row.timestamp))]
			.filter(Boolean)
			.join(" · "),
		tooltip: row.failedReason
			? `Failed: ${row.failedReason}`
			: `Queue id: ${row.id ?? "unknown"}`,
	});
	node.id = `queue:${row.id ?? label}`;
	return node;
}

function stateIcon(state: string | undefined): string {
	switch (state) {
		case "completed":
			return "pass-filled";
		case "failed":
			return "error";
		case "active":
			return "sync~spin";
		case "waiting":
		case "delayed":
			return "clock";
		default:
			return "circle-outline";
	}
}

function timestampToIso(timestamp: number | undefined): string | undefined {
	if (!timestamp || !Number.isFinite(timestamp)) return undefined;
	return new Date(timestamp).toISOString();
}
