/**
 * The database service, exercised through the real SDK against the in-process
 * mock API.
 *
 * What matters here is not that a GET happens — it is that the client's promises
 * hold: a service is normalised whichever engine it came from, an engine the
 * instance does not expose produces a note rather than a crash, LibSQL is read
 * out of the project tree because it has no `search`, and the password procedure
 * is refused for an engine that does not define one.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionManager } from "@/main/connection/connection-manager";
import { noopLogger } from "@/main/logging";
import { DatabaseService } from "@/main/services/database-service";
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

const TOKEN = "npk_test_key_value";

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

const POSTGRES_ROW = {
	postgresId: "pg-1",
	name: "Primary",
	appName: "primary-abc123",
	description: "Main database",
	databaseName: "app",
	databaseUser: "app",
	databasePassword: "s3cret-value",
	dockerImage: "postgres:16",
	externalPort: 5432,
	applicationStatus: "done",
	createdAt: "2026-09-01T10:00:00.000Z",
	environmentId: "env-1",
};

/** An instance exposing some engines, with a project tree that holds a LibSQL. */
function instanceData() {
	return {
		"GET settings.health": { status: "ok" },
		"GET user.session": { user: { id: "u1" } },
		"GET settings.getNotployVersion": "0.30.6",
		"GET settings.isCloud": false,
		"GET settings.getOpenApiDocument": openApiDocument([
			"project",
			"environment",
			"application",
			"postgres",
			"mysql",
			"redis",
			"libsql",
			// Deliberately no `mariadb`, `mongo`: they must be reported as absent.
		]),
		"GET postgres.search": { items: [POSTGRES_ROW], total: 1 },
		"GET mysql.search": { items: [], total: 0 },
		"GET redis.search": {
			items: [
				{
					redisId: "rd-1",
					name: "Cache",
					appName: "cache-def456",
					applicationStatus: "running",
				},
			],
			total: 1,
		},
		"GET project.all": [{ projectId: "proj-1", name: "Storefront" }],
		"GET environment.byProjectId": [
			{
				environmentId: "env-1",
				name: "production",
				libsql: [
					{
						libsqlId: "sq-1",
						name: "Edge replica",
						appName: "edge-ghi789",
						applicationStatus: "done",
					},
				],
			},
		],
		"GET postgres.one": POSTGRES_ROW,
		"GET postgres.readLogs": "postgres log line\n",
		"POST postgres.stop": null,
		"POST postgres.reload": null,
		"GET libsql.one": {
			libsqlId: "sq-1",
			name: "Edge replica",
			appName: "edge-ghi789",
		},
	};
}

async function serviceFor(): Promise<{
	service: DatabaseService;
	manager: ConnectionManager;
}> {
	server = await startNotployMockServer({
		token: TOKEN,
		data: instanceData(),
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
	// Reads the OpenAPI document, so capabilities reflect the routers above.
	await manager.checkConnection(connection.id);
	return { service: new DatabaseService(manager), manager };
}

describe("DatabaseService.list", () => {
	it("normalises every engine's identifier into one shape", async () => {
		const { service } = await serviceFor();
		const { databases } = await service.list();

		const postgres = databases.find((entry) => entry.engine === "postgres");
		expect(postgres).toMatchObject({
			engine: "postgres",
			id: "pg-1",
			name: "Primary",
			databaseName: "app",
			externalPort: 5432,
		});

		const redis = databases.find((entry) => entry.engine === "redis");
		expect(redis).toMatchObject({ engine: "redis", id: "rd-1", name: "Cache" });
	});

	it("reads LibSQL out of the project environment tree", async () => {
		const { service } = await serviceFor();
		const { databases } = await service.list({ engine: "libsql" });

		expect(databases).toHaveLength(1);
		expect(databases[0]).toMatchObject({
			engine: "libsql",
			id: "sq-1",
			name: "Edge replica",
			environmentId: "env-1",
			projectId: "proj-1",
		});
	});

	it("says which engines the instance does not expose", async () => {
		const { service } = await serviceFor();
		const { notes } = await service.list();

		expect(notes.some((note) => note.includes("mariadb"))).toBe(true);
		expect(notes.some((note) => note.includes("mongo"))).toBe(true);
		// An engine that *is* exposed must not be reported as missing.
		expect(notes.some((note) => note.startsWith("postgres:"))).toBe(false);
	});

	it("narrows to one engine when asked", async () => {
		const { service } = await serviceFor();
		const { databases } = await service.list({ engine: "postgres" });

		expect(databases.every((entry) => entry.engine === "postgres")).toBe(true);
	});

	it("scopes the search query to the requested environment", async () => {
		const { service } = await serviceFor();
		await service.list({ engine: "postgres", environmentId: "env-1" });

		const request = server?.requests.find(
			(entry) => entry.path === "postgres.search",
		);
		expect(request?.query.get("environmentId")).toBe("env-1");
	});
});

describe("DatabaseService.one", () => {
	it("returns a normalised record", async () => {
		const { service } = await serviceFor();
		const database = await service.one("postgres", "pg-1");

		expect(database).toMatchObject({
			engine: "postgres",
			id: "pg-1",
			appName: "primary-abc123",
		});
	});

	it("reports a record the instance does not recognise instead of guessing", async () => {
		const { service } = await serviceFor();
		// The mock answers `null` for an endpoint it has no payload for, so a
		// mismatched shape is what `one` has to reject.
		await expect(service.one("mysql", "missing")).rejects.toMatchObject({
			code: "not-found",
		});
	});
});

describe("DatabaseService.action", () => {
	it("posts the engine-scoped identifier", async () => {
		const { service } = await serviceFor();

		await service.action({
			engine: "postgres",
			databaseId: "pg-1",
			action: "stop",
		});

		const request = server?.requests.find(
			(entry) => entry.path === "postgres.stop",
		);
		expect(request?.body).toEqual({ postgresId: "pg-1" });
	});

	it("resolves the generated name before a reload", async () => {
		const { service } = await serviceFor();

		// No appName supplied: it has to be read from the service itself, because
		// `*.reload` rejects without it.
		await service.action({
			engine: "postgres",
			databaseId: "pg-1",
			action: "reload",
		});

		const request = server?.requests.find(
			(entry) => entry.path === "postgres.reload",
		);
		expect(request?.body).toEqual({
			postgresId: "pg-1",
			appName: "primary-abc123",
		});
	});
});

describe("DatabaseService.logs", () => {
	it("returns the service's log text", async () => {
		const { service } = await serviceFor();
		expect(await service.logs("postgres", "pg-1")).toBe("postgres log line\n");
	});
});

describe("DatabaseService.changePassword", () => {
	it("refuses an engine whose router has no password procedure", async () => {
		const { service } = await serviceFor();
		// LibSQL exposes no `changePassword`; calling another engine's route for it
		// would be worse than refusing.
		await expect(
			service.changePassword("libsql", "sq-1", "new-password"),
		).rejects.toMatchObject({ code: "unsupported" });
	});
});
