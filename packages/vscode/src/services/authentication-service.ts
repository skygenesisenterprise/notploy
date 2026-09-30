import * as vscode from "vscode";
import { NotployError } from "../core/errors";
import { apiKeysUrl } from "../core/formatting";
import type { InstanceStore } from "../core/instance-store";
import type { Logger } from "../core/logger";
import type { InstanceManager } from "./instance-manager";

export interface LoginResult {
	ok: boolean;
	message: string;
	/**
	 * Where to create an API key, set whenever the result is about a missing or
	 * rejected credential. The caller turns it into a shortcut so a user who
	 * cannot find the key is one click from the page that issues it.
	 */
	apiKeysUrl?: string;
}

/**
 * Credential handling.
 *
 * Notploy's public API authenticates with an API key sent as `x-api-key` — the
 * same mechanism the CLI, the SDK and the MCP server use. There is no
 * interactive/OAuth procedure in the OpenAPI document, so "Login" means "store
 * an API key for this instance". Credentials go to `SecretStorage` only: never
 * to `settings.json`, never to a workspace file, never to a log line.
 */
export class AuthenticationService {
	constructor(
		private readonly instances: InstanceManager,
		private readonly store: InstanceStore,
		private readonly logger: Logger,
	) {}

	/**
	 * Prompts for an API key, verifies it against `user.session`, and stores it
	 * only when the instance accepts it.
	 */
	async login(instanceId?: string): Promise<LoginResult> {
		const instance = instanceId
			? this.instances.get(instanceId)
			: this.instances.active();
		if (!instance) {
			return {
				ok: false,
				message:
					"No Notploy instance is selected. Add one with “Notploy: Add Instance” first.",
			};
		}

		const keysPage = apiKeysUrl(instance.url);
		const token = await vscode.window.showInputBox({
			title: `Notploy: Login to ${instance.name}`,
			prompt: `Paste an API key generated in ${keysPage}. It is stored in VS Code secret storage and never written to settings.json.`,
			placeHolder: "API key",
			password: true,
			ignoreFocusOut: true,
			validateInput: (value) =>
				value.trim().length === 0 ? "An API key is required." : undefined,
		});
		if (token === undefined) {
			return { ok: false, message: "Login cancelled." };
		}

		return await this.verifyAndStore(instance.id, token.trim());
	}

	/** Validates a token and stores it when it works. */
	async verifyAndStore(
		instanceId: string,
		token: string,
	): Promise<LoginResult> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { ok: false, message: "Unknown Notploy instance." };
		}
		if (!token) {
			return {
				ok: false,
				message: "The API key is empty.",
				apiKeysUrl: apiKeysUrl(instance.url),
			};
		}

		// Store first so the client picks the key up, then verify. If the instance
		// rejects it the secret is removed again, so an invalid key is never left
		// behind and the next request cannot silently use it.
		await this.store.setToken(instance.id, token);
		this.instances.invalidate(instance.id);

		try {
			const client = await this.instances.clientFor(instance.id);
			const session = await client.session();
			if (!session) {
				throw new NotployError({
					code: "unauthorized",
					userMessage: `${instance.name} did not accept this API key.`,
					detail: `session rejected for ${instance.id}`,
				});
			}
			this.logger.info(`Authenticated against ${instance.name}`);
			await this.instances.checkConnection(instance);
			return { ok: true, message: `Connected to ${instance.name}.` };
		} catch (error) {
			await this.store.deleteToken(instance.id);
			this.instances.invalidate(instance.id);
			const message =
				error instanceof NotployError
					? error.userMessage
					: `Could not authenticate against ${instance.name}.`;
			this.logger.warn(`Authentication failed for ${instance.name}`);
			// The credential is the thing missing, so every failure here is
			// recoverable by minting a new key on the dashboard.
			return { ok: false, message, apiKeysUrl: apiKeysUrl(instance.url) };
		}
	}

	/** Removes the stored credential for an instance. */
	async logout(instanceId?: string): Promise<boolean> {
		const instance = instanceId
			? this.instances.get(instanceId)
			: this.instances.active();
		if (!instance) return false;
		await this.store.deleteToken(instance.id);
		this.instances.invalidate(instance.id);
		this.logger.info(`Credential removed for ${instance.name}`);
		return true;
	}
}
