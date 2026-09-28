import * as vscode from "vscode";
import { STORAGE, secretKeyFor } from "./constants";
import type { NotployInstance } from "./domain";
import type { Logger } from "./logger";

/**
 * Persistence for Notploy instances.
 *
 * Non-secret instance metadata lives in `globalState` so it is available in
 * every window; API keys go to `SecretStorage` and are keyed per instance. No
 * token is ever written to `settings.json`, a workspace file, or a log.
 */
export class InstanceStore implements vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChange: vscode.Event<void> = this.changeEmitter.event;

	private instances: NotployInstance[] = [];
	private activeId: string | undefined;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger,
	) {
		this.reload();
	}

	private reload(): void {
		const stored = this.context.globalState.get<NotployInstance[]>(
			STORAGE.instances,
			[],
		);
		this.instances = Array.isArray(stored) ? stored : [];
		this.activeId = this.context.globalState.get<string | undefined>(
			STORAGE.activeInstance,
		);
	}

	list(): readonly NotployInstance[] {
		return this.instances;
	}

	get(id: string | undefined): NotployInstance | undefined {
		if (!id) return undefined;
		return this.instances.find((instance) => instance.id === id);
	}

	findByNameOrId(reference: string): NotployInstance | undefined {
		const needle = reference.trim().toLowerCase();
		if (!needle) return undefined;
		return (
			this.instances.find((instance) => instance.id.toLowerCase() === needle) ??
			this.instances.find(
				(instance) => instance.name.trim().toLowerCase() === needle,
			)
		);
	}

	/**
	 * The active instance, resolved with this precedence:
	 * `notploy.defaultInstance` (workspace/user setting) → last selection → the
	 * only configured instance.
	 */
	active(): NotployInstance | undefined {
		const configured = vscode.workspace
			.getConfiguration("notploy")
			.get<string>("defaultInstance", "")
			.trim();
		if (configured) {
			const bySetting = this.findByNameOrId(configured);
			if (bySetting) return bySetting;
		}
		const stored = this.get(this.activeId);
		if (stored) return stored;
		if (this.instances.length === 1) return this.instances[0];
		return undefined;
	}

	activeId_(): string | undefined {
		return this.active()?.id;
	}

	async add(instance: NotployInstance): Promise<void> {
		this.instances = [
			...this.instances.filter((existing) => existing.id !== instance.id),
			instance,
		];
		await this.persist();
		this.logger.info(`Instance registered: ${instance.name} (${instance.url})`);
	}

	async update(
		id: string,
		patch: Partial<NotployInstance>,
	): Promise<NotployInstance | undefined> {
		const existing = this.get(id);
		if (!existing) return undefined;
		const updated: NotployInstance = { ...existing, ...patch, id };
		this.instances = this.instances.map((instance) =>
			instance.id === id ? updated : instance,
		);
		await this.persist();
		return updated;
	}

	async remove(id: string): Promise<void> {
		const existing = this.get(id);
		this.instances = this.instances.filter((instance) => instance.id !== id);
		if (this.activeId === id) {
			this.activeId = undefined;
			await this.context.globalState.update(STORAGE.activeInstance, undefined);
		}
		await this.deleteToken(id);
		await this.persist();
		if (existing) {
			this.logger.info(`Instance removed: ${existing.name}`);
		}
	}

	async setActive(id: string): Promise<void> {
		this.activeId = id;
		await this.context.globalState.update(STORAGE.activeInstance, id);
		this.changeEmitter.fire();
	}

	/** Reads the API key for an instance from `SecretStorage`. */
	async getToken(id: string): Promise<string | undefined> {
		const token = await this.context.secrets.get(secretKeyFor(id));
		return token?.trim() ? token : undefined;
	}

	async setToken(id: string, token: string): Promise<void> {
		await this.context.secrets.store(secretKeyFor(id), token);
		await this.update(id, { hasCredential: true, lastStatus: "connected" });
	}

	async deleteToken(id: string): Promise<void> {
		if (await this.getToken(id)) {
			await this.context.secrets.delete(secretKeyFor(id));
		}
		const existing = this.get(id);
		if (existing) {
			await this.update(id, {
				hasCredential: false,
				lastStatus: "unknown",
				capabilities: undefined,
			});
		}
	}

	/** Refreshes the `hasCredential` flags from `SecretStorage`. */
	async syncCredentialFlags(): Promise<void> {
		let changed = false;
		for (const instance of [...this.instances]) {
			const token = await this.getToken(instance.id);
			const hasCredential = Boolean(token);
			if (instance.hasCredential !== hasCredential) {
				instance.hasCredential = hasCredential;
				changed = true;
			}
		}
		if (changed) await this.persist();
	}

	private async persist(): Promise<void> {
		await this.context.globalState.update(STORAGE.instances, this.instances);
		this.changeEmitter.fire();
	}

	dispose(): void {
		this.changeEmitter.dispose();
	}
}
