/**
 * Main entry: `createGitHubClient`.
 *
 * The client exposes functional namespaces so Notploy code never touches raw
 * Octokit routes directly:
 *
 *   github.repositories / branches / commits / pullRequests
 *   github.deployments / checks / releases / installations
 *   github.webhooks / rateLimit
 */

import { Octokit } from "octokit";
import { createGitHubAppAuthStrategy } from "../auth/index.js";
import {
	GitHubConfigurationError,
	type GitHubRateLimitInfo,
} from "../errors/index.js";
import { BranchesNamespace } from "./namespaces/branches.js";
import { ChecksNamespace } from "./namespaces/checks.js";
import { CommitsNamespace } from "./namespaces/commits.js";
import { DeploymentsNamespace } from "./namespaces/deployments.js";
import { InstallationsNamespace } from "./namespaces/installations.js";
import { PullRequestsNamespace } from "./namespaces/pull-requests.js";
import { ReleasesNamespace } from "./namespaces/releases.js";
import { RepositoriesNamespace } from "./namespaces/repositories.js";

/** A GitHub ref the user resolved to an exact commit SHA (when available). */
export interface RepositoryRef {
	owner: string;
	repository: string;
	/** Branch name, tag or full SHA. */
	ref: string;
	/** Exact commit SHA, when already known to the caller. */
	commitSha?: string;
}

export interface GitHubClientAuth {
	/** GitHub App credentials (appId + PEM private key). */
	app: {
		appId: number | string;
		privateKey: string;
	};
	/** Default installation used for API calls when none is provided. */
	installationId?: number | string;
	/**
	 * Alternatively, a pre-obtained installation token or PAT. When set,
	 * `app` must be omitted.
	 */
	token?: string;
	/** GitHub instance base URL (github.com, GHES, ghe.com data residency). */
	baseUrl?: string;
}

export interface GitHubClientOptions {
	auth: GitHubClientAuth;
	/**
	 * Retry configuration for transient failures. Kept deliberately small:
	 * the package surfaces rate-limit info but does not implement a job
	 * engine; heavier retry policy belongs to the caller.
	 */
	retry?: {
		/** Max automatic retries for transient errors (default 1). */
		maxRetries?: number;
		/** Whether to retry automatically after primary rate limit (default true, once). */
		retryAfterRateLimit?: boolean;
	};
	/** Custom logger; defaults to a no-op logger (never logs secrets). */
	log?: {
		debug?: (message: string) => void;
		info?: (message: string) => void;
		warn?: (message: string) => void;
		error?: (message: string) => void;
	};
}

export interface GitHubClient {
	readonly repositories: RepositoriesNamespace;
	readonly branches: BranchesNamespace;
	readonly commits: CommitsNamespace;
	readonly pullRequests: PullRequestsNamespace;
	readonly deployments: DeploymentsNamespace;
	readonly checks: ChecksNamespace;
	readonly releases: ReleasesNamespace;
	readonly installations: InstallationsNamespace;
	/** Snapshot of the primary rate limit for the current credentials. */
	rateLimit(): Promise<GitHubRateLimitInfo>;
	/** Underlying Octokit instance (escape hatch; avoid in Notploy core). */
	readonly octokit: Octokit;
}

const buildOctokit = (options: GitHubClientOptions): Octokit => {
	const { auth } = options;

	if (!auth) {
		throw new GitHubConfigurationError("GitHub client auth is required");
	}

	const hasAppCredentials = auth.app?.appId != null && !!auth.app?.privateKey;
	const hasToken = typeof auth.token === "string" && auth.token.length > 0;

	if (!hasAppCredentials && !hasToken) {
		throw new GitHubConfigurationError(
			"Provide either GitHub App credentials (auth.app) or an access token (auth.token)",
		);
	}

	if (hasAppCredentials && hasToken) {
		throw new GitHubConfigurationError(
			"Provide either GitHub App credentials or a token, not both",
		);
	}

	const common: Record<string, unknown> = {
		...(auth.baseUrl ? { baseUrl: auth.baseUrl } : {}),
		request: {
			retries: options.retry?.maxRetries ?? 1,
			retryAfterBase: 1,
		},
		throttle:
			options.retry?.retryAfterRateLimit === false
				? { onRateLimit: () => false, onSecondaryRateLimit: () => false }
				: {
						// Let the plugin retry once after the rate limit resets.
						onRateLimit: (
							_retryAfter: number,
							_opts: unknown,
							octokit: Octokit,
						) => {
							octokit.log.warn("GitHub primary rate limit hit; retrying once");
							return true;
						},
						onSecondaryRateLimit: (
							_retryAfter: number,
							_opts: unknown,
							octokit: Octokit,
						) => {
							octokit.log.warn(
								"GitHub secondary rate limit hit; retrying once",
							);
							return true;
						},
					},
		log: {
			debug: () => {},
			info: () => {},
			warn: (message: string) => options.log?.warn?.(message),
			error: (message: string) => options.log?.error?.(message),
		},
	};

	if (hasToken) {
		return new Octokit({ ...common, auth: auth.token });
	}

	// GitHub App + installation authentication. When no installationId is
	// provided the client operates at App level (JWT auth); requests that
	// require an installation then fail with a clear 401 from GitHub.
	const strategy = createGitHubAppAuthStrategy({
		appId: auth.app.appId,
		privateKey: auth.app.privateKey,
		baseUrl: auth.baseUrl,
	});

	return new Octokit({
		...common,
		authStrategy: strategy,
		auth: auth.installationId
			? { type: "installation", installationId: auth.installationId }
			: { type: "app" },
	});
};

export const createGitHubClient = (
	options: GitHubClientOptions,
): GitHubClient => {
	const octokit = buildOctokit(options);

	const repositories = new RepositoriesNamespace(octokit);
	const branches = new BranchesNamespace(octokit);
	const commits = new CommitsNamespace(octokit);
	const pullRequests = new PullRequestsNamespace(octokit);
	const deployments = new DeploymentsNamespace(octokit);
	const checks = new ChecksNamespace(octokit);
	const releases = new ReleasesNamespace(octokit);
	const installations = new InstallationsNamespace(octokit);

	return {
		repositories,
		branches,
		commits,
		pullRequests,
		deployments,
		checks,
		releases,
		installations,
		octokit,
		async rateLimit(): Promise<GitHubRateLimitInfo> {
			const { data } = await octokit.rest.rateLimit.get();
			return {
				limit: data.resources.core.limit,
				remaining: data.resources.core.remaining,
				resetAt: new Date(data.resources.core.reset * 1000).toISOString(),
			};
		},
	};
};
