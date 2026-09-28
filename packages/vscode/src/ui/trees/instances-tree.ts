import { CONTEXT } from "../../core/constants";
import type { NotployInstance } from "../../core/domain";
import {
	connectionStatusIcon,
	connectionStatusLabel,
	dashboardUrl,
} from "../../core/formatting";
import type { Logger } from "../../core/logger";
import type { InstanceManager } from "../../services/instance-manager";
import { InstanceNode, MessageNode, type NotployNode } from "../nodes";
import { NotployTreeProvider } from "./base-tree";

/**
 * The Instances view: one node per configured instance, each expanding into its
 * connection details and capability report.
 */
export class InstancesTreeProvider extends NotployTreeProvider {
	constructor(
		logger: Logger,
		private readonly instances: InstanceManager,
	) {
		super(logger);
	}

	protected async loadRoots(): Promise<NotployNode[]> {
		const list = this.instances.list();
		if (list.length === 0) {
			return [
				new MessageNode("No Notploy instance configured.", {
					icon: "cloud",
					tooltip:
						"Run “Notploy: Add Instance” to connect Notploy Cloud, a self-hosted instance or a local server.",
				}),
			];
		}

		const active = this.instances.active();
		return list.map(
			(instance) =>
				new InstanceNode(
					instance,
					{
						active: active?.id === instance.id,
						status: connectionStatusIcon(this.instances.statusOf(instance.id)),
					},
					() => this.loadInstanceChildren(instance),
				),
		);
	}

	private async loadInstanceChildren(
		instance: NotployInstance,
	): Promise<NotployNode[]> {
		const status = this.instances.statusOf(instance.id);
		const result = this.instances.connectionResult(instance.id);
		const current = this.instances.get(instance.id) ?? instance;

		const nodes: NotployNode[] = [
			new MessageNode("Connection", {
				icon: connectionStatusIcon(status).id,
				description: connectionStatusLabel(status),
				tooltip: result?.error?.userMessage,
			}),
			new MessageNode("URL", {
				icon: "link",
				description: instance.url,
				tooltip: "Open the Notploy dashboard",
			}),
			new MessageNode(
				current.hasCredential ? "Credential stored" : "No credential",
				{
					icon: current.hasCredential ? "key" : "warning",
					description: "VS Code secret storage",
					tooltip: current.hasCredential
						? "Run “Notploy: Logout” to remove it."
						: "Run “Notploy: Login” to paste an API key.",
					contextValue: CONTEXT.info,
				},
			),
		];

		if (current.version) {
			nodes.push(
				new MessageNode("Version", {
					icon: "tag",
					description: current.version,
				}),
			);
		}

		nodes.push(
			new MessageNode("Capabilities", {
				icon: "checklist",
				description:
					result?.capabilities?.source === "openapi"
						? "from the instance OpenAPI document"
						: undefined,
				children: async () => this.loadCapabilityChildren(instance),
			}),
		);

		if (!result) {
			nodes.push(
				new MessageNode(
					"Run “Notploy: Test Connection” to inspect this instance.",
					{
						icon: "info",
					},
				),
			);
		}

		return nodes;
	}

	private async loadCapabilityChildren(
		instance: NotployInstance,
	): Promise<NotployNode[]> {
		const report = this.instances.connectionResult(instance.id)?.capabilities;
		if (!report) {
			return [
				new MessageNode("Capabilities have not been read yet.", {
					icon: "info",
					tooltip:
						"Run “Notploy: Test Connection” or “Notploy: Show Instance Capabilities”.",
				}),
			];
		}

		const nodes: NotployNode[] = Object.entries(report.capabilities).map(
			([name, enabled]) =>
				new MessageNode(name, {
					icon: enabled ? "pass-filled" : "circle-slash",
					description: enabled ? "available" : "not exposed",
				}),
		);
		for (const note of report.notes) {
			nodes.push(new MessageNode(note, { icon: "info" }));
		}
		if (report.restricted.length > 0) {
			nodes.push(
				new MessageNode("Restricted for this credential", {
					icon: "lock",
					description: report.restricted.join(", "),
				}),
			);
		}
		return nodes;
	}

	/** Dashboard URL for an instance; also used by the commands. */
	static dashboardFor(instance: NotployInstance): string {
		return dashboardUrl(instance.url);
	}
}
