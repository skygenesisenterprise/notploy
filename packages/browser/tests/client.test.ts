import { afterEach, describe, expect, it } from "vitest";
import { NotployBrowserClient } from "../src/api/client.js";
import {
	type MockServer,
	startNotployMockServer,
} from "./helpers/mock-server.js";

let server: MockServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
});

function clientFor(
	origin: string,
	token?: string,
	timeout = 5_000,
): NotployBrowserClient {
	return new NotployBrowserClient({
		origin,
		token,
		timeout,
		instanceName: "Test",
	});
}

describe("NotployBrowserClient", () => {
	it("sends the API key as x-api-key", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET project.all": [{ projectId: "p1", name: "Marketing" }] },
		});
		const projects = await clientFor(server.url, "npk_test").projects();
		expect(projects).toEqual([{ projectId: "p1", name: "Marketing" }]);
		expect(server.requests[0]?.apiKey).toBe("npk_test");
		expect(server.requests[0]?.path).toBe("project.all");
	});

	it("reads recent deployments", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET deployment.allCentralized": [
					{ deploymentId: "d1", title: "Deploy 1", status: "done" },
					{ deploymentId: "d2", title: "Deploy 2", status: "running" },
				],
			},
		});
		const deployments = await clientFor(
			server.url,
			"npk_test",
		).recentDeployments();
		expect(deployments).toHaveLength(2);
	});

	it("turns 401 into unauthorized", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET project.all": [] },
		});
		await expect(
			clientFor(server.url, "npk_wrong").projects(),
		).rejects.toMatchObject({ code: "unauthorized" });
	});

	it("verifies sessions", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET user.session": {
					user: { id: "u1" },
					session: { activeOrganizationId: "o1" },
				},
			},
		});
		const session = await clientFor(server.url, "npk_test").session();
		expect(session?.user.id).toBe("u1");
	});
});
