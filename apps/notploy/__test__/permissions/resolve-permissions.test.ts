import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMemberData = (
	role: string,
	overrides: Record<string, boolean> = {},
) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	accessedProjects: [] as string[],
	accessedServices: [] as string[],
	accessedEnvironments: [] as string[],
	canCreateProjects: overrides.canCreateProjects ?? false,
	canDeleteProjects: overrides.canDeleteProjects ?? false,
	canCreateServices: overrides.canCreateServices ?? false,
	canDeleteServices: overrides.canDeleteServices ?? false,
	canCreateEnvironments: overrides.canCreateEnvironments ?? false,
	canDeleteEnvironments: overrides.canDeleteEnvironments ?? false,
	canAccessToTraefikFiles: overrides.canAccessToTraefikFiles ?? false,
	canAccessToDocker: overrides.canAccessToDocker ?? false,
	canAccessToAPI: overrides.canAccessToAPI ?? false,
	canAccessToSSHKeys: overrides.canAccessToSSHKeys ?? false,
	canAccessToGitProviders: overrides.canAccessToGitProviders ?? false,
	user: { id: "user-1", email: "test@test.com" },
});

let memberToReturn: ReturnType<typeof mockMemberData> =
	mockMemberData("member");

vi.mock("@notploy/server/db", () => ({
	db: {
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

const { resolvePermissions } = await import(
	"@notploy/server/services/permission"
);
const { statements } = await import("@notploy/server/lib/access-control");

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("full access for privileged static roles", () => {
	it("owner gets true for every statement resource and action", async () => {
		memberToReturn = mockMemberData("owner");
		const perms = await resolvePermissions(ctx);

		for (const [resource, actions] of Object.entries(statements)) {
			for (const action of actions) {
				expect((perms as any)[resource][action]).toBe(true);
			}
		}
	});

	it("admin gets true for every statement resource and action but organization.delete", async () => {
		memberToReturn = mockMemberData("admin");
		const perms = await resolvePermissions(ctx);

		for (const [resource, actions] of Object.entries(statements)) {
			for (const action of actions) {
				// adminRole is ownerRole without the ability to delete the organization
				if (resource === "organization" && action === "delete") {
					expect((perms as any)[resource][action]).toBe(false);
					continue;
				}
				expect((perms as any)[resource][action]).toBe(true);
			}
		}
	});

	it("member gets true for service-level resources", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);

		expect(perms.deployment.read).toBe(true);
		expect(perms.deployment.create).toBe(true);
		expect(perms.domain.read).toBe(true);
		expect(perms.backup.read).toBe(true);
		expect(perms.logs.read).toBe(true);
		expect(perms.monitoring.read).toBe(true);
	});

	it("member gets false for org-level resources", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);

		expect(perms.server.read).toBe(false);
		expect(perms.server.terminal).toBe(false);
		expect(perms.registry.read).toBe(false);
		expect(perms.certificate.read).toBe(false);
		expect(perms.destination.read).toBe(false);
		expect(perms.notification.read).toBe(false);
		expect(perms.auditLog.read).toBe(false);
	});
});

describe("base resources for member", () => {
	it("member gets service.read=true", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);
		expect(perms.service.read).toBe(true);
	});

	it("member gets project.create=false without legacy override", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);
		expect(perms.project.create).toBe(false);
	});

	it("member gets project.create=true with canCreateProjects", async () => {
		memberToReturn = mockMemberData("member", { canCreateProjects: true });
		const perms = await resolvePermissions(ctx);
		expect(perms.project.create).toBe(true);
	});

	it("member gets docker.read=false without legacy override", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);
		expect(perms.docker.read).toBe(false);
	});

	it("member gets docker.read=true with canAccessToDocker", async () => {
		memberToReturn = mockMemberData("member", { canAccessToDocker: true });
		const perms = await resolvePermissions(ctx);
		expect(perms.docker.read).toBe(true);
	});

	it("member gets gitProviders create/delete=false without legacy override", async () => {
		memberToReturn = mockMemberData("member");
		const perms = await resolvePermissions(ctx);
		expect(perms.gitProviders.read).toBe(false);
		expect(perms.gitProviders.create).toBe(false);
		expect(perms.gitProviders.delete).toBe(false);
	});

	it("member gets gitProviders read/create/delete=true with canAccessToGitProviders", async () => {
		memberToReturn = mockMemberData("member", {
			canAccessToGitProviders: true,
		});
		const perms = await resolvePermissions(ctx);
		expect(perms.gitProviders.read).toBe(true);
		expect(perms.gitProviders.create).toBe(true);
		expect(perms.gitProviders.delete).toBe(true);
	});
});

describe("base resources for owner", () => {
	it("owner gets all base permissions as true", async () => {
		memberToReturn = mockMemberData("owner");
		const perms = await resolvePermissions(ctx);
		expect(perms.project.create).toBe(true);
		expect(perms.project.delete).toBe(true);
		expect(perms.service.create).toBe(true);
		expect(perms.service.read).toBe(true);
		expect(perms.service.delete).toBe(true);
		expect(perms.docker.read).toBe(true);
		expect(perms.traefikFiles.read).toBe(true);
		expect(perms.traefikFiles.write).toBe(true);
	});
});
