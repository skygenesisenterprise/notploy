import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const execute = vi.fn(() => Promise.resolve([]));
	const findMany = vi.fn(() => Promise.resolve([] as unknown[]));
	const insertReturning = vi.fn(() => Promise.resolve([] as unknown[]));
	const insert = vi.fn(() => ({
		values: () => ({ returning: insertReturning }),
	}));
	const updateReturning = vi.fn(() => Promise.resolve([] as unknown[]));
	const update = vi.fn(() => ({
		set: () => ({
			where: () => ({ returning: updateReturning }),
		}),
	}));
	const tx = {
		execute,
		query: { ports: { findMany } },
		insert,
		update,
	};
	const transaction = vi.fn(
		async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx),
	);
	return {
		execute,
		findMany,
		insert,
		insertReturning,
		transaction,
		update,
		updateReturning,
	};
});

vi.mock("@notploy/server/db", () => ({
	db: { transaction: mocks.transaction },
	dbUrl: "postgres://mock:mock@localhost:5432/mock",
}));

import {
	createPortChecked,
	updatePortChecked,
} from "@notploy/server/services/port";

const existingPort = {
	portId: "port-1",
	publishedPort: 8080,
	targetPort: 80,
	protocol: "tcp" as const,
	publishMode: "host" as const,
};

const newMapping = {
	publishedPort: 8080,
	targetPort: 3000,
	protocol: "tcp" as const,
	publishMode: "host" as const,
};

beforeEach(() => {
	// `mockClear` keeps the implementations declared above, so each test only
	// resets the values it cares about.
	vi.clearAllMocks();
	mocks.findMany.mockResolvedValue([]);
});

describe("createPortChecked", () => {
	it("takes the per-application lock before reading existing mappings", async () => {
		mocks.insertReturning.mockResolvedValue([
			{ portId: "port-new", ...newMapping, applicationId: "app-1" },
		]);

		await createPortChecked({ applicationId: "app-1", ...newMapping });

		expect(mocks.transaction).toHaveBeenCalledTimes(1);
		expect(mocks.execute).toHaveBeenCalledTimes(1);
		expect(mocks.findMany).toHaveBeenCalledTimes(1);
		expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.findMany.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.insert).toHaveBeenCalledTimes(1);
	});

	it("refuses a mapping that collides with an existing published port", async () => {
		mocks.findMany.mockResolvedValue([existingPort]);

		await expect(
			createPortChecked({ applicationId: "app-1", ...newMapping }),
		).rejects.toBeInstanceOf(TRPCError);
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("returns the created port", async () => {
		const created = {
			portId: "port-new",
			...newMapping,
			applicationId: "app-1",
		};
		mocks.insertReturning.mockResolvedValue([created]);

		await expect(
			createPortChecked({ applicationId: "app-1", ...newMapping }),
		).resolves.toEqual(created);
	});
});

describe("updatePortChecked", () => {
	it("ignores the mapping being updated when checking conflicts", async () => {
		mocks.findMany.mockResolvedValue([existingPort]);
		mocks.updateReturning.mockResolvedValue([
			{ ...existingPort, targetPort: 3000 },
		]);

		await expect(
			updatePortChecked("port-1", "app-1", newMapping),
		).resolves.toMatchObject({ targetPort: 3000 });
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("refuses a conflict with another mapping of the same application", async () => {
		mocks.findMany.mockResolvedValue([
			existingPort,
			{
				portId: "port-2",
				publishedPort: 9000,
				targetPort: 90,
				protocol: "tcp" as const,
				publishMode: "host" as const,
			},
		]);

		await expect(
			updatePortChecked("port-1", "app-1", {
				...newMapping,
				publishedPort: 9000,
			}),
		).rejects.toBeInstanceOf(TRPCError);
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
