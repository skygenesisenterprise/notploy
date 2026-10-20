import { db } from "@notploy/server/db";
import { cloudDomains, domains } from "@notploy/server/db/schema";
import { redactSecrets } from "@notploy/server/utils/security/redact";
import {
	manageDomain,
	removeDomain,
} from "@notploy/server/utils/traefik/domain";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { findApplicationById } from "./application";
import { ensureCloudWildcardRecord } from "./cloud-domain-dns";
import { isManagedCloud } from "./instance-identity";

/**
 * Notploy Cloud managed hostnames (issue https://github.com/skygenesisenterprise/notploy/issues/113).
 *
 * Allocation lives in `cloud_domain`, not in `domain`: the ledger must survive
 * application deletion so a released hostname can never be handed to another
 * tenant. The `domain` row remains the routing source of truth (Traefik file
 * provider) and is created from the ledger with `cloudManaged = true`, which
 * keeps the hostname out of the editable custom-domain list.
 */

export const CLOUD_DOMAIN_ENV = "NOTPLOY_CLOUD_DOMAIN";
export const CLOUD_CERT_RESOLVER_ENV = "NOTPLOY_CLOUD_CERT_RESOLVER";
const DEFAULT_CLOUD_DOMAIN = "notploy.app";
const MAX_LABEL_LENGTH = 48;
const MAX_CANDIDATES = 20;

/** Labels that must never be assigned to a single tenant. */
const RESERVED_LABELS = new Set([
	"www",
	"api",
	"app",
	"admin",
	"console",
	"dashboard",
	"docs",
	"mail",
	"status",
	"support",
]);

export type CloudDomainRow = typeof cloudDomains.$inferSelect;

export interface CloudDomainView {
	cloudDomainId: string | null;
	hostname: string;
	url: string;
	status: CloudDomainRow["status"] | "unavailable";
	port: number | null;
	errorMessage: string | null;
}

export const normalizeCloudDomainBase = (
	value?: string | null,
): string | null => {
	const base = value
		?.trim()
		.toLowerCase()
		.replace(/^\.+/, "")
		.replace(/\.+$/, "");
	if (!base) {
		return null;
	}
	// A wildcard zone needs at least one dot and valid DNS labels; a trailing
	// wildcard or a bare TLD would silently break every allocation.
	if (
		!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
			base,
		)
	) {
		return null;
	}
	return base;
};

/**
 * Wildcard zone used for generated hostnames, or `null` when the feature is
 * disabled. Managed Cloud defaults to `notploy.app`; setting the env var to an
 * empty value disables allocation, and self-hosted/console never allocate.
 */
export const getCloudDomainBase = (
	env: Record<string, string | undefined> = process.env,
	managedCloud: boolean = isManagedCloud(),
): string | null => {
	if (!managedCloud) {
		return null;
	}
	const configured = env[CLOUD_DOMAIN_ENV];
	if (configured === undefined) {
		return DEFAULT_CLOUD_DOMAIN;
	}
	return normalizeCloudDomainBase(configured);
};

/** DNS label derived from an application name (`My App!` → `my-app`). */
export const toCloudDomainLabel = (appName: string): string => {
	const ascii = appName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
	const label = ascii
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, MAX_LABEL_LENGTH)
		.replace(/-+$/g, "");
	if (!label) {
		return "app";
	}
	return RESERVED_LABELS.has(label) ? `${label}-app` : label;
};

/**
 * Deterministic candidate list: the natural label first, then numeric suffixes.
 * The database unique index decides the winner, so two concurrent allocations
 * can iterate the same list without risking a duplicate.
 */
export const cloudHostnameCandidates = (
	appName: string,
	base: string,
	limit: number = MAX_CANDIDATES,
): string[] => {
	const label = toCloudDomainLabel(appName);
	const candidates: string[] = [];
	for (let index = 0; index < limit; index += 1) {
		const suffix = index === 0 ? "" : `-${index + 1}`;
		const candidate = `${label}${suffix}`.slice(0, 63).replace(/-+$/g, "");
		candidates.push(`${candidate}.${base}`);
	}
	return candidates;
};

const now = () => new Date().toISOString();

export const cloudDomainUrl = (hostname: string) => `https://${hostname}`;

