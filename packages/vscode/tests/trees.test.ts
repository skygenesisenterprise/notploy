import { beforeEach, describe, expect, it } from "vitest";
import { TreeItemCollapsibleState } from "vscode";
import type { NotployClient } from "../src/api/notploy-client";
import { CONTEXT } from "../src/core/constants";
import {
	EMPTY_CAPABILITIES,
	type InstanceCapabilities,
} from "../src/core/domain";
import { DeploymentService } from "../src/services/deployment-service";
import { InfrastructureService } from "../src/services/infrastructure-service";
import { ProjectService } from "../src/services/project-service";
import { ErrorNode, InstanceNode, MessageNode } from "../src/ui/nodes";
import { DeploymentsTreeProvider } from "../src/ui/trees/deployments-tree";
import { InfrastructureTreeProvider } from "../src/ui/trees/infrastructure-tree";
import { InstancesTreeProvider } from "../src/ui/trees/instances-tree";
import { ProjectsTreeProvider } from "../src/ui/trees/projects-tree";
import {
	stubInstanceManager,
	testInstance,
	testLogger,
} from "./helpers/services";
import { resetMockState, setConfiguration } from "./helpers/vscode-mock";

const PROJECTS = [
	{
		projectId: "p1",
		name: "Marketing",
		createdAt: "2026-01-01T00:00:00.000Z",
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
		],
	},
];

const DEPLOYMENTS = [
	{
		deploymentId: "d1",
		title: "Release 1",
		status: "done" as const,
		createdAt: "2026-01-02T00:00:00.000Z",
		applicationId: "a1",
		application: { applicationId: "a1", name: "Website" },
	},
];

function stubClient(
	overrides: Partial<NotployClient> = {},
): Partial<NotployClient> {
	return {
		projects: async () => PROJECTS as never,
		allDeployments: async () => DEPLOYMENTS as never,
		applications: async () => ({ items: [], total: 0 }),
		servers: async () => [],
		containers: async () => [],
		images: async () => [],
		volumes: async () => [],
		volumesSize: async () => [],
		networks: async () => [],
		swarmNodes: async () => [],
		deploymentQueue: async () => [],
		...overrides,
	};
}

beforeEach(() => {
	resetMockState();
	setConfiguration({});
});

describe("InstancesTreeProvider", () => {
	it("shows an empty state when nothing is configured", async () => {
		const instances = stubInstanceManager(stubClient());
		(instances as unknown as { list: () => unknown[] }).list = () => [];
		const provider = new InstancesTreeProvider(testLogger(), instances);

		const roots = await provider.getChildren();
		expect(roots).toHaveLength(1);
		expect(roots[0]).toBeInstanceOf(MessageNode);
		expect(String(roots[0]?.label)).toContain("No Notploy instance configured");
	});

	it("renders one node per instance with the active one marked", async () => {
		const instances = stubInstanceManager(
			stubClient(),
			testInstance({ hasCredential: false }),
		);
		const provider = new InstancesTreeProvider(testLogger(), instances);

		const roots = await provider.getChildren();
		expect(roots[0]).toBeInstanceOf(InstanceNode);
		expect(roots[0]?.description).toContain("active");
		expect(roots[0]?.contextValue).toBe(CONTEXT.instance);
		expect(roots[0]?.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
	});

	it("marks an instance node as authenticated when a key is stored", async () => {
		const instances = stubInstanceManager(stubClient());
		const provider = new InstancesTreeProvider(testLogger(), instances);
		const roots = await provider.getChildren();
		expect(roots[0]?.contextValue).toBe(CONTEXT.instanceAuthenticated);
		expect(roots[0]?.description).toContain("active");
	});
});

describe("ProjectsTreeProvider", () => {
	function build(client: Partial<NotployClient> = stubClient()) {
		const instances = stubInstanceManager(client);
		const projects = new ProjectService(instances);
		const deployments = new DeploymentService(
			instances,
			projects,
			testLogger(),
		);
		return new ProjectsTreeProvider(testLogger(), projects, deployments);
	}

	it("renders projects, environments and applications lazily", async () => {
		const provider = build();
		const projects = await provider.getChildren();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.contextValue).toBe(CONTEXT.project);

		const environments = await provider.getChildren(projects[0]!);
		expect(environments[0]?.contextValue).toBe(CONTEXT.environment);
		expect(environments[0]?.description).toBe("default");

		const applications = await provider.getChildren(environments[0]!);
		expect(applications[0]?.contextValue).toBe(CONTEXT.application);
		expect(applications[0]?.description).toBe("Deployed");
	});

	it("shows the deployments of an application", async () => {
		const provider = build();
		const [project] = await provider.getChildren();
		const [environment] = await provider.getChildren(project!);
		const [application] = await provider.getChildren(environment!);
		const deployments = await provider.getChildren(application!);
		expect(deployments[0]?.contextValue).toBe(CONTEXT.deployment);
	});

	it("shows an empty state instead of throwing when there is no project", async () => {
		const provider = build({ ...stubClient(), projects: async () => [] });
		const roots = await provider.getChildren();
		expect(String(roots[0]?.label)).toContain("No projects found");
	});

	it("renders an error node instead of throwing when loading fails", async () => {
		const provider = build({
			...stubClient(),
			projects: async () => {
				throw Object.assign(new Error("down"), { status: 500 });
			},
		});
		const roots = await provider.getChildren();
		expect(roots[0]).toBeInstanceOf(ErrorNode);
		expect((roots[0] as ErrorNode).error.code).toBe("server-error");
		expect(String(roots[0]?.tooltip)).toContain("Notploy: Refresh");
	});
});

