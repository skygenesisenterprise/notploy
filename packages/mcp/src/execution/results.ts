import type { McpConfig } from "../config.js";
import type {
  AnyCapability,
  CapabilityOutcome,
  VerificationOutcome,
} from "../contracts/capability.js";
import type { Environment, RiskLevel } from "../contracts/core.js";
import type {
  OperationStatus,
  ToolError,
  ToolErrorCode,
  ToolResult,
  ToolResultMeta,
} from "../contracts/result.js";
import { getRegisteredSecrets } from "../observability/secrets.js";
import { redactKnownSecrets, redactSensitive } from "../utils/redactSensitive.js";

/** Applies field-based then literal redaction to anything leaving the process. */
export function redactForOutput(value: unknown, config: McpConfig): unknown {
  const fieldRedacted = config.redactEnv ? redactSensitive(value, config.redactFields) : value;
  return redactKnownSecrets(fieldRedacted, getRegisteredSecrets());
}

export interface TruncationResult {
  data: unknown;
  truncated: boolean;
}

/**
 * Keeps the serialized data under the configured budget.
 *
 * The preview is a byte-bounded slice of the JSON document, so a large response
 * cannot exhaust the client context window. The original size is reported so an
 * agent can ask for a narrower query instead of retrying blindly.
 */
export function truncateData(value: unknown, maxBytes: number): TruncationResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? "null";
  } catch {
    return {
      data: { truncated: true, reason: "The result could not be serialized" },
      truncated: true,
    };
  }

  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes <= maxBytes) return { data: value, truncated: false };

  const previewBudget = Math.max(512, maxBytes - 1024);
  const preview = Buffer.from(serialized, "utf8").subarray(0, previewBudget).toString("utf8");

  return {
    data: {
      truncated: true,
      originalBytes: bytes,
      preview,
      hint: "Narrow the request (for example with a lower limit) to receive the full result",
    },
    truncated: true,
  };
}

export interface ResultMetaInput {
  requestId: string;
  environment: Environment;
  risk: RiskLevel;
  startedAt: number;
  now: number;
  operationId?: string;
}

export function buildMeta(input: ResultMetaInput, truncated = false): ToolResultMeta {
  return {
    requestId: input.requestId,
    environment: input.environment,
    risk: input.risk,
    durationMs: Math.max(0, input.now - input.startedAt),
    ...(input.operationId ? { operationId: input.operationId } : {}),
    ...(truncated ? { truncated: true } : {}),
  };
}

export function buildSuccessResult(
  capability: AnyCapability,
  meta: ToolResultMeta,
  outcome: CapabilityOutcome,
  verification?: VerificationOutcome,
): ToolResult {
  const data = verification ? mergeVerification(outcome.data, verification) : outcome.data;
  return {
    ok: true,
    capability: capability.name,
    status: "succeeded",
    message: outcome.message ?? `${capability.title} completed successfully`,
    ...(data !== undefined ? { data } : {}),
    meta,
  };
}

function mergeVerification(data: unknown, verification: VerificationOutcome): unknown {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>), verification };
  }
  return { data, verification };
}

export function buildFailureResult(options: {
  capability: AnyCapability;
  meta: ToolResultMeta;
  error: ToolError;
  status?: Extract<OperationStatus, "failed" | "rejected">;
}): ToolResult {
  return {
    ok: false,
    capability: options.capability.name,
    status: options.status ?? "failed",
    message: options.error.message,
    error: options.error,
    meta: options.meta,
  };
}

export function buildPendingResult(options: {
  capability: AnyCapability;
  meta: ToolResultMeta;
  operationId: string;
  message: string;
  data?: unknown;
}): ToolResult {
  return {
    ok: true,
    capability: options.capability.name,
    status: "pending",
    message: options.message,
    ...(options.data !== undefined ? { data: options.data } : {}),
    meta: { ...options.meta, operationId: options.operationId },
  };
}

const ERROR_HINTS: Partial<Record<ToolErrorCode, string>> = {
  unauthenticated: "Check that NOTPLOY_API_KEY is valid and not expired.",
  permission_denied:
    "The identity behind the API key lacks this permission in the active organization.",
  approval_required:
    "Ask the Notploy operator for an approval token and pass it as the approvalToken argument.",
  unsupported_environment:
    "Switch NOTPLOY_MCP_ENVIRONMENT or use a capability available in this deployment.",
  not_found: "Verify the resource identifier and that it belongs to the active organization.",
  operation_not_found:
    "Operation ids are scoped to the authenticated identity and expire after the retention window.",
  rate_limited: "Wait for the indicated delay before retrying.",
  timeout: "Narrow the request or increase the configured timeout.",
  conflict: "The target resource is not in the expected state; re-inspect it before retrying.",
  idempotency_mismatch:
    "Reuse an idempotency key only for the same capability, identity and organization.",
  api_error: "Inspect the Notploy server logs for this request id before retrying.",
  network_error: "Check network connectivity to NOTPLOY_URL.",
  internal_error: "This is an MCP server bug or an unexpected response; report the request id.",
};

export function withHint(error: ToolError): ToolError {
  if (error.hint) return error;
  const hint = ERROR_HINTS[error.code];
  return hint ? { ...error, hint } : error;
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Returns both a readable JSON block and MCP structured content.
 *
 * Modern clients consume `structuredContent`; clients that only render text
 * still receive the same envelope, so no information is lost.
 */
export function toMcpResponse(result: ToolResult): McpToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result as unknown as Record<string, unknown>,
    ...(result.ok ? {} : { isError: true }),
  };
}
