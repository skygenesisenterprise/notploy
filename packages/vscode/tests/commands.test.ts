import { beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json";
import { type CommandDeps, registerCommandHandlers } from "../src/commands";
import { resolveLogTarget } from "../src/commands/deployment-commands";
import { dashboardForNode } from "../src/commands/project-commands";
import type { Services } from "../src/services/container";
import {
	ApplicationNode,
	DeploymentApplicationNode,
	DeploymentNode,
	EnvironmentNode,
	ProjectNode,
} from "../src/ui/nodes";
import { stubInstanceManager, testLogger } from "./helpers/services";
import {
	registeredCommands,
	resetMockState,
	setConfiguration,
} from "./helpers/vscode-mock";

const PROJECT = {
	projectId: "p1",
	name: "Marketing",
	environments: [{ environmentId: "e1", name: "Production", applications: [] }],
};

const APPLICATION = { applicationId: "a1", name: "Website" };
const DEPLOYMENT = {
	deploymentId: "d1",
	title: "Release 1",
	status: "done" as const,
	applicationId: "a1",
	application: {
		applicationId: "a1",
		name: "Website",
		environment: {
			environmentId: "e1",
			name: "Production",
			project: { projectId: "p1", name: "Marketing" },
		},
	},
};

function fakeServices(): Services {
	const client = {
		projects: async () => [PROJECT],
		allApplications: async () => [APPLICATION],
		applications: async () => ({ items: [], total: 0 }),
		allDeployments: async () => [],
		deploymentQueue: async () => [],
	};
	return {
		logger: testLogger(),
		store: {} as never,
		instances: stubInstanceManager(client as never),
		auth: {} as never,
		projects: {
			allApplications: async () => [APPLICATION],
			model: async () => ({
				projects: [PROJECT],
				applicationsByEnvironment: new Map(),
			}),
			invalidate: () => {},
		} as never,
		deployments: {
			logsForApplication: vi.fn(async () => "app logs"),
			logsForDeployment: vi.fn(async () => "build logs"),
			invalidate: () => {},
		} as never,
		infrastructure: { invalidate: () => {} } as never,
		workspace: {} as never,
		logs: {} as never,
	};
}

function deps(): CommandDeps {
	return {
		services: fakeServices(),
		refresh: () => {},
		refreshInstances: () => {},
	};
}

beforeEach(() => {
	resetMockState();
	setConfiguration({});
});

describe("command registration", () => {
	it("registers every command declared in package.json", () => {
		const disposable = registerCommandHandlers(deps());
		const declared = (
			packageJson.contributes.commands as Array<{ command: string }>
		).map((entry) => entry.command);

		const missing = declared.filter((id) => !registeredCommands.has(id));
		expect(missing).toEqual([]);
		disposable.dispose();
	});

	it("registers nothing that package.json does not declare", () => {
		const disposable = registerCommandHandlers(deps());
		const declared = new Set(
			(packageJson.contributes.commands as Array<{ command: string }>).map(
				(entry) => entry.command,
			),
		);
		const extra = [...registeredCommands.keys()].filter(
			(id) => !declared.has(id),
		);
		expect(extra).toEqual([]);
		disposable.dispose();
	});

	it("only contributes menus for commands it declares", () => {
		const declared = new Set(
			(packageJson.contributes.commands as Array<{ command: string }>).map(
				(entry) => entry.command,
			),
		);
		const menus = packageJson.contributes.menus as Record<
			string,
			Array<{ command: string }>
		>;
		for (const entries of Object.values(menus)) {
			for (const entry of entries) {
				expect(declared.has(entry.command)).toBe(true);
			}
		}
	});

	it("contributes viewsWelcome only for declared views", () => {
		const views = Object.values(
			packageJson.contributes.views as Record<string, Array<{ id: string }>>,
		)
			.flat()
			.map((view) => view.id);
		const welcome = packageJson.contributes.viewsWelcome as Array<{
			view: string;
		}>;
		for (const entry of welcome) {
			expect(views).toContain(entry.view);
		}
	});
});

describe("dashboardForNode", () => {
	it("builds deep links from node data", () => {
		expect(
			dashboardForNode(
				"https://x.dev",
				new ProjectNode(PROJECT as never, async () => []),
			),
		).toContain("/dashboard/project/p1");

		expect(
			dashboardForNode(
				"https://x.dev",
				new EnvironmentNode(
					PROJECT as never,
					PROJECT.environments[0] as never,
					async () => [],
				),
			),
		).toContain("/environment/e1");

		expect(
			dashboardForNode(
				"https://x.dev",
				new ApplicationNode(
					PROJECT as never,
					PROJECT.environments[0] as never,
					APPLICATION,
					async () => [],
				),
			),
		).toContain("/services/application/a1");

		expect(
			dashboardForNode("https://x.dev", new DeploymentNode(DEPLOYMENT)),
		).toBe(
			"https://x.dev/dashboard/project/p1/environment/e1/services/application/a1",
		);
	});

	it("falls back to the dashboard root for unknown nodes", () => {
		expect(dashboardForNode("https://x.dev", {})).toBeUndefined();
	});
});

describe("resolveLogTarget", () => {
	it("uses the build log endpoint for a deployment node", async () => {
		const target = await resolveLogTarget(
			deps(),
			new DeploymentNode(DEPLOYMENT),
		);
		expect(target?.key).toBe("deployment:d1");
		expect(target?.label).toContain("build");
		expect(await target?.fetch()).toBe("build logs");
	});

	it("uses the container log endpoint for an application node", async () => {
		const node = new ApplicationNode(
			PROJECT as never,
			PROJECT.environments[0] as never,
			APPLICATION,
			async () => [],
		);
		const target = await resolveLogTarget(deps(), node);
		expect(target?.key).toBe("application:a1");
		expect(await target?.fetch()).toBe("app logs");
	});

	it("works for an application node in the Deployments view", async () => {
		const node = new DeploymentApplicationNode(
			undefined,
			undefined,
			APPLICATION,
			[DEPLOYMENT],
			async () => [],
		);
		const target = await resolveLogTarget(deps(), node);
		expect(target?.key).toBe("application:a1");
	});

	it("falls back to a quick pick when there is no node", async () => {
		const target = await resolveLogTarget(deps(), undefined);
		// A single application is picked without prompting.
		expect(target?.key).toBe("application:a1");
	});
});
