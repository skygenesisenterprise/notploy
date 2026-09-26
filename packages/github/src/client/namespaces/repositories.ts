import type { Octokit } from "octokit";
import type { GitHubRepository } from "../../types/index.js";
import { mapRepository, type RepoLike } from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class RepositoriesNamespace {
	constructor(private readonly octokit: Octokit) {}

	async get(parameters: {
		owner: string;
		repository: string;
	}): Promise<GitHubRepository> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.get({
				owner: parameters.owner,
				repo: parameters.repository,
			});
			return mapRepository(data);
		});
	}

	async listForAuthenticatedInstallation(parameters?: {
		page?: number;
		perPage?: number;
	}): Promise<GitHubRepository[]> {
		return withErrorTranslation(async () => {
			const { data } =
				await this.octokit.rest.apps.listReposAccessibleToInstallation({
					...(parameters?.perPage ? { per_page: parameters.perPage } : {}),
					...(parameters?.page ? { page: parameters.page } : {}),
				});
			return (data.repositories as unknown as RepoLike[]).map(mapRepository);
		});
	}

	async listForOwner(parameters: {
		owner: string;
		type?: "all" | "owner" | "member";
		page?: number;
		perPage?: number;
	}): Promise<GitHubRepository[]> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.listForUser({
				username: parameters.owner,
				type: parameters.type ?? "owner",
				...(parameters.perPage ? { per_page: parameters.perPage } : {}),
				...(parameters.page ? { page: parameters.page } : {}),
			});
			return (data as unknown as RepoLike[]).map(mapRepository);
		});
	}

	async getPermissions(parameters: {
		owner: string;
		repository: string;
		username: string;
	}): Promise<{ permission: "read" | "write" | "admin" | "none" }> {
		return withErrorTranslation(async () => {
			const { data } =
				await this.octokit.rest.repos.getCollaboratorPermissionLevel({
					owner: parameters.owner,
					repo: parameters.repository,
					username: parameters.username,
				});
			const level = data.permission;
			if (level === "admin" || level === "write" || level === "read") {
				return { permission: level };
			}
			return { permission: "none" };
		});
	}
}
