import { TtlCache } from "../core/cache";
import type {
	ApplicationSummary,
	EnvironmentSummary,
	ProjectSummary,
} from "../core/domain";
import type { InstanceManager } from "./instance-manager";

/** How long a project listing is reused before a background refresh. */
const PROJECT_TTL_MS = 10_000;

export interface ProjectTreeModel {
	projects: ProjectSummary[];
	/** `environmentId` → applications, filled from the projects payload. */
	applicationsByEnvironment: Map<string, ApplicationSummary[]>;
}

/**
 * Read model for the Projects view.
 *
 * `project.all` already embeds environments and their applications, so the tree
 * is built from a single request. The service exists so the TreeDataProvider
 * never talks to the API directly.
 */
export class ProjectService {
	private readonly projectsCache: TtlCache<ProjectTreeModel>;

	constructor(private readonly instances: InstanceManager) {
		this.projectsCache = new TtlCache(PROJECT_TTL_MS, async () => {
			const client = await this.instances.authenticatedClient();
			const projects = await client.projects();
			const applicationsByEnvironment = new Map<string, ApplicationSummary[]>();
			for (const project of projects) {
				for (const environment of project.environments ?? []) {
					applicationsByEnvironment.set(
						environment.environmentId,
						environment.applications ?? [],
					);
				}
			}
			return { projects, applicationsByEnvironment };
		});
	}

	async model(force = false): Promise<ProjectTreeModel> {
		return await this.projectsCache.get(force);
	}

	invalidate(): void {
		this.projectsCache.invalidate();
	}

	/** Finds a project by id or (case-insensitive) name. */
	async findProject(
		reference: string,
		force = false,
	): Promise<ProjectSummary | undefined> {
		const needle = reference.trim().toLowerCase();
		if (!needle) return undefined;
		const { projects } = await this.model(force);
		return (
			projects.find((project) => project.projectId.toLowerCase() === needle) ??
			projects.find((project) => project.name.trim().toLowerCase() === needle)
		);
	}

	async findEnvironment(
		project: ProjectSummary,
		reference: string,
	): Promise<EnvironmentSummary | undefined> {
		const needle = reference.trim().toLowerCase();
		const environments = project.environments ?? [];
		const byId = environments.find(
			(environment) => environment.environmentId.toLowerCase() === needle,
		);
		if (byId) return byId;
		const byName = environments.find(
			(environment) => environment.name.trim().toLowerCase() === needle,
		);
		if (byName) return byName;
		return environments.find((environment) => environment.isDefault);
	}

	/** Looks an application up across every project. */
	async findApplication(
		reference: string,
		force = false,
	): Promise<ApplicationSummary | undefined> {
		const needle = reference.trim().toLowerCase();
		if (!needle) return undefined;
		const { projects } = await this.model(force);
		for (const project of projects) {
			for (const environment of project.environments ?? []) {
				for (const application of environment.applications ?? []) {
					if (
						application.applicationId.toLowerCase() === needle ||
						application.name.trim().toLowerCase() === needle
					) {
						return application;
					}
				}
			}
		}
		return undefined;
	}

	/** All applications known through the projects payload, flattened. */
	async allApplications(force = false): Promise<ApplicationSummary[]> {
		return (await this.applicationEntries(force)).map(
			(entry) => entry.application,
		);
	}

	/**
	 * Every application with the project and environment it belongs to.
	 * `project.all` nests applications under their environment, so this needs no
	 * extra request.
	 */
	async applicationEntries(force = false): Promise<
		Array<{
			project: ProjectSummary;
			environment: EnvironmentSummary;
			application: ApplicationSummary;
		}>
	> {
		const { projects } = await this.model(force);
		const entries: Array<{
			project: ProjectSummary;
			environment: EnvironmentSummary;
			application: ApplicationSummary;
		}> = [];
		for (const project of projects) {
			for (const environment of project.environments ?? []) {
				for (const application of environment.applications ?? []) {
					entries.push({ project, environment, application });
				}
			}
		}
		return entries;
	}

	/** `applicationId` → `{project, environment}`. */
	async locateApplication(
		applicationId: string,
		force = false,
	): Promise<
		{ project: ProjectSummary; environment: EnvironmentSummary } | undefined
	> {
		const { projects } = await this.model(force);
		for (const project of projects) {
			for (const environment of project.environments ?? []) {
				const found = (environment.applications ?? []).some(
					(application) => application.applicationId === applicationId,
				);
				if (found) return { project, environment };
			}
		}
		return undefined;
	}
}
