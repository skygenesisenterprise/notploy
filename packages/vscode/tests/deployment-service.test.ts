import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotployClient } from "../src/api/notploy-client";
import { DeploymentService } from "../src/services/deployment-service";
import { ProjectService } from "../src/services/project-service";
import { stubInstanceManager, testLogger } from "./helpers/services";
import { resetMockState } from "./helpers/vscode-mock";

const DEPLOYMENTS = [
	{
		deploymentId: "d2",
		title: "Release 2",
		status: "done" as const,
		createdAt: "2026-01-02T10:00:00.000Z",
		applicationId: "a1",
		application: { applicationId: "a1", name: "Website" },
	},
	{
		deploymentId: "d1",
		title: "Release 1",
		status: "error" as const,
		createdAt: "2026-01-01T10:00:00.000Z",
		applicationId: "a1",
		application: { applicationId: "a1", name: "Website" },
	},
	{
		deploymentId: "d3",
		title: "API 1",
		status: "running" as const,
		createdAt: "2026-01-03T10:00:00.000Z",
		applicationId: "a2",
		application: { applicationId: "a2", name: "API" },
	},
];

beforeEach(() => resetMockState());

function build(client: Partial<NotployClient>): {
	service: DeploymentService;
	projects: ProjectService;
} {
	const instances = stubInstanceManager(client);
	const projects = new ProjectService(instances);
	return {
		service: new DeploymentService(instances, projects, testLogger()),
		projects,
	};
}

describe("DeploymentService", () => {
	it("lists deployments newest first and groups them per application", async () => {
		const allDeployments = vi.fn(async () => DEPLOYMENTS);
		const { service } = build({ allDeployments });

		const deployments = await service.deployments();
		expect(deployments.map((entry) => entry.deploymentId)).toEqual([
			"d3",
			"d2",
			"d1",
		]);

		const grouped = await service.deploymentsByApplication();
		expect(grouped.get("a1")?.map((entry) => entry.deploymentId)).toEqual([
			"d2",
			"d1",
		]);
		// A second read is served from the cache.
		expect(allDeployments).toHaveBeenCalledTimes(1);
	});

	it("invalidates the deployment cache after a mutation", async () => {
		const allDeployments = vi.fn(async () => DEPLOYMENTS);
		const deploy = vi.fn(async () => undefined);
		const { service } = build({ allDeployments, deploy });

		await service.deployments();
		await service.deploy("a1", "Release 3");
		await service.deployments();
		expect(allDeployments).toHaveBeenCalledTimes(2);
		expect(deploy).toHaveBeenCalledWith("a1", "Release 3");
	});

	it("reads the app name before reloading, because the API requires it", async () => {
		const application = vi.fn(async () => ({
			applicationId: "a1",
			name: "Website",
			appName: "website-abc123",
		}));
		const restartApplication = vi.fn(async () => undefined);
		const { service } = build({ application, restartApplication });

		await service.restart("a1");
		expect(restartApplication).toHaveBeenCalledWith("a1", "website-abc123");
	});

	it("refuses to reload an application without an app name", async () => {
		const { service } = build({
			application: async () => ({ applicationId: "a1", name: "Website" }),
			restartApplication: async () => undefined,
		});
		await expect(service.restart("a1")).rejects.toThrow(/app name/i);
	});

	it("matches workspace applications on the Git repository, not on GitHub", async () => {
		const applications = vi.fn(async () => ({
			items: [{ applicationId: "a1", name: "Website", appName: "website" }],
			total: 1,
		}));
		const application = vi.fn(async () => ({
			applicationId: "a1",
			name: "Website",
			repository: "acme/site",
			owner: "acme",
			branch: "main",
		}));
		const allDeployments = vi.fn(async () => DEPLOYMENTS);
		const projects = vi.fn(async () => []);
		const { service } = build({
			applications,
			application,
			allDeployments,
			projects,
		});

		const matches = await service.matchApplicationsForRepository({
			repositoryRoot: "/tmp/site",
			slug: "acme/site",
			branch: "main",
		});
		expect(matches).toHaveLength(1);
		expect(matches[0]?.application.applicationId).toBe("a1");
		expect(matches[0]?.deployment.deploymentId).toBe("d2");
	});

	it("ignores applications from a different repository", async () => {
		const { service } = build({
			applications: async () => ({
				items: [{ applicationId: "a1", name: "Website" }],
				total: 1,
			}),
			application: async () => ({
				applicationId: "a1",
				name: "Website",
				repository: "acme/other",
			}),
			allDeployments: async () => DEPLOYMENTS,
			projects: async () => [],
		});

		const matches = await service.matchApplicationsForRepository({
			repositoryRoot: "/tmp/site",
			slug: "acme/site",
		});
		expect(matches).toHaveLength(0);
	});

	it("returns nothing to match when there is no Git context", async () => {
		const { service } = build({});
		expect(await service.matchApplicationsForRepository(undefined)).toEqual([]);
	});
});
