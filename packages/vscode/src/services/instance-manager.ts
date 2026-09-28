import * as vscode from "vscode";
import { NotployClient } from "../api/notploy-client";
import {
	type CapabilityReport,
	detectCapabilities,
} from "../core/capabilities";
import type { InstanceConnectionStatus, NotployInstance } from "../core/domain";
import { NotployError, notConfigured } from "../core/errors";
import type { InstanceStore } from "../core/instance-store";
import type { Logger } from "../core/logger";

export interface ConnectionResult {
	instance: NotployInstance;
	status: InstanceConnectionStatus;
	version?: string;
	cloud?: boolean;
	capabilities?: CapabilityReport;
	error?: NotployError;
}

/**
 * Owns one {@link NotployClient} per configured instance and the connection
 * state the UI renders.
 *
 * Clients are cached and rebuilt only when the instance URL, the timeout or the
 * presence of a credential changes, so switching between instances — or simply
 * re-rendering a tree — never re-creates a client or repeats a token read.
 */
export class InstanceManager implements vscode.Disposable {
	private readonly clients = new Map<string, NotployClient>();
	/** Cache key per instance: url + credential + timeout. Never logged. */
	private readonly clientKeys = new Map<string, string>();
	private readonly results = new Map<string, ConnectionResult>();
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChange: vscode.Event<void> = this.changeEmitter.event;

	constructor(
		private readonly store: InstanceStore,
		private readonly logger: Logger,
	) {}

	list(): readonly NotployInstance[] {
		return this.store.list();
	}

	get(id: string | undefined): NotployInstance | undefined {
		return this.store.get(id);
	}

	active(): NotployInstance | undefined {
		return this.store.active();
	}

	connectionResult(id: string | undefined): ConnectionResult | undefined {
		return id ? this.results.get(id) : undefined;
	}

	statusOf(id: string | undefined): InstanceConnectionStatus {
		if (!id) return "disconnected";
		const result = this.results.get(id);
		if (result) return result.status;
		const instance = this.store.get(id);
		if (!instance) return "disconnected";
		if (!instance.hasCredential) return "unavailable";
		return instance.lastStatus ?? "unknown";
	}

	private resolveTimeout(): number {
		const value = vscode.workspace
			.getConfiguration("notploy")
			.get<number>("requestTimeout", 30_000);
		return Number.isFinite(value) && value >= 1_000 ? value : 30_000;
	}

	/**
	 * Builds, or returns a cached, client for an instance. The cache key embeds
	 * the credential so changing the API key transparently rebuilds the client.
	 * The key is only ever held in memory and compared, never logged.
	 */
	async clientFor(instanceId: string | undefined): Promise<NotployClient> {
		const instance = instanceId
			? this.store.get(instanceId)
			: this.store.active();
		if (!instance) throw notConfigured();

		const token = await this.store.getToken(instance.id);
		const cacheKey = [
			instance.url,
			token ?? "anonymous",
			String(this.resolveTimeout()),
		].join("\u0000");

		const cached = this.clients.get(instance.id);
		if (cached && this.clientKeys.get(instance.id) === cacheKey) {
			return cached;
		}

		const client = new NotployClient({
			origin: instance.url,
			token,
			timeout: this.resolveTimeout(),
			instanceName: instance.name,
			logger: this.logger,
		});
		this.clients.set(instance.id, client);
		this.clientKeys.set(instance.id, cacheKey);
		return client;
	}

	/** Client for the active instance; throws when nothing is configured. */
	async activeClient(): Promise<NotployClient> {
		return await this.clientFor(this.store.active()?.id);
	}

	/** Client for the active instance, requiring a stored credential. */
	async authenticatedClient(): Promise<NotployClient> {
		const instance = this.store.active();
		if (!instance) throw notConfigured();
		const client = await this.clientFor(instance.id);
		if (!client.authenticated) {
			throw new NotployError({
				code: "unauthorized",
				userMessage: `No credential is stored for "${instance.name}". Run "Notploy: Login" to add an API key.`,
				detail: `missing credential for ${instance.id}`,
			});
		}
		return client;
	}

	/** Drops cached clients so the next call re-reads the credential. */
	invalidate(instanceId?: string): void {
		if (instanceId) {
			this.clients.delete(instanceId);
			this.clientKeys.delete(instanceId);
			return;
		}
		this.clients.clear();
		this.clientKeys.clear();
	}

	/**
	 * Verifies that an instance answers, reads its version and cloud flag, and
	 * refreshes the capability report.
	 */
	async checkConnection(instance: NotployInstance): Promise<ConnectionResult> {
		const client = await this.clientFor(instance.id);
		let status: InstanceConnectionStatus = "unavailable";
		let version: string | undefined;
		let cloud: boolean | undefined;
		let capabilities: CapabilityReport | undefined;
		let error: NotployError | undefined;

		try {
			await client.health();
			if (client.authenticated) {
				const session = await client.session();
				if (!session) {
					status = "disconnected";
					error = new NotployError({
						code: "unauthorized",
						userMessage: `"${instance.name}" did not accept the stored credential. Sign in again.`,
						detail: `session rejected for ${instance.id}`,
					});
				} else {
					status = "connected";
				}
			} else {
				// The instance answers but there is no credential yet.
				status = "disconnected";
			}

			if (status === "connected") {
				capabilities = await detectCapabilities(client);
				version = capabilities.version;
				cloud = capabilities.capabilities.cloud;
			}
		} catch (caught) {
			error =
				caught instanceof NotployError
					? caught
					: new NotployError({
							code: "connection",
							userMessage: `Unable to reach "${instance.name}".`,
							cause: caught,
						});

			// The Notploy REST API gates every procedure behind authentication, so a
			// credential error still proves the server answered. Only a transport
			// failure means the instance is genuinely unreachable.
			status =
				error.code === "unauthorized" || error.code === "forbidden"
					? "disconnected"
					: "unavailable";
		}

		const result: ConnectionResult = {
			instance,
			status,
			version,
			cloud,
			capabilities,
			error,
		};
		this.results.set(instance.id, result);

		await this.store.update(instance.id, {
			lastStatus: status,
			version,
			cloud,
			capabilities: capabilities?.capabilities,
			hasCredential: client.authenticated,
		});
		this.changeEmitter.fire();
		return result;
	}

	/** Re-checks every configured instance, in parallel. */
	async checkAll(): Promise<ConnectionResult[]> {
		const instances = [...this.store.list()];
		return await Promise.all(
			instances.map(async (instance) => await this.checkConnection(instance)),
		);
	}

	async refreshCapabilities(instanceId?: string): Promise<CapabilityReport> {
		const instance = instanceId
			? this.store.get(instanceId)
			: this.store.active();
		if (!instance) throw notConfigured();
		const client = await this.clientFor(instance.id);
		const report = await detectCapabilities(client);
		await this.store.update(instance.id, {
			capabilities: report.capabilities,
			version: report.version,
			cloud: report.capabilities.cloud,
		});
		this.changeEmitter.fire();
		return report;
	}

	dispose(): void {
		this.changeEmitter.dispose();
		this.clients.clear();
		this.clientKeys.clear();
	}
}
