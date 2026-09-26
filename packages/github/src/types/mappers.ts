/**
 * Internal mapping helpers: raw Octokit responses -> Notploy domain models.
 * These are private to the package; consumers only see the typed models.
 */

import type { Octokit } from "octokit";
import type {
	GitHubBranch,
	GitHubCheckRun,
	GitHubCommit,
	GitHubDeployment,
	GitHubDeploymentStatus,
	GitHubInstallation,
	GitHubPullRequest,
	GitHubPullRequestFile,
	GitHubRelease,
	GitHubRepository,
	GitHubTag,
	GitHubVisibility,
} from "../types/index.js";

type AnyRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnyRecord =>
	(value && typeof value === "object" ? value : {}) as AnyRecord;

const asString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

type RepoLike = {
	id: number;
	name: string;
	full_name?: string;
	private?: boolean;
	visibility?: string;
	description?: string | null;
	html_url?: string;
	clone_url?: string;
	default_branch?: string;
	language?: string | null;
	archived?: boolean;
	disabled?: boolean;
	fork?: boolean;
	created_at?: string | null;
	updated_at?: string | null;
	pushed_at?: string | null;
	owner?: { login?: string; type?: string; avatar_url?: string } | null;
};

export type { RepoLike };

const toVisibility = (value: unknown): GitHubVisibility | undefined => {
	if (value === "public" || value === "private" || value === "internal") {
		return value;
	}
	return undefined;
};

/** Maps any GitHub repository payload (REST repo, installation repo) to the model. */
export const mapRepository = (repo: RepoLike): GitHubRepository => {
	const ownerLogin = asString(repo.owner?.login) ?? "unknown";

	return {
		id: repo.id,
		name: repo.name,
		fullName: asString(repo.full_name) ?? `${ownerLogin}/${repo.name}`,
		owner: ownerLogin,
		private: repo.private ?? false,
		...(toVisibility(repo.visibility)
			? { visibility: toVisibility(repo.visibility) }
			: {}),
		description: repo.description ?? null,
		htmlUrl:
			asString(repo.html_url) ??
			`https://github.com/${ownerLogin}/${repo.name}`,
		...(asString(repo.clone_url) ? { cloneUrl: asString(repo.clone_url) } : {}),
		defaultBranch: asString(repo.default_branch) ?? "main",
		language: repo.language ?? null,
		archived: repo.archived ?? false,
		disabled: repo.disabled ?? false,
		fork: repo.fork ?? false,
		...(asString(repo.created_at)
			? { createdAt: asString(repo.created_at) }
			: {}),
		...(asString(repo.updated_at)
			? { updatedAt: asString(repo.updated_at) }
			: {}),
		...(asString(repo.pushed_at) ? { pushedAt: asString(repo.pushed_at) } : {}),
	};
};

type BranchLike = {
	name: string;
	protected?: boolean;
	commit?: { sha?: string } | null;
};

export type { BranchLike };

export const mapBranch = (branch: BranchLike): GitHubBranch => ({
	name: branch.name,
	commitSha: asString(branch.commit?.sha) ?? "",
	protected: branch.protected ?? false,
});

type CommitLike = {
	sha: string;
	html_url?: string;
	commit?: {
		message?: string;
		author?: { name?: string; email?: string; date?: string } | null;
		committer?: { name?: string; email?: string; date?: string } | null;
	} | null;
	author?: { login?: string } | null;
};

export type { CommitLike };

export const mapCommit = (commit: CommitLike): GitHubCommit => ({
	sha: commit.sha,
	message: asString(commit.commit?.message) ?? "",
	author: commit.commit?.author ?? null,
	committer: commit.commit?.committer ?? null,
	htmlUrl: asString(commit.html_url) ?? "",
	...(asString(commit.author?.login)
		? { authorLogin: asString(commit.author?.login) }
		: {}),
});

type PullRequestLike = {
	id: number;
	number: number;
	title: string;
	state: string;
	draft?: boolean;
	merged?: boolean;
	html_url?: string;
	created_at?: string;
	updated_at?: string;
	closed_at?: string | null;
	merged_at?: string | null;
	user?: { login?: string } | null;
	head?: { ref?: string; sha?: string } | null;
	base?: { ref?: string } | null;
};

export type { PullRequestLike };

