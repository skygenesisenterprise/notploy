import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(() => Promise.resolve()),
}));

const { audit } = await import("@/server/api/utils/audit");
const { ProjectQuotaExceededError } = await import(
	"@notploy/server/services/project-quota"
);
const { withQuotaAudit } = await import("@/server/api/utils/quota");

const ctx = {
	user: { id: "user-1", email: "user@example.com", role: "owner" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("withQuotaAudit", () => {
	it("returns the mutation result without auditing on success", async () => {
		await expect(
			withQuotaAudit(ctx, { type: "service" }, () => Promise.resolve("ok")),
		).resolves.toBe("ok");
		expect(audit).not.toHaveBeenCalled();
	});

	it("audits the refusal and rethrows the explicit error", async () => {
		const error = new ProjectQuotaExceededError({
			projectId: "project-1",
			serviceType: "postgres",
			serviceId: "pg-1",
			violations: [
				{
					meter: "memoryLimit",
					quota: 1024 ** 3,
					used: 512 * 1024 ** 2,
					requested: 1024 ** 3,
					total: 1.5 * 1024 ** 3,
				},
			],
		});

		await expect(
			withQuotaAudit(
				ctx,
				{ type: "service", id: "pg-1", name: "db" },
				() => Promise.reject(error),
			),
		).rejects.toBe(error);

		expect(audit).toHaveBeenCalledTimes(1);
		expect(audit).toHaveBeenCalledWith(
			ctx,
			expect.objectContaining({
				action: "quotaExceeded",
				resourceType: "service",
				resourceId: "pg-1",
				resourceName: "db",
				metadata: expect.objectContaining({
					projectId: "project-1",
					serviceType: "postgres",
					serviceId: "pg-1",
				}),
			}),
		);
	});

	it("does not audit unrelated errors", async () => {
		const error = new Error("database unavailable");

		await expect(
			withQuotaAudit(ctx, { type: "service" }, () => Promise.reject(error)),
		).rejects.toBe(error);
		expect(audit).not.toHaveBeenCalled();
	});
});