describe("DeploymentsTreeProvider", () => {
	function build(client: Partial<NotployClient> = stubClient()) {
		const instances = stubInstanceManager(client);
		const projects = new ProjectService(instances);
		const deployments = new DeploymentService(
			instances,
			projects,
			testLogger(),
		);
		return new DeploymentsTreeProvider(testLogger(), projects, deployments);
	}

	it("starts with the deploy queue, then one node per application", async () => {
		const provider = build();
		const roots = await provider.getChildren();
		expect(String(roots[0]?.label)).toBe("Queue");

		const application = roots.find(
			(node) => node.contextValue === CONTEXT.deploymentApplication,
		);
		expect(application).toBeDefined();
		expect(application?.description).toContain("Done");
	});

	it("reports an empty queue clearly", async () => {
		const provider = build();
		const [queue] = await provider.getChildren();
		const children = await provider.getChildren(queue!);
		expect(String(children[0]?.label)).toContain("queue is empty");
	});

	it("lists queued jobs when the instance has some", async () => {
		const provider = build({
			...stubClient(),
			deploymentQueue: async () => [
				{ id: "7", state: "waiting", timestamp: Date.now(), name: "deploy" },
			],
		});
		const [queue] = await provider.getChildren();
		const children = await provider.getChildren(queue!);
		expect(children[0]?.id).toBe("queue:7");
		expect(String(children[0]?.description)).toContain("waiting");
	});

	it("shows the deployments of an application", async () => {
		const provider = build();
		const roots = await provider.getChildren();
		const application = roots.find(
			(node) => node.contextValue === CONTEXT.deploymentApplication,
		);
		const deployments = await provider.getChildren(application!);
		expect(deployments[0]?.contextValue).toBe(CONTEXT.deployment);
	});
});

describe("InfrastructureTreeProvider", () => {
	function build(
		client: Partial<NotployClient> = stubClient(),
		capabilities: Partial<InstanceCapabilities> = {
			docker: true,
			servers: true,
			swarm: false,
			dockerImages: true,
		},
	) {
		const instances = stubInstanceManager(client);
		const instance = instances.active()!;
		instance.capabilities = {
			...EMPTY_CAPABILITIES,
			deployments: true,
			logs: true,
			...capabilities,
		};
		const infrastructure = new InfrastructureService(instances, testLogger());
		return new InfrastructureTreeProvider(
			testLogger(),
			instances,
			infrastructure,
		);
	}

	it("asks for a connection check when capabilities are unknown", async () => {
		const provider = build(stubClient(), {});
		(
			provider as unknown as {
				instances: { active: () => { capabilities?: unknown } };
			}
		).instances.active()!.capabilities = undefined;
		const roots = await provider.getChildren();
		expect(String(roots[0]?.label)).toContain("Capabilities are unknown");
	});

	it("explains what the instance does not expose", async () => {
		const provider = build(stubClient(), { docker: false, servers: false });
		const roots = await provider.getChildren();
		expect(
			roots.some((node) =>
				String(node.label).includes("Docker is not exposed"),
			),
		).toBe(true);
		expect(
			roots.some((node) =>
				String(node.label).includes("Servers are not exposed"),
			),
		).toBe(true);
	});

	it("always reports Kubernetes as unavailable, with the reason", async () => {
		const provider = build();
		const roots = await provider.getChildren();
		const kubernetes = roots.find(
			(node) => node.contextValue === CONTEXT.kubernetesUnavailable,
		);
		expect(kubernetes).toBeDefined();
		expect(String(kubernetes?.tooltip)).toContain("does not expose");
	});

	it("lists containers under Docker", async () => {
		const provider = build({
			...stubClient(),
			containers: async () => [
				{
					containerId: "abc123",
					name: "web",
					image: "nginx:latest",
					ports: "80/tcp",
					state: "running",
					status: "Up 2 hours",
				},
			],
		});
		const roots = await provider.getChildren();
		const docker = roots.find((node) => String(node.label) === "Docker");
		const sections = await provider.getChildren(docker!);
		const containers = await provider.getChildren(sections[0]!);
		expect(containers[0]?.contextValue).toBe(CONTEXT.dockerContainer);
		expect(String(containers[0]?.description)).toContain("running");
	});
});

describe("node tooltips", () => {
	it("never exposes a credential", async () => {
		const instances = stubInstanceManager(stubClient(), {
			...testInstance(),
			hasCredential: true,
		});
		const provider = new InstancesTreeProvider(testLogger(), instances);
		const [node] = await provider.getChildren();
		const serialized = JSON.stringify(node?.tooltip);
		expect(serialized).not.toMatch(/npk_|api[-_]?key/i);
	});
});
