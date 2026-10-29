/**
 * Status Core — Zod contracts.
 *
 * Every write entering the platform (HTTP body, integration event, CLI input)
 * is validated here before it touches storage. These schemas are also the
 * source of truth for the OpenAPI document.
 */
import { z } from "zod";
import { isIsoDate, isValidTimeZone } from "./time";
import type {
	ComponentCategory,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
	PublicComponentStatus,
	TokenScope,
	Visibility,
} from "./types";

export const PUBLIC_STATUSES = [
	"operational",
	"degraded_performance",
	"partial_outage",
	"major_outage",
	"under_maintenance",
] as const;

export const OBSERVED_STATUSES = [
	"operational",
	"degraded",
	"outage",
	"unknown",
] as const;

export const INCIDENT_SEVERITIES = ["minor", "major", "critical"] as const;

export const INCIDENT_STATES = [
	"investigating",
	"identified",
	"monitoring",
	"resolved",
] as const;

export const MAINTENANCE_STATES = [
	"scheduled",
	"in_progress",
	"completed",
	"cancelled",
] as const;

export const VISIBILITIES = ["public", "private"] as const;

export const TOKEN_SCOPES = [
	"read",
	"write",
	"publish",
	"ingest",
	"tokens",
	"admin",
] as const;

export const COMPONENT_CATEGORIES = [
	"core",
	"application",
	"api",
	"infrastructure",
	"storage",
	"network",
	"documentation",
	"security",
	"other",
] as const;

const isoDate = z
	.string()
	.min(1)
	.refine(isIsoDate, { message: "must be an ISO 8601 date (UTC preferred)" });

export const slugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: "lowercase letters, digits and single dashes only",
	});

export const visibilitySchema = z.enum(VISIBILITIES);
export const publicStatusSchema = z.enum(PUBLIC_STATUSES);
export const observedStatusSchema = z.enum(OBSERVED_STATUSES);
export const severitySchema = z.enum(INCIDENT_SEVERITIES);
export const incidentStateSchema = z.enum(INCIDENT_STATES);
export const maintenanceStateSchema = z.enum(MAINTENANCE_STATES);
export const tokenScopeSchema = z.enum(TOKEN_SCOPES);
export const categorySchema = z.enum(COMPONENT_CATEGORIES);

/** User-provided display settings; all fields optional with safe defaults. */
export const pageSettingsSchema = z
	.object({
		staleAfterSeconds: z.number().int().min(30).max(86_400).default(120),
		refreshIntervalSeconds: z.number().int().min(0).max(3600).default(30),
		showHistory: z.boolean().default(true),
		historyLimit: z.number().int().min(1).max(50).default(10),
		autoIncident: z.boolean().default(false),
		autoPublish: z.boolean().default(false),
		autoIncidentWindowSeconds: z
			.number()
			.int()
			.min(30)
			.max(86_400)
			.default(300),
		severityToStatus: z
			.object({
				minor: publicStatusSchema,
				major: publicStatusSchema,
				critical: publicStatusSchema,
			})
			.partial()
			.default({}),
	})
	.strict();

export const createPageSchema = z
	.object({
		slug: slugSchema,
		name: z.string().min(1).max(120),
		description: z.string().max(500).default(""),
		settings: pageSettingsSchema.partial().optional(),
	})
	.strict();

export const updatePageSchema = z
	.object({
		name: z.string().min(1).max(120).optional(),
		description: z.string().max(500).optional(),
		settings: pageSettingsSchema.partial().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "at least one field is required",
	});

export const createComponentSchema = z
	.object({
		name: z.string().min(1).max(120),
		description: z.string().max(500).default(""),
		category: categorySchema.default("other"),
		groupName: z.string().max(80).optional(),
		visibility: visibilitySchema.default("public"),
		position: z.number().int().min(0).max(9999).optional(),
		parentId: z.string().min(1).nullable().optional(),
		source: z.enum(["manual", "monitoring"]).default("manual"),
		observedStatus: observedStatusSchema.default("operational"),
	})
	.strict();

export const updateComponentSchema = z
	.object({
		name: z.string().min(1).max(120).optional(),
		description: z.string().max(500).optional(),
		category: categorySchema.optional(),
		groupName: z.string().max(80).nullable().optional(),
		visibility: visibilitySchema.optional(),
		position: z.number().int().min(0).max(9999).optional(),
		parentId: z.string().min(1).nullable().optional(),
		observedStatus: observedStatusSchema.optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "at least one field is required",
	});

export const createIncidentSchema = z
	.object({
		title: z.string().min(1).max(160),
		description: z.string().max(4000).default(""),
		severity: severitySchema.default("minor"),
		state: incidentStateSchema.default("investigating"),
		visibility: visibilitySchema.default("private"),
		published: z.boolean().default(false),
		componentIds: z.array(z.string().min(1)).max(50).default([]),
		correlationKey: z.string().min(1).max(200).optional(),
		startedAt: isoDate.optional(),
		/** First public update, optional. */
		update: z
			.object({
				message: z.string().min(1).max(4000),
				state: incidentStateSchema.optional(),
			})
			.strict()
			.optional(),
	})
	.strict();

export const updateIncidentSchema = z
	.object({
		title: z.string().min(1).max(160).optional(),
		description: z.string().max(4000).optional(),
		severity: severitySchema.optional(),
		visibility: visibilitySchema.optional(),
		componentIds: z.array(z.string().min(1)).max(50).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "at least one field is required",
	});

