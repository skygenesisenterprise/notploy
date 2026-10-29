/**
 * OpenAPI 3.1 contract.
 *
 * Kept as code so it ships with the handlers, served at
 * `/api/v1/openapi.json` and materialized to `openapi.json` at the package
 * root by `pnpm generate:openapi`. `tests/api-contract.test.ts` asserts that
 * every route registered by the Hono app appears here.
 */

export interface OpenApiDocument {
	openapi: string;
	info: { title: string; version: string; description: string };
	servers: Array<{ url: string; description: string }>;
	paths: Record<string, Record<string, unknown>>;
	components: {
		securitySchemes: Record<string, unknown>;
		schemas: Record<string, unknown>;
	};
}

const errorSchema = {
	type: "object",
	properties: {
		error: {
			type: "object",
			properties: {
				code: { type: "string" },
				message: { type: "string" },
				details: { type: "object", additionalProperties: true },
			},
			required: ["code", "message"],
		},
	},
	required: ["error"],
};

const jsonBody = (schema: Record<string, unknown>) => ({
	required: true,
	content: { "application/json": { schema } },
});

const ok = (description: string, schema: Record<string, unknown>) => ({
	description,
	content: { "application/json": { schema } },
});

const errors = (description: string) => ({
	description,
	content: { "application/json": { schema: errorSchema } },
});

const idempotencyHeader = {
	name: "Idempotency-Key",
	in: "header",
	required: false,
	schema: { type: "string", maxLength: 200 },
	description:
		"Replaying the same key with the same body returns the stored response instead of acting twice.",
};

