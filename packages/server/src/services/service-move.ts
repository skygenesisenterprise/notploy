import { db } from "@notploy/server/db";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { checkServiceAccess, type PermissionCtx } from "./permission";
import {
	findProjectQuota,
	findQuotaViolations,
	getProjectQuotaUsage,
	ProjectQuotaExceededError,
	parseQuotaValue,
	QUOTA_METERS,
	type QuotaViolation,
	RESOURCE_SERVICE_TABLES,
	RESOURCE_SERVICE_TYPES,
	type ResourceServiceType,
} from "./project-quota";

/**
 * Compose has no per-service limit columns, so it participates in the move
 * boundaries (cross-org, target access) but contributes zero to quotas.
 */
export const MOVE_SERVICE_TYPES = [
	...RESOURCE_SERVICE_TYPES,
	"compose",
] as const;

export type MoveServiceType = (typeof MOVE_SERVICE_TYPES)[number];

interface ServiceRow {
	serviceId: string;
	appName: string;
	projectId: string;
	projectName: string;
	environmentId: string;
	environmentName: string;
	organizationId: string;
	cpuLimit: string | null;
	cpuReservation: string | null;
	memoryLimit: string | null;
	memoryReservation: string | null;
}

interface TargetRow {
	projectId: string;
	projectName: string;
	environmentId: string;
	environmentName: string;
	organizationId: string;
}

export interface ServiceMoveEndpoint {
	projectId: string;
	projectName: string;
	environmentId: string;
	environmentName: string;
}

export interface ServiceMovePreview {
	service: {
		id: string;
		type: MoveServiceType;
		appName: string;
	};
	source: ServiceMoveEndpoint;
	target: ServiceMoveEndpoint;
	sameProject: boolean;
	/**
	 * Moving only changes the owning environment/project. No runtime resource
	 * is copied or deleted, so these properties travel with the service.
	 */
	preserved: {
		identity: true;
		appName: true;
		volumes: true;
		domains: true;
		networks: true;
	};
	permissions: {
		/** Access is recalculated from the target project after the move. */
		recalculatedFromTargetProject: true;
	};
	/** An environment move does not redeploy; the container keeps running. */
	requiresRedeploy: false;
	quota: {
		withinQuota: boolean;
		violations: QuotaViolation[];
	};
}

