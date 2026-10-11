import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionManager } from "@/main/connection/connection-manager";
import { normalizeInstanceUrl } from "@/main/connection/connection-store";
import { noopLogger } from "@/main/logging";
import {
	memorySecrets,
	type TempContext,
	tempUserData,
	testConnectionStore,
} from "../helpers/harness";
import {
	type MockServer,
	openApiDocument,
	startNotployMockServer,
} from "../helpers/mock-server";

let context: TempContext;
let server: MockServer | undefined;

beforeEach(() => {
	context = tempUserData();
});

afterEach(async () => {
	context.cleanup();
	await server?.close();
	server = undefined;
});

function managerFor(userDataPath: string): ConnectionManager {
	return new ConnectionManager({
		store: testConnectionStore(userDataPath, memorySecrets()),
		logger: noopLogger,
		defaultTimeout: () => 5_000,
	});
}

/** The routes a healthy instance answers on. */
function healthyData(token?: string) {
	return {
		"GET settings.health": { status: "ok" },
		...(token ? { "GET user.session": { user: { id: "u1" } } } : {}),
		"GET settings.getNotployVersion": "0.30.6",
		"GET settings.isCloud": false,
		"GET settings.getOpenApiDocument": openApiDocument([
			"project",
			"application",
			"deployment",
			"docker",
			"server",
			"network",
		]),
	};
}

describe("normalizeInstanceUrl", () => {
	it("adds https when the scheme is missing", () => {
		expect(normalizeInstanceUrl("notploy.example.com")).toBe(
			"https://notploy.example.com",
		);
	});

	it("keeps an explicit http origin, for a local instance", () => {
		expect(normalizeInstanceUrl("http://localhost:3000")).toBe(
			"http://localhost:3000",
		);
	});

	it("drops the path, query and fragment of a pasted dashboard URL", () => {
		expect(
			normalizeInstanceUrl(
				"https://notploy.example.com/dashboard/project/1?x=2",
			),
		).toBe("https://notploy.example.com");
	});

	it("returns an empty string for unparseable input", () => {
		expect(normalizeInstanceUrl("   ")).toBe("");
	});
});

