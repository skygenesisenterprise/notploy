/**
 * Phase 1 — shared observability contracts for Prometheus/Grafana.
 *
 * These types are intentionally transport-agnostic: the Notploy console must
 * not be coupled to whether metrics come from the managed stack or from an
 * external Prometheus/Grafana pair. Adapters (Phase 3) implement these
 * contracts; the console (Phase 4) only consumes them.
 *
 * Design rules enforced here:
 * - Absent data is explicit (`data: null` + typed error), never `0`/healthy.
 * - Secrets never appear in labels, queries, logs, or API views.
 * - Prometheus read paths must not depend on Grafana at runtime.
 */

/** Stable resource identity used to join Notploy objects to metric series. */
export interface ObservableResourceRef {
	organizationId: string;
	serverId?: string;
	projectId?: string;
	environmentId?: string;
	serviceId?: string;
	serviceType?:
		| "application"
		| "compose"
		| "postgres"
		| "mysql"
		| "mongo"
		| "redis"
		| "mariadb"
		| "libsql";
	containerName?: string;
}

/**
 * Mastered Prometheus label set for Notploy series.
 * Keep cardinality bounded: no secrets, no unbounded/free-form values.
 */
export type ObservabilityLabelKey =
	| "notploy_org_id"
	| "notploy_server_id"
	| "notploy_project_id"
	| "notploy_environment_id"
	| "notploy_service_id"
	| "notploy_service_type"
	| "notploy_container_name";

export type ObservabilityLabels = Partial<
	Record<ObservabilityLabelKey, string>
>;

const OBSERVABILITY_LABEL_KEYS: ReadonlySet<string> = new Set([
	"notploy_org_id",
	"notploy_server_id",
	"notploy_project_id",
	"notploy_environment_id",
	"notploy_service_id",
	"notploy_service_type",
	"notploy_container_name",
]);

/** Guard against secret, high-cardinality, or unbounded label keys. */
export const isAllowedObservabilityLabelKey = (key: string): boolean =>
	OBSERVABILITY_LABEL_KEYS.has(key);

export const toObservabilityLabels = (
	ref: ObservableResourceRef,
): ObservabilityLabels => {
	const labels: ObservabilityLabels = {};
	if (ref.organizationId) labels.notploy_org_id = ref.organizationId;
	if (ref.serverId) labels.notploy_server_id = ref.serverId;
	if (ref.projectId) labels.notploy_project_id = ref.projectId;
	if (ref.environmentId) labels.notploy_environment_id = ref.environmentId;
	if (ref.serviceId) labels.notploy_service_id = ref.serviceId;
	if (ref.serviceType) labels.notploy_service_type = ref.serviceType;
	if (ref.containerName) labels.notploy_container_name = ref.containerName;
	return labels;
};

/**
 * Console-facing connection states. `stale` means the backend answered but
 * the newest sample is older than the freshness threshold.
 */
export type ObservabilityConnectionState =
	| "unconfigured"
	| "healthy"
	| "degraded"
	| "unreachable"
	| "stale";

export interface ObservabilityFreshness {
	/** ISO timestamp of the newest sample, when known. */
	lastScrapeAt: string | null;
	/** Freshness budget in seconds used to decide `stale`. */
	freshnessThresholdSeconds: number;
}

export const isFreshSample = (
	lastScrapeAt: string | null,
	thresholdSeconds: number,
	nowMs = Date.now(),
): boolean => {
	if (!lastScrapeAt) return false;
	const parsed = Date.parse(lastScrapeAt);
	if (!Number.isFinite(parsed)) return false;
	return nowMs - parsed <= thresholdSeconds * 1000;
};

/** Deployment mode selected in Connections/Settings. */
export type ObservabilityMode = "managed" | "external" | "unconfigured";

export interface ObservabilityProviderCapabilities {
	/** Prometheus query API reachable and usable standalone. */
	prometheus: boolean;
	/** Grafana reachable; never required for Prometheus reads. */
	grafana: boolean;
	targets: boolean;
	alerts: boolean;
	rules: boolean;
	dashboards: boolean;
	externalLabels: boolean;
}

export const EMPTY_CAPABILITIES: ObservabilityProviderCapabilities = {
	prometheus: false,
	grafana: false,
	targets: false,
	alerts: false,
	rules: false,
	dashboards: false,
	externalLabels: false,
};

export type ObservabilityMetricKind =
	| "host.cpu"
	| "host.memory"
	| "host.load"
	| "host.disk"
	| "host.io"
	| "host.network"
	| "container.state"
	| "container.restarts"
	| "container.cpu"
	| "container.memory"
	| "container.network"
	| "app.availability"
	| "app.latency"
	| "app.errors"
	| "app.custom"
	| "controlplane.health"
	| "deployment.duration";

/** Availability of one metric kind from the active backend. */
export type MetricAvailability = "available" | "unavailable" | "unknown";

export interface TypedMetricQuery {
	kind: ObservabilityMetricKind;
	labels: ObservabilityLabels;
	/** ISO range bounds for range queries. Instant queries omit `end`. */
	start: string;
	end?: string;
	/** Downsampling step, e.g. `15s`, `1m`, `5m`. */
	step?: string;
}

/** Normalized series point. Missing samples stay missing, never zero-filled. */
export interface MetricSample {
	timestamp: string;
	value: number | null;
}

export interface NormalizedMetricResult {
	query: TypedMetricQuery;
	availability: MetricAvailability;
	samples: MetricSample[];
	freshness: ObservabilityFreshness;
	/** Machine-readable reason when `availability !== "available"`. */
	reason?: string;
}

export type ObservabilityAlertState = "firing" | "pending" | "resolved";

export interface NormalizedAlert {
	name: string;
	state: ObservabilityAlertState;
	severity: "critical" | "warning" | "info";
	labels: ObservabilityLabels;
	summary: string;
	startsAt: string;
	endsAt?: string;
	generatorUrl?: string;
}

/** Read-only view returned to the console. Secrets are never included. */
export interface ObservabilityTargetView {
	name: string;
	url: string;
	state: ObservabilityConnectionState;
	lastScrapeAt: string | null;
	lastError: string | null;
}

/** Read surface implemented by Prometheus adapters (managed or external). */
export interface ObservabilityReader {
	getCapabilities(): Promise<ObservabilityProviderCapabilities>;
	getConnectionState(): Promise<ObservabilityConnectionState>;
	queryMetrics(query: TypedMetricQuery): Promise<NormalizedMetricResult>;
	listAlerts?(): Promise<NormalizedAlert[]>;
	listTargets?(): Promise<ObservabilityTargetView[]>;
}

/** Configuration surface, kept separate from reads and destructive ops. */
export interface ObservabilityConfigurator {
	testConnection(): Promise<{
		ok: boolean;
		capabilities: ObservabilityProviderCapabilities;
		error?: string;
	}>;
}

/** Destructive stack operations. Implementations must confirm before acting. */
export interface ObservabilityAdmin {
	requiresConfirmation(action: "delete" | "reset" | "rotate-secrets"): true;
}
