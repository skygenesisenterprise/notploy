import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstanceStore } from "../src/core/instance-store";
import { InstanceManager } from "../src/services/instance-manager";
import { createFakeContext } from "./helpers/context";
import { type MockServer, startNotployMockServer } from "./helpers/mock-server";
import { testInstance, testLogger } from "./helpers/services";
import { resetMockState, setConfiguration } from "./helpers/vscode-mock";

const OPENAPI = {
	paths: {
		"/project.all": {},
		"/application.deploy": {},
		"/deployment.all": {},
		"/deployment.readLogs": {},
		"/docker.getContainers": {},
		"/server.all": {},
	},
};

let server: MockServer;

beforeEach(() => {
	resetMockState();
	setConfiguration({});
});

afterEach(async () => {
	await server?.close();
});

async function makeManager(
	options: {
		token?: string;
		stored?: string;
		data?: Record<string, unknown>;
	} = {},
): Promise<{
	manager: InstanceManager;
	store: InstanceStore;
	context: ReturnType<typeof createFakeContext>;
}> {
	server = await startNotployMockServer({
		token: options.token,
		data: {
			"GET settings.health": { status: "ok" },
			"GET settings.isCloud": false,
			"GET settings.getNotployVersion": "0.30.6",
			"GET settings.getOpenApiDocument": OPENAPI,
			"GET user.session": {
				user: { id: "u1" },
				session: { activeOrganizationId: "org1" },
			},
			...(options.data ?? {}),
		},
	});

	const context = createFakeContext();
	const store = new InstanceStore(context, testLogger());
	const instance = testInstance({
		id: "local",
		name: "Local",
		url: server.url,
		hasCredential: Boolean(options.stored),
	});
	await store.add(instance);
	await store.setActive(instance.id);
	if (options.stored) await store.setToken(instance.id, options.stored);

	return { manager: new InstanceManager(store, testLogger()), store, context };
}

describe("InstanceManager", () => {
	it("reports connected and reads version and capabilities", async () => {
		const { manager } = await makeManager({
			token: "npk_ok",
			stored: "npk_ok",
		});
		const instance = manager.active()!;
		const result = await manager.checkConnection(instance);

		expect(result.status).toBe("connected");
		expect(result.version).toBe("0.30.6");
		expect(result.capabilities?.source).toBe("openapi");
		expect(result.capabilities?.capabilities.docker).toBe(true);
		expect(result.capabilities?.capabilities.kubernetes).toBe(false);
	});

	it("reports an unauthenticated instance as disconnected, not unavailable", async () => {
		const { manager } = await makeManager();
		const result = await manager.checkConnection(manager.active()!);
		expect(result.status).toBe("disconnected");
		expect(result.error).toBeUndefined();
	});

	it("reports a rejected credential as disconnected with a clear error", async () => {
		const { manager } = await makeManager({
			token: "npk_ok",
			stored: "npk_wrong",
		});
		const result = await manager.checkConnection(manager.active()!);
		expect(result.status).toBe("disconnected");
		expect(result.error?.code).toBe("unauthorized");
	});

	it("reports an unreachable instance as unavailable with a retryable error", async () => {
		const { manager } = await makeManager({
			token: "npk_ok",
			stored: "npk_ok",
		});
		await server.close();
		const result = await manager.checkConnection(manager.active()!);
		expect(result.status).toBe("unavailable");
		expect(result.error?.code).toBe("connection");
		expect(result.error?.isRetryable).toBe(true);
	});

	it("reuses one client per instance and rebuilds it when the key changes", async () => {
		const { manager, store } = await makeManager({
			token: "npk_ok",
			stored: "npk_ok",
		});
		const first = await manager.clientFor("local");
		const second = await manager.clientFor("local");
		expect(second).toBe(first);

		await store.setToken("local", "npk_rotated");
		const third = await manager.clientFor("local");
		expect(third).not.toBe(first);

		manager.invalidate("local");
		const fourth = await manager.clientFor("local");
		expect(fourth).not.toBe(third);
	});

	it("refuses authenticated calls without a credential", async () => {
		const { manager } = await makeManager();
		await expect(manager.authenticatedClient()).rejects.toMatchObject({
			code: "unauthorized",
		});
	});

	it("throws a not-configured error when nothing is registered", async () => {
		resetMockState();
		const context = createFakeContext();
		const store = new InstanceStore(context, testLogger());
		const manager = new InstanceManager(store, testLogger());
		await expect(manager.activeClient()).rejects.toMatchObject({
			code: "not-configured",
		});
	});
});
