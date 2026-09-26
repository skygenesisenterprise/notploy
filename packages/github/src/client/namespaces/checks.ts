import type { Octokit } from "octokit";
import type {
	GitHubCheckConclusion,
	GitHubCheckRun,
	GitHubCheckStatus,
} from "../../types/index.js";
import { type CheckRunLike, mapCheckRun } from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export interface OutputOption {
	title?: string;
	summary: string;
	text?: string;
	/** Annotations shown inline on the commit diff. */
	annotations?: Array<{
		path: string;
		start_line: number;
		end_line: number;
		annotation_level: "notice" | "warning" | "failure";
		message: string;
		title?: string;
		raw_details?: string;
	}>;
	/** Images attached to the check run output. */
	images?: Array<{ alt: string; image_url: string; caption?: string }>;
}

export interface CreateCheckRunOptions {
	owner: string;
	repository: string;
	/** Name of the check shown in the GitHub UI, e.g. "Notploy Build". */
	name: string;
	/** Commit SHA the check is attached to. */
	headSha: string;
	status?: GitHubCheckStatus;
	conclusion?: GitHubCheckConclusion;
	detailsUrl?: string;
	externalId?: string;
	output?: OutputOption;
}

export interface UpdateCheckRunOptions {
	owner: string;
	repository: string;
	checkRunId: number;
	name?: string;
	status?: GitHubCheckStatus;
	conclusion?: GitHubCheckConclusion;
	detailsUrl?: string;
	output?: OutputOption;
}

export class ChecksNamespace {
	constructor(private readonly octokit: Octokit) {}

	async create(options: CreateCheckRunOptions): Promise<GitHubCheckRun> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.checks.create({
				owner: options.owner,
				repo: options.repository,
				name: options.name,
				head_sha: options.headSha,
				...(options.status ? { status: options.status } : {}),
				...(options.conclusion && options.status === "completed"
					? { conclusion: options.conclusion }
					: {}),
				...(options.detailsUrl ? { details_url: options.detailsUrl } : {}),
				...(options.externalId ? { external_id: options.externalId } : {}),
				...(options.output
					? {
							output: {
								title:
									options.output.title ?? options.output.summary.slice(0, 60),
								summary: options.output.summary,
								...(options.output.text ? { text: options.output.text } : {}),
								...(options.output.annotations
									? { annotations: options.output.annotations }
									: {}),
								...(options.output.images
									? { images: options.output.images }
									: {}),
							},
						}
					: {}),
			});
			return mapCheckRun(data as unknown as CheckRunLike);
		});
	}

	async update(options: UpdateCheckRunOptions): Promise<GitHubCheckRun> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.checks.update({
				owner: options.owner,
				repo: options.repository,
				check_run_id: options.checkRunId,
				...(options.name ? { name: options.name } : {}),
				...(options.status ? { status: options.status } : {}),
				...(options.conclusion && options.status === "completed"
					? { conclusion: options.conclusion }
					: {}),
				...(options.detailsUrl ? { details_url: options.detailsUrl } : {}),
				...(options.output
					? {
							output: {
								...(options.output.title
									? { title: options.output.title }
									: {}),
								summary: options.output.summary,
								...(options.output.text ? { text: options.output.text } : {}),
							},
						}
					: {}),
			});
			return mapCheckRun(data as unknown as CheckRunLike);
		});
	}

	async get(parameters: {
		owner: string;
		repository: string;
		checkRunId: number;
	}): Promise<GitHubCheckRun> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.checks.get({
				owner: parameters.owner,
				repo: parameters.repository,
				check_run_id: parameters.checkRunId,
			});
			return mapCheckRun(data as unknown as CheckRunLike);
		});
	}
}
