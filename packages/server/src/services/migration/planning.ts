import type { CapabilityMatrix } from "./types";
import type {
  CompatibilityFinding,
  CompatibilityReport,
  CompatibilityStatus,
  MigrationInventory,
  MigrationOperation,
  MigrationPlan,
  MigrationResourceKind,
} from "./types";

const KIND_PRIORITY: Record<MigrationResourceKind, number> = {
  server: 0,
  project: 1,
  environment: 2,
  network: 3,
  volume: 4,
  database: 5,
  "git-provider": 6,
  registry: 7,
  application: 8,
  compose: 8,
  "env-vars": 9,
  secret: 10,
  domain: 11,
  routing: 12,
  port: 12,
  certificate: 13,
  "health-check": 14,
  "deployment-history": 15,
};

function statusForResource(
  kind: MigrationResourceKind,
  attributed: boolean,
  destination: CapabilityMatrix,
  direction: string,
): { status: CompatibilityStatus; reason: string; action: string; blocking: boolean; impact: string } {
  if (!attributed) {
    return {
      status: "to-verify",
      reason: "Ownership could not be established from Docker metadata.",
      action: "Verify manually whether this resource belongs to the migration scope.",
      blocking: false,
      impact: "Excluded from automatic plan until attributed.",
    };
  }
  switch (kind) {
    case "secret":
      return {
        status: "action-required",
        reason: "Secret values are never collected automatically.",
        action: "Re-enter secrets on the destination or reference a secrets provider.",
        blocking: false,
        impact: "Deployments would start with empty environment without this step.",
      };
    case "git-provider":
    case "registry":
      return {
        status: "action-required",
        reason: "Credentials require manual re-entry.",
        action: "Recreate provider/registry credentials on the destination.",
        blocking: false,
        impact: "Builds and pulls fail until credentials exist.",
      };
    case "certificate":
      return {
        status: "action-required",
        reason: "ACME certificates are re-issued, never copied.",
        action: "Add domains on destination and let certificates issue.",
        blocking: false,
        impact: "TLS unavailable until re-issued.",
      };
    case "deployment-history":
      return {
        status: "unsupported",
        reason: "History is summarized, not imported.",
        action: "Keep source history for audit; do not expect import.",
        blocking: false,
        impact: "Operational history only.",
      };
    case "database":
      if (destination.capabilities["database.direct-internal-copy"] === true) {
        return {
          status: "blocking",
          reason: "Direct internal database copy is not supported.",
          action: "Use dump and restore procedure instead.",
          blocking: true,
          impact: "Unsafe import would corrupt destination state.",
        };
      }
      return {
        status: "action-required",
        reason: "Databases transfer via dump and restore with validation.",
        action: "Create instance on destination then restore a verified dump.",
        blocking: false,
        impact: "Data loss risk if restored without validation.",
      };
    case "domain":
    case "port":
    case "routing":
      return {
        status: "action-required",
        reason: "Routing and DNS need verification before cutover.",
        action: "Verify DNS and health behind new domain before switching traffic.",
        blocking: false,
        impact: "Traffic outage if cut over too early.",
      };
    case "server":
      return {
        status: "to-verify",
        reason: "Runtime constraints differ between hosts.",
        action: "Compare CPU/memory/network constraints and adjust.",
        blocking: false,
        impact: "Scheduling differences possible.",
      };
    default:
      break;
  }
  if (direction === "notploy-to-dokploy") {
    return {
      status: "to-verify",
      reason: "Export equivalence must be verified against declared Dokploy version.",
      action: "Check destination capability matrix for this resource.",
      blocking: false,
      impact: "Flagged rather than silently approximated.",
    };
  }
  return {
    status: "automatic",
    reason: "Operational equivalence validated via native destination concepts.",
    action: "Recreate via destination native API.",
    blocking: false,
    impact: "Low.",
  };
}

