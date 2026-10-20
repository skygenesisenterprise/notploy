import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMemberData = (
	role: string,
	accessedServices: string[] = [],
	accessedProjects: string[] = [],
) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	accessedProjects,
	accessedServices,
	accessedEnvironments: [] as string[],
	canCreateProjects: false,
	canDeleteProjects: false,
	canCreateServices: false,
	canDeleteServices: false,
	canCreateEnvironments: false,
	canDeleteEnvironments: false,
	canAccessToTraefikFiles: false,
	canAccessToDocker: false,
	canAccessToAPI: false,
	canAccessToSSHKeys: false,
	canAccessToGitProviders: false,
	user: { id: "user-1", email: "test@test.com" },
});

let memberToReturn: ReturnType<typeof mockMemberData> =
	mockMemberData("member");

let serviceProjectRows: Array<{ projectId: string }> = [];

vi.mock("@notploy/server/db", () => ({
	db: {
		execute: vi.fn(() => Promise.resolve(serviceProjectRows)),
		query: {
			member: {
				findFirst: vi.fn(() => Promise.resolve(memberToReturn)),
				findMany: vi.fn(() => Promise.resolve([])),
			},
			organizationRole: {
				findFirst: vi.fn(),
				findMany: vi.fn(() => Promise.resolve([])),
			},
		},
	},
}));

const { db } = await import("@notploy/server/db");
const {
	checkEnvironmentAccess,
	checkServicePermissionAndAccess,
	checkServiceAccess,
} = await import("@notploy/server/services/permission");

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
	serviceProjectRows = [];
});

describe("checkServicePermissionAndAccess", () => {
	it("owner bypasses accessedServices check", async () => {
		memberToReturn = mockMemberData("owner", []);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
	});

	it("admin bypasses accessedServices check", async () => {
		memberToReturn = mockMemberData("admin", []);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				backup: ["create"],
			}),
		).resolves.toBeUndefined();
	});

	it("member with access to service passes", async () => {
		memberToReturn = mockMemberData("member", ["service-123"]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
	});

	it("member WITHOUT access to service fails", async () => {
		memberToReturn = mockMemberData("member", ["other-service"]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});

	it("member with empty accessedServices fails", async () => {
		memberToReturn = mockMemberData("member", []);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				domain: ["delete"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});

	it("member inherits access to a service from project access", async () => {
		memberToReturn = mockMemberData("member", [], ["project-1"]);
		serviceProjectRows = [{ projectId: "project-1" }];

		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
	});

	it("member without project access still fails when the service belongs elsewhere", async () => {
		memberToReturn = mockMemberData("member", [], ["project-1"]);
		serviceProjectRows = [{ projectId: "project-2" }];

		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});

	it("revoking project access removes the inherited service access", async () => {
		memberToReturn = mockMemberData("member", [], []);
		serviceProjectRows = [{ projectId: "project-1" }];

		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});

	it("does not resolve the project when the service is explicitly granted", async () => {
		memberToReturn = mockMemberData("member", ["service-123"]);
		serviceProjectRows = [{ projectId: "project-1" }];

		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
		expect(db.execute).not.toHaveBeenCalled();
	});
});

describe("checkServiceAccess", () => {
	it("member with service access passes read check", async () => {
		memberToReturn = mockMemberData("member", ["app-1"]);
		await expect(
			checkServiceAccess(ctx, "app-1", "read"),
		).resolves.toBeUndefined();
	});

	it("member without service access fails read check", async () => {
		memberToReturn = mockMemberData("member", []);
		await expect(checkServiceAccess(ctx, "app-1", "read")).rejects.toThrow(
			"You don't have access to this service",
		);
	});

	it("owner bypasses all access checks", async () => {
		memberToReturn = mockMemberData("owner", [], []);
		await expect(
			checkServiceAccess(ctx, "project-1", "create"),
		).resolves.toBeUndefined();
	});

	it("member with project access can create a service in that project", async () => {
		memberToReturn = mockMemberData("member", [], ["project-1"]);
		memberToReturn.canCreateServices = true;
		await expect(
			checkServiceAccess(ctx, "project-1", "create"),
		).resolves.toBeUndefined();
	});

	it("member without project access cannot create a service", async () => {
		memberToReturn = mockMemberData("member", [], ["project-2"]);
		memberToReturn.canCreateServices = true;
		await expect(
			checkServiceAccess(ctx, "project-1", "create"),
		).rejects.toThrow("You don't have access to this project");
	});

	it("member inherits read access from the service project", async () => {
		memberToReturn = mockMemberData("member", [], ["project-1"]);
		serviceProjectRows = [{ projectId: "project-1" }];
		await expect(
			checkServiceAccess(ctx, "app-1", "read"),
		).resolves.toBeUndefined();
	});
});

describe("checkEnvironmentAccess", () => {
	it("member inherits environment access from project access", async () => {
		memberToReturn = mockMemberData("member", [], ["project-1"]);
		serviceProjectRows = [{ projectId: "project-1" }];

		await expect(
			checkEnvironmentAccess(ctx, "env-1", "read"),
		).resolves.toBeUndefined();
	});

	it("member without project access fails environment check", async () => {
		memberToReturn = mockMemberData("member", [], ["project-2"]);
		serviceProjectRows = [{ projectId: "project-1" }];

		await expect(
			checkEnvironmentAccess(ctx, "env-1", "read"),
		).rejects.toThrow("You don't have access to this environment");
	});
});
