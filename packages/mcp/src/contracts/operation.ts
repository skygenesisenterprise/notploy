import type { VerificationOutcome } from "./capability.js";
import type { Environment } from "./core.js";
import type { ToolError } from "./result.js";

export type StoredOperationStatus = "running" | "succeeded" | "failed" | "interrupted";

export interface StoredOperation {
  id: string;
  capability: string;
  status: StoredOperationStatus;
  identityId: string;
  organizationId: string;
  environment: Environment;
  requestId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  idempotencyKey?: string;
  resourceIds: Record<string, string>;
  data?: unknown;
  error?: ToolError;
  verification?: VerificationOutcome;
}

/** Public projection returned by `get_operation_status`. */
export interface OperationView {
  id: string;
  capability: string;
  status: StoredOperationStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  resourceIds: Record<string, string>;
  data?: unknown;
  error?: ToolError;
  verification?: VerificationOutcome;
}

export interface OperationScope {
  identityId: string;
  organizationId: string;
}

/** Read-only port exposed to capabilities. */
export interface OperationPort {
  getScoped(id: string, scope: OperationScope): Promise<StoredOperation | undefined>;
}

export function toOperationView(operation: StoredOperation): OperationView {
  return {
    id: operation.id,
    capability: operation.capability,
    status: operation.status,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    ...(operation.completedAt ? { completedAt: operation.completedAt } : {}),
    resourceIds: operation.resourceIds,
    ...(operation.data !== undefined ? { data: operation.data } : {}),
    ...(operation.error ? { error: operation.error } : {}),
    ...(operation.verification ? { verification: operation.verification } : {}),
  };
}
