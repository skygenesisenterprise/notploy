import { z } from "zod";
import { ApiError } from "../adapters/notployApi.js";
import { defineCapability } from "../contracts/capability.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";
import {
  deploymentTimestamp,
  errorSignature,
  fetchApplication,
  fetchDeployments,
  findDeployment,
  getString,
  isTerminalDeployment,
  projectApplicationSummary,
  summarizeDeployment,
} from "./helpers.js";

const applicationId = z
  .string()
  .min(1)
  .max(128)
  .describe("Notploy application identifier (not the application name)");
const deploymentId = z
  .string()
  .min(1)
  .max(128)
  .optional()
  .describe("Deployment identifier; defaults to the most recent deployment");

const deploymentPermissions = [{ resource: "deployment", actions: ["read"] }] as const;

const readEffects = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  supportsIdempotencyKey: false,
  longRunning: false,
} as const;

function readAnnotations(title: string) {
  return {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  };
}

export const getDeploymentStatusCapability = defineCapability({
  name: "get_deployment_status",
  title: "Get deployment status",
  description:
    "Returns the status of one deployment (by id) or the most recent deployment of an application, including terminal state, timing and error message. Use it to follow a deployment started by execute_deployment.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: deploymentPermissions,
  effects: readEffects,
  inputSchema: z.object({ applicationId, deploymentId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Get deployment status"),
  execute: async (input, context) => {
    const deployments = await fetchDeployments(context, input.applicationId);
    const deployment = findDeployment(deployments, input.deploymentId);
    if (!deployment) {
      throw new ApiError({
        code: "not_found",
        message: input.deploymentId
          ? `Deployment ${input.deploymentId} was not found for this application`
          : "This application has no deployment yet",
      });
    }

    const summary = summarizeDeployment(deployment);
    return {
      data: {
        applicationId: input.applicationId,
        deployment: summary,
        terminal: isTerminalDeployment(summary.status),
        succeeded: summary.status === "done",
        active: summary.status === "running",
      },
    };
  },
});

export const getDeploymentHistoryCapability = defineCapability({
  name: "get_deployment_history",
  title: "Get deployment history",
  description:
    "Lists recent deployments for an application, newest first, with counts by status. Optionally filters by deployment status. Use it before diagnosing a failure or deciding whether a deployment is already queued.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: deploymentPermissions,
  effects: readEffects,
  inputSchema: z.object({
    applicationId,
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum deployments to return"),
    status: z
      .enum(["running", "done", "error", "cancelled"])
      .optional()
      .describe("Only return deployments with this status"),
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Get deployment history"),
  execute: async (input, context) => {
    const deployments = await fetchDeployments(context, input.applicationId);
    const summaries = deployments.map(summarizeDeployment);
    const filtered = input.status
      ? summaries.filter((deployment) => deployment.status === input.status)
      : summaries;

    return {
      data: {
        applicationId: input.applicationId,
        total: summaries.length,
        matched: filtered.length,
        statusCounts: {
          running: summaries.filter((item) => item.status === "running").length,
          done: summaries.filter((item) => item.status === "done").length,
          error: summaries.filter((item) => item.status === "error").length,
          cancelled: summaries.filter((item) => item.status === "cancelled").length,
        },
        deployments: filtered.slice(0, input.limit),
      },
      message: `Returned ${Math.min(filtered.length, input.limit)} of ${filtered.length} matching deployment(s)`,
    };
  },
});

export const getApplicationLogsCapability = defineCapability({
  name: "get_application_logs",
  title: "Get application logs",
  description:
    "Returns recent runtime or build logs for an application, with bounded tail size and optional text filter. Use it with diagnose_deployment when a deployment failed. Logs are returned as stored by Notploy; known credentials are redacted but application secrets may appear in application output.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [{ resource: "service", actions: ["read"] }],
  effects: readEffects,
  inputSchema: z.object({
    applicationId,
    tail: z.number().int().min(1).max(10_000).default(100).describe("Number of log lines"),
    since: z
      .string()
      .regex(/^(all|\d+[smhd])$/, "Expected 'all' or a duration such as 30m, 24h or 7d")
      .default("all"),
    search: z
      .string()
      .regex(/^[a-zA-Z0-9 ._-]{0,500}$/, "Only letters, digits, spaces and ._- are allowed")
      .optional()
      .describe("Case-sensitive text filter"),
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Get application logs"),
  execute: async (input, context) => {
    const logs = await context.api.request<unknown>({
      method: "GET",
      path: "/application.readLogs",
      params: {
        applicationId: input.applicationId,
        tail: input.tail,
        since: input.since,
        ...(input.search ? { search: input.search } : {}),
      },
      idempotent: true,
      signal: context.signal,
    });

    return {
      data: {
        applicationId: input.applicationId,
        tail: input.tail,
        since: input.since,
        logs,
      },
    };
  },
});

export const inspectApplicationHealthCapability = defineCapability({
  name: "inspect_application_health",
  title: "Inspect application health",
  description:
    "Combines the application record, its domains and its latest deployment into a health verdict with concrete findings. Read-only: it never restarts or redeploys anything. Use get_deployment_status or get_application_logs to go deeper.",
  category: "diagnostics",
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
  effects: readEffects,
  inputSchema: z.object({ applicationId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Inspect application health"),
  execute: async (input, context) => {
    const [application, deployments] = await Promise.all([
      fetchApplication(context, input.applicationId),
      fetchDeployments(context, input.applicationId),
    ]);

    const summary = projectApplicationSummary(application);
    const latest = deployments[0] ? summarizeDeployment(deployments[0]) : undefined;
    const applicationStatus = getString(application, "applicationStatus") ?? "unknown";
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const failuresLast24h = deployments
      .map(summarizeDeployment)
      .filter(
        (deployment) => deployment.status === "error" && deploymentTimestamp(deployment) >= cutoff,
      ).length;

    const findings: string[] = [];
    let verdict: "healthy" | "in_progress" | "degraded" | "unhealthy" | "unknown";

    if (!latest) {
      verdict = "unknown";
      findings.push("No deployment has been recorded for this application yet.");
    } else if (applicationStatus === "error" || latest.status === "error") {
      verdict = "unhealthy";
      findings.push(
        applicationStatus === "error"
          ? "The application is in the error state."
          : "The most recent deployment failed.",
      );
      if (latest.errorMessage) findings.push(`Last error: ${latest.errorMessage}`);
    } else if (latest.status === "running" || applicationStatus === "running") {
      verdict = "in_progress";
      findings.push("A deployment or restart is currently in progress.");
    } else if (latest.status === "cancelled") {
      verdict = "degraded";
      findings.push("The most recent deployment was cancelled.");
    } else {
      verdict = "healthy";
      findings.push("The application is not in an error state and its last deployment succeeded.");
    }

    if (failuresLast24h > 0) {
      findings.push(`${failuresLast24h} deployment(s) failed in the last 24 hours.`);
    }
    if (summary.domainCount === 0) {
      findings.push("No domain is attached; the application is only reachable internally.");
    }

    return {
      data: {
        application: summary,
        verdict,
        findings,
        latestDeployment: latest ?? null,
        deploymentCount: deployments.length,
        failuresLast24h,
      },
      message: `Application health: ${verdict}`,
    };
  },
});

interface FailureSignal {
  pattern: RegExp;
  summary: string;
  nextStep: string;
}

const FAILURE_SIGNALS: FailureSignal[] = [
  {
    pattern: /port is already allocated|address already in use/i,
    summary: "A port required by the container is already in use",
    nextStep: "Inspect the ports of the application and other services on the same server.",
  },
  {
    pattern: /no space left on device|enospc/i,
    summary: "The target server ran out of disk space",
    nextStep: "Free disk space or move the application to a server with more capacity.",
  },
  {
    pattern: /permission denied|eacces/i,
    summary: "A file or Docker permission was denied",
    nextStep: "Check mount permissions and the Docker context used by the deployment.",
  },
  {
    pattern: /oomkilled|out of memory|exit code 137/i,
    summary: "The container was killed for using too much memory",
    nextStep: "Raise the memory limit or reduce the application's memory usage.",
  },
  {
    pattern: /cannot connect to the docker daemon|cannot connect to docker/i,
    summary: "The deployment could not reach the Docker daemon",
    nextStep: "Check that Docker is running on the target server and reachable by Notploy.",
  },
  {
    pattern: /npm err!|yarn error|pnpm err|failed to compile|build failed/i,
    summary: "The build step failed",
    nextStep: "Review the build logs and the application's build command and dependencies.",
  },
  {
    pattern: /health ?check|unhealthy/i,
    summary: "The container health check failed",
    nextStep: "Verify the health endpoint, port and startup time of the application.",
  },
  {
    pattern: /pull access denied|manifest unknown|image not found/i,
    summary: "The container image could not be pulled",
    nextStep: "Check registry credentials and the image name/tag.",
  },
  {
    pattern: /git|clone|repository|branch/i,
    summary: "The source repository could not be fetched",
    nextStep: "Check the git provider connection, branch and deploy key.",
  },
];

function matchSignals(text: string): FailureSignal[] {
  const normalized = text.toLowerCase();
  return FAILURE_SIGNALS.filter((signal) => signal.pattern.test(normalized));
}

export const diagnoseDeploymentCapability = defineCapability({
  name: "diagnose_deployment",
  title: "Diagnose deployment",
  description:
    "Explains a failed (or in-progress) deployment using its status, error message and a bounded log excerpt. Returns deterministic signals and next steps; it does not invent a root cause. Use analyze_recent_failures to detect recurring patterns.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [
    { resource: "deployment", actions: ["read"] },
    { resource: "service", actions: ["read"] },
  ],
  effects: readEffects,
  inputSchema: z.object({ applicationId, deploymentId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Diagnose deployment"),
  execute: async (input, context) => {
    const [application, deployments] = await Promise.all([
      fetchApplication(context, input.applicationId),
      fetchDeployments(context, input.applicationId),
    ]);

    const deployment = findDeployment(deployments, input.deploymentId);
    if (!deployment) {
      throw new ApiError({
        code: "not_found",
        message: "No deployment was found for this application",
      });
    }

    const summary = summarizeDeployment(deployment);
    const logsAvailable = summary.status === "error";
    let logExcerpt: string | null = null;
    let logsNote: string | null = null;

    if (logsAvailable) {
      try {
        const logs = await context.api.request<unknown>({
          method: "GET",
          path: "/application.readLogs",
          params: { applicationId: input.applicationId, tail: 200, since: "all" },
          idempotent: true,
          signal: context.signal,
        });
        const text = typeof logs === "string" ? logs : JSON.stringify(logs);
        logExcerpt = text.slice(-8_000);
      } catch {
        logsNote = "Logs could not be read; the diagnosis only uses deployment metadata.";
      }
    }

    const combined = [summary.errorMessage ?? "", logExcerpt ?? ""].join("\n");
    const signals = matchSignals(combined);

    let verdict: "not_failed" | "in_progress" | "cancelled" | "failed" | "unknown";
    let summaryText: string;

    if (summary.status === "done") {
      verdict = "not_failed";
      summaryText = "The deployment succeeded; there is nothing to diagnose.";
    } else if (summary.status === "running") {
      verdict = "in_progress";
      summaryText =
        "The deployment is still running. Poll get_deployment_status before diagnosing.";
    } else if (summary.status === "cancelled") {
      verdict = "cancelled";
      summaryText = "The deployment was cancelled. Re-run it if the cancellation was not intended.";
    } else if (summary.status === "error") {
      verdict = "failed";
      summaryText =
        signals.length > 0
          ? `The deployment failed. ${signals.length} known failure signal(s) matched the logs.`
          : "The deployment failed, but no known failure signature matched the logs.";
    } else {
      verdict = "unknown";
      summaryText = "The deployment status is unknown.";
    }

    return {
      data: {
        application: projectApplicationSummary(application),
        deployment: summary,
        verdict,
        summary: summaryText,
        signals: signals.map((signal) => ({
          summary: signal.summary,
          nextStep: signal.nextStep,
        })),
        nextSteps:
          signals.length > 0
            ? signals.map((signal) => signal.nextStep)
            : [
                "Open the full deployment logs in Notploy for the raw build output.",
                "Check the target server health with list_servers.",
              ],
        logExcerpt,
        logsNote,
      },
      message: summaryText,
    };
  },
});

export const analyzeRecentFailuresCapability = defineCapability({
  name: "analyze_recent_failures",
  title: "Analyze recent failures",
  description:
    "Aggregates the most recent deployments of an application, reports the failure rate and groups failures by normalized error signature. Use it to spot recurring deployment problems before changing anything.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: deploymentPermissions,
  effects: readEffects,
  inputSchema: z.object({
    applicationId,
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Number of most recent deployments to analyze"),
  }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Analyze recent failures"),
  execute: async (input, context) => {
    const deployments = await fetchDeployments(context, input.applicationId);
    const analyzed = deployments.slice(0, input.limit).map(summarizeDeployment);
    const failures = analyzed.filter((deployment) => deployment.status === "error");

    const grouped = new Map<string, number>();
    for (const failure of failures) {
      const signature = errorSignature(failure.errorMessage);
      grouped.set(signature, (grouped.get(signature) ?? 0) + 1);
    }

    const topSignatures = [...grouped.entries()]
      .map(([signature, count]) => ({ signature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      data: {
        applicationId: input.applicationId,
        analyzed: analyzed.length,
        failures: failures.length,
        failureRate: analyzed.length > 0 ? failures.length / analyzed.length : 0,
        topSignatures,
        recentFailures: failures.slice(0, 10),
      },
      message: `${failures.length} failure(s) among the last ${analyzed.length} deployment(s)`,
    };
  },
});

export const verifyDeploymentCapability = defineCapability({
  name: "verify_deployment",
  title: "Verify deployment",
  description:
    "Checks whether a deployment reached a terminal state and whether it succeeded. Read-only and safe to poll. Returns `verified`, `failed`, `pending` or `unknown` with the deployment summary.",
  category: "diagnostics",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: deploymentPermissions,
  effects: readEffects,
  inputSchema: z.object({ applicationId, deploymentId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: readAnnotations("Verify deployment"),
  execute: async (input, context) => {
    const deployments = await fetchDeployments(context, input.applicationId);
    const deployment = findDeployment(deployments, input.deploymentId);

    if (!deployment) {
      return {
        data: {
          applicationId: input.applicationId,
          result: "unknown",
          deployment: null,
          message: "No deployment exists for this application",
        },
      };
    }

    const summary = summarizeDeployment(deployment);
    const result =
      summary.status === "done"
        ? "verified"
        : summary.status === "error" || summary.status === "cancelled"
          ? "failed"
          : "pending";

    return {
      data: {
        applicationId: input.applicationId,
        result,
        terminal: isTerminalDeployment(summary.status),
        succeeded: summary.status === "done",
        deployment: summary,
      },
      message:
        result === "verified"
          ? "The deployment completed successfully"
          : result === "failed"
            ? `The deployment ended with status ${summary.status}`
            : "The deployment has not reached a terminal state yet",
    };
  },
});
