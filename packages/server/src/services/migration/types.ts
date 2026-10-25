/**
 * Common migration engine contracts.
 *
 * The engine is interface-independent: installer, CLI, API and Web UI are
 * clients of the same domain services and orchestration. No interface owns
 * its own copy of the migration logic.
 *
 * Design rules enforced here:
 * - read-only inspection first, dry-run never mutates;
 * - configuration, persistent data and traffic cutover are distinct steps
 *   with distinct validations;
 * - no silent translation: without a faithful equivalent the resource is
 *   flagged, never approximated as automatic;
 * - secrets never appear in logs, reports, CLI output or errors;
 * - every significant operation is auditable without sensitive data.
 */

export type MigrationDirection = "dokploy-to-notploy" | "notploy-to-dokploy";

export type InstallationProduct = "dokploy" | "notploy" | "unknown";

export type InstallationType = "swarm" | "compose" | "docker" | "unknown";

export type DetectionConfidence = "low" | "medium" | "high";

export interface DetectedInstallation {
	product: InstallationProduct;
	version: string;
	installationType: InstallationType;
	confidence: DetectionConfidence;
	evidence: string[];
}

export type MigrationResourceKind =
	| "server"
	| "project"
	| "environment"
	| "application"
	| "compose"
	| "git-provider"
	| "registry"
	| "env-vars"
	| "secret"
	| "domain"
	| "port"
	| "routing"
	| "certificate"
	| "volume"
	| "network"
	| "database"
	| "health-check"
	| "deployment-history";

export type CompatibilityStatus =
	| "automatic"
	| "action-required"
	| "blocking"
	| "unsupported"
	| "to-verify";

export interface MigrationResource {
	/** Stable id within the inventory (e.g. `compose:my-stack`). */
	id: string;
	kind: MigrationResourceKind;
	name: string;
	/** Which platform object it came from, for traceability. */
	sourceRef?: string;
	/** Metadata safe to persist and display. Never contains secret values. */
	metadata: Record<string, string | number | boolean | null>;
	/** True when Docker metadata proves platform ownership. */
	attributed: boolean;
}

export interface MigrationInventory {
	direction: MigrationDirection;
	source: DetectedInstallation;
	resources: MigrationResource[];
	unattributedCount: number;
	/** Resource ids that are stopped and cannot be reconstructed as-is. */
	stoppedResourceIds: string[];
	collectedAt: string;
}

export interface CompatibilityFinding {
	resourceId: string;
	kind: MigrationResourceKind;
	status: CompatibilityStatus;
	reason: string;
	expectedAction: string;
	blocking: boolean;
	impact: string;
}

export interface CompatibilityReport {
	inventoryId: string;
	direction: MigrationDirection;
	findings: CompatibilityFinding[];
	summary: Record<CompatibilityStatus, number>;
	/** Human-readable manual steps, in order. */
	manualActions: string[];
	/** Hard blockers that make migration unsafe until resolved. */
	blockers: string[];
	/** Destination capabilities that were evaluated. */
	evaluatedCapabilities: string[];
	generatedAt: string;
}

export type MigrationOperationKind =
	| "create-project"
	| "create-environment"
	| "create-application"
	| "create-compose"
	| "create-database"
	| "restore-database"
	| "copy-volume"
	| "copy-bind-mount"
	| "recreate-network"
	| "add-domain"
	| "issue-certificate"
	| "configure-routing"
	| "transfer-secret-reference";

export interface MigrationOperation {
	id: string;
	kind: MigrationOperationKind;
	resourceId: string;
	title: string;
	/** Explicit dependencies: operation ids that must succeed first. */
	dependsOn: string[];
	/** Config vs data vs cutover. These never mix in one operation. */
	phase: "configuration" | "data" | "cutover";
	/** Destructive or production-impacting operations require confirmation. */
	requiresConfirmation: boolean;
	risks: string[];
	/** Idempotency key: re-running with the same key never duplicates. */
	idempotencyKey: string;
	/** Conflict description when the destination already has the resource. */
	conflict?: string;
}

export interface MigrationPlan {
	inventoryId: string;
	direction: MigrationDirection;
	operations: MigrationOperation[];
	/** Ordered manual steps that the engine cannot automate. */
	manualSteps: string[];
	/** Data transfer steps are listed separately from configuration. */
	dataTransfer: string[];
	estimatedRisk: "low" | "medium" | "high";
	createdAt: string;
}

export type MigrationPhase =
	| "detected"
	| "inventoried"
	| "compatibility-reported"
	| "planned"
	| "plan-validated"
	| "destination-prepared"
	| "imported"
	| "health-validated"
	| "cutover-confirmed"
	| "completed"
	| "failed";

export type OperationResultStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface OperationResult {
	operationId: string;
	status: OperationResultStatus;
	/** Redacted log lines, never containing secret values. */
	log: string[];
	error?: string;
	completedAt?: string;
}

export interface MigrationRecord {
	id: string;
	direction: MigrationDirection;
	phase: MigrationPhase;
	inventory: MigrationInventory | null;
	compatibility: CompatibilityReport | null;
	plan: MigrationPlan | null;
	/** Explicit user confirmations, with timestamps. Never contains secrets. */
	confirmations: Array<{ step: string; at: string; actor?: string }>;
	results: OperationResult[];
	/** Recovery instructions for partial failures. */
	recovery: string[];
	createdAt: string;
	updatedAt: string;
}

export interface CapabilityMatrix {
	/** Capability id -> supported. Adapters must declare limits explicitly. */
	capabilities: Record<string, boolean>;
	/** Human-readable limits, e.g. supported Dokploy versions. */
	limits: string[];
	supportedVersions?: string[];
}

/**
 * Source adapter: read-only detection, inspection and inventory extraction.
 * Implementations must never create, update or remove anything.
 */
export interface MigrationSourceAdapter {
	readonly product: InstallationProduct;
	readonly direction: MigrationDirection;
	detect(): Promise<DetectedInstallation>;
	inventory(detected: DetectedInstallation): Promise<MigrationInventory>;
	capabilities(): CapabilityMatrix;
}

/**
 * Destination adapter: capability verification, preparation and application
 * of compatible resources. Each platform pair gets its own adapter; an
 * import adapter is never reused blindly as an export adapter.
 */
export interface MigrationDestinationAdapter {
	readonly product: InstallationProduct;
	readonly direction: MigrationDirection;
	capabilities(): CapabilityMatrix;
	/** Verify destination before anything is applied. */
	verifyDestination(): Promise<{ ok: boolean; errors: string[] }>;
	/** Dry-run: return planned changes without applying them. */
	preview(
		inventory: MigrationInventory,
		compatibility: CompatibilityReport,
	): Promise<MigrationPlan>;
}

export interface AuditEvent {
	type: string;
	migrationId: string;
	phase: MigrationPhase;
	/** Redacted metadata. Never contains secrets. */
	metadata: Record<string, unknown>;
	at: string;
}
