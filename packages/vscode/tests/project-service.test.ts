import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotployClient } from "../src/api/notploy-client";
import { ProjectService } from "../src/services/project-service";
import { stubInstanceManager } from "./helpers/services";
import { resetMockState } from "./helpers/vscode-mock";

const PROJECTS = [
	{
		projectId: "p1",
		name: "Marketing",
		description: "Public site",
		createdAt: "2026-01-01T10:00:00.000Z",
		environments: [
			{
				environmentId: "e1",
				name: "Production",
				isDefault: true,
				applications: [
					{
						applicationId: "a1",
						name: "Website",
						applicationStatus: "done" as const,
					},
				],
			},
			{ environmentId: "e2", name: "Staging", applications: [] },
		],
	},
	{
		projectId: "p2",
		name: "Platform",
		environments: [
			{
				environmentId: "e3",
				name: "Production",
				applications: [
					{
						applicationId: "a2",
						name: "API",
						applicationStatus: "error" as const,
					},
				],
			},
		],
	},
];

beforeEach(() => resetMockState());

function serviceWith(client: Partial<NotployClient>): ProjectService {
	return new ProjectService(stubInstanceManager(client));
}

describe("ProjectService", () => {
	it("builds the model from a single request", async () => {
		const projects = vi.fn(async () => PROJECTS);
		const service = serviceWith({ projects });

		const model = await service.model();
		expect(projects).toHaveBeenCalledTimes(1);
		expect(model.projects).toHaveLength(2);
		expect(model.applicationsByEnvironment.get("e1")).toHaveLength(1);
	});

	it("serves repeated reads from the cache and refreshes on demand", async () => {
		const projects = vi.fn(async () => PROJECTS);
		const service = serviceWith({ projects });

		await service.model();
		await service.model();
		expect(projects).toHaveBeenCalledTimes(1);

		await service.model(true);
		expect(projects).toHaveBeenCalledTimes(2);
	});

	it("finds projects by id or name, case-insensitively", async () => {
		const service = serviceWith({ projects: async () => PROJECTS });
		expect((await service.findProject("p2"))?.name).toBe("Platform");
		expect((await service.findProject("marketing"))?.projectId).toBe("p1");
		expect(await service.findProject("nope")).toBeUndefined();
	});

	it("finds applications across projects and locates them", async () => {
		const service = serviceWith({ projects: async () => PROJECTS });
		expect((await service.findApplication("a2"))?.name).toBe("API");

		const location = await service.locateApplication("a1");
		expect(location?.project.projectId).toBe("p1");
		expect(location?.environment.environmentId).toBe("e1");
	});

	it("falls back to the default environment", async () => {
		const service = serviceWith({ projects: async () => PROJECTS });
		const project = await service.findProject("p1");
		const environment = await service.findEnvironment(
			project!,
			"does-not-exist",
		);
		expect(environment?.environmentId).toBe("e1");
	});

	it("returns entries with their project and environment", async () => {
		const service = serviceWith({ projects: async () => PROJECTS });
		const entries = await service.applicationEntries();
		expect(entries).toHaveLength(2);
		expect(entries[0]?.project.name).toBe("Marketing");
		expect(entries[0]?.environment.name).toBe("Production");
	});

	it("propagates failures so the tree can render an error node", async () => {
		// Error normalisation belongs to NotployClient; the service must not swallow
		// the failure, otherwise the TreeDataProvider would show an empty view.
		const service = serviceWith({
			projects: async () => {
				throw Object.assign(new Error("nope"), { status: 403 });
			},
		});
		await expect(service.model()).rejects.toThrow("nope");
	});
});
