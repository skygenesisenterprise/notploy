import {
	validateBuildServer,
	validateDeploymentTarget,
} from "@notploy/server/services/deployment-target";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindServerById, mockGetAccessibleServerIds } = vi.hoisted(() => ({
	mockFindServerById: vi.fn(),
	mockGetAccessibleServerIds: vi.fn(),
}));

vi.mock("@notploy/server/services/server", () => ({
	findServerById: mockFindServerById,
	getAccessibleServerIds: mockGetAccessibleServerIds,
}));

const session = { userId: "u1", activeOrganizationId: "org1" };

beforeEach(() => {
	vi.clearAllMocks();
	mockGetAccessibleServerIds.mockResolvedValue(new Set(["srv-deploy"]));
});

describe("validateDeploymentTarget", () => {
	it("accepts a connected deployment server", async () => {
		mockFindServerById.mockResolvedValue({
			serverId: "srv-deploy",
			name: "prod",
			organizationId: "org1",
			serverType: "deploy",
			serverStatus: "active",
			sshKeyId: "key1",
		});
		const target = await validateDeploymentTarget({
			serverId: "srv-deploy",
			session,
		});
		expect(target?.serverId).toBe("srv-deploy");
	});

	it("returns null for explicit local execution", async () => {
		await expect(
			validateDeploymentTarget({ serverId: null, session }),
		).resolves.toBeNull();
	});

	it("rejects build-only servers as runtime targets", async () => {
		mockGetAccessibleServerIds.mockResolvedValue(new Set(["srv-build"]));
		mockFindServerById.mockResolvedValue({
			serverId: "srv-build",
			name: "builder",
			organizationId: "org1",
			serverType: "build",
			serverStatus: "active",
			sshKeyId: "key1",
		});
		await expect(
			validateDeploymentTarget({ serverId: "srv-build", session }),
		).rejects.toBeInstanceOf(TRPCError);
	});

	it("rejects disabled servers and servers without SSH keys", async () => {
		mockFindServerById.mockResolvedValue({
			serverId: "srv-deploy",
			name: "prod",
			organizationId: "org1",
			serverType: "deploy",
			serverStatus: "inactive",
			sshKeyId: "key1",
		});
		await expect(
			validateDeploymentTarget({ serverId: "srv-deploy", session }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		mockFindServerById.mockResolvedValue({
			serverId: "srv-deploy",
			name: "prod",
			organizationId: "org1",
			serverType: "deploy",
			serverStatus: "active",
			sshKeyId: null,
		});
		await expect(
			validateDeploymentTarget({ serverId: "srv-deploy", session }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects servers outside the caller's access without leaking details", async () => {
		mockGetAccessibleServerIds.mockResolvedValue(new Set());
		await expect(
			validateDeploymentTarget({ serverId: "srv-other", session }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(mockFindServerById).not.toHaveBeenCalled();
	});
});

describe("validateBuildServer", () => {
	it("rejects deployment servers as build servers", async () => {
		mockFindServerById.mockResolvedValue({
			serverId: "srv-deploy",
			organizationId: "org1",
			serverType: "deploy",
			serverStatus: "active",
			sshKeyId: "key1",
		});
		await expect(
			validateBuildServer({ buildServerId: "srv-deploy", session }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
