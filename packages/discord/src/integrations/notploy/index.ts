import type { Client as NotploySdkClient } from "@notploy/sdk";
import type { BotConfig } from "../../types/index.js";
import type { Logger } from "../../utils/logger.js";

export interface NotployStatus {
	/** Whether NOTPLOY_URL and NOTPLOY_API_KEY are both configured. */
	configured: boolean;
	/** Whether the public Notploy API responded successfully. */
	reachable: boolean;
	baseUrl: string | null;
	version: string | null;
	/** Human-readable explanation when status is unavailable. */
	message: string | null;
}

/**
 * Read-only Notploy API integration.
 *
 * All calls go through `@notploy/sdk` (never through `packages/server`,
 * Prisma or any internal database detail) and only ever read public or
 * instance-scoped informational endpoints. Destructive operations are out of
 * scope by design.
 */
export class NotployIntegration {
	private clientPromise: Promise<NotploySdkClient> | null = null;

	constructor(
		private readonly config: BotConfig,
		private readonly logger: Logger,
	) {}

	get isConfigured(): boolean {
		return Boolean(this.config.notployApi.baseUrl && this.config.notployApi.apiKey);
	}

	private async getClient(): Promise<NotploySdkClient> {
		if (!this.clientPromise) {
			const baseUrl = this.config.notployApi.baseUrl;
			const apiKey = this.config.notployApi.apiKey;
			if (!baseUrl || !apiKey) {
				throw new Error("Notploy API is not configured");
			}

			this.clientPromise = import("@notploy/sdk").then((sdk) =>
				sdk.createClient({
					baseUrl,
					headers: { "x-api-key": apiKey },
				}),
			);
		}
		return this.clientPromise;
	}

	/** Returns the Notploy version reported by the configured instance. */
	async getVersion(): Promise<string | null> {
		if (!this.isConfigured) return null;
		try {
			const sdk = await import("@notploy/sdk");
			const client = await this.getClient();
			const result = (await sdk.settingsGetNotployVersion({ client })) as {
				data?: unknown;
			};
			return extractVersion(result.data);
		} catch (error) {
			this.logger.warn("Failed to read Notploy version", {
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/** Read-only status snapshot for `/status`. */
	async getStatus(): Promise<NotployStatus> {
		const baseUrl = this.config.notployApi.baseUrl;
		if (!this.isConfigured) {
			return {
				configured: false,
				reachable: false,
				baseUrl,
				version: null,
				message: "No Notploy instance is configured for this bot.",
			};
		}

		const [reachable, version] = await Promise.all([this.checkHealth(), this.getVersion()]);

		return {
			configured: true,
			reachable,
			baseUrl,
			version,
			message: reachable ? null : "The configured Notploy instance did not respond.",
		};
	}

	private async checkHealth(): Promise<boolean> {
		try {
			const sdk = await import("@notploy/sdk");
			const client = await this.getClient();
			const result = (await sdk.settingsHealth({ client })) as { error?: unknown };
			return result.error === undefined;
		} catch (error) {
			this.logger.warn("Notploy health check failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}
}

/**
 * Best-effort extraction of a version string from an untyped SDK payload.
 * The generated OpenAPI types for these endpoints are currently opaque, so we
 * accept a few common shapes rather than asserting a rigid contract.
 */
export function extractVersion(data: unknown): string | null {
	if (typeof data === "string") return data;
	if (!data || typeof data !== "object") return null;
	const record = data as Record<string, unknown>;
	for (const key of ["version", "notployVersion", "tag", "releaseTag"]) {
		const value = record[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return null;
}