export const buildOpenApiDocument = (publicUrl: string): OpenApiDocument => ({
	openapi: "3.1.0",
	info: {
		title: "Notploy Status API",
		version: "1.0.0",
		description:
			"Public and administration API of the Notploy Status platform. Public routes are read-only and unauthenticated; administration and integration routes require a bearer token with the matching scope (read, write, publish, ingest, tokens, admin).",
	},
	servers: [{ url: publicUrl, description: "This instance" }],
	paths: {
		"/api/v1/pages": {
			get: {
				summary: "List public status pages",
				responses: {
					"200": ok("Pages with their computed global status", {
						type: "object",
						properties: {
							items: {
								type: "array",
								items: { $ref: "#/components/schemas/PageSummary" },
							},
						},
					}),
					"429": errors("Rate limited"),
				},
			},
		},
		"/api/v1/pages/{slug}": {
			get: {
				summary: "Full public state of one status page",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": ok("Public page projection", {
						$ref: "#/components/schemas/PublicPage",
					}),
					"404": errors("Unknown page"),
				},
			},
		},
		"/api/v1/pages/{slug}/status": {
			get: {
				summary: "Global status indicator only",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": ok("Global status", {
						type: "object",
						properties: {
							slug: { type: "string" },
							status: { $ref: "#/components/schemas/GlobalStatus" },
							stale: { type: "boolean" },
							generatedAt: { type: "string", format: "date-time" },
							updatedAt: { type: "string", format: "date-time" },
						},
					}),
					"404": errors("Unknown page"),
				},
			},
		},
		"/api/v1/pages/{slug}/components": {
			get: {
				summary: "Public components",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": ok("Visible components only", {
						type: "object",
						properties: {
							items: {
								type: "array",
								items: { $ref: "#/components/schemas/PublicComponent" },
							},
						},
					}),
				},
			},
		},
		"/api/v1/pages/{slug}/incidents": {
			get: {
				summary: "Active or resolved public incidents",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "status",
						in: "query",
						schema: { type: "string", enum: ["active", "resolved", "all"] },
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", minimum: 1, maximum: 100 },
					},
					{ name: "cursor", in: "query", schema: { type: "string" } },
				],
				responses: {
					"200": ok("Paginated incidents", {
						$ref: "#/components/schemas/PaginatedIncidents",
					}),
				},
			},
		},
		"/api/v1/pages/{slug}/incidents/{incidentId}": {
			get: {
				summary: "Public incident detail with its public timeline",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": ok("Incident detail", {
						$ref: "#/components/schemas/PublicIncident",
					}),
					"404": errors("Unknown or non-public incident"),
				},
			},
		},
		"/api/v1/pages/{slug}/incidents/{incidentId}/updates": {
			get: {
				summary: "Paginated public updates of an incident",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{ name: "limit", in: "query", schema: { type: "integer" } },
					{ name: "cursor", in: "query", schema: { type: "string" } },
				],
				responses: { "200": ok("Paginated updates", { type: "object" }) },
			},
		},
		"/api/v1/pages/{slug}/uptime": {
			get: {
				summary: "Daily uptime rollup of the public components (90 days)",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{ name: "componentId", in: "query", schema: { type: "string" } },
				],
				responses: {
					"200": ok("Daily uptime per component", { type: "object" }),
				},
			},
		},
		"/api/v1/pages/{slug}/maintenances": {
			get: {
				summary: "Scheduled or in-progress public maintenances",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "status",
						in: "query",
						schema: {
							type: "string",
							enum: ["scheduled", "in_progress", "completed", "all"],
						},
					},
					{ name: "limit", in: "query", schema: { type: "integer" } },
					{ name: "cursor", in: "query", schema: { type: "string" } },
				],
				responses: { "200": ok("Paginated maintenances", { type: "object" }) },
			},
		},
		"/api/v1/pages/{slug}/history": {
			get: {
				summary: "Combined public history (incidents and maintenances)",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "from",
						in: "query",
						schema: { type: "string", format: "date-time" },
					},
					{
						name: "to",
						in: "query",
						schema: { type: "string", format: "date-time" },
					},
					{ name: "componentId", in: "query", schema: { type: "string" } },
					{ name: "state", in: "query", schema: { type: "string" } },
					{ name: "limit", in: "query", schema: { type: "integer" } },
					{ name: "cursor", in: "query", schema: { type: "string" } },
				],
				responses: { "200": ok("Paginated history", { type: "object" }) },
			},
		},
		"/api/v1/pages/{slug}/feed.xml": {
			get: {
				summary: "RSS 2.0 feed of published incidents",
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": { description: "RSS XML" } },
			},
		},
		"/api/v1/openapi.json": {
			get: {
				summary: "This document",
				responses: { "200": ok("OpenAPI document", { type: "object" }) },
			},
		},
		"/healthz": {
			get: {
				summary: "Liveness probe",
				responses: { "200": ok("Process alive", { type: "object" }) },
			},
		},
		"/readyz": {
			get: {
				summary: "Readiness probe (includes storage)",
				responses: {
					"200": ok("Ready", { type: "object" }),
					"503": errors("Storage unavailable"),
				},
			},
		},
		"/api/v1/admin/pages": {
			get: {
				summary: "List pages including internal settings (read)",
				security: [{ bearerAuth: ["read"] }],
				responses: {
					"200": ok("Pages", { type: "object" }),
					"401": errors("Missing credentials"),
				},
			},
			post: {
				summary: "Create a status page (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [idempotencyHeader],
				requestBody: jsonBody({ $ref: "#/components/schemas/CreatePage" }),
				responses: {
					"201": ok("Created page", { type: "object" }),
					"409": errors("Slug taken"),
				},
			},
		},
		"/api/v1/admin/pages/{ref}": {
			get: {
				summary: "Internal page view (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Page", { type: "object" }) },
			},
			patch: {
				summary: "Update page name, description or settings (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated page", { type: "object" }) },
			},
		},
		"/api/v1/admin/pages/{ref}/components": {
			get: {
				summary: "All components including private ones (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Components", { type: "object" }) },
			},
			post: {
				summary: "Create a component (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "201": ok("Created component", { type: "object" }) },
			},
		},
		"/api/v1/admin/components/{componentId}": {
			patch: {
				summary: "Update a component (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "componentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated component", { type: "object" }) },
			},
			delete: {
				summary: "Delete a component (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "componentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Deleted", { type: "object" }) },
			},
		},
		"/api/v1/admin/pages/{ref}/incidents": {
			get: {
				summary: "Incidents including drafts (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Incidents", { type: "object" }) },
			},
			post: {
				summary:
					"Create an incident (write; publish requires the publish scope)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					idempotencyHeader,
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ $ref: "#/components/schemas/CreateIncident" }),
				responses: {
					"201": ok("Created incident", { type: "object" }),
					"409": errors("Correlation conflict"),
				},
			},
		},
		"/api/v1/admin/incidents/{incidentId}": {
			get: {
				summary: "Internal incident view (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Incident", { type: "object" }) },
			},
			patch: {
				summary: "Update an incident (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated incident", { type: "object" }) },
			},
			delete: {
				summary: "Delete an unpublished incident (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: {
					"200": ok("Deleted", { type: "object" }),
					"409": errors("Published incidents must be unpublished first"),
				},
			},
		},
		"/api/v1/admin/incidents/{incidentId}/timeline": {
			get: {
				summary: "Full internal timeline including internal updates (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Timeline", { type: "object" }) },
			},
		},
		"/api/v1/admin/incidents/{incidentId}/state": {
			post: {
				summary: "Transition state or resolve (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					idempotencyHeader,
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated incident", { type: "object" }) },
			},
		},
		"/api/v1/admin/incidents/{incidentId}/updates": {
			post: {
				summary: "Append a timeline update (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					idempotencyHeader,
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated incident", { type: "object" }) },
			},
		},
		"/api/v1/admin/incidents/{incidentId}/publish": {
			post: {
				summary: "Publish or withdraw an incident (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					idempotencyHeader,
					{
						name: "incidentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated incident", { type: "object" }) },
			},
		},
		"/api/v1/admin/pages/{ref}/maintenances": {
			get: {
				summary: "Maintenances including drafts (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Maintenances", { type: "object" }) },
			},
			post: {
				summary: "Schedule a maintenance (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					idempotencyHeader,
					{
						name: "ref",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "201": ok("Created maintenance", { type: "object" }) },
			},
		},
		"/api/v1/admin/maintenances/{maintenanceId}": {
			patch: {
				summary: "Update a maintenance (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "maintenanceId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated maintenance", { type: "object" }) },
			},
			delete: {
				summary: "Delete an unpublished maintenance (write)",
				security: [{ bearerAuth: ["write"] }],
				parameters: [
					{
						name: "maintenanceId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Deleted", { type: "object" }) },
			},
		},
		"/api/v1/admin/maintenances/{maintenanceId}/state": {
			post: {
				summary: "Start, complete or cancel (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					{
						name: "maintenanceId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated maintenance", { type: "object" }) },
			},
		},
		"/api/v1/admin/maintenances/{maintenanceId}/publish": {
			post: {
				summary: "Publish or withdraw a maintenance (publish)",
				security: [{ bearerAuth: ["publish"] }],
				parameters: [
					{
						name: "maintenanceId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated maintenance", { type: "object" }) },
			},
		},
		"/api/v1/admin/tokens": {
			get: {
				summary: "List credentials, plaintext values never shown (tokens)",
				security: [{ bearerAuth: ["tokens"] }],
				responses: { "200": ok("Tokens", { type: "object" }) },
			},
			post: {
				summary: "Create a credential; the value is returned once (tokens)",
				security: [{ bearerAuth: ["tokens"] }],
				requestBody: jsonBody({ $ref: "#/components/schemas/CreateToken" }),
				responses: {
					"201": ok("Created token with one-time value", { type: "object" }),
				},
			},
		},
		"/api/v1/admin/tokens/{tokenId}": {
			delete: {
				summary: "Revoke a credential (tokens)",
				security: [{ bearerAuth: ["tokens"] }],
				parameters: [
					{
						name: "tokenId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Revoked token", { type: "object" }) },
			},
		},
		"/api/v1/admin/audit": {
			get: {
				summary: "Audit trail of sensitive operations (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{ name: "limit", in: "query", schema: { type: "integer" } },
					{ name: "cursor", in: "query", schema: { type: "string" } },
				],
				responses: { "200": ok("Audit entries", { type: "object" }) },
			},
		},
		"/api/v1/admin/webhooks": {
			get: {
				summary: "List webhook subscriptions (read)",
				security: [{ bearerAuth: ["read"] }],
				responses: { "200": ok("Subscriptions", { type: "object" }) },
			},
			post: {
				summary: "Create a signed webhook subscription (write)",
				security: [{ bearerAuth: ["write"] }],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "201": ok("Created subscription", { type: "object" }) },
			},
		},
		"/api/v1/integration/events": {
			post: {
				summary:
					"Ingest a monitoring alert (ingest): deduplicated, correlated, debounced",
				security: [{ bearerAuth: ["ingest"] }],
				parameters: [idempotencyHeader],
				requestBody: jsonBody({ $ref: "#/components/schemas/IngestEvent" }),
				responses: { "202": ok("Ingestion outcome", { type: "object" }) },
			},
		},
		"/api/v1/integration/pages/{slug}/components/{componentId}/state": {
			get: {
				summary: "Known state of a component (read)",
				security: [{ bearerAuth: ["read"] }],
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "componentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				responses: { "200": ok("Component state", { type: "object" }) },
			},
			post: {
				summary: "Report the observed state of a component (ingest)",
				security: [{ bearerAuth: ["ingest"] }],
				parameters: [
					{
						name: "slug",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
					{
						name: "componentId",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				requestBody: jsonBody({ type: "object", additionalProperties: true }),
				responses: { "200": ok("Updated state", { type: "object" }) },
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "nps_<tokenId>_<secret>",
				description:
					"Token created via the admin API or the token:create CLI. Scopes: read, write, publish, ingest, tokens, admin.",
			},
		},
		schemas: {
			GlobalStatus: {
				type: "string",
				enum: [
					"operational",
					"degraded_performance",
					"partial_outage",
					"major_outage",
					"under_maintenance",
				],
			},
			PublicComponent: {
				type: "object",
				properties: {
					id: { type: "string" },
					name: { type: "string" },
					description: { type: "string" },
					category: { type: "string" },
					groupName: { type: "string", nullable: true },
					position: { type: "integer" },
					status: { $ref: "#/components/schemas/GlobalStatus" },
					stale: { type: "boolean" },
					observedAt: { type: "string", format: "date-time", nullable: true },
					incidentIds: { type: "array", items: { type: "string" } },
				},
			},
			PublicIncident: {
				type: "object",
				properties: {
					id: { type: "string" },
					title: { type: "string" },
					severity: { type: "string", enum: ["minor", "major", "critical"] },
					state: {
						type: "string",
						enum: ["investigating", "identified", "monitoring", "resolved"],
					},
					startedAt: { type: "string", format: "date-time" },
					resolvedAt: { type: "string", format: "date-time", nullable: true },
					componentIds: { type: "array", items: { type: "string" } },
					summary: { type: "string" },
					updates: { type: "array", items: { type: "object" } },
				},
			},
			PublicPage: {
				type: "object",
				properties: {
					slug: { type: "string" },
					name: { type: "string" },
					description: { type: "string" },
					status: { $ref: "#/components/schemas/GlobalStatus" },
					stale: { type: "boolean" },
					generatedAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					refreshIntervalSeconds: { type: "integer" },
					components: {
						type: "array",
						items: { $ref: "#/components/schemas/PublicComponent" },
					},
					activeIncidents: {
						type: "array",
						items: { $ref: "#/components/schemas/PublicIncident" },
					},
					scheduledMaintenances: { type: "array", items: { type: "object" } },
				},
			},
			PageSummary: {
				type: "object",
				properties: {
					slug: { type: "string" },
					name: { type: "string" },
					status: { $ref: "#/components/schemas/GlobalStatus" },
					stale: { type: "boolean" },
				},
			},
			PaginatedIncidents: {
				type: "object",
				properties: {
					items: {
						type: "array",
						items: { $ref: "#/components/schemas/PublicIncident" },
					},
					nextCursor: { type: "string", nullable: true },
				},
			},
			CreatePage: {
				type: "object",
				required: ["slug", "name"],
				properties: {
					slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
					name: { type: "string" },
					description: { type: "string" },
					settings: { type: "object", additionalProperties: true },
				},
			},
			CreateIncident: {
				type: "object",
				required: ["title"],
				properties: {
					title: { type: "string" },
					description: { type: "string" },
					severity: { type: "string", enum: ["minor", "major", "critical"] },
					state: {
						type: "string",
						enum: ["investigating", "identified", "monitoring", "resolved"],
					},
					visibility: { type: "string", enum: ["public", "private"] },
					published: { type: "boolean" },
					componentIds: { type: "array", items: { type: "string" } },
					correlationKey: { type: "string" },
					update: { type: "object", additionalProperties: true },
				},
			},
			CreateToken: {
				type: "object",
				required: ["name", "scopes"],
				properties: {
					name: { type: "string" },
					scopes: {
						type: "array",
						items: {
							type: "string",
							enum: ["read", "write", "publish", "ingest", "tokens", "admin"],
						},
					},
				},
			},
			IngestEvent: {
				type: "object",
				required: ["pageSlug", "correlationKey", "title"],
				properties: {
					eventId: {
						type: "string",
						description: "Client-side idempotency key",
					},
					pageSlug: { type: "string" },
					componentId: { type: "string" },
					correlationKey: {
						type: "string",
						description: "Groups repeated alerts into one incident",
					},
					title: { type: "string" },
					message: { type: "string" },
					severity: { type: "string", enum: ["minor", "major", "critical"] },
					observedStatus: {
						type: "string",
						enum: ["operational", "degraded", "outage", "unknown"],
					},
					source: { type: "string" },
					updateComponentState: { type: "boolean" },
				},
			},
		},
	},
});
