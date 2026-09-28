import type { LogRequest } from "../api/notploy-client";
import { TtlCache } from "../core/cache";
import type {
	ApplicationSummary,
	Deployment,
	DeploymentMatch,
} from "../core/domain";
import type { Logger } from "../core/logger";
import type { InstanceManager } from "./instance-manager";
import type { ProjectService } from "./project-service";
import type { GitContext } from "./workspace-service";

const DEPLOYMENTS_TTL_MS = 5_000;
const APPLICATION_DETAILS_TTL_MS = 60_000;

/** A row from `deployment.queueList`. */
export interface DeployQueueRow {
	id?: string;
	name?: string;
	state?: string;
	timestamp?: number;
	processedOn?: number;
	finishedOn?: number;
	failedReason?: string;
	servicePath?: { href?: string | null; label?: string } | null;
}

/** An application plus the Git/image metadata `application.one` adds. */
export interface ApplicationDetails extends ApplicationSummary {
	repository?: string | null;
	owner?: string | null;
	branch?: string | null;
	dockerImage?: string | null;
	buildType?: string | null;
	environmentId?: string;
}

/**
 * Deployments and the actions that operate on them.
 *
 * Reads are cached briefly and mutations invalidate the cache, so the tree can
 * refresh after a deploy without extra round trips.
 */
export class DeploymentService {
	private readonly deploymentsCache: TtlCache<Deployment[]>;
	private readonly detailsCache = new Map<
		string,
		TtlCache<ApplicationDetails>
	>();

	constructor(
		private readonly instances: InstanceManager,
		private readonly projects: ProjectService,
		private readonly logger: Logger,
	) {
		this.deploymentsCache = new TtlCache(DEPLOYMENTS_TTL_MS, async () => {
			const client = await this.instances.authenticatedClient();
			// One request returns every deployment in the organisation, with its
			// application, environment and server already embedded.
			return await client.allDeployments();
		});
	}

