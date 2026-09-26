import type { Octokit } from "octokit";
import type { GitHubRelease, GitHubTag } from "../../types/index.js";
import { mapRelease, mapTag } from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class ReleasesNamespace {
	constructor(private readonly octokit: Octokit) {}

	async list(parameters: {
		owner: string;
		repository: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubRelease[]> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.listReleases({
				owner: parameters.owner,
				repo: parameters.repository,
				...(parameters.perPage ? { per_page: parameters.perPage } : {}),
				...(parameters.page ? { page: parameters.page } : {}),
			});
			return data.map(mapRelease);
		});
	}

	async getLatest(parameters: {
		owner: string;
		repository: string;
	}): Promise<GitHubRelease> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getLatestRelease({
				owner: parameters.owner,
				repo: parameters.repository,
			});
			return mapRelease(data);
		});
	}

	async getByTag(parameters: {
		owner: string;
		repository: string;
		tag: string;
	}): Promise<GitHubRelease> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getReleaseByTag({
				owner: parameters.owner,
				repo: parameters.repository,
				tag: parameters.tag,
			});
			return mapRelease(data);
		});
	}

	async listTags(parameters: {
		owner: string;
		repository: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubTag[]> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.listTags({
				owner: parameters.owner,
				repo: parameters.repository,
				...(parameters.perPage ? { per_page: parameters.perPage } : {}),
				...(parameters.page ? { page: parameters.page } : {}),
			});
			return data.map(mapTag);
		});
	}
}
