import { z } from "zod";
import { ApiError } from "../adapters/notployApi.js";
import { defineCapability } from "../contracts/capability.js";
import { toOperationView } from "../contracts/operation.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";

export const getOperationStatusCapability = defineCapability({
  name: "get_operation_status",
  title: "Get operation status",
  description:
    "Returns the state, structured result and verification outcome of a long-running operation started by this MCP server (for example execute_deployment). Operation identifiers are scoped to the authenticated identity and organization and expire after the retention window.",
  category: "operations",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [],
  effects: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    supportsIdempotencyKey: false,
    longRunning: false,
  },
  inputSchema: z.object({
    operationId: z
      .string()
      .min(8)
      .max(128)
      .describe("Identifier returned by a long-running capability"),
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Get operation status",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  limitations: [
    "Operations are stored per MCP server process; they are shared across instances only when NOTPLOY_MCP_OPERATION_STORE is configured on a shared volume.",
  ],
  execute: async (input, context) => {
    const operation = await context.operations.getScoped(input.operationId, {
      identityId: context.identity.id,
      organizationId: context.identity.organizationId,
    });

    if (!operation) {
      throw new ApiError({
        code: "operation_not_found",
        message: `Operation ${input.operationId} was not found for this identity`,
      });
    }

    return {
      data: toOperationView(operation),
      message: `Operation is ${operation.status}`,
    };
  },
});