export function buildCompatibilityReport(
  inventory: MigrationInventory,
  destination: CapabilityMatrix,
): CompatibilityReport {
  const findings: CompatibilityFinding[] = inventory.resources.map((r) => {
    const s = statusForResource(r.kind, r.attributed, destination, inventory.direction);
    return {
      resourceId: r.id,
      kind: r.kind,
      status: s.status,
      reason: s.reason,
      expectedAction: s.action,
      blocking: s.blocking,
      impact: s.impact,
    };
  });

  const summary: Record<CompatibilityStatus, number> = {
    automatic: 0,
    "action-required": 0,
    blocking: 0,
    unsupported: 0,
    "to-verify": 0,
  };
  for (const f of findings) summary[f.status] += 1;

  const manualActions = findings
    .filter((f) => f.status === "action-required" || f.status === "to-verify")
    .map((f) => `${f.resourceId}: ${f.expectedAction}`);
  const blockers = findings.filter((f) => f.blocking).map((f) => `${f.resourceId}: ${f.reason}`);

  return {
    inventoryId: `${inventory.direction}-${inventory.collectedAt}`,
    direction: inventory.direction,
    findings,
    summary,
    manualActions,
    blockers,
    evaluatedCapabilities: Object.keys(destination.capabilities),
    generatedAt: new Date().toISOString(),
  };
}

function operationKindFor(kind: MigrationResourceKind): MigrationPlan["operations"][number]["kind"] | null {
  switch (kind) {
    case "project": return "create-project";
    case "environment": return "create-environment";
    case "application": return "create-application";
    case "compose": return "create-compose";
    case "database": return "create-database";
    case "volume": return "copy-volume";
    case "network": return "recreate-network";
    case "domain": return "add-domain";
    case "certificate": return "issue-certificate";
    case "routing": return "configure-routing";
    case "secret": return "transfer-secret-reference";
    default: return null;
  }
}

export function buildMigrationPlan(
  inventory: MigrationInventory,
  compatibility: CompatibilityReport,
): MigrationPlan {
  const byId = new Map(compatibility.findings.map((f) => [f.resourceId, f]));
  const sorted = [...inventory.resources].sort(
    (a, b) => (KIND_PRIORITY[a.kind] ?? 99) - (KIND_PRIORITY[b.kind] ?? 99),
  );

  const operations: MigrationOperation[] = [];
  for (const r of sorted) {
    const finding = byId.get(r.id);
    if (!finding) continue;
    if (finding.status === "unsupported" || finding.status === "blocking") continue;
    if (finding.status === "to-verify" && !r.attributed) continue;
    const kind = operationKindFor(r.kind);
    if (!kind) continue;
    const isData = kind === "copy-volume" || kind === "create-database";
    operations.push({
      id: `op-${r.id}`,
      kind,
      resourceId: r.id,
      title: `${kind} for ${r.name}`,
      dependsOn: [],
      phase: isData ? "data" : "configuration",
      requiresConfirmation: isData || r.kind === "domain" || r.kind === "certificate",
      risks: finding.blocking ? [finding.reason] : [],
      idempotencyKey: `${inventory.direction}:${r.id}:${kind}`,
      conflict: undefined,
    });
  }

  // Wire simple dependencies: environments after projects, apps after envs.
  const projectOps = new Set(operations.filter((o) => o.kind === "create-project").map((o) => o.id));
  if (projectOps.size > 0) {
    for (const o of operations) {
      if (o.kind === "create-environment") o.dependsOn.push([...projectOps][0] as string);
    }
  }

  const manualSteps = compatibility.manualActions;
  const dataTransfer = operations.filter((o) => o.phase === "data").map((o) => o.title);
  const hasBlocking = compatibility.blockers.length > 0;

  return {
    inventoryId: compatibility.inventoryId,
    direction: inventory.direction,
    operations,
    manualSteps,
    dataTransfer,
    estimatedRisk: hasBlocking ? "high" : dataTransfer.length > 0 ? "medium" : "low",
    createdAt: new Date().toISOString(),
  };
}
