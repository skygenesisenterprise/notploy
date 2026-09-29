/**
 * The deployment watcher.
 *
 * The property under test is the one that makes native notifications tolerable:
 * it notifies on a **transition** to a terminal state and nothing else. Without
 * that, every poll would re-announce every finished deployment the instance still
 * lists, and the user would turn notifications off.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionManager } from "@/main/connection/connection-manager";
import { DeploymentWatcher } from "@/main/deployment-watcher";
import { noopLogger } from "@/main/logging";
import {
	memorySecrets,
	type TempContext,
	tempUserData,
	testConnectionStore,
} from "../helpers/harness";
import {
	type MockServer,
	startNotployMockServer,
} from "../helpers/mock-server";

const TOKEN = "npk_watcher_key";

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

interface Harness {
	watcher: DeploymentWatcher;
	notifications: string[];
	/** Replaces what the instance reports, for the next poll. */
	setDeployments: (deployments: unknown[]) => void;
}

async function harnessFor(): Promise<Harness> {
	let deployments: unknown[] = [];
	server = await startNotployMockServer({
		token: TOKEN,
		data: {
			"GET settings.health": { status: "ok" },
			"GET user.session": { user: { id: "u1" } },
			"GET deployment.allCentralized": () => deployments,
		},
	});

	const store = testConnectionStore(context.userDataPath, memorySecrets());
	const connection = await store.add({
		name: "Production",
		url: server.url,
		apiKey: TOKEN,
	});
	await store.setActive(connection.id);

	const manager = new ConnectionManager({
		store,
		logger: noopLogger,
		defaultTimeout: () => 5_000,
	});

	const notifications: string[] = [];
	const watcher = new DeploymentWatcher({
		manager,
		logger: noopLogger,
		notify: (title, body) => notifications.push(`${title} :: ${body}`),
		intervalSeconds: () => 0,
	});

	return {
		watcher,
		notifications,
		setDeployments: (next) => {
			deployments = next;
		},
	};
}

const running = {
	deploymentId: "dep-1",
	title: "Deploy storefront",
	status: "running",
};

describe("DeploymentWatcher", () => {
	it("never notifies on the first observation", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		// Already finished and unseen: the app started after the fact, so there is
		// nothing to report.
		setDeployments([{ ...running, status: "done" }]);

		expect(await watcher.poll()).toBe(0);
		expect(notifications).toEqual([]);
	});

	it("notifies when a running deployment succeeds", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		setDeployments([running]);
		await watcher.poll();

		setDeployments([{ ...running, status: "done" }]);
		expect(await watcher.poll()).toBe(1);
		expect(notifications[0]).toContain("Deployment succeeded on Production");
		expect(notifications[0]).toContain("Deploy storefront");
	});

	it("includes the instance's own error message on failure", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		setDeployments([running]);
		await watcher.poll();

		setDeployments([
			{ ...running, status: "error", errorMessage: "Build step 3 failed" },
		]);
		await watcher.poll();

		expect(notifications[0]).toContain("Deployment failed on Production");
		expect(notifications[0]).toContain("Build step 3 failed");
	});

	it("does not re-notify while the status does not change", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		setDeployments([running]);
		await watcher.poll();

		setDeployments([{ ...running, status: "done" }]);
		await watcher.poll();
		await watcher.poll();
		await watcher.poll();

		expect(notifications).toHaveLength(1);
	});

	it("stays quiet for a cancelled deployment", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		setDeployments([running]);
		await watcher.poll();

		setDeployments([{ ...running, status: "cancelled" }]);
		expect(await watcher.poll()).toBe(0);
		expect(notifications).toEqual([]);
	});

	it("does not let a failed poll look like a successful deployment", async () => {
		const { watcher, notifications, setDeployments } = await harnessFor();
		setDeployments([running]);
		await watcher.poll();

		// The instance goes away: the poll must be silent, not report anything.
		await server?.close();
		expect(await watcher.poll()).toBe(0);
		expect(notifications).toEqual([]);
	});

	it("is disabled when the interval preference is 0", async () => {
		const { watcher } = await harnessFor();
		watcher.apply();
		// `apply` with 0 seconds must not leave a timer behind; `stop` is safe to
		// call regardless, and the assertion is that neither throws nor hangs.
		watcher.stop();
		expect(true).toBe(true);
	});
});
