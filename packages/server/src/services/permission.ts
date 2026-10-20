import { db } from "@notploy/server/db";
import { member, organizationRole } from "@notploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import {
	ac,
	adminRole,
	memberRole,
	ownerRole,
	statements,
} from "../lib/access-control";

type Statements = typeof statements;
type Resource = keyof Statements;
type Action<R extends Resource> = Statements[R][number];
type Permissions = {
	[R in Resource]?: Action<R>[];
};

export type PermissionCtx = {
	user: { id: string };
	session: { activeOrganizationId: string };
};

export type ResolvedPermissions = {
	[R in Resource]: {
		[A in Statements[R][number]]: boolean;
	};
};

/**
 * Resolves the project that owns a service, whatever its type.
 *
 * Project access is the default authorization boundary: a member who can
 * access a project must also access the services it contains, including
 * services created after the member was granted access. The lookup is a
 * single UNION query so the fallback does not multiply database round-trips
 * for each request.
 */
const findProjectIdForService = async (
	serviceId: string,
): Promise<string | null> => {
	const rows = (await db.execute(sql`
		select e."projectId" as "projectId"
		from "application" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."applicationId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "compose" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."composeId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "postgres" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."postgresId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "mysql" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."mysqlId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "mariadb" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."mariadbId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "mongo" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."mongoId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "libsql" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."libsqlId" = ${serviceId}
		union all
		select e."projectId" as "projectId"
		from "redis" s
		join "environment" e on e."environmentId" = s."environmentId"
		where s."redisId" = ${serviceId}
		limit 1
	`)) as unknown as Array<{ projectId: string }>;

	return rows[0]?.projectId ?? null;
};

const findProjectIdForEnvironment = async (
	environmentId: string,
): Promise<string | null> => {
	const rows = (await db.execute(sql`
		select "projectId" as "projectId"
		from "environment"
		where "environmentId" = ${environmentId}
		limit 1
	`)) as unknown as Array<{ projectId: string }>;

	return rows[0]?.projectId ?? null;
};

const isPrivilegedRole = (roleName: string) =>
	roleName === "owner" || roleName === "admin";

/**
 * Service access is additive: an explicit `accessedServices` grant always
 * works, and project access now grants every service in that project. The
 * project lookup is only needed for the fallback, so explicitly granted
 * services keep the previous fast path.
 */
const hasServiceAccess = async (
	memberRecord: Awaited<ReturnType<typeof findMemberByUserId>>,
	serviceId: string,
): Promise<boolean> => {
	if (memberRecord.accessedServices.includes(serviceId)) {
		return true;
	}
	if (memberRecord.accessedProjects.length === 0) {
		return false;
	}
	const projectId = await findProjectIdForService(serviceId);
	return projectId ? memberRecord.accessedProjects.includes(projectId) : false;
};

const hasEnvironmentAccess = async (
	memberRecord: Awaited<ReturnType<typeof findMemberByUserId>>,
	environmentId: string,
): Promise<boolean> => {
	if (memberRecord.accessedEnvironments.includes(environmentId)) {
		return true;
	}
	if (memberRecord.accessedProjects.length === 0) {
		return false;
	}
	const projectId = await findProjectIdForEnvironment(environmentId);
	return projectId ? memberRecord.accessedProjects.includes(projectId) : false;
};

const staticRoles: Record<string, ReturnType<typeof ac.newRole>> = {
	owner: ownerRole,
	admin: adminRole,
	member: memberRole,
};

const resolveRole = async (
	roleName: string,
	organizationId: string,
): Promise<ReturnType<typeof ac.newRole> | null> => {
	if (staticRoles[roleName]) {
		return staticRoles[roleName];
	}

	const customRoles = await db.query.organizationRole.findMany({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, roleName),
		),
	});

	if (customRoles.length === 0) {
		return null;
	}

	const merged: Record<string, string[]> = {};
	for (const entry of customRoles) {
		const parsed = JSON.parse(entry.permission) as Record<string, string[]>;
		for (const [resource, actions] of Object.entries(parsed)) {
			merged[resource] = [
				...new Set([...(merged[resource] ?? []), ...actions]),
			];
		}
	}

	return ac.newRole(merged as any);
};

export const checkPermission = async (
	ctx: PermissionCtx,
	permissions: Permissions,
) => {
	const { id: userId } = ctx.user;
	const { activeOrganizationId: organizationId } = ctx.session;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	const role = await resolveRole(memberRecord.role, organizationId);

	if (!role) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Invalid role",
		});
	}

	const result = role.authorize(permissions);
	if (result.success) {
		return;
	}

	if (memberRecord.role === "member") {
		const overrides = getLegacyOverrides(memberRecord);
		const allGranted = Object.entries(permissions).every(
			([resource, actions]) =>
				(actions as string[]).every(
					(action) =>
						!!(overrides[resource] as Record<string, boolean> | undefined)?.[
							action
						],
				),
		);
		if (allGranted) {
			return;
		}
	}

	throw new TRPCError({
		code: "UNAUTHORIZED",
		message: result.error || "Permission denied",
	});
};

export const hasPermission = async (
	ctx: PermissionCtx,
	permissions: Permissions,
): Promise<boolean> => {
	try {
		await checkPermission(ctx, permissions);
		return true;
	} catch {
		return false;
	}
};

