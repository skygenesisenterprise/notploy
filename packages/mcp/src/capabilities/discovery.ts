import { z } from "zod";
import { defineCapability } from "../contracts/capability.js";
import { toolResultEnvelopeShape } from "../contracts/result.js";
import { asArray, asRecord, fetchApplication, projectApplicationSummary } from "./helpers.js";

const projectId = z.string().min(1).max(128).describe("Notploy project identifier");
const applicationId = z
  .string()
  .min(1)
  .max(128)
  .describe("Notploy application identifier (not the application name)");

export const listProjectsCapability = defineCapability({
  name: "list_projects",
  title: "List projects",
  description:
    "Lists the Notploy projects visible to the authenticated identity in the active organization. Use this first to discover project and environment identifiers. Returns a count and the project records; the API already filters projects the identity cannot access.",
  category: "discovery",
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
  inputSchema: z.object({}),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "List projects",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  limitations: [
    "Only projects the API key's user can access in the active organization are returned.",
  ],
  execute: async (_input, context) => {
    const data = await context.api.request<unknown>({
      method: "GET",
      path: "/project.all",
      idempotent: true,
      signal: context.signal,
    });
    const projects = asArray(data);
    return {
      data: { count: projects.length, projects },
      message: `Found ${projects.length} project(s)`,
    };
  },
});

export const getProjectCapability = defineCapability({
  name: "get_project",
  title: "Get project",
  description:
    "Returns one Notploy project by identifier, including its environments and services when the API provides them. Use list_projects first when the identifier is unknown.",
  category: "discovery",
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
  inputSchema: z.object({ projectId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Get project",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  execute: async (input, context) => {
    const project = await context.api.request<unknown>({
      method: "GET",
      path: "/project.one",
      params: { projectId: input.projectId },
      idempotent: true,
      signal: context.signal,
    });
    return { data: project };
  },
});

export const getApplicationCapability = defineCapability({
  name: "get_application",
  title: "Get application",
  description:
    "Returns one Notploy application with a stable summary (environment, project, source type, status) and the raw application record. Requires service read access; the API also enforces the identity's per-service access list.",
  category: "discovery",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [{ resource: "service", actions: ["read"] }],
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
    title: "Get application",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  execute: async (input, context) => {
    const application = await fetchApplication(context, input.applicationId);
    return {
      data: {
        summary: projectApplicationSummary(application),
        application,
      },
    };
  },
});

export const getEnvironmentOverviewCapability = defineCapability({
  name: "get_environment_overview",
  title: "Get environment overview",
  description:
    "Summarizes a project and every environment it contains. Use it to pick the environment that holds the application to inspect or deploy before calling deployment tools.",
  category: "discovery",
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
  inputSchema: z.object({ projectId }),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "Get environment overview",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  execute: async (input, context) => {
    const [project, environments] = await Promise.all([
      context.api.request<unknown>({
        method: "GET",
        path: "/project.one",
        params: { projectId: input.projectId },
        idempotent: true,
        signal: context.signal,
      }),
      context.api.request<unknown>({
        method: "GET",
        path: "/environment.byProjectId",
        params: { projectId: input.projectId },
        idempotent: true,
        signal: context.signal,
      }),
    ]);

    const projectRecord = asRecord(project);
    const environmentList = asArray(environments);

    return {
      data: {
        project: projectRecord
          ? {
              projectId: projectRecord.projectId ?? null,
              name: projectRecord.name ?? null,
              description: projectRecord.description ?? null,
              environmentCount: environmentList.length,
            }
          : null,
        environments: environmentList,
      },
      message: `Project has ${environmentList.length} environment(s)`,
    };
  },
});

export const listServersCapability = defineCapability({
  name: "list_servers",
  title: "List servers",
  description:
    "Lists the Notploy servers the authenticated identity can read, with their status and connection details useful for deployment diagnostics. Requires server read permission.",
  category: "discovery",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [{ resource: "server", actions: ["read"] }],
  effects: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    supportsIdempotencyKey: false,
    longRunning: false,
  },
  inputSchema: z.object({}),
  outputSchema: toolResultEnvelopeShape(),
  annotations: {
    title: "List servers",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  execute: async (_input, context) => {
    const data = await context.api.request<unknown>({
      method: "GET",
      path: "/server.all",
      idempotent: true,
      signal: context.signal,
    });
    const servers = asArray(data);
    return {
      data: { count: servers.length, servers },
      message: `Found ${servers.length} server(s)`,
    };
  },
});

export const listApplicationDomainsCapability = defineCapability({
  name: "list_application_domains",
  title: "List application domains",
  description:
    "Lists the domains attached to an application, including certificate and HTTPS state when available. Requires domain read permission and access to the application.",
  category: "discovery",
  mode: "business",
  source: "business",
  version: "1.0.0",
  status: "available",
  environments: ["self", "cloud", "console"],
  risk: 0,
  permissions: [{ resource: "domain", actions: ["read"] }],
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
    title: "List application domains",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  execute: async (input, context) => {
    const data = await context.api.request<unknown>({
      method: "GET",
      path: "/domain.byApplicationId",
      params: { applicationId: input.applicationId },
      idempotent: true,
      signal: context.signal,
    });
    const domains = asArray(data);
    return {
      data: {
        applicationId: input.applicationId,
        count: domains.length,
        domains,
      },
      message: `Application has ${domains.length} domain(s)`,
    };
  },
});
