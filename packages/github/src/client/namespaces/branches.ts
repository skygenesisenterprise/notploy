import type { Octokit } from "octokit";
import type { GitHubBranch } from "../../types/index.js";
import { type BranchLike, mapBranch, paginate } from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class BranchesNamespace {
	constructor(private readonly octokit: Octokit) {}

	async list(parameters: {
		owner: string;
		repository: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubBranch[]> {
		return withErrorTranslation(async () => {
			const data = await paginate<BranchLike>(
				this.octokit,
				this.octokit.rest.repos.listBranches,
				{
					owner: parameters.owner,
					repo: parameters.repository,
					...(parameters.perPage ? { per_page: parameters.perPage } : {}),
					...(parameters.page ? { page: parameters.page } : {}),
				},
			);
			return data.map(mapBranch);
		});
	}

	async get(parameters: {
		owner: string;
		repository: string;
		branch: string;
	}): Promise<GitHubBranch> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getBranch({
				owner: parameters.owner,
				repo: parameters.repository,
				branch: parameters.branch,
			});
			return mapBranch({
				name: data.name,
				commit: { sha: data.commit.sha },
				protected: data.protected,
			});
		});
	}

	/** Resolves a ref (branch name, tag or SHA) to an exact commit SHA. */
	async resolve(parameters: {
		owner: string;
		repository: string;
		ref: string;
	}): Promise<{ sha: string; ref: string }> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getCommit({
				owner: parameters.owner,
				repo: parameters.repository,
				ref: parameters.ref,
			});
			return { sha: data.sha, ref: parameters.ref };
		});
	}
}
