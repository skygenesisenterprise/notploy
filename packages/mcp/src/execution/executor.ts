import type { IdentityResolver } from "../adapters/identity.js";
import { ApiError } from "../adapters/notployApi.js";
import type { McpConfig } from "../config.js";
import type { ApiPort } from "../contracts/api.js";
import type {
  AnyCapability,
  CapabilityExecutionContext,
  CapabilityOutcome,
  VerificationOutcome,
} from "../contracts/capability.js";
import type { AuthenticatedIdentity } from "../contracts/context.js";
import type { ResolvedPermissions, RiskLevel } from "../contracts/core.js";
import type { StoredOperation } from "../contracts/operation.js";
import type { ToolError, ToolErrorCode, ToolResult } from "../contracts/result.js";
import type { AuditPort } from "../observability/audit.js";
import { effectiveRisk, evaluatePolicy } from "../policies/engine.js";
import { createLogger } from "../utils/logger.js";
import type { ExecutionLimiter } from "./limiter.js";
import type { OperationStore } from "./operations.js";
import {
  buildFailureResult,
  buildMeta,
  buildPendingResult,
  buildSuccessResult,
  redactForOutput,
  truncateData,
  withHint,
} from "./results.js";

const logger = createLogger("Executor");

const UNAUTHENTICATED_IDENTITY: AuthenticatedIdentity = {
  id: "unauthenticated",
  organizationId: "",
};

export class ToolTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`The operation exceeded its ${timeoutMs}ms deadline`);
    this.name = "ToolTimeoutError";
  }
}

