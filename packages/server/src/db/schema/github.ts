import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	primaryKey,
	text,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { z } from "zod";
import { gitProvider } from "./git-provider";

export const github = pgTable("github", {
	githubId: text("githubId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	githubAppName: text("githubAppName"),
	githubAppId: integer("githubAppId"),
	githubClientId: text("githubClientId"),
	githubClientSecret: text("githubClientSecret"),
	githubInstallationId: text("githubInstallationId"),
	githubPrivateKey: text("githubPrivateKey"),
	githubWebhookSecret: text("githubWebhookSecret"),
	/**
	 * Set when GitHub reports the installation as suspended, cleared on
	 * `unsuspend`. A suspended installation must not trigger deployments: the
	 * App keeps its credentials but granted access is paused.
	 */
	githubInstallationSuspendedAt: text("githubInstallationSuspendedAt"),
	githubUrl: text("githubUrl").default("https://github.com").notNull(),
	gitProviderId: text("gitProviderId")
		.notNull()
		.references(() => gitProvider.gitProviderId, { onDelete: "cascade" }),
});

/**
 * One row per accepted GitHub webhook delivery (`X-GitHub-Delivery`).
 *
 * GitHub redelivers events and retries failed ones, so handling a delivery twice
 * must not create a second deployment. The composite primary key makes the
 * claim atomic: the insert either wins or reports that the delivery is already
 * known. `status` records how far processing got, which is what lets a failed
 * retryable delivery be retried while a processed one is ignored.
 */
export const githubWebhookDelivery = pgTable(
	"github_webhook_delivery",
	{
		githubId: text("githubId")
			.notNull()
			.references(() => github.githubId, { onDelete: "cascade" }),
		deliveryId: text("deliveryId").notNull(),
		/** `X-GitHub-Event` value, for diagnostics. */
		event: text("event").notNull(),
		/** `received` | `processed` | `ignored` | `failed`. */
		status: text("status").notNull().default("received"),
		/** Number of processing attempts, so retries stay bounded. */
		attempts: integer("attempts").notNull().default(0),
		receivedAt: text("receivedAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		processedAt: text("processedAt"),
		/** Safe, non-sensitive failure summary; never a payload or a token. */
		errorMessage: text("errorMessage"),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.githubId, t.deliveryId] }),
		receivedIdx: index("github_webhook_delivery_receivedAt_idx").on(
			t.receivedAt,
		),
	}),
);

export const githubProviderRelations = relations(github, ({ one }) => ({
	gitProvider: one(gitProvider, {
		fields: [github.gitProviderId],
		references: [gitProvider.gitProviderId],
	}),
}));

export type GithubWebhookDelivery =
	typeof githubWebhookDelivery.$inferSelect;
export type NewGithubWebhookDelivery =
	typeof githubWebhookDelivery.$inferInsert;

export const apiCreateGithub = z.object({
	githubAppName: z.string().optional(),
	githubAppId: z.number().optional(),
	githubClientId: z.string().optional(),
	githubClientSecret: z.string().optional(),
	githubInstallationId: z.string().optional(),
	githubPrivateKey: z.string().optional(),
	githubWebhookSecret: z.string().nullable(),
	githubUrl: z
		.url()
		.startsWith("https://", "Only https is supported for GitHub instances")
		.optional(),
	gitProviderId: z.string().optional(),
	name: z.string().min(1),
});

export const apiFindGithubBranches = z.object({
	repo: z.string().min(1),
	owner: z.string().min(1),
	githubId: z.string().optional(),
});

export const apiFindOneGithub = z.object({
	githubId: z.string().min(1),
});

export const apiUpdateGithub = z.object({
	githubId: z.string().min(1),
	name: z.string().min(1),
	gitProviderId: z.string().min(1),
	githubAppName: z.string().min(1),
});
