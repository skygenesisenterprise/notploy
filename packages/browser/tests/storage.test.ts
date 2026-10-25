import { describe, expect, it } from "vitest";
import { BackgroundState } from "../src/background/state.js";
import { InstanceStorage, MemoryStorage } from "../src/background/storage.js";
import { isExtensionMessage } from "../src/shared/messages.js";
import type { NotployInstance } from "../src/shared/types.js";
import { startNotployMockServer } from "./helpers/mock-server.js";

function setup() {
	const storage = new InstanceStorage(new MemoryStorage());
	const state = new BackgroundState(storage);
	return { storage, state };
}

const instance: NotployInstance = {
	id: "inst_1",
	name: "Local",
	url: "http://127.0.0.1:3000",
	label: "local",
	lastStatus: "unknown",
	hasCredential: false,
};

describe("InstanceStorage", () => {
	it("stores instances and tokens without mixing sessions", async () => {
		const { storage } = setup();
		await storage.saveInstance(instance);
		await storage.setToken(instance.id, "npk_test");
		expect(await storage.getToken(instance.id)).toBe("npk_test");
		await storage.deleteToken(instance.id);
		expect(await storage.getToken(instance.id)).toBeUndefined();
	});

	it("resolves the single instance as active", async () => {
		const { storage } = setup();
		await storage.saveInstance(instance);
		expect((await storage.active())?.id).toBe(instance.id);
	});
});

describe("BackgroundState", () => {
	it("rejects http outside localhost", async () => {
		const { state } = setup();
		await expect(
			state.addInstance("Prod", "http://notploy.example.com", "self-hosted"),
		).rejects.toMatchObject({
			code: "bad-request",
		});
	});

	it("adds and selects instances without mixing data", async () => {
		const { state, storage } = setup();
		const first = await state.addInstance(
			"Local",
			"http://127.0.0.1:3000",
			"local",
		);
		const second = await state.addInstance(
			"Cloud",
			"https://app.notploy.com",
			"cloud",
		);
		await state.selectInstance(second.id);
		expect((await storage.active())?.id).toBe(second.id);
		const snapshot = await state.snapshot();
		expect(snapshot.projects).toEqual([]);
		expect(snapshot.deployments).toEqual([]);
		expect(first.id).not.toBe(second.id);
	});

	it("logs in against a mock instance and refreshes", async () => {
		const server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET user.session": {
					user: { id: "u1" },
					session: { activeOrganizationId: "o1" },
				},
				"GET project.all": [{ projectId: "p1", name: "Marketing" }],
				"GET deployment.allCentralized": [
					{ deploymentId: "d1", title: "Deploy", status: "done" },
				],
				"GET settings.getNotployVersion": "1.2.3",
				"GET settings.isCloud": false,
			},
		});
		try {
			const { state } = setup();
			const added = await state.addInstance("Local", server.url, "local");
			await state.login(added.id, "npk_test");
			const snapshot = await state.refresh();
			expect(snapshot.projects).toHaveLength(1);
			expect(snapshot.deployments).toHaveLength(1);
			expect(snapshot.connection?.status).toBe("connected");
			await state.logout(added.id);
			const after = await state.snapshot();
			// Logout clears cached resources: nothing from the previous session stays visible.
			expect(after.projects).toEqual([]);
			expect(after.deployments).toEqual([]);
		} finally {
			await server.close();
		}
	});

	it("rejects invalid keys and removes them", async () => {
		const server = await startNotployMockServer({
			token: "npk_test",
			data: {
				"GET user.session": {
					user: { id: "u1" },
					session: { activeOrganizationId: "o1" },
				},
			},
		});
		try {
			const { state, storage } = setup();
			const added = await state.addInstance("Local", server.url, "local");
			await expect(state.login(added.id, "npk_wrong")).rejects.toMatchObject({
				code: "unauthorized",
			});
			expect(await storage.getToken(added.id)).toBeUndefined();
		} finally {
			await server.close();
		}
	});
});

describe("messages", () => {
	it("validates message kinds", () => {
		expect(isExtensionMessage({ kind: "getState" })).toBe(true);
		expect(isExtensionMessage({ kind: "rm -rf" })).toBe(false);
		expect(isExtensionMessage(null)).toBe(false);
	});
});
