import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appMocks = vi.hoisted(() => ({
	findApplicationById: vi.fn(),
	manageDomain: vi.fn(),
	removeDomain: vi.fn(),
}));

vi.mock("@notploy/server/services/application", () => ({
	findApplicationById: appMocks.findApplicationById,
}));

vi.mock("@notploy/server/utils/traefik/domain", () => ({
	manageDomain: appMocks.manageDomain,
	removeDomain: appMocks.removeDomain,
}));

const mocks = vi.hoisted(() => {
	const findFirst = vi.fn(() => Promise.resolve(undefined as unknown));
	const insertReturning = vi.fn(() => Promise.resolve([] as unknown[]));
	const insertValues = vi.fn(() => ({
		onConflictDoNothing: () => ({ returning: insertReturning }),
	}));
	const insert = vi.fn(() => ({ values: insertValues }));
	const updateReturning = vi.fn(() => Promise.resolve([] as unknown[]));
	const update = vi.fn(() => ({
		set: () => ({ where: () => ({ returning: updateReturning }) }),
	}));
	const db = {
		query: { cloudDomains: { findFirst } },
		insert,
		update,
		delete: vi.fn(),
	};
	return { db, findFirst, insert, insertReturning, update, updateReturning };
});

vi.mock("@notploy/server/db", () => ({
	db: mocks.db,
	dbUrl: "postgres://mock:mock@localhost:5432/mock",
}));

import {
	allocateCloudDomain,
	cloudHostnameCandidates,
	getCloudDomainBase,
	normalizeCloudDomainBase,
	provisionCloudDomainRouting,
	releaseCloudDomain,
	toCloudDomainLabel,
	toCloudDomainView,
} from "@notploy/server/services/cloud-domain";

const reserved = {
	cloudDomainId: "cloud-1",
	hostname: "my-app.notploy.app",
	label: "my-app",
	organizationId: "org-1",
	projectId: "project-1",
	environmentId: "env-1",
	applicationId: "app-1",
	domainId: null,
	port: 3000,
	status: "pending" as const,
	errorMessage: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	releasedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.findFirst.mockResolvedValue(undefined);
});

describe("toCloudDomainLabel", () => {
	it("normalizes names into DNS labels", () => {
		expect(toCloudDomainLabel("My Project")).toBe("my-project");
		expect(toCloudDomainLabel("  Café  API !! ")).toBe("cafe-api");
		expect(toCloudDomainLabel("--Already-Slugged--")).toBe("already-slugged");
	});

	it("falls back to a stable label for unusable names", () => {
		expect(toCloudDomainLabel("***")).toBe("app");
	});

	it("never assigns platform labels to a tenant", () => {
		expect(toCloudDomainLabel("api")).toBe("api-app");
		expect(toCloudDomainLabel("WWW")).toBe("www-app");
	});
});

describe("cloudHostnameCandidates", () => {
	it("is deterministic and collision-suffixed", () => {
		expect(cloudHostnameCandidates("My App", "notploy.app", 3)).toEqual([
			"my-app.notploy.app",
			"my-app-2.notploy.app",
			"my-app-3.notploy.app",
		]);
	});

	it("never produces duplicates", () => {
		const candidates = cloudHostnameCandidates("Shop", "notploy.app", 20);
		expect(new Set(candidates).size).toBe(candidates.length);
	});
});

describe("getCloudDomainBase / normalizeCloudDomainBase", () => {
	it("normalizes a valid wildcard zone", () => {
		expect(normalizeCloudDomainBase(".Notploy.App.")).toBe("notploy.app");
	});

	it("rejects invalid zones", () => {
		expect(normalizeCloudDomainBase("notploy")).toBeNull();
		expect(normalizeCloudDomainBase("*.notploy.app")).toBeNull();
		expect(normalizeCloudDomainBase("")).toBeNull();
	});

	it("is disabled outside managed cloud", () => {
		expect(getCloudDomainBase({}, false)).toBeNull();
	});

	it("defaults to notploy.app on managed cloud and honors the override", () => {
		expect(getCloudDomainBase({}, true)).toBe("notploy.app");
		expect(
			getCloudDomainBase({ NOTPLOY_CLOUD_DOMAIN: "apps.example.com" }, true),
		).toBe("apps.example.com");
	});

	it("can be disabled explicitly on managed cloud", () => {
		expect(getCloudDomainBase({ NOTPLOY_CLOUD_DOMAIN: "" }, true)).toBeNull();
	});
});