export const incidentStateChangeSchema = z
	.object({
		state: incidentStateSchema,
		/** Public message attached to the transition. */
		message: z.string().min(1).max(4000).optional(),
		/** Mark the incident resolved (sets resolvedAt). */
		resolvedAt: isoDate.optional(),
	})
	.strict();

export const incidentUpdateSchema = z
	.object({
		message: z.string().min(1).max(4000),
		state: incidentStateSchema.optional(),
		/**
		 * `internal` updates are kept in the timeline for audit purposes but
		 * never exposed through the public API.
		 */
		visibility: visibilitySchema.default("public"),
	})
	.strict();

export const publishSchema = z
	.object({
		published: z.boolean(),
		/** Optionally flip visibility together with the publication flag. */
		visibility: visibilitySchema.optional(),
	})
	.strict();

export const createMaintenanceSchema = z
	.object({
		title: z.string().min(1).max(160),
		description: z.string().max(4000).default(""),
		componentIds: z.array(z.string().min(1)).max(50).default([]),
		startAt: isoDate,
		endAt: isoDate,
		timeZone: z
			.string()
			.min(1)
			.max(64)
			.refine(isValidTimeZone, { message: "unknown IANA time zone" })
			.default("UTC"),
		visibility: visibilitySchema.default("private"),
		published: z.boolean().default(false),
		update: z
			.object({ message: z.string().min(1).max(4000) })
			.strict()
			.optional(),
	})
	.strict()
	.refine((ctx) => Date.parse(ctx.endAt) > Date.parse(ctx.startAt), {
		message: "endAt must be after startAt",
		path: ["endAt"],
	});

export const updateMaintenanceSchema = z
	.object({
		title: z.string().min(1).max(160).optional(),
		description: z.string().max(4000).optional(),
		componentIds: z.array(z.string().min(1)).max(50).optional(),
		startAt: isoDate.optional(),
		endAt: isoDate.optional(),
		timeZone: z
			.string()
			.min(1)
			.max(64)
			.refine(isValidTimeZone, { message: "unknown IANA time zone" })
			.optional(),
		visibility: visibilitySchema.optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "at least one field is required",
	});

export const maintenanceStateChangeSchema = z
	.object({
		state: maintenanceStateSchema,
		message: z.string().min(1).max(4000).optional(),
	})
	.strict();

export const createTokenSchema = z
	.object({
		name: z.string().min(1).max(80),
		scopes: z.array(tokenScopeSchema).min(1).max(6),
	})
	.strict()
	.refine((ctx) => new Set(ctx.scopes).size === ctx.scopes.length, {
		message: "scopes must be unique",
	});

/**
 * Monitoring event received from an external source (Notploy Console, the Go
 * monitoring agent, or any other probe). `eventId` makes the ingestion
 * idempotent; `correlationKey` groups repeated alerts under one incident.
 */
export const ingestEventSchema = z
	.object({
		eventId: z.string().min(8).max(200).optional(),
		pageSlug: slugSchema,
		componentId: z.string().min(1).optional(),
		correlationKey: z.string().min(1).max(200),
		title: z.string().min(1).max(160),
		message: z.string().max(2000).default(""),
		severity: severitySchema.default("minor"),
		observedStatus: observedStatusSchema.optional(),
		source: z.string().min(1).max(80).default("integration"),
		/** When set, the component's observed status is updated too. */
		updateComponentState: z.boolean().default(false),
	})
	.strict();

export const componentStateSchema = z
	.object({
		observedStatus: observedStatusSchema,
		/** Optional observability note kept internally, never published. */
		note: z.string().max(500).optional(),
	})
	.strict();

export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.string().max(200).optional(),
});

export const historyQuerySchema = paginationSchema.extend({
	from: isoDate.optional(),
	to: isoDate.optional(),
	componentId: z.string().min(1).optional(),
	state: incidentStateSchema.optional(),
});

/** Re-exported entity types for consumers of the package. */
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type IncidentStateChangeInput = z.infer<
	typeof incidentStateChangeSchema
>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
export type MaintenanceStateChangeInput = z.infer<
	typeof maintenanceStateChangeSchema
>;
export type PublishInput = z.infer<typeof publishSchema>;
export type ComponentStateInput = z.infer<typeof componentStateSchema>;
export type CreateTokenInputResolved = z.infer<typeof createTokenSchema>;
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
export type IngestEventInput = z.infer<typeof ingestEventSchema>;
export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/** Narrowing helpers kept next to the schemas. */
export const isPublicStatus = (value: string): value is PublicComponentStatus =>
	(PUBLIC_STATUSES as readonly string[]).includes(value);
export const isSeverity = (value: string): value is IncidentSeverity =>
	(INCIDENT_SEVERITIES as readonly string[]).includes(value);
export const isIncidentState = (value: string): value is IncidentState =>
	(INCIDENT_STATES as readonly string[]).includes(value);
export const isMaintenanceState = (value: string): value is MaintenanceState =>
	(MAINTENANCE_STATES as readonly string[]).includes(value);
export const isVisibility = (value: string): value is Visibility =>
	(VISIBILITIES as readonly string[]).includes(value);
export const isTokenScope = (value: string): value is TokenScope =>
	(TOKEN_SCOPES as readonly string[]).includes(value);
export const isCategory = (value: string): value is ComponentCategory =>
	(COMPONENT_CATEGORIES as readonly string[]).includes(value);
