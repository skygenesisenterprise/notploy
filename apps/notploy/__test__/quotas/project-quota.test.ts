import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CPU = 1_000_000_000;

const quotaRow = (
	overrides: Partial<Record<"cpuLimit" | "cpuReservation" | "memoryLimit" | "memoryReservation", string | null>> = {},
) => ({
	cpuLimit: null,
	cpuReservation: null,
	memoryLimit: null,
	memoryReservation: null,
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

let projectQuota = quotaRow();
let usage: Record<string, string | number> = usageRow();
let application: Record<string, unknown> | undefined;

const updateChain = {
	set: vi.fn(),
	where: vi.fn(),
	returning: vi.fn(),
};
updateChain.set.mockReturnValue(updateChain);
updateChain.where.mockReturnValue(updateChain);
updateChain.returning.mockResolvedValue([
	{ applicationId: "app-1", appName: "app" },
]);
const updateMock = vi.fn(() => updateChain);

vi.mock("@notploy/server/db", () => ({
	db: {
		execute: vi.fn(() => Promise.resolve([usage])),
		update: updateMock,
		query: {
			projects: {
				findFirst: vi.fn(() => Promise.resolve(projectQuota)),
			},
			applications: {
				findFirst: vi.fn(() => Promise.resolve(application)),
			},
		},
	},
}));

const { db } = await import("@notploy/server/db");
const {
	assertProjectQuotaWithinUsage,
	assertServiceQuotaChange,
	findQuotaViolations,
	formatQuotaValue,
	getProjectQuotaUsage,
	parseQuotaValue,
	ProjectQuotaExceededError,
} = await import("@notploy/server/services/project-quota");
const { updateApplication } = await import(
	"@notploy/server/services/application"
);
const { updateProjectById } = await import("@notploy/server/services/project");

beforeEach(() => {		vi.clearAllMocks();
	vi.mocked(db.execute).mockReset();
	vi.mocked(db.execute).mockImplementation(
		(() => Promise.resolve([usage])) as never,
	);
	updateChain.returning.mockResolvedValue([
		{ applicationId: "app-1", appName: "app" },
	]);
	projectQuota = quotaRow();
	usage = usageRow();
	application = {
		applicationId: "app-1",
		appName: "app",
		cpuLimit: null,
		cpuReservation: null,
		memoryLimit: null,
		memoryReservation: null,
		environment: { project: { projectId: "project-1" } },
	};
});

describe("parseQuotaValue", () => {
	it("treats missing, empty, invalid and non-positive values as zero", () => {
		expect(parseQuotaValue(null)).toBe(0);
		expect(parseQuotaValue(undefined)).toBe(0);
		expect(parseQuotaValue("")).toBe(0);
		expect(parseQuotaValue("abc")).toBe(0);
		expect(parseQuotaValue("-5")).toBe(0);
		expect(parseQuotaValue("0")).toBe(0);
	});

	it("parses numeric strings and floors decimals", () => {
		expect(parseQuotaValue("1000000000")).toBe(CPU);
		expect(parseQuotaValue("1.9")).toBe(1);
	});
});

describe("formatQuotaValue", () => {
	it("formats CPU in cores and memory in binary units", () => {
		expect(formatQuotaValue("cpuLimit", 1_500_000_000)).toBe("1.5 CPU");
		expect(formatQuotaValue("memoryLimit", 2 * 1024 ** 3)).toBe("2 GiB");
		expect(formatQuotaValue("memoryLimit", 512 * 1024 ** 2)).toBe("512 MiB");
	});
});

describe("findQuotaViolations", () => {
	it("ignores meters without a quota", () => {
		expect(
			findQuotaViolations({
				quota: quotaRow(),
				usage: usageRow({ cpuLimit: 64 * CPU }),
			}),
		).toEqual([]);
	});

	it("reports the exact overage when other services already consume quota", () => {
		const violations = findQuotaViolations({
			quota: quotaRow({ cpuLimit: String(1.5 * CPU) }),
			usage: usageRow({ cpuLimit: CPU }),
			requested: { cpuLimit: String(CPU) },
		});

		expect(violations).toEqual([
			{
				meter: "cpuLimit",
				quota: 1.5 * CPU,
				used: CPU,
				requested: CPU,
				total: 2 * CPU,
			},
		]);
	});

	it("counts limits and reservations independently", () => {
		const violations = findQuotaViolations({
			quota: quotaRow({
				cpuLimit: String(4 * CPU),
				memoryReservation: String(1024 ** 3),
			}),
			usage: usageRow({ cpuLimit: CPU, memoryReservation: 512 * 1024 ** 2 }),
			requested: {
				cpuLimit: String(CPU),
				memoryReservation: String(768 * 1024 ** 2),
			},
		});

		expect(violations.map((violation) => violation.meter)).toEqual([
			"memoryReservation",
		]);
	});

	it("accepts usage exactly at the quota", () => {
		expect(
			findQuotaViolations({
				quota: quotaRow({ memoryLimit: "1073741824" }),
				usage: usageRow({ memoryLimit: 512 * 1024 ** 2 }),
				requested: { memoryLimit: String(512 * 1024 ** 2) },
			}),
		).toEqual([]);
	});
});

describe("ProjectQuotaExceededError", () => {
	it("is an explicit PRECONDITION_FAILED refusal carrying audit metadata", () => {
		const error = new ProjectQuotaExceededError({
			projectId: "project-1",
			serviceType: "application",
			serviceId: "app-1",
			violations: [
				{
					meter: "cpuLimit",
					quota: CPU,
					used: CPU / 2,
					requested: CPU,
					total: 1.5 * CPU,
				},
			],
		});

		expect(error.code).toBe("PRECONDITION_FAILED");
		expect(error.message).toContain("Project quota exceeded");
		expect(error.message).toContain("1 CPU");
		expect(error.message).toContain("1.5 CPU");
		expect(error.auditMetadata).toMatchObject({
			operation: "service",
			projectId: "project-1",
			serviceType: "application",
			serviceId: "app-1",
		});
	});

	it("uses a dedicated message when lowering a project quota", () => {
		const error = new ProjectQuotaExceededError({
			projectId: "project-1",
			operation: "project",
			violations: [
				{ meter: "cpuLimit", quota: CPU, used: 2 * CPU, requested: 0, total: 2 * CPU },
			],
		});

		expect(error.message).toContain("cannot be lowered");
		expect(error.auditMetadata.operation).toBe("project");
	});
});

describe("getProjectQuotaUsage", () => {
	it("parses the aggregated SQL result as numbers", async () => {
		usage = {
			cpuLimit: "3000000000",
			cpuReservation: "1000000000",
			memoryLimit: String(4 * 1024 ** 3),
			memoryReservation: "0",
		};

		await expect(getProjectQuotaUsage("project-1")).resolves.toEqual({
			cpuLimit: 3 * CPU,
			cpuReservation: CPU,
			memoryLimit: 4 * 1024 ** 3,
			memoryReservation: 0,
		});
		expect(db.execute).toHaveBeenCalledTimes(1);
	});

	it("builds one query covering every service table and excludes the edited service", async () => {
		await getProjectQuotaUsage("project-1", {
			type: "postgres",
			id: "pg-1",
		});

		const statement = vi.mocked(db.execute).mock.calls[0]?.[0];
		const { sql: query, params } = new PgDialect().sqlToQuery(statement as never);

		for (const table of [
			"application",
			"libsql",
			"mariadb",
			"mongo",
			"mysql",
			"postgres",
			"redis",
		]) {
			expect(query).toContain(`"${table}"`);
		}
		expect(query.match(/union all/g)).toHaveLength(6);
		expect(query).toContain('s."postgresId" <> ');
		expect(params.filter((param) => param === "project-1")).toHaveLength(7);
		expect(params.filter((param) => param === "pg-1")).toHaveLength(1);
	});
});

describe("assertProjectQuotaWithinUsage", () => {
	it("refuses lowering a quota below the limits already declared", async () => {
		usage = usageRow({ cpuLimit: 2 * CPU });

		await expect(
			assertProjectQuotaWithinUsage({
				projectId: "project-1",
				quota: quotaRow({ cpuLimit: String(CPU) }),
			}),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);
	});

	it("allows a quota at or above current usage", async () => {
		usage = usageRow({ cpuLimit: 2 * CPU });

		await expect(
			assertProjectQuotaWithinUsage({
				projectId: "project-1",
				quota: quotaRow({ cpuLimit: String(2 * CPU) }),
			}),
		).resolves.toBeUndefined();
	});

	it("skips the usage query when every quota is unset", async () => {
		await assertProjectQuotaWithinUsage({
			projectId: "project-1",
			quota: quotaRow(),
		});
		expect(db.execute).not.toHaveBeenCalled();
	});
});

describe("assertServiceQuotaChange", () => {
	it("merges the update over the service's current limits", async () => {
		projectQuota = quotaRow({ cpuLimit: String(CPU) });
		usage = usageRow({ cpuLimit: CPU });

		await expect(
			assertServiceQuotaChange({
				projectId: "project-1",
				serviceType: "application",
				serviceId: "app-1",
				current: { cpuLimit: String(CPU / 2) },
				changes: { memoryLimit: "1073741824" },
			}),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);
	});

	it("does not query anything when no resource field changes", async () => {
		await assertServiceQuotaChange({
			projectId: "project-1",
			serviceType: "application",
			serviceId: "app-1",
			current: { cpuLimit: String(CPU) },
			changes: { description: "new description" } as never,
		});

		expect(db.query.projects.findFirst).not.toHaveBeenCalled();
		expect(db.execute).not.toHaveBeenCalled();
	});
});

describe("updateProjectById enforcement", () => {
	it("refuses lowering a quota below the declared usage", async () => {
		projectQuota = quotaRow({ cpuLimit: String(2 * CPU) });
		usage = usageRow({ cpuLimit: 2 * CPU });

		await expect(
			updateProjectById("project-1", { cpuLimit: String(CPU) }),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("refuses a reservation greater than its limit", async () => {
		projectQuota = quotaRow({ cpuLimit: String(2 * CPU) });

		await expect(
			updateProjectById("project-1", {
				cpuLimit: String(CPU),
				cpuReservation: String(2 * CPU),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("applies a quota at or above current usage", async () => {
		projectQuota = quotaRow({ cpuLimit: String(4 * CPU) });
		usage = usageRow({ cpuLimit: CPU });

		await expect(
			updateProjectById("project-1", { cpuLimit: String(2 * CPU) }),
		).resolves.toBeDefined();
		expect(updateMock).toHaveBeenCalledTimes(1);
	});
});

describe("updateApplication enforcement", () => {
	it("refuses a CPU limit that would exceed the project quota before writing", async () => {
		projectQuota = quotaRow({ cpuLimit: String(CPU) });
		usage = usageRow({ cpuLimit: CPU / 2 });

		await expect(
			updateApplication("app-1", { cpuLimit: String(CPU) }),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);

		expect(updateMock).not.toHaveBeenCalled();
	});

	it("writes when the resulting total fits the quota", async () => {
		projectQuota = quotaRow({ cpuLimit: String(2 * CPU) });
		usage = usageRow({ cpuLimit: CPU });

		await expect(
			updateApplication("app-1", { cpuLimit: String(CPU) }),
		).resolves.toMatchObject({ applicationId: "app-1" });

		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("allows a non-resource update even when the project is at its quota", async () => {
		projectQuota = quotaRow({ cpuLimit: String(CPU) });
		application = {
			...application,
			cpuLimit: String(CPU),
		};

		await expect(
			updateApplication("app-1", { description: "renamed" }),
		).resolves.toBeDefined();

		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("still refuses increases for legacy services that already exceed the quota", async () => {
		projectQuota = quotaRow({ cpuLimit: String(CPU) });
		application = {
			...application,
			cpuLimit: String(2 * CPU),
		};

		await expect(
			updateApplication("app-1", { cpuLimit: String(3 * CPU) }),
		).rejects.toBeInstanceOf(ProjectQuotaExceededError);
	});
});