describe("ConnectionManager", () => {
	it("starts with nothing configured", async () => {
		const manager = managerFor(context.userDataPath);
		expect(manager.list()).toEqual([]);
		expect(manager.active()).toBeUndefined();
		await expect(manager.summaries()).resolves.toEqual([]);
	});

	it("makes the first connection added the active one", async () => {
		const manager = managerFor(context.userDataPath);
		const created = await manager.add({
			name: "Staging",
			url: "https://staging.example.com",
		});
		expect(created.active).toBe(true);
		expect(manager.active()?.name).toBe("Staging");
	});

	it("keeps a second connection inactive", async () => {
		const manager = managerFor(context.userDataPath);
		await manager.add({ name: "A", url: "https://a.example.com" });
		await manager.add({ name: "B", url: "https://b.example.com" });
		expect(manager.active()?.name).toBe("A");
		expect(manager.list()).toHaveLength(2);
	});

	it("switches the active connection", async () => {
		const manager = managerFor(context.userDataPath);
		await manager.add({ name: "A", url: "https://a.example.com" });
		const second = await manager.add({
			name: "B",
			url: "https://b.example.com",
		});
		await manager.setActive(second.id);
		expect(manager.active()?.name).toBe("B");
	});

	it("stores an API key in the secure store, never in the config file", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const secrets = memorySecrets();
		const store = testConnectionStore(context.userDataPath, secrets);
		const manager = new ConnectionManager({
			store,
			logger: noopLogger,
			defaultTimeout: () => 5_000,
		});

		const created = await manager.add({ name: "Local", url: server.url });
		await manager.login(created.id, "npk_good");

		expect(await secrets.get(`notploy.connection.${created.id}`)).toBe(
			"npk_good",
		);
		expect(await store.getCredential(created.id)).toBe("npk_good");

		const { readFileSync } = await import("node:fs");
		const { join } = await import("node:path");
		const config = readFileSync(
			join(context.userDataPath, "connections.json"),
			"utf8",
		);
		expect(config).not.toContain("npk_good");
	});

	it("never stores an API key the instance rejects", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const secrets = memorySecrets();
		const manager = new ConnectionManager({
			store: testConnectionStore(context.userDataPath, secrets),
			logger: noopLogger,
			defaultTimeout: () => 5_000,
		});
		const created = await manager.add({ name: "Local", url: server.url });

		await expect(manager.login(created.id, "npk_wrong")).rejects.toMatchObject({
			code: "unauthorized",
		});
		expect(
			await secrets.get(`notploy.connection.${created.id}`),
		).toBeUndefined();
	});

	it("checks a connection and detects capabilities from the OpenAPI document", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const manager = managerFor(context.userDataPath);
		const created = await manager.add({ name: "Local", url: server.url });
		await manager.login(created.id, "npk_good");

		const result = await manager.checkConnection(created.id);
		expect(result.summary.status).toBe("connected");
		expect(result.summary.version).toBe("0.30.6");
		expect(result.report?.source).toBe("openapi");
		expect(result.summary.capabilities).toMatchObject({
			deployments: true,
			docker: true,
			servers: true,
			kubernetes: false,
		});
	});

	it("reports an unreachable instance without throwing", async () => {
		server = await startNotployMockServer({
			failWith: () => true,
			data: healthyData(),
		});
		const manager = managerFor(context.userDataPath);
		const created = await manager.add({ name: "Broken", url: server.url });

		const result = await manager.checkConnection(created.id);
		expect(result.summary.status).toBe("unavailable");
		expect(result.summary.error).toBeTruthy();
	});

	it("reports a connection with no credential as disconnected", async () => {
		server = await startNotployMockServer({ data: healthyData() });
		const manager = managerFor(context.userDataPath);
		const created = await manager.add({ name: "Anon", url: server.url });

		const result = await manager.checkConnection(created.id);
		expect(result.summary.status).toBe("disconnected");
		expect(result.summary.hasCredential).toBe(false);
	});

	it("clears the credential on logout", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const secrets = memorySecrets();
		const manager = new ConnectionManager({
			store: testConnectionStore(context.userDataPath, secrets),
			logger: noopLogger,
			defaultTimeout: () => 5_000,
		});
		const created = await manager.add({ name: "Local", url: server.url });
		await manager.login(created.id, "npk_good");
		const afterLogout = await manager.logout(created.id);

		expect(afterLogout.hasCredential).toBe(false);
		expect(afterLogout.status).toBe("unknown");
		expect(
			await secrets.get(`notploy.connection.${created.id}`),
		).toBeUndefined();
	});

	it("removes a connection and its credential, without touching the instance", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const secrets = memorySecrets();
		const manager = new ConnectionManager({
			store: testConnectionStore(context.userDataPath, secrets),
			logger: noopLogger,
			defaultTimeout: () => 5_000,
		});
		const created = await manager.add({ name: "Local", url: server.url });
		await manager.login(created.id, "npk_good");
		const requestsBefore = server.requests.length;

		await manager.remove(created.id);

		expect(manager.list()).toEqual([]);
		expect(
			await secrets.get(`notploy.connection.${created.id}`),
		).toBeUndefined();
		// Removing a connection is a local operation.
		expect(server.requests.length).toBe(requestsBefore);
	});

	it("rebuilds the client when the credential changes", async () => {
		server = await startNotployMockServer({
			token: "npk_good",
			data: healthyData("npk_good"),
		});
		const manager = managerFor(context.userDataPath);
		const created = await manager.add({ name: "Local", url: server.url });

		const anonymous = await manager.clientFor(created.id);
		expect(anonymous.authenticated).toBe(false);

		await manager.login(created.id, "npk_good");
		const authenticated = await manager.clientFor(created.id);
		expect(authenticated).not.toBe(anonymous);
		expect(authenticated.authenticated).toBe(true);
	});

	it("emits the connection list on every change", async () => {
		const manager = managerFor(context.userDataPath);
		const seen: number[] = [];
		const unsubscribe = manager.onChanged((connections) => {
			seen.push(connections.length);
		});

		await manager.add({ name: "A", url: "https://a.example.com" });
		await manager.add({ name: "B", url: "https://b.example.com" });
		unsubscribe();
		await manager.add({ name: "C", url: "https://c.example.com" });

		expect(seen).toEqual([1, 2]);
	});

	it("refuses to use a client for a connection that is not configured", async () => {
		const manager = managerFor(context.userDataPath);
		await expect(manager.activeClient()).rejects.toMatchObject({
			code: "not-configured",
		});
	});

	it("requires a credential for the authenticated client", async () => {
		const manager = managerFor(context.userDataPath);
		await manager.add({ name: "A", url: "https://a.example.com" });
		await expect(manager.authenticatedClient()).rejects.toMatchObject({
			code: "unauthorized",
		});
	});
});
