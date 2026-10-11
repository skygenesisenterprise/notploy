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
export * from "./core/types";
export * from "./core/dto";
export {
	NOTPLOY_STATUS_CATALOG,
	type CatalogComponent,
	type StatusCatalog,
} from "./core/catalog";
export * from "./core/schemas";
export * from "./core/status-engine";
export { newId, newTokenValue, newRequestId } from "./core/ids";
export {
	nowIso,
	isIsoDate,
	isOlderThan,
	intervalsOverlap,
	plusSeconds,
	isValidTimeZone,
} from "./core/time";
export {
	UPTIME_WINDOW_DAYS,
	utcDay,
	dayWindow,
	daysBetween,
	isAvailable,
	availabilityPercent,
	formatUptime,
} from "./core/uptime";

export { loadConfig, type StatusConfig } from "./config";
export { StatusError } from "./errors";
export {
	createStatusContext,
	readSnapshot,
	type StatusContext,
	type Actor,
} from "./services/context";
export { openDatabase, getSchemaVersion, pingDatabase } from "./store/db";
export { MIGRATIONS, runMigrations, rollbackLastMigration } from "./store/migrations";
export { resolveSettings, DEFAULT_PAGE_SETTINGS } from "./services/settings";
export {
	createPage,
	updatePage,
	listPagesInternal,
	requirePage,
} from "./services/pages";
export {
	seedCatalog,
	type SeedResult,
	type SeedOptions,
} from "./services/seed";
export {
	createComponent,
	updateComponent,
	deleteComponent,
	listComponentsInternal,
	setComponentObservedState,
	requireComponent,
} from "./services/components";
export {
	createIncident,
	updateIncident,
	changeIncidentState,
	addIncidentUpdate,
	setIncidentPublish,
	deleteIncident,
	requireIncident,
} from "./services/incidents";
export {
	createMaintenance,
	updateMaintenance,
	changeMaintenanceState,
	setMaintenancePublish,
	deleteMaintenance,
	requireMaintenance,
} from "./services/maintenances";
export {
	createTokenRecord,
	listTokenRecords,
	revokeTokenRecord,
	verifyBearer,
	requireScope,
} from "./services/security";
export {
	ingestMonitoringEvent,
	getComponentObservedState,
} from "./services/ingest";
export {
	createWebhookSubscription,
	listWebhookSubscriptions,
	dispatchOutbox,
	replayOutboxEntry,
} from "./services/outbox";
export {
	buildPublicPage,
	buildAllPublicPages,
	getPublicPage,
	getPublicStatus,
	listPages,
	listPublicIncidents,
	getPublicIncident,
	listPublicIncidentUpdates,
	listPublicMaintenances,
	listPublicHistory,
	listPublicUptime,
	listTimeline,
} from "./services/public";
export {
	recordDailyUptime,
	sampleUptime,
	getComponentUptime,
	getUptimeForComponents,
	emptyComponentUptime,
	type UptimeQuery,
} from "./services/uptime";
export {
	createStatusPlatform,
	type StatusPlatform,
} from "./platform";
export { createBackup, listBackups } from "./operations/backup";
export {
	startOutboxWorker,
	type OutboxWorkerHandle,
} from "./operations/outbox-worker";
export {
	startUptimeSampler,
	type UptimeSamplerHandle,
} from "./operations/uptime-sampler";
export {
	generateToken,
	hashSecret,
	parseToken,
	verifySecret,
	scopeAllows,
	parseScopes,
} from "./auth/tokens";
