import * as vscode from "vscode";
import { connectionStatusLabel } from "../core/formatting";
import type { InstanceManager } from "../services/instance-manager";

/**
 * A single, small status bar entry.
 *
 * It shows the active instance and its connection state, and clicking it opens
 * the Instances view. Nothing else is added to the status bar on purpose.
 */
export class NotployStatusBar implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;

	constructor(private readonly instances: InstanceManager) {
		this.item = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100,
		);
		this.item.command = "notploy.open";
		this.item.name = "Notploy";
		this.update();
	}

	update(): void {
		const active = this.instances.active();
		if (!active) {
			this.item.text = "$(cloud) Notploy";
			this.item.tooltip = new vscode.MarkdownString(
				"No Notploy instance selected.\n\nClick to open the Notploy view.",
			);
			this.item.backgroundColor = undefined;
			this.item.show();
			return;
		}

		const status = this.instances.statusOf(active.id);
		const icon =
			status === "connected"
				? "cloud"
				: status === "unavailable"
					? "cloud-offline"
					: status === "authenticating"
						? "sync~spin"
						: "cloud";

		this.item.text = `$(${icon}) Notploy: ${active.name}`;
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${active.name}**\n\n`);
		tooltip.appendMarkdown(`Connection: ${connectionStatusLabel(status)}\n\n`);
		tooltip.appendMarkdown(`URL: \`${active.url}\``);
		this.item.tooltip = tooltip;
		this.item.backgroundColor = undefined;
		this.item.show();
	}

	dispose(): void {
		this.item.dispose();
	}
}
