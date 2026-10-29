/**
 * Domain types for Notploy Voyager
 *
 * This file contains the core domain models shared across the Voyager application.
 * It mirrors the types used in the Desktop app but adapted for React Native.
 */

// ============================================================================
// Connection Types
// ============================================================================

/**
 * How a connection was created. Presentation only.
 */
export type ConnectionKind = "cloud" | "self-hosted" | "local" | "custom";

/**
 * Status of a connection to a Notploy instance.
 */
export type ConnectionStatus =
	| "unknown"
	| "checking"
	| "connected"
	| "disconnected"
	| "unavailable"
	| "error";

/**
 * A connection to a Notploy instance, as stored locally.
 * API keys are NOT part of this object - they are stored securely.
 */
export interface Connection {
	id: string;
	name: string;
	/** Instance origin, without a trailing slash and without /api */
	url: string;
	kind: ConnectionKind;
	/** True when the user asked to skip TLS verification for this instance */
	allowInsecureTls: boolean;
	/** Milliseconds before a request to this instance is aborted */
	timeout: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * A connection plus everything the UI needs to render its state.
 */
export interface ConnectionSummary extends Connection {
	active: boolean;
	hasCredential: boolean;
	status: ConnectionStatus;
	version?: string;
	cloud?: boolean;
	capabilities?: InstanceCapabilities;
	lastCheckedAt?: string;
	/** User-facing failure message from the last check, when there was one */
	error?: string;
}

/**
 * Input for creating a new connection.
 */
export interface ConnectionInput {
	name: string;
	url: string;
	kind?: ConnectionKind;
	allowInsecureTls?: boolean;
	timeout?: number;
	/** Optional API key; stored securely, never in the config */
	apiKey?: string;
}

/**
 * Input for updating an existing connection.
 */
export interface ConnectionUpdate {
	name?: string;
	url?: string;
	kind?: ConnectionKind;
	allowInsecureTls?: boolean;
	timeout?: number;
	/** null clears the stored credential; undefined leaves it untouched */
	apiKey?: string | null;
}

// ============================================================================
// Instance Capabilities
// ============================================================================

/**
 * Capabilities reported by a Notploy instance.
 * These indicate which API routes and features are available.
 */
export interface InstanceCapabilities {
	// Core features
	deployments: boolean;
	logs: boolean;

	// Container features
	docker: boolean;
	dockerImages: boolean;
	dockerVolumes: boolean;
	networks: boolean;
	servers: boolean;
	swarm: boolean;

	// Project features
	compose: boolean;
	environments: boolean;

	// Notification features
	notifications: boolean;

	// Database features
	databases: boolean;
	postgres: boolean;
	mysql: boolean;
	mariadb: boolean;
	mongo: boolean;
	redis: boolean;
	libsql: boolean;

	// Additional features
	schedules: boolean;
	tags: boolean;
	certificates: boolean;
	sshKeys: boolean;
	registries: boolean;
	destinations: boolean;

	// Enterprise features
	auditLogs: boolean;
	cloud: boolean;

