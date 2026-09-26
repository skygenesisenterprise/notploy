/**
 * Domain models exposed by `@notploy/github`.
 *
 * These are Notploy-facing projections of the GitHub REST API responses. They
 * intentionally expose a small, stable surface: internal consumers must not
 * depend on the full GitHub payload shape, so fields can be added here without
 * leaking upstream API churn.
 */

export type GitHubVisibility = "public" | "private" | "internal";

export interface GitHubUser {
	id: number;
	login: string;
	type: string;
	avatarUrl?: string;
	htmlUrl?: string;
}

export interface GitHubRepository {
	id: number;
	name: string;
	/** "owner/name" full name. */
	fullName: string;
	owner: string;
	private: boolean;
	visibility?: GitHubVisibility;
	description?: string | null;
	htmlUrl: string;
	cloneUrl?: string;
	defaultBranch: string;
	language?: string | null;
	archived: boolean;
	disabled: boolean;
	fork: boolean;
	createdAt?: string;
	updatedAt?: string;
	pushedAt?: string;
}

export interface GitHubBranch {
	name: string;
	commitSha: string;
	protected: boolean;
}

export interface GitHubCommit {
	sha: string;
	message: string;
	author?: {
		name?: string;
		email?: string;
		date?: string;
	} | null;
	committer?: {
		name?: string;
		email?: string;
		date?: string;
	} | null;
	htmlUrl: string;
	authorLogin?: string;
}

export interface GitHubPullRequest {
	id: number;
	number: number;
	title: string;
	state: "open" | "closed";
	draft: boolean;
	merged?: boolean;
	/** Branch the changes come from. */
	headRef: string;
	/** Branch the changes target. */
	baseRef: string;
	headSha: string;
	htmlUrl: string;
	authorLogin?: string;
	createdAt?: string;
	updatedAt?: string;
	closedAt?: string | null;
	mergedAt?: string | null;
}

export interface GitHubPullRequestFile {
	filename: string;
	previousFilename?: string | null;
	status:
		| "added"
		| "removed"
		| "modified"
		| "renamed"
		| "changed"
		| "copied"
		| "unchanged";
	additions: number;
	deletions: number;
	changes: number;
	patch?: string | null;
}

export type GitHubDeploymentState =
	| "queued"
	| "in_progress"
	| "success"
	| "failure"
	| "error"
	| "inactive";

export interface GitHubDeployment {
	id: number;
	sha: string;
	ref: string;
	task: string;
	environment: string;
	description?: string | null;
	creatorLogin?: string;
	createdAt?: string;
	updatedAt?: string;
	htmlUrl: string;
}

export interface GitHubDeploymentStatus {
	id: number;
	state: GitHubDeploymentState;
	description?: string | null;
	environmentUrl?: string | null;
	logUrl?: string | null;
	creatorLogin?: string;
	createdAt?: string;
	updatedAt?: string;
}

export type GitHubCheckConclusion =
	| "success"
	| "failure"
	| "neutral"
	| "cancelled"
	| "timed_out"
	| "action_required"
	| "stale"
	| "skipped";

export type GitHubCheckStatus = "queued" | "in_progress" | "completed";

export interface GitHubCheckRun {
	id: number;
	name: string;
	headSha: string;
	status: GitHubCheckStatus;
	conclusion?: GitHubCheckConclusion | null;
	detailsUrl?: string | null;
	startedAt?: string;
	completedAt?: string | null;
	htmlUrl?: string;
}

export interface GitHubRelease {
	id: number;
	tagName: string;
	name?: string | null;
	draft: boolean;
	prerelease: boolean;
	createdAt?: string;
	publishedAt?: string | null;
	htmlUrl: string;
}

export interface GitHubTag {
	name: string;
	commitSha: string;
}

export interface GitHubInstallation {
	id: number;
	/** "all" or "selected" repositories. */
	repositorySelection: string;
	accountLogin?: string;
	accountType?: string;
	accountAvatarUrl?: string;
	/** URL slug of the account, when available. */
	htmlUrl?: string;
	targetType?: string;
	permissions?: Record<string, string>;
	createdAt?: string;
	updatedAt?: string;
	suspendedAt?: string | null;
}

export interface GitHubInstallationPermissions {
	permission: "read" | "write" | "admin" | "none";
	roleName?: string;
	userLogin?: string;
}