export const mapPullRequest = (pr: PullRequestLike): GitHubPullRequest => ({
	id: pr.id,
	number: pr.number,
	title: pr.title,
	state: pr.state === "closed" ? "closed" : "open",
	draft: pr.draft ?? false,
	...(pr.merged !== undefined ? { merged: pr.merged } : {}),
	headRef: asString(pr.head?.ref) ?? "",
	baseRef: asString(pr.base?.ref) ?? "",
	headSha: asString(pr.head?.sha) ?? "",
	htmlUrl: asString(pr.html_url) ?? "",
	...(asString(pr.user?.login)
		? { authorLogin: asString(pr.user?.login) }
		: {}),
	...(asString(pr.created_at) ? { createdAt: asString(pr.created_at) } : {}),
	...(asString(pr.updated_at) ? { updatedAt: asString(pr.updated_at) } : {}),
	closedAt: pr.closed_at ?? null,
	mergedAt: pr.merged_at ?? null,
});

type PullRequestFileLike = {
	filename: string;
	previous_filename?: string | null;
	status?: string;
	additions?: number;
	deletions?: number;
	changes?: number;
	patch?: string | null;
};

export type { PullRequestFileLike };

const mapFileStatus = (
	status: string | undefined,
): GitHubPullRequestFile["status"] => {
	switch (status) {
		case "added":
			return "added";
		case "removed":
			return "removed";
		case "modified":
			return "modified";
		case "renamed":
			return "renamed";
		case "changed":
			return "changed";
		case "copied":
			return "copied";
		default:
			return "unchanged";
	}
};

export const mapPullRequestFile = (
	file: PullRequestFileLike,
): GitHubPullRequestFile => ({
	filename: file.filename,
	...(asString(file.previous_filename)
		? { previousFilename: file.previous_filename }
		: {}),
	status: mapFileStatus(file.status),
	additions: file.additions ?? 0,
	deletions: file.deletions ?? 0,
	changes: file.changes ?? 0,
	patch: file.patch ?? null,
});

type DeploymentLike = {
	id: number;
	sha: string;
	ref?: string;
	task?: string;
	environment?: string;
	description?: string | null;
	created_at?: string;
	updated_at?: string;
	html_url?: string;
	creator?: { login?: string } | null;
};

export type { DeploymentLike };

export const mapDeployment = (
	deployment: DeploymentLike,
): GitHubDeployment => ({
	id: deployment.id,
	sha: deployment.sha,
	ref: asString(deployment.ref) ?? "",
	task: asString(deployment.task) ?? "deploy",
	environment: asString(deployment.environment) ?? "production",
	description: deployment.description ?? null,
	...(asString(deployment.creator?.login)
		? { creatorLogin: asString(deployment.creator?.login) }
		: {}),
	...(asString(deployment.created_at)
		? { createdAt: asString(deployment.created_at) }
		: {}),
	...(asString(deployment.updated_at)
		? { updatedAt: asString(deployment.updated_at) }
		: {}),
	htmlUrl: asString(deployment.html_url) ?? "",
});

type DeploymentStatusLike = {
	id: number;
	state: string;
	description?: string | null;
	environment_url?: string | null;
	log_url?: string | null;
	created_at?: string;
	updated_at?: string;
	creator?: { login?: string } | null;
};

const toDeploymentState = (value: string): GitHubDeploymentStatus["state"] => {
	switch (value) {
		case "queued":
		case "in_progress":
		case "success":
		case "failure":
		case "error":
		case "inactive":
			return value;
		default:
			return "error";
	}
};

export const mapDeploymentStatus = (
	status: DeploymentStatusLike,
): GitHubDeploymentStatus => ({
	id: status.id,
	state: toDeploymentState(status.state),
	description: status.description ?? null,
	environmentUrl: status.environment_url ?? null,
	logUrl: status.log_url ?? null,
	...(asString(status.creator?.login)
		? { creatorLogin: asString(status.creator?.login) }
		: {}),
	...(asString(status.created_at)
		? { createdAt: asString(status.created_at) }
		: {}),
	...(asString(status.updated_at)
		? { updatedAt: asString(status.updated_at) }
		: {}),
});

type CheckRunLike = {
	id: number;
	name: string;
	head_sha?: string;
	status?: string;
	conclusion?: string | null;
	details_url?: string | null;
	started_at?: string | null;
	completed_at?: string | null;
	html_url?: string | null;
};

export type { CheckRunLike };

