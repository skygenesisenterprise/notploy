import type { AnyCapability } from "../contracts/capability.js";
import { deleteApplicationCapability } from "./administration.js";
import { getConnectionStatusCapability } from "./connection.js";
import {
  executeDeploymentCapability,
  prepareDeploymentCapability,
  restartApplicationCapability,
} from "./deployment.js";
import {
  analyzeRecentFailuresCapability,
  diagnoseDeploymentCapability,
  getApplicationLogsCapability,
  getDeploymentHistoryCapability,
  getDeploymentStatusCapability,
  inspectApplicationHealthCapability,
  verifyDeploymentCapability,
} from "./diagnostics.js";
import {
  getApplicationCapability,
  getEnvironmentOverviewCapability,
  getProjectCapability,
  listApplicationDomainsCapability,
  listProjectsCapability,
  listServersCapability,
} from "./discovery.js";
import { getOperationStatusCapability } from "./operations.js";

/**
 * Business capabilities exposed by default.
 *
 * This is intentionally a small, workflow-oriented surface. Low-level API
 * coverage lives in the opt-in advanced catalog.
 */
export const businessCapabilities: readonly AnyCapability[] = [
  // Discovery
  getConnectionStatusCapability,
  listProjectsCapability,
  getProjectCapability,
  getApplicationCapability,
  getEnvironmentOverviewCapability,
  listServersCapability,
  listApplicationDomainsCapability,
  // Diagnostics
  getDeploymentStatusCapability,
  getDeploymentHistoryCapability,
  getApplicationLogsCapability,
  inspectApplicationHealthCapability,
  diagnoseDeploymentCapability,
  analyzeRecentFailuresCapability,
  verifyDeploymentCapability,
  // Deployment
  prepareDeploymentCapability,
  executeDeploymentCapability,
  restartApplicationCapability,
  // Administration
  deleteApplicationCapability,
  // Long-running operations
  getOperationStatusCapability,
];
