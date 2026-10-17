import { z } from "zod";
import { ApiError } from "../adapters/notployApi.js";
import { defineCapability } from "../contracts/capability.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";
import { fetchApplication } from "./helpers.js";

export const deleteApplicationCapability = defineCapability({
  name: "delete_application",
  title: "Delete application",
  description:
    "Permanently deletes an application and its deployments from Notploy. Destructive and irreversible: it requires service delete permission, explicit confirmation (confirm=true), an operator approval token and NOTPLOY_MCP_ALLOW_DESTRUCTIVE=true. Prefer stopping or restarting an application when the goal is only to interrupt it.",
  category: "administration",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 2,
  permissions: [{ resource: "service", actions: ["delete"] }],
  effects: {
    readOnly: false,
    destructive: true,
    idempotent: true,
    supportsIdempotencyKey: false,
    longRunning: false,
  },
  inputSchema: z.object({
    applicationId: z
      .string()
      .min(1)
      .max(128)
      .describe("Notploy application identifier (not the application name)"),
    confirm: z
      .literal(true)
      .describe("Must be true; protects against accidental deletions from an agent"),
    approvalToken: z
      .string()
      .min(1)
      .max(512)
      .optional()
      .describe(
        "Operator-provided approval token. It is verified server-side and never logged or returned.",
      ),
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Delete application",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  preconditions: [
    "NOTPLOY_MCP_ALLOW_DESTRUCTIVE must be true and an approval token must be configured.",
    "The identity needs service delete permission and access to the application.",
  ],
  limitations: ["The deletion cannot be undone from the MCP server."],
  verify: async (input, context) => {
    try {
      await fetchApplication(context, input.applicationId);
      return {
        status: "failed",
        message: "The application still exists after the deletion request",
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") {
        return {
          status: "verified",
          message: `Application ${input.applicationId} no longer exists`,
        };
      }
      throw error;
    }
  },
  execute: async (input, context) => {
    await context.api.request<unknown>({
      method: "POST",
      path: "/application.delete",
      body: { applicationId: input.applicationId },
      signal: context.signal,
    });

    return {
      data: { applicationId: input.applicationId, deleted: true },
      resourceIds: { applicationId: input.applicationId },
      message: "Application deleted",
    };
  },
});