const toCheckStatus = (value: string | undefined): GitHubCheckRun["status"] =>
	value === "completed"
		? "completed"
		: value === "in_progress"
			? "in_progress"
			: "queued";

const toCheckConclusion = (
	value: string | null | undefined,
): import("../types/index.js").GitHubCheckConclusion | null => {
	switch (value) {
		case "success":
		case "failure":
		case "neutral":
		case "cancelled":
		case "timed_out":
		case "action_required":
		case "stale":
		case "skipped":
			return value;
		default:
			return null;
	}
};

export const mapCheckRun = (check: CheckRunLike): GitHubCheckRun => ({
	id: check.id,
	name: check.name,
	headSha: asString(check.head_sha) ?? "",
	status: toCheckStatus(check.status),
	conclusion: toCheckConclusion(check.conclusion),
	detailsUrl: check.details_url ?? null,
	...(asString(check.started_at)
		? { startedAt: asString(check.started_at) }
		: {}),
	completedAt: check.completed_at ?? null,
	...(asString(check.html_url) ? { htmlUrl: asString(check.html_url) } : {}),
});

type ReleaseLike = {
	id: number;
	tag_name: string;
	name?: string | null;
	draft?: boolean;
	prerelease?: boolean;
	created_at?: string;
	published_at?: string | null;
	html_url?: string;
};

export const mapRelease = (release: ReleaseLike): GitHubRelease => ({
	id: release.id,
	tagName: release.tag_name,
	name: release.name ?? null,
	draft: release.draft ?? false,
	prerelease: release.prerelease ?? false,
	...(asString(release.created_at)
		? { createdAt: asString(release.created_at) }
		: {}),
	publishedAt: release.published_at ?? null,
	htmlUrl: asString(release.html_url) ?? "",
});

type TagLike = {
	name: string;
	commit?: { sha?: string } | null;
};

export const mapTag = (tag: TagLike): GitHubTag => ({
	name: tag.name,
	commitSha: asString(tag.commit?.sha) ?? "",
});

type InstallationLike = {
	id: number;
	repository_selection?: string;
	permissions?: Record<string, string>;
	target_type?: string;
	created_at?: string;
	updated_at?: string;
	suspended_at?: string | null;
	html_url?: string;
	account?: { login?: string; type?: string; avatar_url?: string } | null;
};

export const mapInstallation = (
	installation: InstallationLike,
): GitHubInstallation => {
	const account = asRecord(installation.account);

	return {
		id: installation.id,
		repositorySelection:
			asString(installation.repository_selection) ?? "selected",
		...(asString(account.login)
			? {
					accountLogin: asString(account.login),
					accountType: asString(account.type),
					accountAvatarUrl: asString(account.avatar_url),
				}
			: {}),
		...(asString(installation.html_url)
			? { htmlUrl: asString(installation.html_url) }
			: {}),
		...(asString(installation.target_type)
			? { targetType: asString(installation.target_type) }
			: {}),
		...(installation.permissions
			? { permissions: installation.permissions }
			: {}),
		...(asString(installation.created_at)
			? { createdAt: asString(installation.created_at) }
			: {}),
		...(asString(installation.updated_at)
			? { updatedAt: asString(installation.updated_at) }
			: {}),
		suspendedAt: installation.suspended_at ?? null,
	};
};

/** Extracts rate-limit metadata from an Octokit response (when available). */
export const extractRateLimit = (
	response: { headers?: Record<string, unknown> } | undefined,
) => {
	const headers = asRecord(response?.headers);
	const limit = Number(headers["x-ratelimit-limit"]);
	const remaining = Number(headers["x-ratelimit-remaining"]);
	const reset = Number(headers["x-ratelimit-reset"]);

	if (Number.isNaN(limit) || Number.isNaN(remaining) || Number.isNaN(reset)) {
		return undefined;
	}

	return {
		limit,
		remaining,
		resetAt: new Date(reset * 1000).toISOString(),
	};
};

/**
 * Runs a paginated Octokit call and collects every page into one array.
 * Typed loosely on purpose: endpoint method generics do not compose well when
 * the caller maps the raw items; the mapper functions provide the real typing.
 */
export const paginate = async <TItem>(
	octokit: Octokit,
	endpoint: any,
	parameters: Record<string, unknown>,
): Promise<TItem[]> => {
	const response = (await octokit.paginate(
		endpoint as any,
		parameters as any,
	)) as TItem[];
	return response;
};
