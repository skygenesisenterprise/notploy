import { redactObject, redactSecrets, safeErrorMessage } from "../../utils/security/redact";
import { buildCompatibilityReport, buildMigrationPlan } from "./planning";
import type {
  AuditEvent,
  CompatibilityReport,
  DetectedInstallation,
  MigrationDestinationAdapter,
  MigrationInventory,
  MigrationPhase,
  MigrationPlan,
  MigrationRecord,
  MigrationSourceAdapter,
  OperationResult,
} from "./types";

function now(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export interface EngineEvents {
  audit?: (event: AuditEvent) => void;
}

export class MigrationEngine {
  private records = new Map<string, MigrationRecord>();
  constructor(private events?: EngineEvents) {}

  private emit(migrationId: string, phase: MigrationPhase, type: string, metadata: Record<string, unknown>): void {
    const safe = redactObject(metadata);
    this.events?.audit?.({ type, migrationId, phase, metadata: safe, at: now() });
  }

  createRecord(direction: MigrationRecord["direction"]): MigrationRecord {
    const record: MigrationRecord = {
      id: newId("mig"),
      direction,
      phase: "detected",
      inventory: null,
      compatibility: null,
      plan: null,
      confirmations: [],
      results: [],
      recovery: [],
      createdAt: now(),
      updatedAt: now(),
    };
    this.records.set(record.id, record);
    this.emit(record.id, record.phase, "migration.created", { direction });
    return structuredClone(record);
  }

  getRecord(id: string): MigrationRecord | null {
    const r = this.records.get(id);
    return r ? structuredClone(r) : null;
  }

  private mutate(id: string, fn: (r: MigrationRecord) => void): MigrationRecord {
    const r = this.records.get(id);
    if (!r) throw new Error(`Migration ${id} not found`);
    fn(r);
    r.updatedAt = now();
    return structuredClone(r);
  }

  async detectInventory(
    id: string,
    source: MigrationSourceAdapter,
  ): Promise<{ detected: DetectedInstallation; inventory: MigrationInventory }> {
    const detected = await source.detect();
    const inventory = await source.inventory(detected);
    this.mutate(id, (r) => {
      r.inventory = inventory;
      r.phase = "inventoried";
    });
    this.emit(id, "inventoried", "migration.inventoried", {
      resources: inventory.resources.length,
      unattributed: inventory.unattributedCount,
      product: detected.product,
    });
    return { detected, inventory };
  }

  reportCompatibility(id: string, destination: MigrationDestinationAdapter): CompatibilityReport {
    const record = this.records.get(id);
    if (!record?.inventory) throw new Error("Inventory required before compatibility report");
    const report = buildCompatibilityReport(record.inventory, destination.capabilities());
    this.mutate(id, (r) => {
      r.compatibility = report;
      r.phase = "compatibility-reported";
    });
    this.emit(id, "compatibility-reported", "migration.compatibility", {
      summary: report.summary,
      blockers: report.blockers.length,
    });
    return structuredClone(report);
  }

  async buildPlan(
    id: string,
    destinationOrPlan: MigrationDestinationAdapter | MigrationPlan,
  ): Promise<MigrationPlan> {
    const record = this.records.get(id);
    if (!record?.inventory || !record?.compatibility) {
      throw new Error("Inventory and compatibility required before planning");
    }
    let plan: MigrationPlan;
    if ("preview" in (destinationOrPlan as object)) {
      const verify = await (destinationOrPlan as MigrationDestinationAdapter).verifyDestination();
      if (!verify.ok) {
        this.mutate(id, (r) => {
          r.phase = "failed";
          r.recovery = verify.errors;
        });
        throw new Error(`Destination verification failed: ${verify.errors.join("; ")}`);
      }
      plan = await (destinationOrPlan as MigrationDestinationAdapter).preview(
        record.inventory,
        record.compatibility,
      );
    } else {
      plan = destinationOrPlan as MigrationPlan;
    }
    const safePlan = redactObject(plan);
    this.mutate(id, (r) => {
      r.plan = safePlan as MigrationPlan;
      r.phase = "planned";
    });
    this.emit(id, "planned", "migration.planned", {
      operations: plan.operations.length,
      risk: plan.estimatedRisk,
    });
    return structuredClone(plan);
  }

  confirmPlan(id: string, actor?: string): MigrationRecord {
    const record = this.records.get(id);
    if (!record?.plan) throw new Error("Plan required before confirmation");
    if (record.compatibility && record.compatibility.blockers.length > 0) {
      throw new Error("Plan has blocking findings; resolve blockers before confirming");
    }
    return this.mutate(id, (r) => {
      r.confirmations.push({ step: "plan-validated", at: now(), actor });
      r.phase = "plan-validated";
    });
  }

  confirmStep(id: string, step: "destination-prepared" | "cutover-confirmed" | "completed", actor?: string): MigrationRecord {
    const allowed: Record<string, MigrationPhase> = {
      "destination-prepared": "destination-prepared",
      "cutover-confirmed": "cutover-confirmed",
      completed: "completed",
    };
    return this.mutate(id, (r) => {
      r.confirmations.push({ step, at: now(), actor });
      r.phase = allowed[step] ?? r.phase;
    });
  }

  dryRun(id: string): { operations: string[]; manualSteps: string[]; dataTransfer: string[] } {
    const record = this.records.get(id);
    if (!record?.plan) throw new Error("Plan required for dry-run");
    return {
      operations: record.plan.operations.map((o) => `${o.phase}:${o.kind}:${o.resourceId}`),
      manualSteps: [...record.plan.manualSteps],
      dataTransfer: [...record.plan.dataTransfer],
    };
  }

  startExecution(id: string): MigrationRecord {
    const record = this.records.get(id);
    if (!record?.plan) throw new Error("Plan required before execution");
    if (!record.confirmations.some((c) => c.step === "plan-validated")) {
      throw new Error("Explicit plan validation required before execution");
    }
    const results: OperationResult[] = record.plan.operations.map((o) => ({
      operationId: o.id,
      status: "pending",
      log: [],
    }));
    return this.mutate(id, (r) => {
      r.results = results;
      r.phase = "imported";
    });
  }

  applyOperationResult(
    id: string,
    operationId: string,
    status: OperationResult["status"],
    logLine?: string,
    error?: unknown,
  ): MigrationRecord {
    return this.mutate(id, (r) => {
      const existing = r.results.find((x) => x.operationId === operationId);
      const redactedLog = logLine ? redactSecrets(logLine) : undefined;
      const redactedError = error ? safeErrorMessage(error) : undefined;
      if (!existing) {
        r.results.push({
          operationId,
          status,
          log: redactedLog ? [redactedLog] : [],
          error: redactedError,
          completedAt: status === "done" || status === "error" ? now() : undefined,
        });
      } else {
        existing.status = status;
        if (redactedLog) existing.log.push(redactedLog);
        if (redactedError) existing.error = redactedError;
        if (status === "done" || status === "error") existing.completedAt = now();
      }
      const failed = r.results.some((x) => x.status === "error");
      if (failed) {
        r.phase = "failed";
        r.recovery = [
          "Identify succeeded vs failed operations in record.results.",
          "Fix blockers, then resume with the same idempotency keys.",
          "Source remains available until explicit completion confirmation.",
        ];
      }
    });
  }

  resume(id: string): { pending: string[]; done: string[]; failed: string[] } {
    const record = this.records.get(id);
    if (!record) throw new Error(`Migration ${id} not found`);
    const pending = record.results.filter((x) => x.status === "pending" || x.status === "running").map((x) => x.operationId);
    const done = record.results.filter((x) => x.status === "done").map((x) => x.operationId);
    const failed = record.results.filter((x) => x.status === "error").map((x) => x.operationId);
    this.emit(id, record.phase, "migration.resume", { pending: pending.length, done: done.length, failed: failed.length });
    return { pending, done, failed };
  }

  validateHealth(id: string, checks: Array<{ name: string; ok: boolean; detail?: string }>): MigrationRecord {
    const failed = checks.filter((c) => !c.ok);
    return this.mutate(id, (r) => {
      if (failed.length > 0) {
        r.phase = "failed";
        r.recovery = failed.map((f) => `Health check failed: ${redactSecrets(f.name)} - ${redactSecrets(f.detail ?? "")}`);
      } else {
        r.phase = "health-validated";
      }
    });
  }
}
