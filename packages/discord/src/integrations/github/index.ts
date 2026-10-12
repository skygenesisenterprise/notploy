import type { Logger } from "../../utils/logger.js";

export interface GitHubRelease {
	tagName: string;
	name: string;
	url: string;
	publishedAt: string | null;
	prerelease: boolean;
	draft: boolean;
	body: string | null;
}

export interface GitHubIntegrationOptions {
	/** Repository in `owner/name` form. */
	repository: string;
	/** Optional token; unauthenticated requests are rate-limited to 60/hour. */
	token?: string | null;
	/** Injectable fetch implementation (used in tests). */
	fetchImpl?: typeof fetch;
	/** Injectable logger. */
	logger?: Logger;
}

interface GitHubReleaseApiResponse {
	tag_name?: string;
	name?: string | null;
	html_url?: string;
	published_at?: string | null;
	draft?: boolean;
	prerelease?: boolean;
	body?: string | null;
}

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Read-only GitHub integration.
 *
 * This module only talks to the public GitHub REST API and never imports
 * Discord.js; keeping it isolated from command handling means the same
 * functions can be reused by notification jobs or tests without a bot
 * connection.
 */
export class GitHubIntegration {
	private readonly repository: string;
	private readonly token: string | null;
	private readonly fetchImpl: typeof fetch;
	private readonly logger: Logger | undefined;

	constructor(options: GitHubIntegrationOptions) {
		this.repository = options.repository;
		this.token = options.token ?? null;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.logger = options.logger;
	}

	/** Latest published (non-draft, non-prerelease) release, or `null`. */
	async getLatestRelease(): Promise<GitHubRelease | null> {
		const response = await this.request<GitHubReleaseApiResponse>(
			`/repos/${this.repository}/releases/latest`,
		);
		if (!response || !response.tag_name) return null;

		return {
			tagName: response.tag_name,
			name: response.name ?? response.tag_name,
			url: response.html_url ?? `https://github.com/${this.repository}/releases`,
			publishedAt: response.published_at ?? null,
			prerelease: response.prerelease ?? false,
			draft: response.draft ?? false,
			body: response.body ?? null,
		};
	}

	private async request<T>(path: string): Promise<T | null> {
		const headers: Record<string, string> = {
			Accept: "application/vnd.github+json",
			"User-Agent": "notploy-discord-bot",
			"X-GitHub-Api-Version": "2022-11-28",
		};
		if (this.token) headers.Authorization = `Bearer ${this.token}`;

		try {
			const response = await this.fetchImpl(`${GITHUB_API_BASE}${path}`, { headers });
			if (!response.ok) {
				this.logger?.warn("GitHub API request failed", {
					path,
					status: response.status,
				});
				return null;
			}
			return (await response.json()) as T;
		} catch (error) {
			this.logger?.warn("GitHub API request threw", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}
}
