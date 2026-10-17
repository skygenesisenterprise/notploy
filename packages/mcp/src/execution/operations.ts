import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { VerificationOutcome } from "../contracts/capability.js";
import type { Environment } from "../contracts/core.js";
import {
  type OperationScope,
  type OperationView,
  type StoredOperation,
  type StoredOperationStatus,
  toOperationView,
} from "../contracts/operation.js";
import type { ToolError } from "../contracts/result.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("OperationStore");

const STORE_VERSION = 1;
const MAX_OPERATIONS = 1_000;

interface StoreFile {
  version: number;
  operations: StoredOperation[];
}

export interface OperationStoreOptions {
  /** When set, operations survive restarts in this JSON file. */
  path?: string;
  retentionMs: number;
  maxEntries?: number;
}

export interface CreateOperationInput {
  capability: string;
  status: StoredOperationStatus;
  identityId: string;
  organizationId: string;
  environment: Environment;
  requestId: string;
  idempotencyKey?: string;
  resourceIds?: Record<string, string>;
  data?: unknown;
  error?: ToolError;
  verification?: VerificationOutcome;
}

type OperationUpdate = Partial<
  Pick<
    StoredOperation,
    "status" | "data" | "error" | "verification" | "completedAt" | "resourceIds"
  >
>;

/**
 * Process-wide operation registry.
 *
 * With `NOTPLOY_MCP_OPERATION_STORE` set, the registry is persisted as JSON and
 * reloaded at startup. Without it, state is in memory only: restarts lose the
 * history and multiple instances do not share it. Both limits are documented.
 */
export class OperationStore {
  private readonly operations = new Map<string, StoredOperation>();
  private readonly options: OperationStoreOptions;
  private loadPromise: Promise<void> | undefined;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: OperationStoreOptions) {
    this.options = options;
  }

  async init(): Promise<void> {
    await this.ensureLoaded();
  }

  async create(input: CreateOperationInput): Promise<StoredOperation> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const operation: StoredOperation = {
      id: randomUUID(),
      capability: input.capability,
      status: input.status,
      identityId: input.identityId,
      organizationId: input.organizationId,
      environment: input.environment,
      requestId: input.requestId,
      createdAt: now,
      updatedAt: now,
      resourceIds: input.resourceIds ?? {},
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.data !== undefined ? { data: input.data } : {}),
      ...(input.error ? { error: input.error } : {}),
      ...(input.verification ? { verification: input.verification } : {}),
    };

    this.operations.set(operation.id, operation);
    this.prune();
    await this.persist();
    return operation;
  }

  async update(id: string, patch: OperationUpdate): Promise<StoredOperation | undefined> {
    await this.ensureLoaded();
    const current = this.operations.get(id);
    if (!current) return undefined;

    const updated: StoredOperation = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      ...(patch.status && patch.status !== "running"
        ? { completedAt: patch.completedAt ?? new Date().toISOString() }
        : {}),
    };
    this.operations.set(id, updated);
    this.prune();
    await this.persist();
    return updated;
  }

  async getScoped(id: string, scope: OperationScope): Promise<StoredOperation | undefined> {
    await this.ensureLoaded();
    const operation = this.operations.get(id);
    if (!operation) return undefined;
    // An operation id is not a capability: a different identity or workspace
    // must not be able to read its state or results.
    if (
      operation.identityId !== scope.identityId ||
      operation.organizationId !== scope.organizationId
    ) {
      return undefined;
    }
    return operation;
  }

  async findByIdempotencyKey(key: string): Promise<StoredOperation | undefined> {
    await this.ensureLoaded();
    for (const operation of this.operations.values()) {
      if (operation.idempotencyKey === key) return operation;
    }
    return undefined;
  }

  async listViews(scope: OperationScope, limit = 20): Promise<OperationView[]> {
    await this.ensureLoaded();
    return [...this.operations.values()]
      .filter(
        (operation) =>
          operation.identityId === scope.identityId &&
          operation.organizationId === scope.organizationId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toOperationView);
  }

  async markRunningAsInterrupted(): Promise<void> {
    await this.ensureLoaded();
    let changed = false;
    for (const [id, operation] of this.operations) {
      if (operation.status === "running") {
        this.operations.set(id, {
          ...operation,
          status: "interrupted",
          error: {
            code: "internal_error",
            message: "The MCP server restarted while this operation was running",
            retryable: true,
          },
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  /** Waits for pending writes; used by tests and graceful shutdown. */
  async close(): Promise<void> {
    await this.writeChain;
  }

  private async ensureLoaded(): Promise<void> {
    this.loadPromise ??= this.load();
    await this.loadPromise;
  }

  private async load(): Promise<void> {
    const path = this.options.path;
    if (!path) return;

    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as StoreFile;
      if (!parsed || parsed.version !== STORE_VERSION || !Array.isArray(parsed.operations)) {
        throw new Error("unsupported operation store format");
      }
      for (const operation of parsed.operations) {
        if (operation?.id) this.operations.set(operation.id, operation);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      throw new Error(`Could not read NOTPLOY_MCP_OPERATION_STORE at ${path}`, { cause: error });
    }
  }

  private prune(): void {
    const cutoff = Date.now() - this.options.retentionMs;
    for (const [id, operation] of this.operations) {
      if (Date.parse(operation.updatedAt) < cutoff) this.operations.delete(id);
    }

    if (this.operations.size <= (this.options.maxEntries ?? MAX_OPERATIONS)) return;
    const oldest = [...this.operations.values()]
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, this.operations.size - (this.options.maxEntries ?? MAX_OPERATIONS));
    for (const operation of oldest) this.operations.delete(operation.id);
  }

  private async persist(): Promise<void> {
    const path = this.options.path;
    if (!path) return;

    const snapshot: StoreFile = {
      version: STORE_VERSION,
      operations: [...this.operations.values()],
    };

    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        try {
          await mkdir(dirname(path), { recursive: true });
          const temporary = `${path}.${process.pid}.tmp`;
          await writeFile(temporary, JSON.stringify(snapshot), { encoding: "utf8", mode: 0o600 });
          await rename(temporary, path);
        } catch (error) {
          // Persistence is an availability feature, not an authorization one:
          // keep the in-memory state and surface the failure in logs.
          logger.error("Could not persist operation store", {
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      });

    await this.writeChain;
  }
}
