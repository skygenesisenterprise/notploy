import { describe, expect, it, vi } from "vitest";
import type { NotployClient } from "../src/api/notploy-client";
import {
	capabilitiesFromRouters,
	describeCapabilities,
	detectCapabilities,
	KUBERNETES_ROUTER,
	routersFromDocument,
} from "../src/core/capabilities";

function fakeClient(
	overrides: Partial<Record<string, unknown>> = {},
): NotployClient {
	const base = {
		version: vi.fn(async () => "0.30.6"),
		isCloud: vi.fn(async () => false),
		openApiDocument: vi.fn(async () => ({ paths: {} })),
		projects: vi.fn(async () => []),
		allDeployments: vi.fn(async () => []),
		containers: vi.fn(async () => []),
		servers: vi.fn(async () => []),
		networks: vi.fn(async () => []),
		images: vi.fn(async () => []),
		volumes: vi.fn(async () => []),
		composes: vi.fn(async () => []),
		swarmNodes: vi.fn(async () => []),
	};
	return { ...base, ...overrides } as unknown as NotployClient;
}

describe("routersFromDocument", () => {
	it("extracts router names from procedure paths", () => {
		const routers = routersFromDocument({
			paths: {
				"/project.all": {},
				"/project.one": {},
				"/docker.getContainers": {},
				"/dockerImage.getImages": {},
				"/settings.health": {},
			},
		});
		expect(routers).toEqual(["docker", "dockerImage", "project", "settings"]);
	});

	it("returns nothing for a document without paths", () => {
		expect(routersFromDocument(undefined)).toEqual([]);
		expect(routersFromDocument({})).toEqual([]);
	});
});

describe("capabilitiesFromRouters", () => {
	it("maps known routers to capabilities", () => {
		const capabilities = capabilitiesFromRouters(
			["project", "application", "deployment", "docker", "server", "swarm"],
			false,
		);
		expect(capabilities.deployments).toBe(true);
		expect(capabilities.logs).toBe(true);
		expect(capabilities.docker).toBe(true);
		expect(capabilities.servers).toBe(true);
		expect(capabilities.swarm).toBe(true);
		expect(capabilities.dockerImages).toBe(false);
	});

	it("never reports Kubernetes without a kubernetes router", () => {
		const capabilities = capabilitiesFromRouters(
			["project", "docker", "cluster", "swarm", "deployment"],
			false,
		);
		expect(capabilities.kubernetes).toBe(false);
		expect(capabilitiesFromRouters([KUBERNETES_ROUTER], false).kubernetes).toBe(
			true,
		);
	});

	it("carries the cloud flag but does not gate features on it", () => {
		const selfHosted = capabilitiesFromRouters(["docker", "server"], false);
		const cloud = capabilitiesFromRouters(["docker", "server"], true);
		expect(selfHosted.cloud).toBe(false);
		expect(cloud.cloud).toBe(true);
		expect(selfHosted.docker).toBe(cloud.docker);
	});
});

describe("detectCapabilities", () => {
	it("uses the instance OpenAPI document when it is available", async () => {
		const client = fakeClient({
			openApiDocument: vi.fn(async () => ({
				paths: {
					"/project.all": {},
					"/application.deploy": {},
					"/deployment.all": {},
					"/docker.getContainers": {},
				},
			})),
		});
		const report = await detectCapabilities(client);
		expect(report.source).toBe("openapi");
		expect(report.capabilities.deployments).toBe(true);
		expect(report.capabilities.docker).toBe(true);
		expect(report.capabilities.kubernetes).toBe(false);
		expect(report.version).toBe("0.30.6");
		expect(client.projects).not.toHaveBeenCalled();
	});

	it("falls back to probes when the document cannot be read", async () => {
		const client = fakeClient({
			openApiDocument: vi.fn(async () => {
				throw Object.assign(new Error("boom"), { status: 404 });
			}),
			projects: vi.fn(async () => [{ projectId: "p1", name: "Site" }]),
			containers: vi.fn(async () => [
				{
					containerId: "abc",
					name: "web",
					image: "nginx",
					ports: "",
					state: "running",
					status: "Up",
				},
			]),
			servers: vi.fn(async () => {
				throw Object.assign(new Error("denied"), { code: "FORBIDDEN" });
			}),
		});
		const report = await detectCapabilities(client);
		expect(report.source).toBe("probe");
		expect(report.capabilities.deployments).toBe(true);
		expect(report.capabilities.docker).toBe(true);
		expect(report.capabilities.servers).toBe(false);
		expect(report.restricted).toContain("server");
		expect(report.notes.join(" ")).toContain("probed");
	});

	it("applies user overrides without pretending the API changed", async () => {
		const client = fakeClient({
			openApiDocument: vi.fn(async () => ({ paths: { "/project.all": {} } })),
		});
		const report = await detectCapabilities(client, {
			overrides: { kubernetes: true },
		});
		expect(report.capabilities.kubernetes).toBe(true);
		expect(report.routers).toEqual(["project"]);
	});
});

describe("describeCapabilities", () => {
	it("explains why Kubernetes is empty", () => {
		const text = describeCapabilities({
			capabilities: capabilitiesFromRouters(["project"], false),
			routers: ["project"],
			source: "openapi",
			restricted: [],
			notes: [],
		});
		expect(text).toContain("no Kubernetes router");
		expect(text).toContain(
			"Kubernetes: the Notploy API exposes no Kubernetes router",
		);
	});
});
