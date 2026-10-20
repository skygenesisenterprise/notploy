import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { environments } from "./environment";
import { projectTags } from "./tag";
import { encryptedText } from "./utils";

export const projects = pgTable("project", {
	projectId: text("projectId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),

	organizationId: text("organizationId")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	env: encryptedText("env").notNull().default(""),
	/**
	 * Logical project quotas. These are Notploy-level caps on the limits that
	 * services **declare**, not a runtime isolation guarantee: Docker and Swarm
	 * still enforce each service's own `cpuLimit`/`memoryLimit`. `null` means
	 * "no quota". Units match the service columns: CPU in nanocpus and memory
	 * in bytes.
	 */
	cpuLimit: text("cpuLimit"),
	cpuReservation: text("cpuReservation"),
	memoryLimit: text("memoryLimit"),
	memoryReservation: text("memoryReservation"),
});

export const projectRelations = relations(projects, ({ many, one }) => ({
	environments: many(environments),
	projectTags: many(projectTags),
	organization: one(organization, {
		fields: [projects.organizationId],
		references: [organization.id],
	}),
}));

const createSchema = createInsertSchema(projects, {
	projectId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	env: z.string().optional(),
});

export const apiCreateProject = createSchema.pick({
	name: true,
	description: true,
	env: true,
});

export const apiFindOneProject = z.object({
	projectId: z.string().min(1),
});
export const apiRemoveProject = createSchema
	.pick({
		projectId: true,
	})
	.required();

// export const apiUpdateProject = createSchema
// 	.pick({
// 		name: true,
// 		description: true,
// 		projectId: true,
// 		env: true,
// 	})
// 	.required();

/**
 * Quotas are non-negative byte/nanocpu strings. Empty strings are rejected so
 * "no quota" is always represented by `null` (or by omitting the field).
 */
const quotaField = z
	.string()
	.regex(/^\d+$/, "Must be a non-negative integer")
	.nullable();

export const apiUpdateProject = createSchema.partial().extend({
	projectId: z.string().min(1),
	cpuLimit: quotaField.optional(),
	cpuReservation: quotaField.optional(),
	memoryLimit: quotaField.optional(),
	memoryReservation: quotaField.optional(),
});
// .omit({ serverId: true });
