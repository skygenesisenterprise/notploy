import type { Octokit } from "octokit";
import type {
	GitHubPullRequest,
	GitHubPullRequestFile,
} from "../../types/index.js";
import {
	mapPullRequest,
	mapPullRequestFile,
	type PullRequestFileLike,
	type PullRequestLike,
	paginate,
} from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export class PullRequestsNamespace {
	constructor(private readonly octokit: Octokit) {}

	async get(parameters: {
		owner: string;
		repository: string;
		pullNumber: number;
	}): Promise<GitHubPullRequest> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.pulls.get({
				owner: parameters.owner,
				repo: parameters.repository,
				pull_number: parameters.pullNumber,
			});
			return mapPullRequest(data);
		});
	}

	async list(parameters: {
		owner: string;
		repository: string;
		state?: "open" | "closed" | "all";
		head?: string;
		base?: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubPullRequest[]> {
		return withErrorTranslation(async () => {
			const data = await paginate<PullRequestLike>(
				this.octokit,
				this.octokit.rest.pulls.list,
				{
					owner: parameters.owner,
					repo: parameters.repository,
					state: parameters.state ?? "open",
					...(parameters.head ? { head: parameters.head } : {}),
					...(parameters.base ? { base: parameters.base } : {}),
					...(parameters.perPage ? { per_page: parameters.perPage } : {}),
					...(parameters.page ? { page: parameters.page } : {}),
				},
			);
			return data.map(mapPullRequest);
		});
	}

	async listCommits(parameters: {
		owner: string;
		repository: string;
		pullNumber: number;
	}): Promise<GitHubCommitLike[]> {
		return withErrorTranslation(async () => {
			const data = await this.octokit.paginate.iterator(
				this.octokit.rest.pulls.listCommits,
				{
					owner: parameters.owner,
					repo: parameters.repository,
					pull_number: parameters.pullNumber,
					per_page: 100,
				},
			);
			const commits: GitHubCommitLike[] = [];
			for await (const page of data) {
				for (const commit of page.data) {
					commits.push(commit);
				}
			}
			return commits;
		});
	}

	async listFiles(parameters: {
		owner: string;
		repository: string;
		pullNumber: number;
	}): Promise<GitHubPullRequestFile[]> {
		return withErrorTranslation(async () => {
			const data = await paginate<PullRequestFileLike>(
				this.octokit,
				this.octokit.rest.pulls.listFiles,
				{
					owner: parameters.owner,
					repo: parameters.repository,
					pull_number: parameters.pullNumber,
				},
			);
			return data.map(mapPullRequestFile);
		});
	}

	async createComment(parameters: {
		owner: string;
		repository: string;
		pullNumber: number;
		body: string;
	}): Promise<{ id: number; htmlUrl: string }> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.issues.createComment({
				owner: parameters.owner,
				repo: parameters.repository,
				issue_number: parameters.pullNumber,
				body: parameters.body,
			});
			return { id: data.id, htmlUrl: data.html_url };
		});
	}

	async updateComment(parameters: {
		owner: string;
		repository: string;
		commentId: number;
		body: string;
	}): Promise<{ id: number; htmlUrl: string }> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.issues.updateComment({
				owner: parameters.owner,
				repo: parameters.repository,
				comment_id: parameters.commentId,
				body: parameters.body,
			});
			return { id: data.id, htmlUrl: data.html_url };
		});
	}

	async listComments(parameters: {
		owner: string;
		repository: string;
		pullNumber: number;
	}): Promise<
		Array<{ id: number; body: string; authorLogin?: string; htmlUrl: string }>
	> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.issues.listComments({
				owner: parameters.owner,
				repo: parameters.repository,
				issue_number: parameters.pullNumber,
			});
			return data.map((comment) => ({
				id: comment.id,
				body: comment.body ?? "",
				...(comment.user?.login ? { authorLogin: comment.user.login } : {}),
				htmlUrl: comment.html_url,
			}));
		});
	}
}

interface GitHubCommitLike {
	sha: string;
	commit: {
		message?: string;
		author?: { name?: string; email?: string; date?: string } | null;
		committer?: { name?: string; email?: string; date?: string } | null;
	} | null;
	html_url?: string;
	author?: { login?: string } | null;
}