describe("allocateCloudDomain", () => {
	const input = {
		applicationId: "app-1",
		organizationId: "org-1",
		projectId: "project-1",
		environmentId: "env-1",
		appName: "My App",
		port: 8080,
		base: "notploy.app",
	};

	it("returns the existing reservation without inserting a second one", async () => {
		mocks.findFirst.mockResolvedValue(reserved);

		await expect(allocateCloudDomain(input)).resolves.toBe(reserved);
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("reserves the first free candidate when another tenant owns the name", async () => {
		const second = {
			...reserved,
			cloudDomainId: "cloud-2",
			hostname: "my-app-2.notploy.app",
		};
		mocks.insertReturning
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([second]);

		await expect(allocateCloudDomain(input)).resolves.toBe(second);
		expect(mocks.insertReturning).toHaveBeenCalledTimes(2);
	});

	it("returns the hostname reserved by a concurrent deploy of the same app", async () => {
		const raced = { ...reserved, hostname: "my-app-3.notploy.app" };
		mocks.insertReturning.mockResolvedValueOnce([]);
		mocks.findFirst
			.mockResolvedValueOnce(undefined) // initial check
			.mockResolvedValueOnce(raced); // concurrent deploy won

		await expect(allocateCloudDomain(input)).resolves.toBe(raced);
	});

	it("fails explicitly when every candidate is taken", async () => {
		mocks.insertReturning.mockResolvedValue([]);

		await expect(
			allocateCloudDomain({ ...input, base: "notploy.app" }),
		).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<TRPCError>);
		expect(mocks.insertReturning).toHaveBeenCalledTimes(20);
	});

	it("does nothing when cloud domains are disabled", async () => {
		await expect(
			allocateCloudDomain({ ...input, base: null }),
		).resolves.toBeNull();
		expect(mocks.insert).not.toHaveBeenCalled();
	});
});

describe("toCloudDomainView", () => {
	it("exposes an HTTPS URL and the provisioning status", () => {
		expect(toCloudDomainView(reserved)).toMatchObject({
			hostname: "my-app.notploy.app",
			url: "https://my-app.notploy.app",
			status: "pending",
			port: 3000,
		});
	});
});

describe("provisionCloudDomainRouting", () => {
	it("records a recoverable error when provisioning fails", async () => {
		mocks.findFirst.mockResolvedValue(reserved);
		appMocks.findApplicationById.mockRejectedValueOnce(
			new Error("server unreachable"),
		);
		mocks.updateReturning.mockResolvedValue([
			{ ...reserved, status: "error", errorMessage: "server unreachable" },
		]);

		const result = await provisionCloudDomainRouting("cloud-1");

		expect(result.status).toBe("error");
		expect(result.errorMessage).toBe("server unreachable");
		expect(appMocks.manageDomain).not.toHaveBeenCalled();
	});
});

describe("releaseCloudDomain", () => {
	it("marks the reservation released and keeps a tombstone", async () => {
		mocks.findFirst.mockResolvedValue(reserved);
		mocks.updateReturning.mockResolvedValue([
			{
				...reserved,
				status: "released",
				releasedAt: "2026-01-02T00:00:00.000Z",
			},
		]);

		const released = await releaseCloudDomain("app-1");

		expect(released?.status).toBe("released");
		expect(released?.hostname).toBe("my-app.notploy.app");
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("is a no-op when the application has no live hostname", async () => {
		mocks.findFirst.mockResolvedValue(undefined);

		await expect(releaseCloudDomain("app-1")).resolves.toBeNull();
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