	// Kubernetes (reserved for future use)
	kubernetes: boolean;
}

/** Empty capabilities - no features available */
export const EMPTY_CAPABILITIES: InstanceCapabilities = {
	deployments: false,
	logs: false,
	docker: false,
	dockerImages: false,
	dockerVolumes: false,
	networks: false,
	servers: false,
	swarm: false,
	compose: false,
	environments: false,
	notifications: false,
	databases: false,
	postgres: false,
	mysql: false,
	mariadb: false,
	mongo: false,
	redis: false,
	libsql: false,
	schedules: false,
	tags: false,
	certificates: false,
	sshKeys: false,
	registries: false,
	destinations: false,
	auditLogs: false,
	cloud: false,
	kubernetes: false,
};

/** Report from probing an instance's capabilities */
export interface CapabilityReport {
	capabilities: InstanceCapabilities;
	/** Router names the instance exposes, sorted */
	routers: string[];
	source: "openapi" | "probe";
	version?: string;
	/** Routers that answered with a permission error while probing */
	restricted: string[];
	/** Human-readable notes about anything that could not be determined */
	notes: string[];
}

// ============================================================================
// Authentication Types
// ============================================================================

/** User session information */
export interface UserSession {
	id: string;
	email?: string;
	name?: string;
	role?: string;
	/** Whether this is a cloud user */
	cloud?: boolean;
	/** Whether 2FA is enabled */
	twoFactorEnabled?: boolean;
	/** Whether email is verified */
	emailVerified?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

/** Authentication credentials for an instance */
export interface InstanceAuth {
	/** The connection ID this auth belongs to */
	connectionId: string;
	/** API token for authentication */
	apiToken?: string;
	/** Session token (if using session-based auth) */
	sessionToken?: string;
	/** User information from the session */
	user?: UserSession;
	/** When the session expires */
	expiresAt?: string;
}

/** Authentication method */
export type AuthMethod = "api-key" | "session" | "none";

/** Authentication status */
export type AuthStatus = "unauthenticated" | "authenticated" | "expired" | "error";

// ============================================================================
// API Types
// ============================================================================

/** Generic API response wrapper */
export interface ApiResponse<T> {
	data?: T;
	error?: ApiError;
	message?: string;
}

/** API error structure */
export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
	timestamp?: string;
}

/** Paginated response */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

/** Query parameters for paginated requests */
export interface PaginationParams {
	page?: number;
	pageSize?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

/** Filter parameters */
export interface FilterParams {
	search?: string;
	status?: string | string[];
	type?: string | string[];
	[key: string]: unknown;
}

// ============================================================================
// Project Types
// ============================================================================

/** Project status */
export type ProjectStatus = "active" | "inactive" | "paused" | "error" | "deploying" | "building";

/** Project deployment type */
export type ProjectType = "application" | "compose" | "server" | "database";

/** Project information */
export interface Project {
	id: string;
	name: string;
	description?: string;
	status: ProjectStatus;
	type: ProjectType;
	/** Git repository URL */
	repository?: string;
	/** Branch to deploy */
	branch?: string;
	/** Docker image or build context */
	image?: string;
	/** Dockerfile path */
	dockerfile?: string;
	/** Build args */
	buildArgs?: Record<string, string>;
	/** Environment variables */
	env?: Record<string, string>;
	/** Port mappings */
	ports?: ProjectPort[];
	/** Volume mounts */
	mounts?: ProjectMount[];
	/** Number of replicas */
	replicas?: number;
	/** Resource limits */
	resources?: ResourceLimits;
	/** Health check configuration */
	healthCheck?: HealthCheck;
	/** Auto-deploy settings */
	autoDeploy?: boolean;
	/** Last deployment info */
	lastDeployment?: Deployment;
	/** Created timestamp */
	createdAt: string;
	/** Updated timestamp */
	updatedAt: string;
}

/** Project port mapping */
export interface ProjectPort {
	containerPort: number;
	hostPort: number;
	protocol: "tcp" | "udp";
	publish?: boolean;
}

/** Project volume mount */
export interface ProjectMount {
	source: string;
	target: string;
	type: "bind" | "volume" | "tmpfs";
	readOnly?: boolean;
}

/** Resource limits */
export interface ResourceLimits {
	cpu?: number | string;
	memory?: number | string;
	/** In bytes */
	storage?: number;
}

/** Health check configuration */
export interface HealthCheck {
	type: "http" | "tcp" | "cmd" | "none";
	interval?: number; // seconds
	timeout?: number; // seconds
	retries?: number;
	startPeriod?: number; // seconds
	/** For http type */
	path?: string;
	/** For http type */
	port?: number;
	/** For http type */
	expectedStatus?: number | number[];
	/** For cmd type */
	command?: string[];
}

/** Minimal project info for lists */
export interface ProjectSummary {
	id: string;
	name: string;
	status: ProjectStatus;
	type: ProjectType;
	lastDeployedAt?: string;
	lastDeploymentStatus?: DeploymentStatus;
}

// ============================================================================
// Deployment Types
// ============================================================================

/** Deployment status */
export type DeploymentStatus =
	| "pending"
	| "building"
	| "deploying"
	| "starting"
	| "running"
	| "stopped"
	| "error"
	| "failed"
	| "cancelled"
	| "completed"
	| "rolled_back";

/** Deployment trigger type */
export type DeploymentTrigger = "manual" | "auto" | "webhook" | "schedule" | "redeploy";

/** Deployment information */
export interface Deployment {
	id: string;
	projectId: string;
	projectName?: string;
	status: DeploymentStatus;
	trigger: DeploymentTrigger;
	/** Git commit hash */
	commitHash?: string;
	/** Git commit message */
	commitMessage?: string;
	/** Git author */
	commitAuthor?: string;
	/** Git branch */
	branch?: string;
	/** Tag */
	tag?: string;
	/** Docker image */
	image?: string;
	/** Build ID */
	buildId?: string;
	/** Started timestamp */
	startedAt?: string;
	/** Completed timestamp */
	completedAt?: string;
	/** Duration in seconds */
	duration?: number;
	/** Error message if failed */
	errorMessage?: string;
	/** Error details */
	errorDetails?: string;
	/** Deployment logs */
	logs?: LogEntry[];
	/** Created timestamp */
	createdAt: string;
	/** Updated timestamp */
	updatedAt: string;
}

/** Minimal deployment info for lists */
export interface DeploymentSummary {
	id: string;
	projectId: string;
	projectName: string;
	status: DeploymentStatus;
	trigger: DeploymentTrigger;
	startedAt?: string;
	completedAt?: string;
}

// ============================================================================
// Container Types
// ============================================================================

/** Container status */
export type ContainerStatus =
	| "created"
	| "running"
	| "paused"
	| "restarting"
	| "removing"
	| "exited"
	| "dead";

/** Container health status */
export type ContainerHealthStatus = "starting" | "healthy" | "unhealthy" | "none";

/** Container information */
export interface Container {
	id: string;
	name: string;
	status: ContainerStatus;
	image?: string;
	command?: string[];
	createdAt: string;
	startedAt?: string;
	finishedAt?: string;
	exitCode?: number;
	ports?: ContainerPort[];
	mounts?: ContainerMount[];
	networks?: string[];
	labels?: Record<string, string>;
	health?: ContainerHealth;
	resources?: ContainerResources;
}

/** Container port */
export interface ContainerPort {
	containerPort: number;
	hostPort?: number;
	protocol: "tcp" | "udp";
	ip?: string;
}

/** Container mount */
export interface ContainerMount {
	source: string;
	target: string;
	type: "bind" | "volume" | "tmpfs";
	readOnly: boolean;
	size?: number;
}

/** Container health check */
export interface ContainerHealth {
	status: ContainerHealthStatus;
	failingStreak?: number;
	log?: string[];
}

/** Container resource usage */
export interface ContainerResources {
	cpu?: number; // percentage
	memory?: number; // bytes
	memoryLimit?: number; // bytes
	cpuLimit?: number; // percentage
}

// ============================================================================
// Service Types
// ============================================================================

/** Service status */
export type ServiceStatus = "running" | "stopped" | "paused" | "error" | "starting" | "updating";

/** Service information */
export interface Service {
	id: string;
	name: string;
	status: ServiceStatus;
	image?: string;
	replicas?: number;
	desiredReplicas?: number;
	ports?: ServicePort[];
	networks?: string[];
	labels?: Record<string, string>;
	containers?: Container[];
	createdAt: string;
	updatedAt: string;
}

/** Service port */
export interface ServicePort {
	publishedPort: number;
	targetPort: number;
	protocol: "tcp" | "udp";
	publishMode?: "ingress" | "host";
}

// ============================================================================
// Log Types
// ============================================================================

/** Log entry */
export interface LogEntry {
	id?: string;
	timestamp: string;
	level: LogLevel;
	message: string;
	source?: string;
	service?: string;
	container?: string;
	deploymentId?: string;
	projectId?: string;
}

/** Log level */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/** Log filter options */
export interface LogFilter {
	since?: string | Date;
	until?: string | Date;
	level?: LogLevel | LogLevel[];
	search?: string;
	limit?: number;
	follow?: boolean;
}

// ============================================================================
// Monitoring Types
// ============================================================================

/** Metric type */
export type MetricType = "cpu" | "memory" | "storage" | "network" | "requests" | "errors";

/** Metric data point */
export interface MetricDataPoint {
	timestamp: string;
	value: number;
}

/** Metric information */
export interface Metric {
	type: MetricType;
	label?: string;
	unit?: string;
	data: MetricDataPoint[];
	current?: number;
	min?: number;
	max?: number;
	avg?: number;
}

/** Resource metrics */
export interface ResourceMetrics {
	cpu?: Metric;
	memory?: Metric;
	storage?: Metric;
	networkIn?: Metric;
	networkOut?: Metric;
}

/** System health */
export interface SystemHealth {
	status: "healthy" | "degraded" | "unhealthy" | "unknown";
	checks?: HealthCheckResult[];
	version?: string;
	uptime?: number;
}

/** Health check result */
export interface HealthCheckResult {
	name: string;
	status: "pass" | "fail" | "warn" | "skip";
	message?: string;
	duration?: number;
}

// ============================================================================
// Alert Types
// ============================================================================

/** Alert severity */
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

/** Alert status */
export type AlertStatus = "firing" | "resolved" | "acknowledged" | "silenced";

/** Alert information */
export interface Alert {
	id: string;
	title: string;
	description?: string;
	severity: AlertSeverity;
	status: AlertStatus;
	/** When the alert started */
	startsAt: string;
	/** When the alert ended */
	endsAt?: string;
	/** When the alert was last updated */
	updatedAt?: string;
	/** Related resource */
	resourceType?: string;
	resourceId?: string;
	resourceName?: string;
	/** Whether this alert has been acknowledged */
	acknowledged?: boolean;
	acknowledgedAt?: string;
	acknowledgedBy?: string;
	/** Whether this alert is silenced */
	silenced?: boolean;
	silencedAt?: string;
	silencedBy?: string;
}

/** Minimal alert info for lists */
export interface AlertSummary {
	id: string;
	title: string;
	severity: AlertSeverity;
	status: AlertStatus;
	startsAt: string;
	resourceType?: string;
	resourceName?: string;
}

// ============================================================================
// Activity Types
// ============================================================================

/** Activity event type */
export type ActivityType =
	| "deployment_started"
	| "deployment_completed"
	| "deployment_failed"
	| "project_created"
	| "project_updated"
	| "project_deleted"
	| "container_started"
	| "container_stopped"
	| "container_error"
	| "service_created"
	| "service_updated"
	| "service_deleted"
	| "alert_firing"
	| "alert_resolved"
	| "user_login"
	| "user_logout"
	| "settings_updated";

/** Activity event */
export interface ActivityEvent {
	id: string;
	type: ActivityType;
	title: string;
	description?: string;
	/** Related resource */
	resourceType?: string;
	resourceId?: string;
	resourceName?: string;
	/** User who triggered the event */
	userId?: string;
	userName?: string;
	userEmail?: string;
	/** When the event occurred */
	timestamp: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/** Minimal activity info for lists */
export interface ActivitySummary {
	id: string;
	type: ActivityType;
	title: string;
	timestamp: string;
	resourceType?: string;
	resourceName?: string;
}

// ============================================================================
// Notification Types
// ============================================================================

/** Push notification */
export interface PushNotification {
	id: string;
	title: string;
	body: string;
	/** Data payload */
	data?: Record<string, string>;
	/** When the notification was sent */
	sentAt: string;
	/** When the notification was received */
	receivedAt?: string;
	/** Whether the notification was opened */
	opened?: boolean;
	/** Whether the notification was read */
	read?: boolean;
}

/** Notification preferences */
export interface NotificationPreferences {
	enabled: boolean;
	sound: boolean;
	badge: boolean;
	vibrate: boolean;
	/** Specific notification types to enable/disable */
	types: {
		deployment?: boolean;
		alert?: boolean;
		error?: boolean;
		info?: boolean;
	};
}

// ============================================================================
// Settings Types
// ============================================================================

/** Application settings */
export interface AppSettings {
	/** Theme preference */
	theme: "system" | "light" | "dark";
	/** Language preference */
	language: string;
	/** Whether to use biometric authentication */
	biometricAuth: boolean;
	/** Default connection timeout in ms */
	defaultTimeout: number;
	/** Whether to allow insecure TLS */
	allowInsecureTls: boolean;
	/** Notification preferences */
	notifications: NotificationPreferences;
}

/** Default settings */
export const DEFAULT_SETTINGS: AppSettings = {
	theme: "system",
	language: "en",
	biometricAuth: false,
	defaultTimeout: 30000,
	allowInsecureTls: false,
	notifications: {
		enabled: true,
		sound: true,
		badge: true,
		vibrate: true,
		types: {
			deployment: true,
			alert: true,
			error: true,
			info: false,
		},
	},
};

// ============================================================================
// State Types
// ============================================================================

/** Loading state */
export type LoadingState = "idle" | "loading" | "success" | "error";

/** Async operation state */
export interface AsyncState<T, E = Error> {
	status: LoadingState;
	data?: T;
	error?: E;
	isLoading: boolean;
	isSuccess: boolean;
	isError: boolean;
}

/** Refresh state */
export interface RefreshState {
	isRefreshing: boolean;
	lastRefreshedAt?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** ISO 8601 date string */
export type ISODateString = string;

/** UUID string */
export type UUID = string;

/** Dictionary type */
export type Dictionary<T> = Record<string, T>;

/** Maybe type (nullable) */
export type Maybe<T> = T | null | undefined;

/** Either type (union) */
export type Either<A, B> = A | B;

/** Tuple type */
export type Tuple<T, U> = [T, U];

/** Make all properties optional */
export type Partial<T> = {
	[P in keyof T]?: T[P];
};

/** Make all properties required */
export type Required<T> = {
	[P in keyof T]-?: T[P];
};

/** Make some properties required */
export type RequiredPick<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Make some properties optional */
export type OptionalPick<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep partial */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Value of an object */
export type ValueOf<T> = T[keyof T];
