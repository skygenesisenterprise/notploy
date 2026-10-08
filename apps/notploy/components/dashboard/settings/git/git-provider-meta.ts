import type { ComponentType } from "react";
import {
	BitbucketIcon,
	GiteaIcon,
	GithubIcon,
	GitlabIcon,
} from "@/components/icons/data-tools-icons";

/**
 * Client-side metadata for the normalized Git provider UI.
 *
 * Mirrors `dns-provider-meta.ts` so the Git Providers page follows the same
 * conventions as DNS and Object Storage: a provider *type* (GitHub, GitLab, …)
 * is separated from a provider *instance/connection* (a name + endpoint +
 * credentials), and the type only describes what the connection can do.
 *
 * The labels deliberately duplicate the server's `gitProviderLabels` instead of
 * importing the server barrel: these are static strings a client component can
 * ship without pulling the server runtime (db, docker, …) into the bundle.
 */

export const gitProviderTypeOrder = [
	"github",
	"gitlab",
	"bitbucket",
	"gitea",
] as const;

export type GitProviderType = (typeof gitProviderTypeOrder)[number];

export const gitProviderLabels: Record<GitProviderType, string> = {
	github: "GitHub",
	gitlab: "GitLab",
	bitbucket: "Bitbucket",
	gitea: "Gitea",
};

export const gitProviderIcons: Record<
	GitProviderType,
	ComponentType<{ className?: string }>
> = {
	github: GithubIcon,
	gitlab: GitlabIcon,
	bitbucket: BitbucketIcon,
	gitea: GiteaIcon,
};

export const gitProviderLabel = (providerType: string) =>
	gitProviderLabels[providerType as GitProviderType] ?? providerType;

export const isGitProviderType = (value: string): value is GitProviderType =>
	(gitProviderTypeOrder as readonly string[]).includes(value);

export const gitProviderIcon = (providerType: string) =>
	gitProviderIcons[valueOrGithub(providerType)];

const valueOrGithub = (providerType: string): GitProviderType =>
	isGitProviderType(providerType) ? providerType : "github";

/**
 * Grouping for the provider selector. Grouping by *authorization model* is the
 * only split that is both meaningful and non-duplicating: every one of these
 * forges can be reached at its SaaS endpoint or at a self-hosted one, so
 * grouping by deployment target would list each provider twice.
 */
export const gitProviderCategoryOrder = ["app", "token"] as const;
export type GitProviderCategory = (typeof gitProviderCategoryOrder)[number];

export const gitProviderCategoryByType: Record<
	GitProviderType,
	GitProviderCategory
> = {
	github: "app",
	gitlab: "app",
	gitea: "app",
	bitbucket: "token",
};

export const gitProviderCategoryLabels: Record<GitProviderCategory, string> = {
	app: "Apps & OAuth",
	token: "API tokens",
};

export const gitProviderCategoryDescriptions: Record<
	GitProviderCategory,
	string
> = {
	app: "Authorize Notploy through a provider app or an OAuth grant.",
	token: "Authenticate with an API token belonging to the connection.",
};

/** SaaS endpoint each type defaults to; `null` when the forge has no SaaS mode. */
export const gitProviderDefaultEndpoint: Record<GitProviderType, string | null> =
	{
		github: "https://github.com",
		gitlab: "https://gitlab.com",
		bitbucket: null,
		gitea: "https://gitea.com",
	};

/** Endpoint a connection points at, when the type stores one. */
export const gitProviderEndpoint = (provider: {
	providerType: string;
	github?: { githubUrl?: string | null } | null;
	gitlab?: { gitlabUrl?: string | null } | null;
	gitea?: { giteaUrl?: string | null } | null;
}): string | null => {
	switch (provider.providerType) {
		case "github":
			return provider.github?.githubUrl ?? null;
		case "gitlab":
			return provider.gitlab?.gitlabUrl ?? null;
		case "gitea":
			return provider.gitea?.giteaUrl ?? null;
		default:
			return null;
	}
};

/** True when the connection targets a self-hosted endpoint rather than SaaS. */
export const gitProviderIsSelfHosted = (provider: {
	providerType: string;
	github?: { githubUrl?: string | null } | null;
	gitlab?: { gitlabUrl?: string | null } | null;
	gitea?: { giteaUrl?: string | null } | null;
}): boolean => {
	const endpoint = gitProviderEndpoint(provider);
	const defaultEndpoint =
		gitProviderDefaultEndpoint[provider.providerType as GitProviderType];
	if (!endpoint) return false;
	return !!defaultEndpoint && endpoint !== defaultEndpoint;
};

export const gitHealthLabels: Record<string, string> = {
	connected: "Connected",
	needsAuthorization: "Needs authorization",
	misconfigured: "Misconfigured",
	unreachable: "Unreachable",
};

export const gitCapabilityLabels: Record<string, string> = {
	repositories: "Repositories",
	repositorySearch: "Repository search",
	branches: "Branches",
	commits: "Commits",
	repositoryPermissions: "Repository permissions",
	organizations: "Organizations",
	organizationRepositories: "Organization repositories",
	privateRepositories: "Private repositories",
	webhooks: "Webhooks",
	appAuthorization: "App authorization",
};

export const gitCapabilityOrder = [
	"repositories",
	"repositorySearch",
	"branches",
	"commits",
	"repositoryPermissions",
	"organizations",
	"organizationRepositories",
	"privateRepositories",
	"webhooks",
	"appAuthorization",
] as const;