const findTable = (serviceType: MoveServiceType) => {
	if (serviceType === "compose") {
		return { table: "compose", idColumn: "composeId", type: "compose" };
	}

	const table = RESOURCE_SERVICE_TABLES.find(
		(entry) => entry.type === serviceType,
	);
	if (!table) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Unknown service type: ${serviceType}`,
		});
	}
	return table;
};

const notFound = () =>
	new TRPCError({
		code: "NOT_FOUND",
		message: "Service or target environment not found",
	});

/**
 * Resolves a logical move and enforces the two hard boundaries before any
 * write: both sides must belong to the active organization, and the caller
 * must be allowed to create services in the target project. This prevents a
 * move from leaking a service into another organization or into a project the
 * caller cannot access.
 */
const resolveServiceMove = async ({
	ctx,
	serviceType,
	serviceId,
	targetEnvironmentId,
}: {
	ctx: PermissionCtx;
	serviceType: MoveServiceType;
	serviceId: string;
	targetEnvironmentId: string;
}) => {
	const { table, idColumn } = findTable(serviceType);
	const limitColumns =
		serviceType === "compose"
			? sql`null::text as "cpuLimit", null::text as "cpuReservation", null::text as "memoryLimit", null::text as "memoryReservation",`
			: sql`s."cpuLimit" as "cpuLimit", s."cpuReservation" as "cpuReservation", s."memoryLimit" as "memoryLimit", s."memoryReservation" as "memoryReservation",`;

	const serviceRows = (await db.execute(sql`
		select
			s.${sql.raw(`"${idColumn}"`)} as "serviceId",
			s."appName" as "appName",
			${limitColumns}
			p."projectId" as "projectId",
			p."name" as "projectName",
			p."organizationId" as "organizationId",
			e."environmentId" as "environmentId",
			e."name" as "environmentName"
		from ${sql.raw(`"${table}"`)} s
		join "environment" e on e."environmentId" = s."environmentId"
		join "project" p on p."projectId" = e."projectId"
		where s.${sql.raw(`"${idColumn}"`)} = ${serviceId}
		limit 1
	`)) as unknown as ServiceRow[];

	const service = serviceRows[0];
	if (!service || service.organizationId !== ctx.session.activeOrganizationId) {
		throw notFound();
	}

	const targetRows = (await db.execute(sql`
		select
			p."projectId" as "projectId",
			p."name" as "projectName",
			p."organizationId" as "organizationId",
			e."environmentId" as "environmentId",
			e."name" as "environmentName"
		from "environment" e
		join "project" p on p."projectId" = e."projectId"
		where e."environmentId" = ${targetEnvironmentId}
		limit 1
	`)) as unknown as TargetRow[];

	const target = targetRows[0];
	if (!target || target.organizationId !== ctx.session.activeOrganizationId) {
		throw notFound();
	}

	await checkServiceAccess(ctx, target.projectId, "create");

	return { service, target };
};

const evaluateMoveQuota = async (
	service: ServiceRow,
	target: TargetRow,
): Promise<QuotaViolation[]> => {
	// A service without declared limits cannot consume a project quota.
	if (QUOTA_METERS.every((meter) => parseQuotaValue(service[meter]) === 0)) {
		return [];
	}

	if (service.projectId === target.projectId) {
		// Moving inside the same project does not change its aggregate usage.
		return [];
	}

	const [quota, usage] = await Promise.all([
		findProjectQuota(target.projectId),
		getProjectQuotaUsage(target.projectId),
	]);
	return findQuotaViolations({ quota, usage, requested: service });
};

const buildPreview = ({
	service,
	target,
	serviceType,
	violations,
}: {
	service: ServiceRow;
	target: TargetRow;
	serviceType: MoveServiceType;
	violations: QuotaViolation[];
}): ServiceMovePreview => ({
	service: {
		id: service.serviceId,
		type: serviceType,
		appName: service.appName,
	},
	source: {
		projectId: service.projectId,
		projectName: service.projectName,
		environmentId: service.environmentId,
		environmentName: service.environmentName,
	},
	target: {
		projectId: target.projectId,
		projectName: target.projectName,
		environmentId: target.environmentId,
		environmentName: target.environmentName,
	},
	sameProject: service.projectId === target.projectId,
	preserved: {
		identity: true,
		appName: true,
		volumes: true,
		domains: true,
		networks: true,
	},
	permissions: { recalculatedFromTargetProject: true },
	requiresRedeploy: false,
	quota: { withinQuota: violations.length === 0, violations },
});

/**
 * Returns the preview shown before a logical move: source/target, what is
 * preserved without any runtime action, and the target project's quota state.
 * Permission and organization violations are refused immediately.
 */
export const previewServiceMove = async ({
	ctx,
	serviceType,
	serviceId,
	targetEnvironmentId,
}: {
	ctx: PermissionCtx;
	serviceType: MoveServiceType;
	serviceId: string;
	targetEnvironmentId: string;
}): Promise<ServiceMovePreview> => {
	const { service, target } = await resolveServiceMove({
		ctx,
		serviceType,
		serviceId,
		targetEnvironmentId,
	});

	const violations = await evaluateMoveQuota(service, target);
	return buildPreview({ service, target, serviceType, violations });
};

/**
 * Enforces organization, target-project access and target-project quota before
 * a logical move. Refusals are explicit; nothing is written by this helper.
 */
export const assertServiceMoveAllowed = async ({
	ctx,
	serviceType,
	serviceId,
	targetEnvironmentId,
}: {
	ctx: PermissionCtx;
	serviceType: MoveServiceType;
	serviceId: string;
	targetEnvironmentId: string;
}) => {
	const { service, target } = await resolveServiceMove({
		ctx,
		serviceType,
		serviceId,
		targetEnvironmentId,
	});

	const violations = await evaluateMoveQuota(service, target);
	if (violations.length > 0) {
		throw new ProjectQuotaExceededError({
			projectId: target.projectId,
			violations,
			// Compose has no limit columns, so it can never produce a quota
			// violation; the cast only narrows the shared move union.
			serviceType: serviceType as ResourceServiceType,
			serviceId,
		});
	}

	return buildPreview({ service, target, serviceType, violations: [] });
};
