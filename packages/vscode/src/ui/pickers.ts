import * as vscode from "vscode";
import type {
	ApplicationSummary,
	Deployment,
	NotployInstance,
} from "../core/domain";
import { deploymentStatusLabel, relativeTime } from "../core/formatting";

/** Quick pick over configured instances. */
export async function pickInstance(
	instances: readonly NotployInstance[],
	options: { placeHolder?: string; activeId?: string } = {},
): Promise<NotployInstance | undefined> {
	if (instances.length === 0) return undefined;
	if (instances.length === 1) return instances[0];
	const picked = await vscode.window.showQuickPick(
		instances.map((instance) => ({
			label: instance.name,
			description: instance.url,
			detail:
				instance.id === options.activeId
					? "Currently active"
					: instance.hasCredential
						? "Credential stored"
						: "No credential",
			instance,
		})),
		{
			placeHolder: options.placeHolder ?? "Select a Notploy instance",
			ignoreFocusOut: true,
		},
	);
	return picked?.instance;
}

interface Pickable {
	label: string;
	description?: string;
	detail?: string;
}

export async function pickFrom<T>(
	items: T[],
	toPickable: (item: T) => Pickable,
	placeHolder: string,
): Promise<T | undefined> {
	if (items.length === 0) return undefined;
	if (items.length === 1) return items[0];
	const picked = await vscode.window.showQuickPick(
		items.map((item) => ({ ...toPickable(item), item })),
		{
			placeHolder,
			ignoreFocusOut: true,
			matchOnDescription: true,
			matchOnDetail: true,
		},
	);
	return picked?.item;
}

export function applicationPickable(application: ApplicationSummary): Pickable {
	return {
		label: application.name,
		description: application.appName,
		detail: application.applicationId,
	};
}

export function deploymentPickable(deployment: Deployment): Pickable {
	return {
		label: deployment.title || "Deployment",
		description: `${deploymentStatusLabel(deployment.status)} · ${relativeTime(deployment.createdAt)}`,
		detail: deployment.deploymentId,
	};
}

/**
 * Confirmation for anything destructive. Honours
 * `notploy.confirmDestructiveActions` so users can turn the modal off, and
 * always defaults to "no".
 */
export async function confirmDestructive(
	message: string,
	detail?: string,
): Promise<boolean> {
	const enabled = vscode.workspace
		.getConfiguration("notploy")
		.get<boolean>("confirmDestructiveActions", true);
	if (!enabled) return true;

	const choice = await vscode.window.showWarningMessage(
		message,
		{ modal: true, detail },
		"Continue",
	);
	return choice === "Continue";
}

/** Prompts for free text with validation. */
export async function promptText(
	title: string,
	prompt: string,
	options: { value?: string; placeHolder?: string; required?: boolean } = {},
): Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		title,
		prompt,
		value: options.value,
		placeHolder: options.placeHolder,
		ignoreFocusOut: true,
		validateInput: (input) =>
			options.required !== false && input.trim().length === 0
				? "This field is required."
				: undefined,
	});
	return value === undefined ? undefined : value.trim();
}
