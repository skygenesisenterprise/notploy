import type { Octokit } from "octokit";
import type { GitHubCommit } from "../../types/index.js";
import { type CommitLike, mapCommit, paginate } from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class CommitsNamespace {
	constructor(private readonly octokit: Octokit) {}

	async get(parameters: {
		owner: string;
		repository: string;
		ref: string;
	}): Promise<GitHubCommit> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getCommit({
				owner: parameters.owner,
				repo: parameters.repository,
				ref: parameters.ref,
			});
			return mapCommit(data);
		});
	}

	async list(parameters: {
		owner: string;
		repository: string;
		sha?: string;
		path?: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubCommit[]> {
		return withErrorTranslation(async () => {
			const data = await paginate<CommitLike>(
				this.octokit,
				this.octokit.rest.repos.listCommits,
				{
					owner: parameters.owner,
					repo: parameters.repository,
					...(parameters.sha ? { sha: parameters.sha } : {}),
					...(parameters.path ? { path: parameters.path } : {}),
					...(parameters.perPage ? { per_page: parameters.perPage } : {}),
					...(parameters.page ? { page: parameters.page } : {}),
				},
			);
			return data.map(mapCommit);
		});
	}

	/** Compares two refs and returns the commits between them. */
	async compare(parameters: {
		owner: string;
		repository: string;
		base: string;
		head: string;
	}): Promise<{
		commits: GitHubCommit[];
		aheadBy: number;
		behindBy: number;
		totalCommits: number;
	}> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.compareCommits({
				owner: parameters.owner,
				repo: parameters.repository,
				base: parameters.base,
				head: parameters.head,
			});
			return {
				commits: data.commits.map(mapCommit),
				aheadBy: data.ahead_by,
				behindBy: data.behind_by,
				totalCommits: data.total_commits,
			};
		});
	}
}
