import type { ZodObject, ZodRawShape, z } from "zod";
import type { ApiPort } from "./api.js";
import type { AuthenticatedIdentity, ExecutionLimits } from "./context.js";
import type { Environment, PermissionRequirement, ResolvedPermissions, RiskLevel } from "./core.js";
import type { OperationPort } from "./operation.js";

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type CapabilityStatus = "available" | "preview" | "deprecated";

export type CapabilityCategory =
  | "discovery"
  | "diagnostics"
  | "deployment"
  | "administration"
  | "operations"
  | "api";

export interface CapabilityEffects {
  readOnly: boolean;
  destructive: boolean;
  /** Safe to repeat with the same input without a second side effect. */
  idempotent: boolean;
  /** Accepts an `idempotencyKey` argument deduplicated by the MCP server. */
  supportsIdempotencyKey: boolean;
  /** Returns an operation id instead of blocking until completion. */
  longRunning: boolean;
}

export interface VerificationOutcome {
  status: "verified" | "failed" | "unverified";
  message: string;
  data?: unknown;
}

export interface CapabilityOutcome {
  data?: unknown;
  message?: string;
  /** Resource identifiers recorded in the audit log and operation store. */
  resourceIds?: Record<string, string>;
  verification?: VerificationOutcome;
}

export interface CapabilityExecutionContext {
  api: ApiPort;
  identity: AuthenticatedIdentity;
  environment: Environment;
  /** Effective permissions resolved from the API for this credential. */
  permissions: ResolvedPermissions;
  requestId: string;
  operationId?: string;
  idempotencyKey?: string;
  signal: AbortSignal;
  /** Abortable sleep used by verification loops. */
  sleep: (ms: number) => Promise<void>;
  /** Scoped access to the server-side operation store. */
  operations: OperationPort;
  /** Server-enforced limits, used by verification loops. */
  limits: ExecutionLimits;
}

/**
 * A catalog entry.
 *
 * The declaration is metadata plus a handler. It is *not* an authorization
 * decision: the executor re-evaluates permissions, policy and limits on every
 * call, using the effective permissions fetched from the API.
 */
export interface CapabilityDefinition<I extends ZodRawShape = ZodRawShape> {
  /** Stable, model-facing tool name. Never renamed silently. */
  name: string;
  title: string;
  /** Intent-oriented description: what it does and what it returns. */
  description: string;
  category: CapabilityCategory;
  mode: "business" | "advanced";
  /** Where the capability came from, for documentation and metrics. */
  source: "business" | "generated";
  version: string;
  status: CapabilityStatus;
  /** Notploy environments where the underlying API is available. */
  environments: readonly Environment[];
  risk: RiskLevel;
  permissions: readonly PermissionRequirement[];
  effects: CapabilityEffects;
  inputSchema: ZodObject<I>;
  /** Shape of the structured MCP output (the shared result envelope). */
  outputSchema: ZodRawShape;
  annotations: ToolAnnotations;
  preconditions?: readonly string[];
  limitations?: readonly string[];
  execute(
    input: z.infer<ZodObject<I>>,
    context: CapabilityExecutionContext,
  ): Promise<CapabilityOutcome>;
  /**
   * Optional post-condition check. For a synchronous capability it runs before
   * the result is returned; for a long-running capability it runs in the
   * background operation.
   */
  verify?(
    input: z.infer<ZodObject<I>>,
    context: CapabilityExecutionContext,
    outcome: CapabilityOutcome,
  ): Promise<VerificationOutcome>;
}

export type AnyCapability = CapabilityDefinition<ZodRawShape>;

/**
 * Helper that preserves input inference inside the declaring module while
 * exposing the erased `AnyCapability` shape to the registry.
 */
export function defineCapability<I extends ZodRawShape>(
  definition: CapabilityDefinition<I>,
): AnyCapability {
  return definition as unknown as AnyCapability;
}
