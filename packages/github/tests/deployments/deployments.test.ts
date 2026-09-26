import { describe, expect, it } from "vitest";
import { DeploymentsNamespace } from "../../src/client/namespaces/deployments.js";
import { mapDeploymentStatus } from "../../src/types/mappers.js";

const buildFakeOctokit = (handlers: {
	createDeployment?: (
		params: Record<string, unknown>,
	) => Promise<{ data: unknown }>;
	createStatus?: (
		params: Record<string, unknown>,
	) => Promise<{ data: unknown }>;
	listDeployments?: () => Promise<{ data: unknown }>;
	getDeployment?: () => Promise<{ data: unknown }>;
	listStatuses?: () => Promise<{ data: unknown }>;
}) =>
	({
		rest: {
			repos: {
				createDeployment:
					handlers.createDeployment ?? (async () => ({ data: {} })),
				createDeploymentStatus:
					handlers.createStatus ?? (async () => ({ data: {} })),
				listDeployments:
					handlers.listDeployments ?? (async () => ({ data: [] })),
				getDeployment: handlers.getDeployment ?? (async () => ({ data: {} })),
				listDeploymentStatuses:
					handlers.listStatuses ?? (async () => ({ data: [] })),
			},
		},
	}) as never;

describe("deployments namespace", () => {
	it("creates a deployment with strongly-typed options", async () => {
		let captured: Record<string, unknown> | undefined;
		const octokit = buildFakeOctokit({
			createDeployment: async (params) => {
				captured = params;
				return {
					data: {
						id: 999,
						sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						ref: "main",
						task: "deploy",
						environment: "production",
						description: "Deployed by Notploy",
						html_url: "https://github.com/acme/a/deployments/production",
					},
				};
			},
		});

		const deployments = new DeploymentsNamespace(octokit);
		const deployment = await deployments.create({
			owner: "acme",
			repository: "a",
			ref: "main",
			environment: "production",
			description: "Deployed by Notploy",
		});

		expect(captured?.environment).toBe("production");
		expect(captured?.auto_merge).toBeUndefined();
		expect(deployment).toMatchObject({
			id: 999,
			ref: "main",
			environment: "production",
		});
	});

	it("creates deployment statuses with typed states", async () => {
		let captured: Record<string, unknown> | undefined;
		const octokit = buildFakeOctokit({
			createStatus: async (params) => {
				captured = params;
				return {
					data: {
						id: 555,
						state: "success",
						description: "Deployed",
						environment_url: "https://app.example.com",
						created_at: "2026-09-26T00:00:00Z",
						updated_at: "2026-09-26T00:01:00Z",
					},
				};
			},
		});

		const deployments = new DeploymentsNamespace(octokit);
		const status = await deployments.createStatus({
			owner: "acme",
			repository: "a",
			deploymentId: 999,
			state: "success",
			environmentUrl: "https://app.example.com",
		});

		expect(captured?.state).toBe("success");
		expect(captured?.environment_url).toBe("https://app.example.com");
		expect(status.state).toBe("success");
		expect(status.environmentUrl).toBe("https://app.example.com");
	});

	it("lists deployments", async () => {
		const octokit = buildFakeOctokit({
			listDeployments: async () => ({
				data: [
					{
						id: 1,
						sha: "a",
						ref: "main",
						environment: "production",
					},
				],
			}),
		});
		const deployments = new DeploymentsNamespace(octokit);
		const list = await deployments.list({
			owner: "acme",
			repository: "a",
			environment: "production",
		});
		expect(list).toHaveLength(1);
		expect(list[0]?.environment).toBe("production");
	});
});

describe("mapDeploymentStatus", () => {
	it("maps known states unchanged", () => {
		for (const state of [
			"queued",
			"in_progress",
			"success",
			"failure",
			"error",
			"inactive",
		]) {
			expect(mapDeploymentStatus({ id: 1, state }).state).toBe(state);
		}
	});

	it("falls back to error for unknown states", () => {
		expect(mapDeploymentStatus({ id: 1, state: "weird" }).state).toBe("error");
	});
});
