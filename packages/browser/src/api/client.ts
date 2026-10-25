/**
 * Browser Notploy client.
 *
 * Reuses `@notploy/sdk` (fetch-based, no Node-only dependencies) exactly like
 * the VS Code extension does: one SDK client per instance, `x-api-key` header,
 * per-request timeout via `AbortSignal.timeout`, and every failure normalised
 * into a `NotployError`.
 *
 * No server code or Node-only dependency may be imported here: this module is
 * bundled for the browser with esbuild (`platform: "browser"`).
 */

import {
	type Client,
	createClient,
	deploymentAllCentralized,
	projectAll,
	settingsGetNotployVersion,
	settingsHealth,
	settingsIsCloud,
	userSession,
} from "@notploy/sdk";
import { toNotployError } from "../shared/errors.js";
import type {
	Deployment,
	ProjectSummary,
	SessionInfo,
} from "../shared/types.js";

export interface BrowserClientOptions {
	origin: string;
	token?: string;
	timeout: number;
	instanceName?: string;
}

const DEFAULT_TIMEOUT = 30_000;

function buildFetch(timeout: number): typeof globalThis.fetch {
	return async (input, init) => {
		const timeoutSignal = AbortSignal.timeout(timeout);
		const callerSignal = init?.signal ?? undefined;
		const signal = callerSignal
			? mergeSignals(callerSignal, timeoutSignal)
			: timeoutSignal;
		return await fetch(input, { ...init, signal });
	};
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
	const controller = new AbortController();
	const abort = (signal: AbortSignal) => () => {
		controller.abort(signal.reason);
	};
	if (a.aborted) controller.abort(a.reason);
	else a.addEventListener("abort", abort(a), { once: true });
	if (b.aborted) controller.abort(b.reason);
	else b.addEventListener("abort", abort(b), { once: true });
	return controller.signal;
}

export class NotployBrowserClient {
	readonly origin: string;
	readonly apiBaseUrl: string;
	private readonly client: Client;
	private readonly instanceName?: string;
	private readonly timeout: number;
	private readonly token?: string;

	constructor(options: BrowserClientOptions) {
		this.origin = options.origin.replace(/\/+$/, "");
		this.apiBaseUrl = `${this.origin}/api`;
		this.instanceName = options.instanceName;
		this.timeout = options.timeout > 0 ? options.timeout : DEFAULT_TIMEOUT;
		this.token = options.token;

		const headers: Record<string, string> = { Accept: "application/json" };
		if (options.token) headers["x-api-key"] = options.token;

		this.client = createClient({
			baseUrl: this.apiBaseUrl,
			responseStyle: "fields",
			headers,
			fetch: buildFetch(this.timeout),
		});
	}

	get authenticated(): boolean {
		return Boolean(this.token);
	}

	private async request<T>(
		operation: string,
		promise: Promise<{ data: unknown }>,
	): Promise<T> {
		try {
			const result = await promise;
			return result.data as T;
		} catch (error) {
			throw toNotployError(error, {
				operation,
				instanceName: this.instanceName,
				baseUrl: this.origin,
			});
		}
	}

	async health(): Promise<{ status: string }> {
		return await this.request(
			"settings.health",
			settingsHealth({ client: this.client, throwOnError: true }),
		);
	}

	async version(): Promise<string | undefined> {
		const value = await this.request<unknown>(
			"settings.getNotployVersion",
			settingsGetNotployVersion({ client: this.client, throwOnError: true }),
		);
		return typeof value === "string" ? value : undefined;
	}

	async isCloud(): Promise<boolean> {
		const value = await this.request<unknown>(
			"settings.isCloud",
			settingsIsCloud({ client: this.client, throwOnError: true }),
		);
		return value === true;
	}

	async session(): Promise<SessionInfo | null> {
		const value = await this.request<SessionInfo | null>(
			"user.session",
			userSession({ client: this.client, throwOnError: true }),
		);
		return value && typeof value === "object" && "user" in value ? value : null;
	}

	async projects(): Promise<ProjectSummary[]> {
		const value = await this.request<ProjectSummary[] | null>(
			"project.all",
			projectAll({ client: this.client, throwOnError: true }),
		);
		return Array.isArray(value) ? value : [];
	}

	async recentDeployments(limit = 20): Promise<Deployment[]> {
		const value = await this.request<Deployment[] | null>(
			"deployment.allCentralized",
			deploymentAllCentralized({ client: this.client, throwOnError: true }),
		);
		if (!Array.isArray(value)) return [];
		return value.slice(0, limit);
	}
}
