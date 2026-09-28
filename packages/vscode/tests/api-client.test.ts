import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotployClient } from "../src/api/notploy-client";
import { type MockServer, startNotployMockServer } from "./helpers/mock-server";
import { testLogger } from "./helpers/services";
import { resetMockState, setConfiguration } from "./helpers/vscode-mock";

let server: MockServer;

beforeEach(() => {
	resetMockState();
	setConfiguration({});
});

afterEach(async () => {
	await server?.close();
});

function clientFor(token?: string, timeout = 5_000): NotployClient {
	return new NotployClient({
		origin: server.url,
		token,
		timeout,
		instanceName: "Test",
		logger: testLogger(),
	});
}

describe("NotployClient", () => {
	it("sends the API key as x-api-key and returns the payload", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET project.all": [{ projectId: "p1", name: "Marketing" }],
			},
		});

		const projects = await clientFor("npk_test").projects();
		expect(projects).toEqual([{ projectId: "p1", name: "Marketing" }]);
		expect(server.requests[0]?.apiKey).toBe("npk_test");
		expect(server.requests[0]?.path).toBe("project.all");
	});

	it("never puts the token in the URL", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET project.all": [] },
		});
		await clientFor("npk_test").projects();
		expect(server.requests[0]?.query.toString()).toBe("");
	});

	it("turns a 401 into an unauthorized error", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET project.all": [] },
		});
		await expect(clientFor("npk_wrong").projects()).rejects.toMatchObject({
			code: "unauthorized",
		});
	});

	it("turns a refusal into a connection error", async () => {
		server = await startNotployMockServer({ data: {} });
		const client = clientFor(undefined);
		await server.close();
		await expect(client.health()).rejects.toMatchObject({ code: "connection" });
	});

	it("aborts requests that exceed the timeout", async () => {
		server = await startNotployMockServer({
			data: {
				"GET settings.health": () => {
					// Never resolves within the timeout window.
					const until = Date.now() + 500;
					while (Date.now() < until) {
						// Busy wait keeps the handler synchronous, so the socket stalls.
					}
					return { status: "ok" };
				},
			},
		});
		await expect(clientFor(undefined, 120).health()).rejects.toMatchObject({
			code: "timeout",
		});
	});

	it("passes query parameters through for log reads", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET application.readLogs": "line one\nline two\n" },
		});
		const logs = await clientFor("npk_test").applicationLogs("a1", {
			tail: 50,
			since: "1h",
		});
		expect(logs).toContain("line two");
		const request = server.requests[0]!;
		expect(request.query.get("applicationId")).toBe("a1");
		expect(request.query.get("tail")).toBe("50");
		expect(request.query.get("since")).toBe("1h");
	});

	it("reads the deploy queue", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: { "GET deployment.queueList": [{ id: "1", state: "waiting" }] },
		});
		expect(await clientFor("npk_test").deploymentQueue()).toEqual([
			{ id: "1", state: "waiting" },
		]);
	});

	it("normalises docker volume payloads", async () => {
		server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET dockerVolume.getVolumes": [
					{
						Name: "data",
						Driver: "local",
						Scope: "local",
						Mountpoint: "/var/lib/docker/volumes/data",
						Labels: "",
					},
				],
			},
		});
		const volumes = await clientFor("npk_test").volumes();
		expect(volumes[0]?.Name).toBe("data");
		expect(volumes[0]?.Driver).toBe("local");
	});

	it("reports a public health check without a credential", async () => {
		server = await startNotployMockServer({
			data: { "GET settings.health": { status: "ok" } },
		});
		expect(await clientFor(undefined).health()).toEqual({ status: "ok" });
		expect(clientFor(undefined).authenticated).toBe(false);
		expect(clientFor("npk_test").authenticated).toBe(true);
	});
});
