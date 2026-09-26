/**
 * `@notploy/github` — official GitHub integration layer for Notploy.
 *
 * Provides a typed, testable abstraction over the GitHub API for Notploy:
 * GitHub App authentication, installations, repositories, branches, commits,
 * pull requests, deployments, deployment statuses, checks, releases and
 * webhook verification/parsing.
 *
 * This package is a library, not the deployment engine: it never builds,
 * ships or orchestrates Notploy deployments itself.
 */

// Authentication (GitHub App + installations)
export {
	type CreateInstallationAuthOptions,
	createGitHubAppAuth,
	createGitHubAppAuthStrategy,
	createInstallationAuth,
	type GitHubAppAuthentication,
	type GitHubAppCredentials,
	type GitHubInstallationAuthentication,
	normalizePrivateKey,
	validateGitHubAppCredentials,
} from "./auth/index.js";
// Client
export {
	createGitHubClient,
	type GitHubClient,
	type GitHubClientAuth,
	type GitHubClientOptions,
} from "./client/github-client.js";
export type {
	CreateCheckRunOptions,
	UpdateCheckRunOptions,
} from "./client/namespaces/checks.js";
// Deployment option types (useful for integrations building on top)
export type {
	CreateDeploymentOptions,
	CreateDeploymentStatusOptions,
} from "./client/namespaces/deployments.js";
// Errors
export {
	GitHubApiError,
	GitHubAuthenticationError,
	GitHubAuthorizationError,
	GitHubConfigurationError,
	GitHubError,
	GitHubNotFoundError,
	GitHubRateLimitError,
	type GitHubRateLimitInfo,
	type GitHubRequestMeta,
	GitHubWebhookError,
} from "./errors/index.js";
// Domain models
export type {
	GitHubBranch,
	GitHubCheckConclusion,
	GitHubCheckRun,
	GitHubCheckStatus,
	GitHubCommit,
	GitHubDeployment,
	GitHubDeploymentState,
	GitHubDeploymentStatus,
	GitHubInstallation,
	GitHubPullRequest,
	GitHubPullRequestFile,
	GitHubRelease,
	GitHubRepository,
	GitHubTag,
	GitHubUser,
	GitHubVisibility,
} from "./types/index.js";
// Webhooks (typed events)
export type {
	GitHubInstallationAction,
	GitHubInstallationEvent,
	GitHubInstallationRepositoriesEvent,
	GitHubPullRequestAction,
	GitHubPullRequestEvent,
	GitHubPushEvent,
	GitHubReleaseEvent,
	GitHubRepositoryEvent,
	GitHubWebhookEvent,
	GitHubWebhookEventName,
	GitHubWorkflowRunEvent,
} from "./webhooks/events.js";
export { parseWebhookPayload } from "./webhooks/events.js";
