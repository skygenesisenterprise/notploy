import * as vscode from "vscode";
import { toNotployError } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { ErrorNode, type NotployNode } from "../nodes";

/**
 * Shared behaviour for every Notploy view.
 *
 * A failed load never throws out of `getChildren` — VS Code would only show an
 * unhelpful error toast. Instead the failure becomes an {@link ErrorNode} in
 * place of the children, with a readable message and the full detail in the
 * Notploy output channel.
 */
export abstract class NotployTreeProvider
	implements vscode.TreeDataProvider<NotployNode>, vscode.Disposable
{
	protected readonly changeEmitter = new vscode.EventEmitter<
		NotployNode | undefined | void
	>();
	readonly onDidChangeTreeData: vscode.Event<NotployNode | undefined | void> =
		this.changeEmitter.event;

	constructor(protected readonly logger: Logger) {}

	getTreeItem(element: NotployNode): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: NotployNode): Promise<NotployNode[]> {
		const loader = element ? element.loadChildren : () => this.loadRoots();
		if (!loader) return [];
		return await this.guard(labelOf(element), loader);
	}

	/** Loads the top-level nodes of the view. */
	protected abstract loadRoots(): Promise<NotployNode[]>;

	/** Runs a child loader, converting failures into a single error node. */
	protected async guard(
		context: string,
		loader: () => Promise<NotployNode[]>,
	): Promise<NotployNode[]> {
		try {
			return await loader();
		} catch (error) {
			const notployError = toNotployError(error, { operation: context });
			this.logger.error(`Loading "${context}" failed`, error);
			return [new ErrorNode(notployError)];
		}
	}

	refresh(element?: NotployNode): void {
		this.changeEmitter.fire(element);
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}
}

function labelOf(element: NotployNode | undefined): string {
	if (!element) return "root";
	const label = element.label;
	if (typeof label === "string") return label;
	if (label && typeof label === "object" && "label" in label) {
		return String(label.label);
	}
	return "node";
}
