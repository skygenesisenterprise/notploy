import { z } from "zod";
import { ENVIRONMENTS, type Environment, type RiskLevel } from "./core.js";

export const TOOL_ERROR_CODES = [
  "invalid_input",
  "unauthenticated",
  "permission_denied",
  "policy_denied",
  "unsupported_capability",
  "unsupported_environment",
  "approval_required",
  "not_found",
  "operation_not_found",
  "conflict",
  "idempotency_mismatch",
  "rate_limited",
  "concurrency_limited",
  "timeout",
  "cancelled",
  "api_error",
  "network_error",
  "internal_error",
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

export interface ToolError {
  code: ToolErrorCode;
  /** Explanation an agent can act on. Never contains credentials. */
  message: string;
  hint?: string;
  retryable?: boolean;
}

export type OperationStatus = "succeeded" | "failed" | "pending" | "rejected";

export interface ToolResultMeta {
  requestId: string;
  environment: Environment;
  risk: RiskLevel;
  durationMs: number;
  operationId?: string;
  truncated?: boolean;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  capability: string;
  status: OperationStatus;
  message: string;
  data?: T;
  error?: ToolError;
  meta: ToolResultMeta;
}

/**
 * MCP `outputSchema` shared by every catalog entry.
 *
 * The same envelope is used for business capabilities and for generated API
 * operations, so clients can parse one stable shape regardless of mode.
 */
export function toolResultEnvelopeShape(): z.ZodRawShape {
  return {
    ok: z.boolean(),
    capability: z.string(),
    status: z.enum(["succeeded", "failed", "pending", "rejected"]),
    message: z.string(),
    data: z.unknown().optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        hint: z.string().optional(),
        retryable: z.boolean().optional(),
      })
      .optional(),
    meta: z.object({
      requestId: z.string(),
      environment: z.enum(ENVIRONMENTS),
      risk: z.number().int().min(0).max(3),
      durationMs: z.number().nonnegative(),
      operationId: z.string().optional(),
      truncated: z.boolean().optional(),
    }),
  };
}
