import { z } from "zod";
import { ApiError } from "../adapters/notployApi.js";
import type {
  CapabilityExecutionContext,
  CapabilityOutcome,
  VerificationOutcome,
} from "../contracts/capability.js";
import { defineCapability } from "../contracts/capability.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";
import {
  asRecord,
  fetchApplication,
  fetchDeployments,
  getString,
  nowIso,
  projectApplicationSummary,
  summarizeDeployment,
} from "./helpers.js";

const applicationId = z
  .string()
  .min(1)
  .max(128)
  .describe("Notploy application identifier (not the application name)");

const approvalToken = z
  .string()
  .min(1)
  .max(512)
  .optional()
  .describe(
    "Operator-provided approval token required for high-impact capabilities. It is verified server-side and never logged or returned.",
  );

const idempotencyKey = z
  .string()
  .regex(
    /^[A-Za-z0-9._:-]{8,128}$/,
    "Use 8-128 characters among letters, digits, dot, underscore, colon and hyphen",
  )
  .optional()
  .describe(
    "Optional key that makes repeated calls return the original operation instead of deploying twice",
  );

export const prepareDeploymentCapability = defineCapability({
  name: "prepare_deployment",
  title: "Prepare deployment",
  description:
    "Runs a read-only preflight for a deployment: resolves the application, checks that no deployment is already running and returns an ordered plan with blockers and warnings. Call it before execute_deployment; it never mutates anything.",
  category: "deployment",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [
    { resource: "service", actions: ["read"] },
    { resource: "deployment", actions: ["read"] },
  ],
  effects: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    supportsIdempotencyKey: false,
    longRunning: false,
  },
  inputSchema: z.object({ applicationId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Prepare deployment",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  preconditions: ["The identity needs service read and deployment read permissions."],
  execute: async (input, context) => {
    const [application, deployments] = await Promise.all([
      fetchApplication(context, input.applicationId),
      fetchDeployments(context, input.applicationId),
    ]);

    const summary = projectApplicationSummary(application);
    const summaries = deployments.map(summarizeDeployment);
    const active = summaries.find((deployment) => deployment.status === "running");
    const blockers = active
      ? [`Deployment ${active.deploymentId ?? "(unknown id)"} is already running.`]
      : [];
    const warnings: string[] = [];

    if (!summary.sourceType) {
      warnings.push(
        "The application has no source type configured; verify its build settings before deploying.",
      );
    }
    if (summary.applicationStatus === "error") {
      warnings.push(
        "The application is currently in the error state; a new deployment may still recover it.",
      );
    }
    if (summary.domainCount === 0) {
      warnings.push("The application has no domain attached; it will not be publicly reachable.");
    }

    return {
      data: {
        ready: blockers.length === 0,
        application: summary,
        latestDeployment: summaries[0] ?? null,
        blockers,
        warnings,
        plan: [
          "Fetch and prepare the source revision",
          "Build the application image",
          "Start the new container and wait for readiness",
          "Switch the domain proxy to the new container",
          "Verify the deployment reaches a terminal state",
        ],
        requiredApproval: true,
        idempotencyRecommended: true,
      },
      message:
        blockers.length === 0
          ? "Deployment preflight passed"
          : `Deployment is blocked: ${blockers.join(" ")}`,
    };
  },
});

async function verifyDeploymentOutcome(
  applicationIdValue: string,
  context: CapabilityExecutionContext,
  requestedAt: string,
): Promise<VerificationOutcome> {
  const requestedAtMs = Date.parse(requestedAt);
  const deadline = Date.now() + context.limits.verificationTimeoutMs;
  const skewToleranceMs = 10_000;

  while (true) {
    const deployments = await fetchDeployments(context, applicationIdValue);
    const candidate = deployments.map(summarizeDeployment).find((deployment) => {
      if (!deployment.createdAt) return false;
      const createdAt = Date.parse(deployment.createdAt);
      return Number.isFinite(createdAt) && createdAt >= requestedAtMs - skewToleranceMs;
    });

    if (candidate) {
      if (candidate.status === "done") {
        return {
          status: "verified",
          message: `Deployment ${candidate.deploymentId ?? ""} completed successfully`,
          data: candidate,
        };
      }
      if (candidate.status === "error" || candidate.status === "cancelled") {
        return {
          status: "failed",
          message:
            candidate.errorMessage ??
            `Deployment ${candidate.deploymentId ?? ""} ended with status ${candidate.status}`,
          data: candidate,
        };
      }
    }

    if (Date.now() >= deadline) {
      return {
        status: "unverified",
        message: candidate
          ? "The deployment is still running; poll get_deployment_status"
          : "No deployment record appeared before the verification timeout; it may still be queued",
        ...(candidate ? { data: candidate } : {}),
      };
    }

    await context.sleep(context.limits.verificationIntervalMs);
  }
}

export const executeDeploymentCapability = defineCapability({
  name: "execute_deployment",
  title: "Execute deployment",
  description:
    "Queues a deployment for an application after permission, policy and approval checks. Returns immediately with an operationId; poll get_operation_status for the verified outcome. This is a high-impact capability: it requires deployment create permission, a valid approval token (NOTPLOY_MCP_APPROVAL_TOKEN) and, when retried, an idempotencyKey.",
  category: "deployment",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 2,
  permissions: [{ resource: "deployment", actions: ["create"] }],
  effects: {
    readOnly: false,
    destructive: false,
    idempotent: false,
    supportsIdempotencyKey: true,
    longRunning: true,
  },
  inputSchema: z.object({
    applicationId,
    title: z.string().min(1).max(200).optional().describe("Deployment title shown in Notploy"),
    description: z.string().max(2_000).optional().describe("Optional deployment description"),
    idempotencyKey,
    approvalToken,
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Execute deployment",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  preconditions: [
    "The identity needs deployment create permission and access to the application.",
    "A valid approval token must be configured by the Notploy operator.",
    "No other deployment should be running; run prepare_deployment first.",
  ],
  verify: async (input, context, outcome) => {
    const data = asRecord(outcome.data);
    const requestedAt = getString(data, "requestedAt") ?? nowIso();
    return verifyDeploymentOutcome(input.applicationId, context, requestedAt);
  },
  execute: async (input, context) => {
    const requestedAt = nowIso();
    await context.api.request<unknown>({
      method: "POST",
      path: "/application.deploy",
      body: {
        applicationId: input.applicationId,
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
      signal: context.signal,
    });

    return {
      data: {
        applicationId: input.applicationId,
        requestedAt,
        deploymentQueued: true,
      },
      resourceIds: { applicationId: input.applicationId },
      message: "Deployment queued; verification is running in the background",
    };
  },
});

export const restartApplicationCapability = defineCapability({
  name: "restart_application",
  title: "Restart application",
  description:
    "Reloads an application container in place without rebuilding it. Reversible but briefly interrupts the service, so it is classified as a limited-impact write and audited. The API requires deployment create permission and access to the application.",
  category: "deployment",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 1,
  permissions: [{ resource: "deployment", actions: ["create"] }],
  effects: {
    readOnly: false,
    destructive: false,
    idempotent: false,
    supportsIdempotencyKey: false,
    longRunning: false,
  },
  inputSchema: z.object({ applicationId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Restart application",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  verify: async (input, context): Promise<VerificationOutcome> => {
    const deadline = Date.now() + context.limits.verificationTimeoutMs;

    while (true) {
      const application = await fetchApplication(context, input.applicationId);
      const status = getString(application, "applicationStatus");

      if (status === "error") {
        return {
          status: "failed",
          message: "The application entered the error state after the restart",
        };
      }
      if (status !== "running") {
        return {
          status: "verified",
          message: `Application is in the ${status ?? "unknown"} state after the restart`,
        };
      }

      if (Date.now() >= deadline) {
        return {
          status: "unverified",
          message: "The restart was accepted but the application is still restarting",
        };
      }
      await context.sleep(context.limits.verificationIntervalMs);
    }
  },
  execute: async (input, context): Promise<CapabilityOutcome> => {
    const application = await fetchApplication(context, input.applicationId);
    const appName = getString(application, "appName");

    if (!appName) {
      throw new ApiError({
        code: "api_error",
        message: "The application has no appName; Notploy cannot reload it",
      });
    }

    await context.api.request<unknown>({
      method: "POST",
      path: "/application.reload",
      body: { applicationId: input.applicationId, appName },
      signal: context.signal,
    });

    return {
      data: { applicationId: input.applicationId, appName, restarted: true },
      resourceIds: { applicationId: input.applicationId },
      message: "Application reloaded",
    };
  },
});