	/** Every deployment visible to the credential, newest first. */
	async deployments(force = false): Promise<Deployment[]> {
		const deployments = await this.deploymentsCache.get(force);
		return [...deployments].sort(
			(left, right) =>
				Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""),
		);
	}

	/** Deployments grouped by application, newest first. */
	async deploymentsByApplication(
		force = false,
	): Promise<Map<string, Deployment[]>> {
		const grouped = new Map<string, Deployment[]>();
		for (const deployment of await this.deployments(force)) {
			const applicationId =
				deployment.applicationId ?? deployment.application?.applicationId;
			if (!applicationId) continue;
			const bucket = grouped.get(applicationId) ?? [];
			bucket.push(deployment);
			grouped.set(applicationId, bucket);
		}
		return grouped;
	}

	/**
	 * Jobs currently waiting in the deploy queue or being processed.
	 * Rows are opaque (queue ids, timestamps, state); only the fields present are
	 * shown. `deployment.queueList` is the API's own view of the queue.
	 */
	async queue(): Promise<DeployQueueRow[]> {
		const client = await this.instances.authenticatedClient();
		const rows = await client.deploymentQueue();
		return rows as DeployQueueRow[];
	}

	async history(applicationId: string, limit = 20): Promise<Deployment[]> {
		const client = await this.instances.authenticatedClient();
		const deployments = await client.deploymentsForApplication(applicationId);
		return deployments
			.sort(
				(left, right) =>
					Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""),
			)
			.slice(0, limit);
	}

	async applicationDetails(
		applicationId: string,
		force = false,
	): Promise<ApplicationDetails> {
		let cache = this.detailsCache.get(applicationId);
		if (!cache) {
			cache = new TtlCache(APPLICATION_DETAILS_TTL_MS, async () => {
				const client = await this.instances.authenticatedClient();
				return (await client.application(applicationId)) as ApplicationDetails;
			});
			this.detailsCache.set(applicationId, cache);
		}
		return await cache.get(force);
	}

	async logsForApplication(
		applicationId: string,
		request: LogRequest = {},
	): Promise<string> {
		const client = await this.instances.authenticatedClient();
		return await client.applicationLogs(applicationId, request);
	}

	async logsForDeployment(deploymentId: string, tail = 500): Promise<string> {
		const client = await this.instances.authenticatedClient();
		return await client.deploymentLogs(deploymentId, tail);
	}

	// ---------------------------------------------------------------------
	// Mutations
	// ---------------------------------------------------------------------

	async deploy(applicationId: string, title?: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.deploy(applicationId, title);
		this.invalidate();
	}

	async redeploy(applicationId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.redeploy(applicationId);
		this.invalidate();
	}

	/**
	 * `application.reload` needs the generated `appName`, which `project.all` and
	 * `application.search` do not return, so the application is read first.
	 */
	async restart(applicationId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		const details = await this.applicationDetails(applicationId);
		if (!details.appName) {
			throw new Error(
				`The instance did not report an app name for ${details.name}; it cannot be reloaded.`,
			);
		}
		await client.restartApplication(applicationId, details.appName);
		this.invalidate();
	}

	async stop(applicationId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.stopApplication(applicationId);
		this.invalidate();
	}

	async start(applicationId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.startApplication(applicationId);
		this.invalidate();
	}

	async cancel(applicationId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.cancelDeployment(applicationId);
		this.invalidate();
	}

	async removeDeployment(deploymentId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.removeDeployment(deploymentId);
		this.invalidate();
	}

	/** Terminates the process running a deployment. */
	async killProcess(deploymentId: string): Promise<void> {
		const client = await this.instances.authenticatedClient();
		await client.killDeploymentProcess(deploymentId);
		this.invalidate();
	}

	invalidate(): void {
		this.deploymentsCache.invalidate();
		this.projects.invalidate();
		this.detailsCache.clear();
	}

	// ---------------------------------------------------------------------
	// Workspace matching
	// ---------------------------------------------------------------------

	/**
	 * Finds the Notploy applications that deploy the repository open in VS Code.
	 *
	 * Matching is done on the Git remote slug (owner/repository) and branch,
	 * which requires `application.one` — `application.search` does not return the
	 * repository. Candidates are narrowed by name search first so this stays a
	 * handful of requests instead of one per application.
	 */
	async matchApplicationsForRepository(
		git: GitContext | undefined,
	): Promise<DeploymentMatch[]> {
		if (!git) return [];
		const slug = git.slug;
		const repositoryName =
			slug?.split("/").pop() ?? basename(git.repositoryRoot);
		const owner = slug?.split("/")[0];
		if (!repositoryName) return [];

		const client = await this.instances.authenticatedClient();
		const candidates = new Map<string, ApplicationSummary>();
		for (const term of [repositoryName, owner].filter(
			(value): value is string => Boolean(value),
		)) {
			try {
				const { items } = await client.applications({ q: term, limit: 25 });
				for (const item of items) candidates.set(item.applicationId, item);
			} catch (error) {
				this.logger.debug(
					"Application search failed while matching workspace",
					error,
				);
			}
		}

		const matches: DeploymentMatch[] = [];
		const deployments = await this.deployments();
		for (const candidate of [...candidates.values()].slice(0, 25)) {
			let details: ApplicationDetails;
			try {
				details = await this.applicationDetails(candidate.applicationId);
			} catch (error) {
				this.logger.debug(
					`Skipping ${candidate.applicationId} during workspace matching`,
					error,
				);
				continue;
			}
			if (!repositoryMatches(details, repositoryName, owner)) continue;
			if (git.branch && details.branch && details.branch !== git.branch) {
				this.logger.debug(
					`${candidate.name} tracks ${details.branch}, workspace is on ${git.branch}`,
				);
			}
			const deployment =
				deployments.find(
					(entry) =>
						(entry.applicationId ?? entry.application?.applicationId) ===
						candidate.applicationId,
				) ?? undefined;
			if (!deployment) continue;
			const location = await this.projects.locateApplication(
				candidate.applicationId,
			);
			matches.push({
				deployment,
				application: {
					applicationId: candidate.applicationId,
					name: candidate.name,
					appName: candidate.appName,
				},
				projectId: location?.project.projectId,
				projectName: location?.project.name,
				environmentName: location?.environment.name,
			});
		}
		return matches;
	}
}

function repositoryMatches(
	details: ApplicationDetails,
	repositoryName: string,
	owner: string | undefined,
): boolean {
	const repository = (details.repository ?? "").toLowerCase();
	if (!repository) return false;
	const short = repository.split("/").pop() ?? repository;
	if (short.replace(/\.git$/, "") !== repositoryName.toLowerCase())
		return false;
	if (!owner) return true;
	return (
		repository.includes(owner.toLowerCase()) ||
		(details.owner ?? "").toLowerCase() === owner.toLowerCase()
	);
}

function basename(path: string): string {
	const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
	return parts[parts.length - 1] ?? "";
}
