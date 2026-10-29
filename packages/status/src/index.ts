/**
 * `@notploy/status` — engine of the Notploy Status platform.
 *
 * Responsibilities (see README.md for the full architecture):
 * - Status Core: domain types, validation contracts, state engine;
 * - Status Operations: durable SQLite persistence, snapshots, backups,
 *   notification outbox, health probes;
 * - Status API: the Hono application (public, admin, integration) that the
 *   Next.js status application mounts through a catch-all route.
 *
 * The web interface lives in `apps/status` and consumes this package; the
 * platform has no dependency on Notploy Console and keeps serving the last
 * known public state when the control plane (or its own storage) is down.
 */

export {
	generateToken,
	hashSecret,
	parseScopes,
	parseToken,
	scopeAllows,
	verifySecret,
} from "./auth/tokens";
export { loadConfig, type StatusConfig } from "./config";
export {
	type CatalogComponent,
	NOTPLOY_STATUS_CATALOG,
	type StatusCatalog,
} from "./core/catalog";
export * from "./core/dto";
export { newId, newRequestId, newTokenValue } from "./core/ids";
export * from "./core/schemas";
export * from "./core/status-engine";
export {
	intervalsOverlap,
	isIsoDate,
	isOlderThan,
	isValidTimeZone,
	nowIso,
	plusSeconds,
} from "./core/time";
export * from "./core/types";
export {
	availabilityPercent,
	daysBetween,
	dayWindow,
	formatUptime,
	isAvailable,
	UPTIME_WINDOW_DAYS,
	utcDay,
} from "./core/uptime";
export { StatusError } from "./errors";
// Re-export the StatusPublisher client for backwards compatibility
export {
	createStatusPublisher,
	type ListOptions,
	type PublisherIncidentInput,
	type PublisherIncidentPatch,
	type PublisherMaintenancePatch,
	StatusPublisher,
	StatusPublisherError,
	type StatusPublisherOptions,
} from "./integration/client";
export { createBackup, listBackups } from "./operations/backup";
export {
	type OutboxWorkerHandle,
	startOutboxWorker,
} from "./operations/outbox-worker";
export {
	startUptimeSampler,
	type UptimeSamplerHandle,
} from "./operations/uptime-sampler";
export {
	createStatusPlatform,
	type StatusPlatform,
} from "./platform";
export {
	createComponent,
	deleteComponent,
	listComponentsInternal,
	requireComponent,
	setComponentObservedState,
	updateComponent,
} from "./services/components";
export {
	type Actor,
	createStatusContext,
	readSnapshot,
	type StatusContext,
} from "./services/context";
export {
	addIncidentUpdate,
	changeIncidentState,
	createIncident,
	deleteIncident,
	requireIncident,
	setIncidentPublish,
	updateIncident,
} from "./services/incidents";
export {
	getComponentObservedState,
	ingestMonitoringEvent,
} from "./services/ingest";
export {
	changeMaintenanceState,
	createMaintenance,
	deleteMaintenance,
	requireMaintenance,
	setMaintenancePublish,
	updateMaintenance,
} from "./services/maintenances";
export {
	createWebhookSubscription,
	dispatchOutbox,
	listWebhookSubscriptions,
	replayOutboxEntry,
} from "./services/outbox";
export {
	createPage,
	listPagesInternal,
	requirePage,
	updatePage,
} from "./services/pages";
export {
	buildAllPublicPages,
	buildPublicPage,
	getPublicIncident,
	getPublicPage,
	getPublicStatus,
	listPages,
	listPublicHistory,
	listPublicIncidents,
	listPublicIncidentUpdates,
	listPublicMaintenances,
	listPublicUptime,
	listTimeline,
} from "./services/public";
export {
	createTokenRecord,
	listTokenRecords,
	requireScope,
	revokeTokenRecord,
	verifyBearer,
} from "./services/security";
export {
	type SeedOptions,
	type SeedResult,
	seedCatalog,
} from "./services/seed";
export { DEFAULT_PAGE_SETTINGS, resolveSettings } from "./services/settings";
export {
	emptyComponentUptime,
	getComponentUptime,
	getUptimeForComponents,
	recordDailyUptime,
	sampleUptime,
	type UptimeQuery,
} from "./services/uptime";
export { getSchemaVersion, openDatabase, pingDatabase } from "./store/db";
export {
	MIGRATIONS,
	rollbackLastMigration,
	runMigrations,
} from "./store/migrations";
