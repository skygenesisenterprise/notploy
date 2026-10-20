import { db } from "@notploy/server/db";
import { projects } from "@notploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";

/**
 * Project resource quotas.
 *
 * Quotas are a **logical Notploy guardrail**: they cap the per-service Docker
 * limits that services *declare* inside a project. They do not create an
 * additional runtime isolation layer — Docker/Swarm still enforce each
 * service's own `cpuLimit`/`memoryLimit`. Services with no declared limit
 * count as `0`, so the quota only bounds configured limits; the API and UI
 * label it accordingly.
 *
 * Units mirror the service columns: CPU in nanocpus (1 CPU = 1e9) and memory
 * in bytes.
 */
export const QUOTA_METERS = [
	"cpuLimit",
	"cpuReservation",
	"memoryLimit",
	"memoryReservation",
] as const;

export type QuotaMeter = (typeof QUOTA_METERS)[number];

export const RESOURCE_SERVICE_TYPES = [
	"application",
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
] as const;

export type ResourceServiceType = (typeof RESOURCE_SERVICE_TYPES)[number];

export type ResourceLimits = Partial<Record<QuotaMeter, string | null>>;

export type ProjectQuota = Record<QuotaMeter, string | null>;

export type ProjectQuotaUsage = Record<QuotaMeter, number>;

export interface QuotaViolation {
	meter: QuotaMeter;
	/** Project quota, in the meter's native unit. */
	quota: number;
	/** Usage of every other service in the project. */
	used: number;
	/** Usage requested by the change being applied. */
	requested: number;
	/** `used + requested`, the value that would exist after the change. */
	total: number;
}

export const RESOURCE_SERVICE_TABLES: Array<{
	type: ResourceServiceType;
	table: string;
	idColumn: string;
}> = [
	{ type: "application", table: "application", idColumn: "applicationId" },
	{ type: "libsql", table: "libsql", idColumn: "libsqlId" },
	{ type: "mariadb", table: "mariadb", idColumn: "mariadbId" },
	{ type: "mongo", table: "mongo", idColumn: "mongoId" },
	{ type: "mysql", table: "mysql", idColumn: "mysqlId" },
	{ type: "postgres", table: "postgres", idColumn: "postgresId" },
	{ type: "redis", table: "redis", idColumn: "redisId" },
];

const METER_LABELS: Record<QuotaMeter, string> = {
	cpuLimit: "CPU limit",
	cpuReservation: "CPU reservation",
	memoryLimit: "memory limit",
	memoryReservation: "memory reservation",
};

const EMPTY_USAGE = (): ProjectQuotaUsage => ({
	cpuLimit: 0,
	cpuReservation: 0,
	memoryLimit: 0,
	memoryReservation: 0,
});

/**
 * Parses a service/quota value. Invalid, empty, zero and negative values all
 * mean "no limit configured" for quota accounting.
 */
