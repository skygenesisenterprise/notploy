import type { Environment, ResolvedPermissions } from "./core.js";

export interface AuthenticatedIdentity {
  /** Stable user identifier returned by the Notploy API. */
  id: string;
  /** Active organization/workspace of the credential. */
  organizationId: string;
}

export interface ExecutionLimits {
  /** Hard deadline for a single tool call, including verification. */
  toolTimeoutMs: number;
  /** Maximum serialized size of the data returned to the client. */
  maxResultBytes: number;
  /** Sliding-window request budget per identity. */
  maxRequestsPerMinute: number;
  /** In-flight tool calls allowed per identity. */
  maxConcurrentRequests: number;
  /** How long a long-running operation may stay in the store. */
  operationRetentionMs: number;
  /** How long verification of a long-running operation may run. */
  verificationTimeoutMs: number;
  /** Interval between verification attempts. */
  verificationIntervalMs: number;
}

/**
 * Resolved, server-side execution context.
 *
 * It is built from the authenticated credential and from server configuration.
 * No field is copied from tool input, so a client cannot select a different
 * environment, workspace or privilege set by calling a tool.
 */
export interface ExecutionContext {
  requestId: string;
  sessionId?: string;
  identity: AuthenticatedIdentity;
  environment: Environment;
  permissions: ResolvedPermissions;
  limits: ExecutionLimits;
  startedAt: number;
}
