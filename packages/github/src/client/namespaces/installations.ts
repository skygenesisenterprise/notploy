import type { Octokit } from "octokit";
import type {
	GitHubInstallation,
	GitHubRepository,
} from "../../types/index.js";
import {
	mapInstallation,
	mapRepository,
	paginate,
	type RepoLike,
} from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class InstallationsNamespace {
	constructor(private readonly octokit: Octokit) {}

	/**
	 * Gets installation metadata. Requires App-level authentication (JWT) when
	 * called with an appId, or works with any installation token.
	 */
	async get(parameters: {
		installationId: number | string;
	}): Promise<GitHubInstallation> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.apps.getInstallation({
				installation_id: Number(parameters.installationId),
			});
			return mapInstallation(data);
		});
	}

	/** Lists repositories accessible to the installation the client is authenticated as. */
	async listRepositories(parameters?: {
		page?: number;
		perPage?: number;
	}): Promise<GitHubRepository[]> {
		return withErrorTranslation(async () => {
			const data = await paginate<RepoLike>(
				this.octokit,
				this.octokit.rest.apps.listReposAccessibleToInstallation,
				{
					...(parameters?.perPage ? { per_page: parameters.perPage } : {}),
					...(parameters?.page ? { page: parameters.page } : {}),
				},
			);
			return data.map(mapRepository);
		});
	}

	/**
	 * Adds a repository to an installation (App JWT required).
	 * Used when a user selects additional repositories for Notploy.
	 */
	async addRepository(parameters: {
		installationId: number | string;
		repositoryId: number;
	}): Promise<void> {
		await withErrorTranslation(async () => {
			await this.octokit.rest.apps.addRepoToInstallation({
				installation_id: Number(parameters.installationId),
				repository_id: parameters.repositoryId,
			});
		});
	}

	/**
	 * Removes a repository from an installation (App JWT required).
	 */
	async removeRepository(parameters: {
		installationId: number | string;
		repositoryId: number;
	}): Promise<void> {
		await withErrorTranslation(async () => {
			await this.octokit.rest.apps.removeRepoFromInstallation({
				installation_id: Number(parameters.installationId),
				repository_id: parameters.repositoryId,
			});
		});
	}

	/**
	 * Revokes the installation token currently in use.
	 */
	async revokeToken(): Promise<void> {
		await withErrorTranslation(async () => {
			await this.octokit.rest.apps.revokeInstallationAccessToken();
		});
	}
}