export const toCloudDomainView = (domain: CloudDomainRow): CloudDomainView => ({
	cloudDomainId: domain.cloudDomainId,
	hostname: domain.hostname,
	url: cloudDomainUrl(domain.hostname),
	status: domain.status,
	port: domain.port,
	errorMessage: domain.errorMessage,
});

export const findLiveCloudDomainByApplicationId = async (
	applicationId: string,
): Promise<CloudDomainRow | undefined> =>
	db.query.cloudDomains.findFirst({
		where: and(
			eq(cloudDomains.applicationId, applicationId),
			ne(cloudDomains.status, "released"),
		),
	});

export interface AllocateCloudDomainInput {
	applicationId: string;
	organizationId: string;
	projectId: string;
	environmentId: string;
	appName: string;
	port?: number | null;
	/** Test/tooling override; production uses `getCloudDomainBase()`. */
	base?: string | null;
}

/**
 * Reserves a hostname for an application.
 *
 * Idempotent: an existing live reservation is returned unchanged, which is what
 * keeps the URL stable across redeploys. Uniqueness is enforced by the
 * `cloud_domain_hostname_unique` index through `onConflictDoNothing()`, so two
 * concurrent deploys cannot claim the same name.
 */
export const allocateCloudDomain = async (
	input: AllocateCloudDomainInput,
): Promise<CloudDomainRow | null> => {
	const base = input.base ?? getCloudDomainBase();
	if (!base) {
		return null;
	}

	const existing = await findLiveCloudDomainByApplicationId(
		input.applicationId,
	);
	if (existing) {
		return existing;
	}

	const label = toCloudDomainLabel(input.appName);
	for (const hostname of cloudHostnameCandidates(input.appName, base)) {
		const inserted = await db
			.insert(cloudDomains)
			.values({
				hostname,
				label,
				organizationId: input.organizationId,
				projectId: input.projectId,
				environmentId: input.environmentId,
				applicationId: input.applicationId,
				port: input.port ?? 3000,
				status: "pending",
			})
			.onConflictDoNothing()
			.returning();

		const reserved = inserted[0];
		if (reserved) {
			return reserved;
		}

		// The conflict may be the hostname (another tenant) or this same
		// application winning the live-unique index in a parallel deploy.
		const raced = await findLiveCloudDomainByApplicationId(input.applicationId);
		if (raced) {
			return raced;
		}
	}

	throw new TRPCError({
		code: "CONFLICT",
		message: `No available ${base} hostname for this application`,
	});
};

const resolveCertificate = (): {
	certificateType: "letsencrypt" | "custom";
	customCertResolver: string | null;
} => {
	const resolver = process.env[CLOUD_CERT_RESOLVER_ENV]?.trim();
	if (resolver) {
		// A centrally provisioned wildcard certificate exposes its resolver name;
		// per-host ACME is then unnecessary.
		return { certificateType: "custom", customCertResolver: resolver };
	}
	return { certificateType: "letsencrypt", customCertResolver: null };
};

const markProvisioningError = async (
	cloudDomainId: string,
	error: unknown,
): Promise<CloudDomainRow | undefined> => {
	const message = redactSecrets(
		error instanceof Error ? error.message : String(error),
	).slice(0, 500);
	const updated = await db
		.update(cloudDomains)
		.set({ status: "error", errorMessage: message, updatedAt: now() })
		.where(eq(cloudDomains.cloudDomainId, cloudDomainId))
		.returning();
	return updated[0];
};

/**
 * Creates (or repairs) the routing entry for a reserved hostname and applies it
 * through the Traefik file provider. Failures are recorded on the ledger so the
 * UI can show a recoverable status instead of losing the reservation.
 */
