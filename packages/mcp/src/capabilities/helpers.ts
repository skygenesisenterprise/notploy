import { ApiError } from "../adapters/notployApi.js";
import type { CapabilityExecutionContext } from "../contracts/capability.js";

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getString(record: JsonRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

export function getBoolean(record: JsonRecord | undefined, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

export function getArray(record: JsonRecord | undefined, key: string): unknown[] {
  return asArray(record?.[key]);
}

export function truncateText(value: string | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface DeploymentSummary {
  deploymentId: string | null;
  title: string | null;
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  isPreview: boolean;
}

export function summarizeDeployment(record: JsonRecord): DeploymentSummary {
  return {
    deploymentId: getString(record, "deploymentId") ?? null,
    title: getString(record, "title") ?? null,
    status: (getString(record, "status") ?? "unknown").toLowerCase(),
    createdAt: getString(record, "createdAt") ?? null,
    startedAt: getString(record, "startedAt") ?? null,
    finishedAt: getString(record, "finishedAt") ?? null,
    errorMessage: truncateText(getString(record, "errorMessage")),
    isPreview: getBoolean(record, "isPreviewDeployment") ?? false,
  };
}

export function isTerminalDeployment(status: string): boolean {
  return status === "done" || status === "error" || status === "cancelled";
}

export function deploymentTimestamp(summary: DeploymentSummary): number {
  const raw = summary.createdAt ?? summary.startedAt;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareDeploymentsNewestFirst(a: JsonRecord, b: JsonRecord): number {
  return deploymentTimestamp(summarizeDeployment(b)) - deploymentTimestamp(summarizeDeployment(a));
}

export async function fetchApplication(
  context: CapabilityExecutionContext,
  applicationId: string,
): Promise<JsonRecord> {
  const data = await context.api.request<unknown>({
    method: "GET",
    path: "/application.one",
    params: { applicationId },
    idempotent: true,
    signal: context.signal,
  });

  const application = asRecord(data);
  if (!application) {
    throw new ApiError({
      code: "api_error",
      message: "The Notploy API returned an unexpected application payload",
    });
  }
  return application;
}

export async function fetchDeployments(
  context: CapabilityExecutionContext,
  applicationId: string,
): Promise<JsonRecord[]> {
  const data = await context.api.request<unknown>({
    method: "GET",
    path: "/deployment.all",
    params: { applicationId },
    idempotent: true,
    signal: context.signal,
  });

  return asArray(data)
    .map(asRecord)
    .filter((record): record is JsonRecord => record !== undefined)
    .sort(compareDeploymentsNewestFirst);
}

export function findDeployment(
  deployments: JsonRecord[],
  deploymentId: string | undefined,
): JsonRecord | undefined {
  if (!deploymentId) return deployments[0];
  return (
    deployments.find((record) => getString(record, "deploymentId") === deploymentId) ?? undefined
  );
}

/** Collapses volatile identifiers so failures can be grouped. */
export function errorSignature(message: string | null): string {
  if (!message) return "unknown";
  return (message.split("\n")[0] ?? message)
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/\b[0-9a-f]{12,}\b/g, "<hash>")
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function projectApplicationSummary(application: JsonRecord): JsonRecord {
  const environment = asRecord(application.environment);
  const project = environment ? asRecord(environment.project) : undefined;

  return {
    applicationId: getString(application, "applicationId") ?? null,
    appName: getString(application, "appName") ?? null,
    name: getString(application, "name") ?? null,
    applicationStatus: getString(application, "applicationStatus") ?? null,
    sourceType: getString(application, "sourceType") ?? null,
    buildType: getString(application, "buildType") ?? null,
    serverId: getString(application, "serverId") ?? null,
    environmentId: getString(environment, "environmentId") ?? null,
    environmentName: getString(environment, "name") ?? null,
    projectId: getString(project, "projectId") ?? null,
    projectName: getString(project, "name") ?? null,
    domainCount: getArray(application, "domains").length,
  };
}