const getLegacyOverrides = (
	memberRecord: Awaited<ReturnType<typeof findMemberByUserId>>,
): Partial<Record<string, Record<string, boolean>>> => {
	return {
		project: {
			create: !!memberRecord.canCreateProjects,
			delete: !!memberRecord.canDeleteProjects,
		},
		service: {
			create: !!memberRecord.canCreateServices,
			delete: !!memberRecord.canDeleteServices,
		},
		environment: {
			create: !!memberRecord.canCreateEnvironments,
			delete: !!memberRecord.canDeleteEnvironments,
		},
		traefikFiles: {
			read: !!memberRecord.canAccessToTraefikFiles,
		},
		docker: {
			read: !!memberRecord.canAccessToDocker,
		},
		api: {
			read: !!memberRecord.canAccessToAPI,
		},
		sshKeys: {
			read: !!memberRecord.canAccessToSSHKeys,
			create: !!memberRecord.canAccessToSSHKeys,
			delete: !!memberRecord.canAccessToSSHKeys,
		},
		gitProviders: {
			read: !!memberRecord.canAccessToGitProviders,
			create: !!memberRecord.canAccessToGitProviders,
			delete: !!memberRecord.canAccessToGitProviders,
		},
	};
};

export const resolvePermissions = async (
	ctx: PermissionCtx,
): Promise<ResolvedPermissions> => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	const role = await resolveRole(memberRecord.role, organizationId);

	const legacyOverrides =
		memberRecord.role === "member" ? getLegacyOverrides(memberRecord) : {};

	const result = {} as ResolvedPermissions;

	for (const [resource, actions] of Object.entries(statements)) {
		const resourcePerms = {} as Record<string, boolean>;
		for (const action of actions) {
			if (!role) {
				resourcePerms[action] = false;
				continue;
			}
			const check = role.authorize({ [resource]: [action] });
			resourcePerms[action] =
				check.success ||
				!!(legacyOverrides[resource] as Record<string, boolean> | undefined)?.[
					action
				];
		}
		(result as any)[resource] = resourcePerms;
	}

	return result;
};

export const checkProjectAccess = async (
	ctx: PermissionCtx,
	action: "create" | "delete",
	projectId?: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { project: [action] });

	if (
		action !== "create" &&
		projectId &&
		memberRecord.role !== "owner" &&
		memberRecord.role !== "admin"
	) {
		if (!memberRecord.accessedProjects.includes(projectId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this project",
			});
		}
	}
};

export const checkServicePermissionAndAccess = async (
	ctx: PermissionCtx,
	serviceId: string,
	permissions: Permissions,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	await checkPermission(ctx, permissions);
	if (
		!isPrivilegedRole(memberRecord.role) &&
		!(await hasServiceAccess(memberRecord, serviceId))
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You don't have access to this service",
		});
	}
};

/**
 * For `create`, `projectOrServiceId` is a **project id**: the caller is about
 * to create a service, so there is no service row to resolve yet. For
 * `read`/`delete` it is a service id and project inheritance applies.
 */
export const checkServiceAccess = async (
	ctx: PermissionCtx,
	projectOrServiceId: string,
	action: "create" | "read" | "delete" = "read",
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { service: [action] });

	if (isPrivilegedRole(memberRecord.role)) {
		return;
	}

	if (action === "create") {
		if (!memberRecord.accessedProjects.includes(projectOrServiceId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this project",
			});
		}
		return;
	}

	if (!(await hasServiceAccess(memberRecord, projectOrServiceId))) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You don't have access to this service",
		});
	}
};

export const checkEnvironmentAccess = async (
	ctx: PermissionCtx,
	environmentId: string,
	action: "read" | "create" | "delete" = "read",
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: [action] });

	if (action !== "create" && !isPrivilegedRole(memberRecord.role)) {
		if (!(await hasEnvironmentAccess(memberRecord, environmentId))) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this environment",
			});
		}
	}
};

export const checkEnvironmentCreationPermission = async (
	ctx: PermissionCtx,
	projectId: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: ["create"] });

	if (memberRecord.role !== "owner" && memberRecord.role !== "admin") {
		if (!memberRecord.accessedProjects.includes(projectId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this project",
			});
		}
	}
};

export const checkEnvironmentDeletionPermission = async (
	ctx: PermissionCtx,
	projectId: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: ["delete"] });

	if (memberRecord.role !== "owner" && memberRecord.role !== "admin") {
		if (!memberRecord.accessedProjects.includes(projectId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this project",
			});
		}
	}
};

export const addNewProject = async (ctx: PermissionCtx, projectId: string) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	await db
		.update(member)
		.set({
			accessedProjects: [...memberRecord.accessedProjects, projectId],
		})
		.where(
			and(
				eq(member.id, memberRecord.id),
				eq(member.organizationId, organizationId),
			),
		);
};

export const addNewEnvironment = async (
	ctx: PermissionCtx,
	environmentId: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	await db
		.update(member)
		.set({
			accessedEnvironments: [
				...memberRecord.accessedEnvironments,
				environmentId,
			],
		})
		.where(
			and(
				eq(member.id, memberRecord.id),
				eq(member.organizationId, organizationId),
			),
		);
};

export const addNewService = async (ctx: PermissionCtx, serviceId: string) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	await db
		.update(member)
		.set({
			accessedServices: [...memberRecord.accessedServices, serviceId],
		})
		.where(
			and(
				eq(member.id, memberRecord.id),
				eq(member.organizationId, organizationId),
			),
		);
};

export const findMemberByUserId = async (
	userId: string,
	organizationId: string,
) => {
	const result = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, organizationId),
		),
		with: {
			user: true,
		},
	});

	if (!result) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Permission denied",
		});
	}
	return result;
};