export const parseQuotaValue = (value: string | number | null | undefined) => {
	if (value === null || value === undefined || value === "") {
		return 0;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const formatBytes = (value: number) => {
	if (value >= 1024 ** 3) {
		return `${Number((value / 1024 ** 3).toFixed(2))} GiB`;
	}
	if (value >= 1024 ** 2) {
		return `${Number((value / 1024 ** 2).toFixed(2))} MiB`;
	}
	return `${value} B`;
};

export const formatQuotaValue = (meter: QuotaMeter, value: number) =>
	meter === "cpuLimit" || meter === "cpuReservation"
		? `${Number((value / 1_000_000_000).toFixed(2))} CPU`
		: formatBytes(value);

const normalizeLimits = (limits?: ResourceLimits): ProjectQuotaUsage => {
	const usage = EMPTY_USAGE();
	if (!limits) {
		return usage;
	}
	for (const meter of QUOTA_METERS) {
		usage[meter] = parseQuotaValue(limits[meter]);
	}
	return usage;
};

/**
 * Compares the projected usage against every configured quota and returns
 * each exceeded meter. An unset (`null`) quota never constrains.
 */
export const findQuotaViolations = ({
	quota,
	usage,
	requested,
}: {
	quota: ProjectQuota;
	usage: ProjectQuotaUsage;
	requested?: ResourceLimits;
}): QuotaViolation[] => {
	const requestedUsage = normalizeLimits(requested);
	const violations: QuotaViolation[] = [];

	for (const meter of QUOTA_METERS) {
		const limit = quota[meter];
		if (limit === null || limit === undefined) {
			continue;
		}
		const used = usage[meter];
		const asked = requestedUsage[meter];
		const total = used + asked;
		if (total > parseQuotaValue(limit)) {
			violations.push({
				meter,
				quota: parseQuotaValue(limit),
				used,
				requested: asked,
				total,
			});
		}
	}

	return violations;
};

/**
 * Refusal raised when a change would exceed a project quota. It is a
 * `TRPCError` with `PRECONDITION_FAILED` so routers can surface an explicit
 * message, and it carries structured audit metadata.
 */
export class ProjectQuotaExceededError extends TRPCError {
	public readonly projectId: string;
	public readonly violations: QuotaViolation[];
	public readonly serviceType?: ResourceServiceType;
	public readonly serviceId?: string;

	public readonly operation: "service" | "project";

	constructor({
		projectId,
		violations,
		serviceType,
		serviceId,
		operation = "service",
	}: {
		projectId: string;
		violations: QuotaViolation[];
		serviceType?: ResourceServiceType;
		serviceId?: string;
		operation?: "service" | "project";
	}) {
		const details =
			operation === "project"
				? violations
						.map(
							(violation) =>
								`${METER_LABELS[violation.meter]} would be set to ${formatQuotaValue(
									violation.meter,
									violation.quota,
								)}, but services in the project already declare ${formatQuotaValue(
									violation.meter,
									violation.used,
								)}`,
						)
						.join("; ")
				: violations
						.map(
							(violation) =>
								`${METER_LABELS[violation.meter]} is ${formatQuotaValue(
									violation.meter,
									violation.quota,
								)}, but this change would reach ${formatQuotaValue(
									violation.meter,
									violation.total,
								)} (${formatQuotaValue(violation.meter, violation.used)} already used in the project)`,
						)
						.join("; ");

		super({
			code: "PRECONDITION_FAILED",
			message:
				operation === "project"
					? `Project quota cannot be lowered: ${details}. Lower the service limits first; no resource was changed.`
					: `Project quota exceeded: ${details}. The change was refused; lower the service limits or raise the project quota first.`,
		});
		this.name = "ProjectQuotaExceededError";
		this.projectId = projectId;
		this.violations = violations;
		this.serviceType = serviceType;
		this.serviceId = serviceId;
		this.operation = operation;
	}

	get auditMetadata() {
		return {
			operation: this.operation,
			projectId: this.projectId,
			serviceType: this.serviceType,
			serviceId: this.serviceId,
			violations: this.violations,
		};
	}
}

/**
 * Sums the declared limits of every service in the project. `exclude` removes
 * the service being edited so its new values can be evaluated in isolation.
 * Compose stacks have no per-service limit columns and therefore contribute
 * nothing; the operator documentation states this explicitly.
 */
export const getProjectQuotaUsage = async (
	projectId: string,
	exclude?: { type: ResourceServiceType; id: string },
): Promise<ProjectQuotaUsage> => {
	const selectMeter = (meter: QuotaMeter) =>
		sql`coalesce(sum(case when s.${sql.raw(`"${meter}"`)} ~ '^[0-9]+$' then s.${sql.raw(`"${meter}"`)}::bigint else 0 end), 0)`;

	const branches = RESOURCE_SERVICE_TABLES.map(({ type, table, idColumn }) => {
		const exclusion =
			exclude?.type === type
				? sql`and s.${sql.raw(`"${idColumn}"`)} <> ${exclude.id}`
				: sql``;

		return sql`
			select
				${selectMeter("cpuLimit")} as "cpuLimit",
				${selectMeter("cpuReservation")} as "cpuReservation",
				${selectMeter("memoryLimit")} as "memoryLimit",
				${selectMeter("memoryReservation")} as "memoryReservation"
			from ${sql.raw(`"${table}"`)} s
			join "environment" e on e."environmentId" = s."environmentId"
			where e."projectId" = ${projectId} ${exclusion}
		`;
	});

	const rows = (await db.execute(sql`
		select
			coalesce(sum(limits."cpuLimit"), 0) as "cpuLimit",
			coalesce(sum(limits."cpuReservation"), 0) as "cpuReservation",
			coalesce(sum(limits."memoryLimit"), 0) as "memoryLimit",
			coalesce(sum(limits."memoryReservation"), 0) as "memoryReservation"
		from (${sql.join(branches, sql` union all `)}) limits
	`)) as unknown as Array<Record<QuotaMeter, string | number | null>>;

	const row = rows[0];
	return {
		cpuLimit: parseQuotaValue(row?.cpuLimit),
		cpuReservation: parseQuotaValue(row?.cpuReservation),
		memoryLimit: parseQuotaValue(row?.memoryLimit),
		memoryReservation: parseQuotaValue(row?.memoryReservation),
	};
};

export const findProjectQuota = async (
	projectId: string,
): Promise<ProjectQuota> => {
	const project = await db.query.projects.findFirst({
		columns: {
			projectId: true,
			cpuLimit: true,
			cpuReservation: true,
			memoryLimit: true,
			memoryReservation: true,
		},
		where: eq(projects.projectId, projectId),
	});

	return {
		cpuLimit: project?.cpuLimit ?? null,
		cpuReservation: project?.cpuReservation ?? null,
		memoryLimit: project?.memoryLimit ?? null,
		memoryReservation: project?.memoryReservation ?? null,
	};
};

const assertNoViolations = ({
	projectId,
	violations,
	serviceType,
	serviceId,
}: {
	projectId: string;
	violations: QuotaViolation[];
	serviceType?: ResourceServiceType;
	serviceId?: string;
}) => {
	if (violations.length > 0) {
		throw new ProjectQuotaExceededError({
			projectId,
			violations,
			serviceType,
			serviceId,
		});
	}
};

export const hasResourceLimitChange = (changes: ResourceLimits) =>
	QUOTA_METERS.some((meter) => changes[meter] !== undefined);

/**
 * Validates a partial update by merging it over the service's current limits,
 * so a change to one meter is still checked against all configured quotas.
 */
export const assertServiceQuotaChange = async ({
	projectId,
	serviceType,
	serviceId,
	current,
	changes,
}: {
	projectId: string;
	serviceType: ResourceServiceType;
	serviceId: string;
	current: ResourceLimits;
	changes: ResourceLimits;
}) => {
	if (!hasResourceLimitChange(changes)) {
		return;
	}

	const effective: ResourceLimits = {};
	for (const meter of QUOTA_METERS) {
		effective[meter] =
			changes[meter] !== undefined ? changes[meter] : current[meter];
	}

	await assertProjectQuotaForService({
		projectId,
		serviceType,
		serviceId,
		limits: effective,
	});
};

/**
 * Validates the full effective limits of one service against its project
 * quota, excluding the service's previous values from usage.
 */
export const assertProjectQuotaForService = async ({
	projectId,
	serviceType,
	serviceId,
	limits,
}: {
	projectId: string;
	serviceType: ResourceServiceType;
	serviceId: string;
	limits: ResourceLimits;
}) => {
	const quota = await findProjectQuota(projectId);
	if (QUOTA_METERS.every((meter) => quota[meter] === null)) {
		return;
	}

	const usage = await getProjectQuotaUsage(projectId, {
		type: serviceType,
		id: serviceId,
	});

	assertNoViolations({
		projectId,
		violations: findQuotaViolations({ quota, usage, requested: limits }),
		serviceType,
		serviceId,
	});
};

/**
 * Validates a new project quota against the project's current usage. This is
 * what refuses lowering a quota below limits that already exist.
 */
export const assertProjectQuotaWithinUsage = async ({
	projectId,
	quota,
}: {
	projectId: string;
	quota: ProjectQuota;
}) => {
	if (QUOTA_METERS.every((meter) => quota[meter] === null)) {
		return;
	}

	const usage = await getProjectQuotaUsage(projectId);
	const violations = findQuotaViolations({ quota, usage });
	if (violations.length > 0) {
		throw new ProjectQuotaExceededError({
			projectId,
			violations,
			operation: "project",
		});
	}
};