function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ToolTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([run(controller.signal), deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ApiError({ message: "The operation was cancelled", code: "cancelled" }));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError({ message: "The operation was cancelled", code: "cancelled" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function describeValidationError(capability: AnyCapability, error: unknown): ToolError {
  const issues =
    error !== null && typeof error === "object" && "issues" in error
      ? (error as { issues?: { path?: (string | number)[]; message?: string }[] }).issues
      : undefined;

  const details = (issues ?? [])
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path?.join(".") ?? "input";
      return `${path}: ${issue.message ?? "invalid value"}`;
    })
    .join("; ");

  return withHint({
    code: "invalid_input",
    message: `Invalid input for ${capability.name}${details ? ` (${details})` : ""}`,
  });
}

function toToolError(error: unknown): ToolError {
  if (error instanceof ApiError) {
    return withHint({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
  }
  if (error instanceof ToolTimeoutError) {
    return withHint({ code: "timeout", message: error.message, retryable: true });
  }
  return withHint({
    code: "internal_error",
    message: "The MCP server could not complete this capability",
  });
}

export interface ExecutorOptions {
  config: McpConfig;
  api: ApiPort;
  identities: IdentityResolver;
  limiter: ExecutionLimiter;
  operations: OperationStore;
  audit: AuditPort;
  now?: () => number;
}

export interface ExecuteOptions {
  requestId: string;
  sessionId?: string;
  approvalToken?: string;
}

interface ResolvedCall {
  identity: AuthenticatedIdentity;
  permissions: ResolvedPermissions;
}

interface AuditContext {
  requestId: string;
  sessionId?: string;
  capability: AnyCapability;
  risk: RiskLevel;
  startedAt: number;
  approvalUsed: boolean;
  identity: AuthenticatedIdentity;
  operationId?: string;
  resourceIds?: Record<string, string>;
  mode: "business" | "advanced";
}

/**
 * The single execution path for every catalog entry.
 *
 * Order matters: environment, schema, identity, effective permissions, policy,
 * limits, idempotency, execution, verification, audit. Catalog filtering never
 * replaces any of these steps.
 */
export class ToolExecutor {
  private readonly now: () => number;

  constructor(private readonly options: ExecutorOptions) {
    this.now = options.now ?? Date.now;
  }

  async execute(
    capability: AnyCapability,
    rawInput: unknown,
    options: ExecuteOptions,
  ): Promise<ToolResult> {
    const startedAt = this.now();
    const risk = effectiveRisk(capability);
    let identity: AuthenticatedIdentity = UNAUTHENTICATED_IDENTITY;

    const auditContext = (overrides: Partial<AuditContext> = {}): AuditContext => ({
      requestId: options.requestId,
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
      capability,
      risk,
      startedAt,
      approvalUsed: false,
      identity,
      mode: capability.mode,
      ...overrides,
    });

    const meta = (operationId?: string) =>
      buildMeta({
        requestId: options.requestId,
        environment: this.options.config.environment,
        risk,
        startedAt,
        now: this.now(),
        ...(operationId ? { operationId } : {}),
      });

    if (!capability.environments.includes(this.options.config.environment)) {
      const error = withHint({
        code: "unsupported_environment",
        message: `${capability.name} is not available in the ${this.options.config.environment} environment`,
      });
      await this.recordAudit(auditContext(), "denied", error.code);
      return buildFailureResult({ capability, meta: meta(), error, status: "rejected" });
    }

    const parsed = capability.inputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const error = describeValidationError(capability, parsed.error);
      // Invalid input is audited without reproducing the submitted values.
      await this.recordAudit(auditContext(), "denied", error.code);
      return buildFailureResult({ capability, meta: meta(), error, status: "rejected" });
    }

    const input = parsed.data as Record<string, unknown>;
    const approvalToken =
      typeof input.approvalToken === "string" ? input.approvalToken : options.approvalToken;

    let resolved: ResolvedCall;
    try {
      resolved = await this.options.identities.resolve();
      identity = resolved.identity;
    } catch (error) {
      const toolError = toToolError(error);
      await this.recordAudit(auditContext(), "failed", toolError.code);
      return buildFailureResult({ capability, meta: meta(), error: toolError });
    }

    const decision = evaluatePolicy(this.options.config.policy, {
      capability,
      permissions: resolved.permissions,
      ...(approvalToken ? { approvalToken } : {}),
    });

    if (!decision.allowed) {
      const error = withHint({
        code: decision.code,
        message: decision.reason,
      });
      await this.recordAudit(
        auditContext({ approvalUsed: decision.requiresApproval }),
        "denied",
        error.code,
      );
      return buildFailureResult({ capability, meta: meta(), error, status: "rejected" });
    }

    const permit = this.options.limiter.acquire(resolved.identity.id);
    if (!permit.allowed) {
      const error = withHint({
        code: permit.code,
        message: permit.message,
        ...(permit.retryAfterMs ? { hint: `Retry after ${permit.retryAfterMs}ms` } : {}),
      });
      await this.recordAudit(
        auditContext({ approvalUsed: decision.requiresApproval }),
        "denied",
        error.code,
      );
      return buildFailureResult({ capability, meta: meta(), error, status: "rejected" });
    }

    try {
      const idempotencyKey =
        capability.effects.supportsIdempotencyKey &&
        typeof input.idempotencyKey === "string" &&
        input.idempotencyKey.length > 0
          ? input.idempotencyKey
          : undefined;

      if (idempotencyKey) {
        const replay = await this.replayIdempotentCall(
          capability,
          idempotencyKey,
          resolved.identity,
          meta(),
          auditContext({ approvalUsed: decision.requiresApproval }),
        );
        if (replay) return replay;
      }

      if (capability.effects.longRunning) {
        return await this.startOperation({
          capability,
          input,
          resolved,
          options,
          idempotencyKey,
          approvalUsed: decision.requiresApproval,
          meta: meta(),
          audit: auditContext({ approvalUsed: decision.requiresApproval }),
        });
      }

      const outcome = await this.callCapability(
        capability,
        input,
        resolved,
        options.requestId,
        idempotencyKey,
        undefined,
        this.options.config.limits.toolTimeoutMs,
      );

      const verification = await this.verifyOutcome(
        capability,
        input,
        resolved,
        options.requestId,
        idempotencyKey,
        outcome,
      );

      if (verification?.status === "failed") {
        const error = withHint({ code: "conflict", message: verification.message });
        await this.recordAudit(
          auditContext({
            approvalUsed: decision.requiresApproval,
            ...(outcome.resourceIds ? { resourceIds: outcome.resourceIds } : {}),
          }),
          "failed",
          error.code,
        );
        return buildFailureResult({ capability, meta: meta(), error });
      }

      const { data, truncated } = this.prepareOutput(outcome.data);
      const successMeta = buildMeta(
        {
          requestId: options.requestId,
          environment: this.options.config.environment,
          risk,
          startedAt,
          now: this.now(),
        },
        truncated,
      );

      await this.recordAudit(
        auditContext({
          approvalUsed: decision.requiresApproval,
          ...(outcome.resourceIds ? { resourceIds: outcome.resourceIds } : {}),
        }),
        "allowed",
        "ok",
      );

      return buildSuccessResult(capability, successMeta, { ...outcome, data }, verification);
    } catch (error) {
      const toolError = toToolError(error);
      logger.error("Tool execution failed", {
        capability: capability.name,
        requestId: options.requestId,
        code: toolError.code,
      });
      await this.recordAudit(
        auditContext({ approvalUsed: decision.requiresApproval }),
        "failed",
        toolError.code,
      );
      return buildFailureResult({ capability, meta: meta(), error: toolError });
    } finally {
      permit.release();
    }
  }

  private prepareOutput(value: unknown): { data: unknown; truncated: boolean } {
    const redacted = redactForOutput(value, this.options.config);
    return truncateData(redacted, this.options.config.limits.maxResultBytes);
  }

  private buildCapabilityContext(
    resolved: ResolvedCall,
    requestId: string,
    signal: AbortSignal,
    idempotencyKey: string | undefined,
    operationId: string | undefined,
  ): CapabilityExecutionContext {
    return {
      api: this.options.api,
      identity: resolved.identity,
      environment: this.options.config.environment,
      permissions: resolved.permissions,
      requestId,
      signal,
      sleep: (ms) => abortableSleep(ms, signal),
      operations: this.options.operations,
      limits: this.options.config.limits,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(operationId ? { operationId } : {}),
    };
  }

  private callCapability(
    capability: AnyCapability,
    input: Record<string, unknown>,
    resolved: ResolvedCall,
    requestId: string,
    idempotencyKey: string | undefined,
    operationId: string | undefined,
    timeoutMs: number,
  ): Promise<CapabilityOutcome> {
    return withDeadline(
      (signal) =>
        capability.execute(
          input,
          this.buildCapabilityContext(resolved, requestId, signal, idempotencyKey, operationId),
        ),
      timeoutMs,
    );
  }

  /**
   * Runs the optional post-condition check.
   *
   * A failed verification is returned to the caller; a verification that cannot
   * run (timeout, transient API error) is reported as `unverified` rather than
   * turning a successful mutation into an ambiguous failure.
   */
  private async verifyOutcome(
    capability: AnyCapability,
    input: Record<string, unknown>,
    resolved: ResolvedCall,
    requestId: string,
    idempotencyKey: string | undefined,
    outcome: CapabilityOutcome,
    operationId?: string,
  ): Promise<VerificationOutcome | undefined> {
    if (!capability.verify) return outcome.verification;

    try {
      return await withDeadline(
        (signal) =>
          capability.verify!(
            input,
            this.buildCapabilityContext(resolved, requestId, signal, idempotencyKey, operationId),
            outcome,
          ),
        this.options.config.limits.verificationTimeoutMs,
      );
    } catch (error) {
      logger.warn("Post-condition verification could not complete", {
        capability: capability.name,
        requestId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      return {
        status: "unverified",
        message: "The action was accepted, but its post-condition could not be verified",
      };
    }
  }

  private async replayIdempotentCall(
    capability: AnyCapability,
    idempotencyKey: string,
    identity: AuthenticatedIdentity,
    meta: ReturnType<typeof buildMeta>,
    audit: AuditContext,
  ): Promise<ToolResult | undefined> {
    const existing = await this.options.operations.findByIdempotencyKey(idempotencyKey);
    if (!existing) return undefined;

    if (
      existing.capability !== capability.name ||
      existing.identityId !== identity.id ||
      existing.organizationId !== identity.organizationId
    ) {
      const error = withHint({
        code: "idempotency_mismatch",
        message: "This idempotency key was already used for a different call",
      });
      await this.recordAudit(audit, "denied", error.code);
      return buildFailureResult({ capability, meta, error, status: "rejected" });
    }

    await this.recordAudit(audit, "allowed", "ok");

    if (existing.status === "running") {
      return buildPendingResult({
        capability,
        meta,
        operationId: existing.id,
        message: `Operation ${existing.id} is already in progress`,
        data: { operationId: existing.id, status: "running" },
      });
    }

    if (existing.status === "succeeded") {
      const { data } = this.prepareOutput(existing.data);
      return buildSuccessResult(
        capability,
        meta,
        { data, message: `Replayed idempotent result for operation ${existing.id}` },
        existing.verification,
      );
    }

    return buildFailureResult({
      capability,
      meta,
      error:
        existing.error ??
        withHint({
          code: "internal_error",
          message: "The previous attempt with this idempotency key did not succeed",
        }),
    });
  }

  private async startOperation(args: {
    capability: AnyCapability;
    input: Record<string, unknown>;
    resolved: ResolvedCall;
    options: ExecuteOptions;
    idempotencyKey: string | undefined;
    approvalUsed: boolean;
    meta: ReturnType<typeof buildMeta>;
    audit: AuditContext;
  }): Promise<ToolResult> {
    const { capability, input, resolved, options, idempotencyKey } = args;

    const resourceIds = extractResourceIds(input);
    const operation = await this.options.operations.create({
      capability: capability.name,
      status: "running",
      identityId: resolved.identity.id,
      organizationId: resolved.identity.organizationId,
      environment: this.options.config.environment,
      requestId: options.requestId,
      resourceIds,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    await this.recordAudit({ ...args.audit, operationId: operation.id }, "allowed", "ok");

    void this.completeOperation({
      capability,
      input,
      resolved,
      requestId: options.requestId,
      operationId: operation.id,
      idempotencyKey,
      approvalUsed: args.approvalUsed,
      audit: { ...args.audit, operationId: operation.id },
    });

    return buildPendingResult({
      capability,
      meta: args.meta,
      operationId: operation.id,
      message: `${capability.title} was accepted. Poll get_operation_status with this operationId for the outcome.`,
      data: { operationId: operation.id, status: "running" },
    });
  }

  private async completeOperation(args: {
    capability: AnyCapability;
    input: Record<string, unknown>;
    resolved: ResolvedCall;
    requestId: string;
    operationId: string;
    idempotencyKey: string | undefined;
    approvalUsed: boolean;
    audit: AuditContext;
  }): Promise<void> {
    const { capability, input, resolved, requestId, operationId, idempotencyKey } = args;

    try {
      const outcome = await this.callCapability(
        capability,
        input,
        resolved,
        requestId,
        idempotencyKey,
        operationId,
        this.options.config.limits.toolTimeoutMs,
      );

      const verification = await this.verifyOutcome(
        capability,
        input,
        resolved,
        requestId,
        idempotencyKey,
        outcome,
        operationId,
      );

      const failed = verification?.status === "failed";
      const { data } = this.prepareOutput(outcome.data);

      await this.options.operations.update(operationId, {
        status: failed ? "failed" : "succeeded",
        data,
        ...(outcome.resourceIds ? { resourceIds: outcome.resourceIds } : {}),
        ...(verification ? { verification } : {}),
        ...(failed
          ? {
              error: withHint({
                code: "conflict" as ToolErrorCode,
                message: verification?.message ?? "The operation post-condition failed",
              }),
            }
          : {}),
      });

      await this.recordAudit(
        {
          ...args.audit,
          operationId,
          ...(outcome.resourceIds ? { resourceIds: outcome.resourceIds } : {}),
          approvalUsed: args.approvalUsed,
        },
        failed ? "failed" : "allowed",
        failed ? "conflict" : "ok",
      );
    } catch (error) {
      const toolError = toToolError(error);
      await this.options.operations.update(operationId, {
        status: "failed",
        error: toolError,
      });
      await this.recordAudit(
        { ...args.audit, operationId, approvalUsed: args.approvalUsed },
        "failed",
        toolError.code,
      );
    }
  }

  private async recordAudit(
    context: AuditContext,
    decision: "allowed" | "denied" | "failed",
    code: ToolErrorCode | "ok",
  ): Promise<void> {
    try {
      await this.options.audit.record({
        requestId: context.requestId,
        ...(context.sessionId ? { sessionId: context.sessionId } : {}),
        identityId: context.identity.id,
        organizationId: context.identity.organizationId,
        environment: this.options.config.environment,
        capability: context.capability.name,
        mode: context.mode,
        risk: context.risk,
        decision,
        code,
        durationMs: Math.max(0, this.now() - context.startedAt),
        approvalUsed: context.approvalUsed,
        ...(context.operationId ? { operationId: context.operationId } : {}),
        ...(context.resourceIds ? { resourceIds: context.resourceIds } : {}),
      });
    } catch (error) {
      // Auditing must never turn an executed action into an unhandled failure.
      logger.error("Could not record audit event", {
        capability: context.capability.name,
        requestId: context.requestId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
}

function extractResourceIds(input: Record<string, unknown>): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const key of [
    "applicationId",
    "composeId",
    "projectId",
    "environmentId",
    "serverId",
    "deploymentId",
  ]) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) ids[key] = value;
  }
  return ids;
}

/** Re-exported for tests that assert the stored JSON shape. */
export type { StoredOperation };
