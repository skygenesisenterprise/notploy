/**
 * Shared GitHub integration contract.
 *
 * This module defines the vocabulary the GitHub App and the CI/CD
 * (`notploy-actions`) path both use to describe a deployment request. It is
 * deliberately free of I/O, database, queue and deployment-policy code: it only
 * names things, so neither integration can drift into its own dialect.
 *
 * Versioning: the contract is additive within a major version. Consumers should
 * tolerate unknown fields and unknown `origin` values (see `isDeploymentOrigin`).
 */

/**
 * Where a deployment request came from.
 *
 * `github_app` — Notploy reacted to a GitHub App webhook delivery.
 * `github_actions` — a workflow explicitly requested the deployment.
 * `manual` / `api` / `schedule` — Notploy-initiated paths.
 */
export const deploymentOrigins = [
	"github_app",
	"github_actions",
	"manual",
	"api",
	"schedule",
] as const;

export type DeploymentOrigin = (typeof deploymentOrigins)[number];

export const isDeploymentOrigin = (value: unknown): value is DeploymentOrigin =>
	typeof value === "string" &&
	(deploymentOrigins as readonly string[]).includes(value);

/** A repository, identified the way GitHub identifies it. */
export interface GitHubRepositoryIdentity {
	/** Numeric GitHub repository id. Stable across renames and transfers. */
	id: number;
	/** Account login owning the repository (user or organization). */
	owner: string;
	/** Repository name without the owner prefix. */
	name: string;
}

/** The installation that granted Notploy access to a set of repositories. */
export interface GitHubInstallationIdentity {
	installationId: number;
	/** Login of the account the App is installed on, when known. */
	accountLogin?: string;
}

export type GitHubRefKind = "branch" | "tag" | "commit";

/** A resolved Git reference: the short name plus the full ref. */
export interface GitHubRef {
	kind: GitHubRefKind;
	/** `refs/heads/main` -> `main`, `refs/tags/v1.0.0` -> `v1.0.0`. */
	name: string;
	/** Full ref as GitHub reports it, e.g. `refs/heads/main`. */
	ref: string;
}

export const repositoryFullName = (
	repository: Pick<GitHubRepositoryIdentity, "owner" | "name">,
): string => `${repository.owner}/${repository.name}`;

const SHA_REGEX = /^[0-9a-fA-F]{7,64}$/;

/**
 * Classifies a Git ref without guessing.
 *
 * Pull-request refs (`refs/pull/42/merge`) and anything else Notploy cannot
 * deploy are reported as `null` rather than as a branch named `refs/pull/...`.
 */
export const parseGitRef = (
	ref: string | null | undefined,
): GitHubRef | null => {
	const value = ref?.trim();
	if (!value) {
		return null;
	}

	if (value.startsWith("refs/heads/")) {
		const name = value.slice("refs/heads/".length);
		return name ? { kind: "branch", name, ref: value } : null;
	}

	if (value.startsWith("refs/tags/")) {
		const name = value.slice("refs/tags/".length);
		return name ? { kind: "tag", name, ref: value } : null;
	}

	if (SHA_REGEX.test(value) && !value.startsWith("refs/")) {
		return { kind: "commit", name: value.toLowerCase(), ref: value };
	}

	return null;
};

/**
 * Everything Notploy needs to trace a deployment back to GitHub.
 *
 * This is correlation metadata only: it carries no deployment policy, no
 * credentials and no installation token.
 */
export interface GitHubDeploymentTrigger {
	origin: DeploymentOrigin;
	repository: GitHubRepositoryIdentity;
	/** Installation whose token performed the operation, when known. */
	installationId?: number;
	/** Commit actually built. Empty string means "not resolved yet". */
	commitSha: string;
	ref?: GitHubRef;
	pullRequestNumber?: number;
	/** `X-GitHub-Delivery` of the event that triggered this deployment. */
	deliveryId?: string;
	/** GitHub login of the actor that triggered the event or workflow. */
	actor?: string;
	/** GitHub Actions run id, when the request came from a workflow. */
	workflowRunId?: string;
	/** Deep link to the workflow run, when available. */
	workflowRunUrl?: string;
	/** Notploy environment name the deployment targets. */
	environment?: string;
}

export interface BuildIdempotencyKeyOptions {
	origin: DeploymentOrigin;
	repository: Pick<GitHubRepositoryIdentity, "owner" | "name">;
	commitSha: string;
	environment?: string;
	/** Required for `github_app`: the delivery is what makes the event unique. */
	deliveryId?: string;
	/** Required for `github_actions`: the workflow run is the unique request. */
	workflowRunId?: string;
}

/**
 * Builds the idempotency key for an externally triggered deployment.
 *
 * The key intentionally includes the delivery/run discriminator, so:
 *
 * - a GitHub redelivery of the same event (same `X-GitHub-Delivery`) is
 *   recognised as a duplicate and does not create a second deployment;
 * - a *new* event for the same commit (a fresh push delivery, a re-run of a
 *   workflow, a manual redeploy) gets a new key and does deploy, because those
 *   are intentional actions;
 * - two environments of the same commit stay distinct.
 *
 * `undefined` means "not idempotent": manual and API deployments are allowed to
 * repeat, so no key is invented for them.
 */
export const buildDeploymentIdempotencyKey = (
	options: BuildIdempotencyKeyOptions,
): string | undefined => {
	const sha = options.commitSha?.trim().toLowerCase();
	if (!sha || !SHA_REGEX.test(sha)) {
		return undefined;
	}

	const repository = `${options.repository.owner.trim().toLowerCase()}/${options.repository.name.trim().toLowerCase()}`;
	const environment = options.environment?.trim().toLowerCase() || "-";

	if (options.origin === "github_app") {
		const delivery = options.deliveryId?.trim();
		if (!delivery) return undefined;
		return `v1:github_app:${repository}:${sha}:${environment}:${delivery}`;
	}

	if (options.origin === "github_actions") {
		const run = options.workflowRunId?.trim();
		if (!run) return undefined;
		return `v1:github_actions:${repository}:${sha}:${environment}:${run}`;
	}

	return undefined;
};