export const provisionCloudDomainRouting = async (
	cloudDomainId: string,
): Promise<CloudDomainRow> => {
	const cloudDomain = await db.query.cloudDomains.findFirst({
		where: eq(cloudDomains.cloudDomainId, cloudDomainId),
	});
	if (!cloudDomain) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Cloud domain not found",
		});
	}
	if (cloudDomain.status === "released" || !cloudDomain.applicationId) {
		return cloudDomain;
	}

	try {
		// Central Cloudflare wildcard (`*.notploy.app`). Ownership stays in the
		// ledger; DNS is only the resolution layer, so a Cloudflare outage marks
		// the hostname recoverable instead of freeing it for another tenant.
		await ensureCloudWildcardRecord({ base: getCloudDomainBase() });

		const application = await findApplicationById(cloudDomain.applicationId);
		let domain = cloudDomain.domainId
			? await db.query.domains.findFirst({
					where: eq(domains.domainId, cloudDomain.domainId),
				})
			: undefined;

		if (!domain) {
			const certificate = resolveCertificate();
			const created = await db
				.insert(domains)
				.values({
					host: cloudDomain.hostname,
					https: true,
					port: cloudDomain.port ?? 3000,
					applicationId: application.applicationId,
					domainType: "application",
					certificateType: certificate.certificateType,
					customCertResolver: certificate.customCertResolver,
					cloudManaged: true,
				})
				.returning();
			domain = created[0];
		}

		if (!domain) {
			throw new Error("Could not create the routing entry");
		}

		await manageDomain(application, domain);

		const updated = await db
			.update(cloudDomains)
			.set({
				domainId: domain.domainId,
				status: "active",
				errorMessage: null,
				updatedAt: now(),
			})
			.where(eq(cloudDomains.cloudDomainId, cloudDomainId))
			.returning();
		return updated[0] ?? { ...cloudDomain, domainId: domain.domainId };
	} catch (error) {
		const failed = await markProvisioningError(cloudDomainId, error);
		return failed ?? cloudDomain;
	}
};

export const getCloudDomainForApplication = async (
	applicationId: string,
): Promise<{ enabled: boolean; domain: CloudDomainView | null }> => {
	if (!getCloudDomainBase()) {
		return { enabled: false, domain: null };
	}
	const cloudDomain = await findLiveCloudDomainByApplicationId(applicationId);
	return {
		enabled: true,
		domain: cloudDomain ? toCloudDomainView(cloudDomain) : null,
	};
};

export interface EnsureCloudDomainResult {
	enabled: boolean;
	domain: CloudDomainView | null;
	reason?: string;
}

/**
 * Ensures an application has a generated hostname and working routing.
 *
 * Called after a successful deployment. It must never fail the deployment: a
 * provisioning problem is persisted as `error` on the ledger and can be retried
 * from the dashboard.
 */
export const ensureCloudDomainForApplication = async (
	applicationId: string,
): Promise<EnsureCloudDomainResult> => {
	if (!getCloudDomainBase()) {
		return { enabled: false, domain: null };
	}

	const application = await findApplicationById(applicationId);
	if (!application.serverId) {
		return {
			enabled: true,
			domain: null,
			reason: "The application is not assigned to a server",
		};
	}

	const port = application.ports[0]?.targetPort ?? 3000;
	const allocated = await allocateCloudDomain({
		applicationId: application.applicationId,
		organizationId: application.environment.project.organizationId,
		projectId: application.environment.projectId,
		environmentId: application.environmentId,
		appName: application.appName,
		port,
	});

	if (!allocated) {
		return { enabled: false, domain: null };
	}

	const provisioned = await provisionCloudDomainRouting(
		allocated.cloudDomainId,
	);
	return { enabled: true, domain: toCloudDomainView(provisioned) };
};

/**
 * Releases the live hostname of an application.
 *
 * The ledger row is retained as `released` (anti-reuse tombstone); the routing
 * entry is removed so the name stops serving immediately.
 */
export const releaseCloudDomain = async (
	applicationId: string,
): Promise<CloudDomainRow | null> => {
	const existing = await findLiveCloudDomainByApplicationId(applicationId);
	if (!existing) {
		return null;
	}

	if (existing.domainId && existing.applicationId) {
		const domain = await db.query.domains.findFirst({
			where: eq(domains.domainId, existing.domainId),
		});
		if (domain) {
			const application = await findApplicationById(existing.applicationId);
			await removeDomain(application, domain.uniqueConfigKey);
			await db.delete(domains).where(eq(domains.domainId, domain.domainId));
		}
	}

	const released = await db
		.update(cloudDomains)
		.set({
			status: "released",
			domainId: null,
			releasedAt: now(),
			updatedAt: now(),
		})
		.where(eq(cloudDomains.cloudDomainId, existing.cloudDomainId))
		.returning();
	return released[0] ?? null;
};
