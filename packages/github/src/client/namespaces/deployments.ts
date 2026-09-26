import type { Octokit } from "octokit";
import type {
	GitHubDeployment,
	GitHubDeploymentState,
	GitHubDeploymentStatus,
} from "../../types/index.js";
import {
	type DeploymentLike,
	mapDeployment,
	mapDeploymentStatus,
} from "../../types/mappers.js";
import { withErrorTranslation } from "../error-translation.js";

export interface CreateDeploymentOptions {
	owner: string;
	repository: string;
	/** Branch name, tag or full commit SHA to deploy. */
	ref: string;
	/** Environment name, e.g. "production" or "preview". */
	environment: string;
	description?: string;
	/** Optional payload surfaced in webhook events for this deployment. */
	payload?: Record<string, unknown>;
	/** Set to false when deploying something that is not a Git ref (e.g. a Docker digest). */
	autoMerge?: boolean;
	/** Mark as transient (preview) or stable (production) deployment. */
	transientEnvironment?: boolean;
	/** GitHub environment to inherit variables/protection rules from. */
	productionEnvironment?: boolean;
	/** Required contexts that must pass before the deployment proceeds. */
	requiredContexts?: string[];
}

export interface CreateDeploymentStatusOptions {
	owner: string;
	repository: string;
	deploymentId: number;
	state: GitHubDeploymentState;
	/** Human-readable summary shown in the GitHub UI (max 140 chars). */
	description?: string;
	/** URL of the deployed environment, shown on the commit/PR. */
	environmentUrl?: string;
	/** URL of the build/deploy logs. */
	logUrl?: string;
}

export class DeploymentsNamespace {
	constructor(private readonly octokit: Octokit) {}

	async create(options: CreateDeploymentOptions): Promise<GitHubDeployment> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.createDeployment({
				owner: options.owner,
				repo: options.repository,
				ref: options.ref,
				environment: options.environment,
				...(options.description ? { description: options.description } : {}),
				...(options.payload ? { payload: options.payload } : {}),
				...(options.autoMerge !== undefined
					? { auto_merge: options.autoMerge }
					: {}),
				...(options.transientEnvironment !== undefined
					? { transient_environment: options.transientEnvironment }
					: {}),
				...(options.productionEnvironment !== undefined
					? { production_environment: options.productionEnvironment }
					: {}),
				...(options.requiredContexts
					? { required_contexts: options.requiredContexts }
					: {}),
			});
			return mapDeployment(data as unknown as DeploymentLike);
		});
	}

	async get(parameters: {
		owner: string;
		repository: string;
		deploymentId: number;
	}): Promise<GitHubDeployment> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.getDeployment({
				owner: parameters.owner,
				repo: parameters.repository,
				deployment_id: parameters.deploymentId,
			});
			return mapDeployment(data);
		});
	}

	async list(parameters: {
		owner: string;
		repository: string;
		environment?: string;
		sha?: string;
		page?: number;
		perPage?: number;
	}): Promise<GitHubDeployment[]> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.listDeployments({
				owner: parameters.owner,
				repo: parameters.repository,
				...(parameters.environment
					? { environment: parameters.environment }
					: {}),
				...(parameters.sha ? { sha: parameters.sha } : {}),
				...(parameters.perPage ? { per_page: parameters.perPage } : {}),
				...(parameters.page ? { page: parameters.page } : {}),
			});
			return data.map(mapDeployment);
		});
	}

	async createStatus(
		options: CreateDeploymentStatusOptions,
	): Promise<GitHubDeploymentStatus> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.createDeploymentStatus({
				owner: options.owner,
				repo: options.repository,
				deployment_id: options.deploymentId,
				state: options.state,
				...(options.description ? { description: options.description } : {}),
				...(options.environmentUrl
					? { environment_url: options.environmentUrl }
					: {}),
				...(options.logUrl ? { log_url: options.logUrl } : {}),
			});
			return mapDeploymentStatus(data);
		});
	}

	async listStatuses(parameters: {
		owner: string;
		repository: string;
		deploymentId: number;
	}): Promise<GitHubDeploymentStatus[]> {
		return withErrorTranslation(async () => {
			const { data } = await this.octokit.rest.repos.listDeploymentStatuses({
				owner: parameters.owner,
				repo: parameters.repository,
				deployment_id: parameters.deploymentId,
			});
			return data.map(mapDeploymentStatus);
		});
	}
}
