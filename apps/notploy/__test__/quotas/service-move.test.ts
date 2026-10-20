import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CPU = 1_000_000_000;

const serviceRow = (
	overrides: Partial<Record<string, string | null>> = {},
) => ({
	serviceId: "pg-1",
	appName: "db-1",
	cpuLimit: null,
	cpuReservation: null,
	memoryLimit: null,
	memoryReservation: null,
	projectId: "project-1",
	projectName: "Project 1",
	environmentId: "env-1",
	environmentName: "Production",
	organizationId: "org-1",
	...overrides,
});

const targetRow = (
	overrides: Partial<Record<string, string | null>> = {},
) => ({
	projectId: "project-2",
	projectName: "Project 2",
	environmentId: "env-2",
	environmentName: "Production",
	organizationId: "org-1",
	...overrides,
});

const usageRow = (
	overrides: Partial<
		Record<"cpuLimit" | "cpuReservation" | "memoryLimit" | "memoryReservation", number>
	> = {},
) => ({
	cpuLimit: 0,
	cpuReservation: 0,
	memoryLimit: 0,
	memoryReservation: 0,
	...overrides,
});

let quota = {
	cpuLimit: null as string | null,
	cpuReservation: null as string | null,
	memoryLimit: null as string | null,
	memoryReservation: null as string | null,
};

vi.mock("@notploy/server/services/permission", () => ({
	checkServiceAccess: vi.fn(() => Promise.resolve()),
}));

vi.mock("@notploy/server/db", () => ({
	db: {
		execute: vi.fn(),
		query: {
			projects: {
				findFirst: vi.fn(() => Promise.resolve(quota)),
			},
		},
	},
}));

const { db } = await import("@notploy/server/db");
const { checkServiceAccess } = await import(
	"@notploy/server/services/permission"
);
const {
	assertServiceMoveAllowed,
	previewServiceMove,
} = await import("@notploy/server/services/service-move");
const { ProjectQuotaExceededError } = await import(
	"@notploy/server/services/project-quota"
);

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

const mockMove = ({
	service = serviceRow(),
	target = targetRow(),
	usage = usageRow(),
}: {
	service?: Record<string, string | null>;
	target?: Record<string, string | null>;
	usage?: Record<string, number>;
} = {}) => {
	vi.mocked(db.execute)
		.mockResolvedValueOnce([service] as never)
		.mockResolvedValueOnce([target] as never)
		.mockResolvedValueOnce([usage] as never);
};

beforeEach(() => {
	vi.clearAllMocks();
	quota = {
		cpuLimit: null,
		cpuReservation: null,
		memoryLimit: null,
		memoryReservation: null,
	};
	vi.mocked(checkServiceAccess).mockResolvedValue(undefined);
	vi.mocked(db.execute).mockReset();
});

describe("previewServiceMove", () => {
	it("refuses a target environment from another organization", async () => {
		mockMove({ target: targetRow({ organizationId: "org-2" }) });

		await expect(
			previewServiceMove({
				ctx,
				serviceType: "postgres",
				serviceId: "pg-1",
				targetEnvironmentId: "env-other",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(checkServiceAccess).not.toHaveBeenCalled();
	});

	it("refuses a service from another organization", async () => {
		mockMove({ service: serviceRow({ organizationId: "org-2" }) });

		await expect(
			previewServiceMove({
				ctx,
				serviceType: "postgres",
				serviceId: "pg-1",
				targetEnvironmentId: "env-2",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("requires service create access on the target project", async () => {
		mockMove();
		vi.mocked(checkServiceAccess).mockRejectedValue(
			new TRPCError({ code: "UNAUTHORIZED" }),
		);

		await expect(
			previewServiceMove({
				ctx,
				serviceType: "postgres",
				serviceId: "pg-1",
				targetEnvironmentId: "env-2",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(checkServiceAccess).toHaveBeenCalledWith(ctx, "project-2", "create");
	});

	it("returns source/target and preserves runtime resources without redeploy", async () => {
		mockMove();

		const preview = await previewServiceMove({
			ctx,
			serviceType: "postgres",
			serviceId: "pg-1",
			targetEnvironmentId: "env-2",
		});

		expect(preview).toMatchObject({
			service: { id: "pg-1", type: "postgres", appName: "db-1" },
			source: {
				projectId: "project-1",
				environmentId: "env-1",
			},
			target: {
				projectId: "project-2",
				environmentId: "env-2",
			},
			sameProject: false,
			preserved: {
				identity: true,
				appName: true,
				volumes: true,
				domains: true,
				networks: true,
			},
			permissions: { recalculatedFromTargetProject: true },
			requiresRedeploy: false,
			quota: { withinQuota: true, violations: [] },
		});
	});

	it("supports Compose moves without quota accounting", async () => {
		// Compose has no per-service limit columns; the resolver substitutes
		// nulls and quota evaluation must not call the usage query.
		mockMove({ service: serviceRow() });

		const preview = await previewServiceMove({
			ctx,
			serviceType: "compose",
			serviceId: "compose-1",
			targetEnvironmentId: "env-2",
		});

		expect(preview.service.type).toBe("compose");
		expect(preview.quota.withinQuota).toBe(true);
		expect(db.execute).toHaveBeenCalledTimes(2);
	});

	it("skips quota accounting for a move inside the same project", async () => {
		mockMove({
			target: targetRow({ projectId: "project-1", environmentId: "env-1b" }),
		});

		const preview = await previewServiceMove({
			ctx,
			serviceType: "postgres",
			serviceId: "pg-1",
			targetEnvironmentId: "env-1b",
		});

		expect(preview.sameProject).toBe(true);
		expect(preview.quota).toEqual({ withinQuota: true, violations: [] });
		// Two resolution queries only: no usage/quota lookup for a no-op move.
		expect(db.execute).toHaveBeenCalledTimes(2);
	});

	it("reports quota violations in the preview instead of hiding them", async () => {
		quota = {
			cpuLimit: String(CPU),
			cpuReservation: null,
			memoryLimit: null,
			memoryReservation: null,
		};
		mockMove({
			service: serviceRow({ cpuLimit: String(CPU) }),
			usage: usageRow({ cpuLimit: CPU / 2 }),
		});

		const preview = await previewServiceMove({
			ctx,
			serviceType: "postgres",
			serviceId: "pg-1",
			targetEnvironmentId: "env-2",
		});

		expect(preview.quota.withinQuota).toBe(false);
		expect(preview.quota.violations).toHaveLength(1);
		expect(preview.quota.violations[0]).toMatchObject({
			meter: "cpuLimit",
			quota: CPU,
			used: CPU / 2,
			requested: CPU,
		});
	});
});

describe("assertServiceMoveAllowed", () => {
	it("refuses the move when the target project quota would be exceeded", async () => {
		quota = {
			cpuLimit: String(CPU),
			cpuReservation: null,
			memoryLimit: null,
			memoryReservation: null,
		};
		mockMove({
			service: serviceRow({ cpuLimit: String(CPU) }),
			usage: usageRow({ cpuLimit: CPU / 2 }),
		});

		await expect(
			assertServiceMoveAllowed({
				ctx,
				serviceType: "postgres",
				serviceId: "pg-1",
				targetEnvironmentId: "env-2",
			}),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);
	});

	it("returns the preview when every boundary passes", async () => {
		mockMove();

		await expect(
			assertServiceMoveAllowed({
				ctx,
				serviceType: "postgres",
				serviceId: "pg-1",
				targetEnvironmentId: "env-2",
			}),
		).resolves.toMatchObject({ sameProject: false });
	});
});
