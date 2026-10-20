import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { organization } from "./account";
import { applications } from "./application";
import { domains } from "./domain";
import { environments } from "./environment";
import { projects } from "./project";

/**
 * Lifecycle of a Notploy Cloud managed hostname.
 *
 * `released` rows are kept on purpose: the unique hostname index then prevents a
 * later tenant from receiving a hostname that previously served someone else's
 * application. Deleting the row would make the name reusable immediately.
 */
export const cloudDomainStatus = pgEnum("cloudDomainStatus", [
	"pending",
	"active",
	"error",
	"released",
]);

export const cloudDomains = pgTable(
	"cloud_domain",
	{
		cloudDomainId: text("cloudDomainId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		/** Lowercase FQDN under the configured Cloud wildcard domain. */
		hostname: text("hostname").notNull(),
		/** Base label derived from the application name, before collisions. */
		label: text("label").notNull(),
		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		projectId: text("projectId").references(() => projects.projectId, {
			onDelete: "set null",
		}),
		environmentId: text("environmentId").references(
			() => environments.environmentId,
			{ onDelete: "set null" },
		),
		applicationId: text("applicationId").references(
			() => applications.applicationId,
			{ onDelete: "set null" },
		),
		/** Routing row generated in `domain`; null until routing is provisioned. */
		domainId: text("domainId").references(() => domains.domainId, {
			onDelete: "set null",
		}),
		/** Target container port the hostname routes to. */
		port: integer("port").default(3000),
		status: cloudDomainStatus("status").notNull().default("pending"),
		errorMessage: text("errorMessage"),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updatedAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		releasedAt: text("releasedAt"),
	},
	(table) => [
		// Allocation relies on this index: `onConflictDoNothing()` on the insert is
		// what makes concurrent claims of the same hostname atomic.
		uniqueIndex("cloud_domain_hostname_unique").on(table.hostname),
		// One live hostname per application, while keeping released rows as
		// anti-reuse tombstones (released rows are excluded from this index).
		uniqueIndex("cloud_domain_application_live_unique")
			.on(table.applicationId)
			.where(sql`${table.status} <> 'released'`),
		index("cloud_domain_organization_idx").on(table.organizationId),
	],
);

export const cloudDomainsRelations = relations(cloudDomains, ({ one }) => ({
	application: one(applications, {
		fields: [cloudDomains.applicationId],
		references: [applications.applicationId],
	}),
	domain: one(domains, {
		fields: [cloudDomains.domainId],
		references: [domains.domainId],
	}),
	environment: one(environments, {
		fields: [cloudDomains.environmentId],
		references: [environments.environmentId],
	}),
}));
