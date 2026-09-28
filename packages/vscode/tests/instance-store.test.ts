import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE, secretKeyFor } from "../src/core/constants";
import { InstanceStore } from "../src/core/instance-store";
import { createFakeContext, type FakeContext } from "./helpers/context";
import { testInstance, testLogger } from "./helpers/services";
import { resetMockState, setConfiguration } from "./helpers/vscode-mock";

let context: FakeContext;

beforeEach(() => {
	resetMockState();
	setConfiguration({});
	context = createFakeContext();
});

function createStore(): InstanceStore {
	return new InstanceStore(context, testLogger());
}

describe("InstanceStore", () => {
	it("persists instances in globalState, never in secrets", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a", name: "Production" }));

		const persisted = context.globalStateValues.get(STORAGE.instances);
		expect(JSON.stringify(persisted)).toContain("Production");
		expect(context.secretValues.size).toBe(0);
	});

	it("stores credentials in SecretStorage under a per-instance key", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a" }));
		await store.setToken("a", "npk_secret_value");

		expect(context.secretValues.get(secretKeyFor("a"))).toBe(
			"npk_secret_value",
		);
		// Nothing secret may end up in globalState.
		const serialized = JSON.stringify([...context.globalStateValues.values()]);
		expect(serialized).not.toContain("npk_secret_value");
		expect(store.get("a")?.hasCredential).toBe(true);
		expect(await store.getToken("a")).toBe("npk_secret_value");
	});

	it("deletes the credential when the instance is removed", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a" }));
		await store.setToken("a", "token");
		await store.remove("a");

		expect(await store.getToken("a")).toBeUndefined();
		expect(context.secretValues.size).toBe(0);
		expect(store.list()).toHaveLength(0);
	});

	it("resolves the active instance from the setting first", async () => {
		const store = createStore();
		await store.add(
			testInstance({ id: "a", name: "Alpha", url: "https://a.dev" }),
		);
		await store.add(
			testInstance({ id: "b", name: "Beta", url: "https://b.dev" }),
		);
		await store.setActive("a");

		expect(store.active()?.id).toBe("a");

		setConfiguration({ "notploy.defaultInstance": "Beta" });
		expect(store.active()?.id).toBe("b");
	});

	it("falls back to the only configured instance", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "only" }));
		expect(store.active()?.id).toBe("only");
	});

	it("returns undefined when several instances exist and none is selected", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a", name: "Alpha" }));
		await store.add(testInstance({ id: "b", name: "Beta" }));
		expect(store.active()).toBeUndefined();
	});

	it("finds an instance by name as well as by id", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "abc123", name: "Staging" }));
		expect(store.findByNameOrId("abc123")?.id).toBe("abc123");
		expect(store.findByNameOrId("staging")?.id).toBe("abc123");
		expect(store.findByNameOrId("missing")).toBeUndefined();
	});

	it("syncs the credential flag with SecretStorage", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a", hasCredential: true }));
		await store.syncCredentialFlags();
		expect(store.get("a")?.hasCredential).toBe(false);

		await store.setToken("a", "token");
		await store.syncCredentialFlags();
		expect(store.get("a")?.hasCredential).toBe(true);
	});

	it("clears capabilities when a credential is removed", async () => {
		const store = createStore();
		await store.add(testInstance({ id: "a" }));
		await store.setToken("a", "token");
		await store.update("a", { version: "1.2.3", capabilities: undefined });
		await store.deleteToken("a");
		expect(store.get("a")?.version).toBe("1.2.3");
		expect(store.get("a")?.lastStatus).toBe("unknown");
	});
});
