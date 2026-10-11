import { afterEach, describe, expect, it } from "vitest";
import { NotployClient } from "@/main/client/notploy-client";
import { noopLogger } from "@/main/logging";
import {
	type MockServer,
	openApiDocument,
	startNotployMockServer,
} from "../helpers/mock-server";

let server: MockServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
});

function clientFor(
	url: string,
	options: { token?: string; timeout?: number } = {},
): NotployClient {
	return new NotployClient({
		origin: url,
		token: options.token,
		timeout: options.timeout ?? 5_000,
		connectionName: "Test",
		logger: noopLogger,
	});
}

describe("NotployClient", () => {
	it("normalises the origin and builds the API base URL", () => {
		const client = clientFor("https://notploy.example.com/");
		expect(client.origin).toBe("https://notploy.example.com");
		expect(client.apiBaseUrl).toBe("https://notploy.example.com/api");
	});

	it("reads health from an anonymous endpoint", async () => {
		server = await startNotployMockServer({
			data: { "GET settings.health": { status: "ok" } },
		});
		const client = clientFor(server.url);
		expect(await client.health()).toEqual({ status: "ok" });
		expect(client.authenticated).toBe(false);
	});

	it("sends the API key as x-api-key", async () => {
		server = await startNotployMockServer({
			token: "npk_secret",
			data: {
				"GET user.session": {
					user: { id: "u1" },
					session: { activeOrganizationId: "o1" },
				},
			},
		});
		const client = clientFor(server.url, { token: "npk_secret" });
		const session = await client.session();
		expect(session?.user.id).toBe("u1");
		expect(server.requests[0]?.apiKey).toBe("npk_secret");
	});

	it("resolves to null when the credential is rejected", async () => {
		server = await startNotployMockServer({
			token: "expected",
			data: { "GET user.session": { user: { id: "u1" } } },
		});
		const client = clientFor(server.url, { token: "wrong" });
		await expect(client.session()).rejects.toMatchObject({
			code: "unauthorized",
		});
	});

	it("maps a forbidden response to the forbidden code", async () => {
		server = await startNotployMockServer({
			data: { "GET server.all": [] },
			status: { "GET server.all": 403 },
		});
		const client = clientFor(server.url);
		await expect(client.servers()).rejects.toMatchObject({ code: "forbidden" });
	});

	it("maps an unreachable instance to the connection code", async () => {
		server = await startNotployMockServer({
			failWith: () => true,
			data: { "GET settings.health": { status: "ok" } },
		});
		const client = clientFor(server.url);
		await expect(client.health()).rejects.toMatchObject({ code: "connection" });
	});

	it("reports a missing procedure as not-found", async () => {
		server = await startNotployMockServer({ data: {} });
		const client = clientFor(server.url);
		await expect(client.version()).rejects.toMatchObject({ code: "not-found" });
	});

	it("sends the application id in the deploy body", async () => {
		server = await startNotployMockServer({
			data: { "POST application.deploy": { ok: true } },
		});
		const client = clientFor(server.url);
		await client.deploy("app-1");
		expect(server.requests[0]?.body).toMatchObject({ applicationId: "app-1" });
	});

	it("reads the OpenAPI document", async () => {
		server = await startNotployMockServer({
			data: {
				"GET settings.getOpenApiDocument": openApiDocument([
					"project",
					"docker",
					"application",
					"deployment",
				]),
			},
		});
		const client = clientFor(server.url);
		const document = await client.openApiDocument();
		expect(Object.keys(document?.paths ?? {})).toHaveLength(4);
	});

	it("returns an empty list when a procedure answers with null", async () => {
		server = await startNotployMockServer({
			data: { "GET project.all": null },
		});
		const client = clientFor(server.url);
		expect(await client.projects()).toEqual([]);
	});

	it("walks every page of applications", async () => {
		let call = 0;
		server = await startNotployMockServer({
			data: {
				"GET application.search": () => {
					call += 1;
					return call === 1
						? { items: [{ applicationId: "a1", name: "one" }], total: 2 }
						: { items: [{ applicationId: "a2", name: "two" }], total: 2 };
				},
			},
		});
		const client = clientFor(server.url);
		const applications = await client.allApplications(1);
		expect(applications.map((entry) => entry.applicationId)).toEqual([
			"a1",
			"a2",
		]);
		expect(call).toBe(2);
	});

	it("normalises the volume listing to Docker's field names", async () => {
		server = await startNotployMockServer({
			data: {
				"GET dockerVolume.getVolumes": [
					{ name: "data", driver: "local", scope: "local" },
				],
			},
		});
		const client = clientFor(server.url);
		const volumes = await client.volumes();
		expect(volumes[0]).toMatchObject({ Name: "data", Driver: "local" });
	});
});
