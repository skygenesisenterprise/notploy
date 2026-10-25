import {
  DOKPLOY_DESTINATION_CAPABILITIES,
  DOKPLOY_SOURCE_CAPABILITIES,
  NOTPLOY_DESTINATION_CAPABILITIES,
  NOTPLOY_SOURCE_CAPABILITIES,
} from "./capabilities";
import { buildCompatibilityReport, buildMigrationPlan } from "./planning";
import type {
  CapabilityMatrix,
  CompatibilityReport,
  DetectedInstallation,
  MigrationDestinationAdapter,
  MigrationInventory,
  MigrationPlan,
  MigrationResource,
  MigrationSourceAdapter,
} from "./types";

export interface DockerMetadataInput {
  name: string;
  networks: string;
  labels: string;
  image?: string;
  running?: boolean;
}

function isNotployInfra(name: string): boolean {
  return name === "notploy" || name.startsWith("notploy-") || name.startsWith("notploy.");
}

function isDokployAttributed(networks: string, labels: string): boolean {
  const nets = networks.split(",").map((s) => s.trim());
  if (nets.some((n) => /dokploy/i.test(n) && !/notploy/i.test(n))) return true;
  if (/(^|[, ])com\.dokploy/i.test(labels)) return true;
  return false;
}

function collectDomains(labels: string): string[] {
  const out: string[] = [];
  for (const mm of labels.matchAll(/Host\([`"]([^`"]+)[`"]\)/g)) {
    if (mm[1]) out.push(mm[1]);
  }
  return [...new Set(out)];
}

export function buildInventoryFromDockerMetadata(args: {
  direction: MigrationInventory["direction"];
  source: DetectedInstallation;
  containers: DockerMetadataInput[];
  networks: string[];
  volumes: string[];
  stoppedNames?: string[];
}): MigrationInventory {
  const resources: MigrationResource[] = [];
  const unattributed: MigrationResource[] = [];
  let stoppedIds: string[] = [];

  for (const c of args.containers) {
    if (isNotployInfra(c.name)) continue;
    if (/traefik/i.test(c.name) && !/dokploy/i.test(c.name + (c.image ?? ""))) continue;
    const attributed = isDokployAttributed(c.networks, c.labels);
    const domains = collectDomains(c.labels);
    const base = {
      sourceRef: `docker:${c.name}`,
      metadata: {
        image: c.image ?? null,
        networks: c.networks || null,
        running: c.running ?? true,
      },
    };
    if (attributed) {
      const id = `app:${c.name}`;
      resources.push({ id, kind: "application", name: c.name, attributed: true, ...base });
      for (const d of domains) {
        resources.push({
          id: `domain:${d}`,
          kind: "domain",
          name: d,
          sourceRef: `docker:${c.name}`,
          metadata: { host: d },
          attributed: true,
        });
      }
      if (c.running === false) stoppedIds.push(id);
    } else {
      unattributed.push({
        id: `unattributed:${c.name}`,
        kind: "application",
        name: c.name,
        attributed: false,
        ...base,
      });
    }
  }

  for (const n of args.networks) {
    if (/notploy/i.test(n)) continue;
    if (!/dokploy/i.test(n)) continue;
    resources.push({
      id: `network:${n}`,
      kind: "network",
      name: n,
      metadata: {},
      attributed: true,
    });
  }

  for (const v of args.volumes) {
    if (/notploy/i.test(v)) continue;
    if (!/dokploy/i.test(v)) continue;
    resources.push({
      id: `volume:${v}`,
      kind: "volume",
      name: v,
      metadata: {},
      attributed: true,
    });
  }

  if (args.stoppedNames) {
    for (const n of args.stoppedNames) {
      const id = `app:${n}`;
      if (!stoppedIds.includes(id)) stoppedIds.push(id);
    }
  }

  return {
    direction: args.direction,
    source: args.source,
    resources,
    unattributedCount: unattributed.length,
    stoppedResourceIds: [...new Set(stoppedIds)],
    collectedAt: new Date().toISOString(),
  };
}

export class DokploySourceAdapter implements MigrationSourceAdapter {
  readonly product = "dokploy" as const;
  readonly direction = "dokploy-to-notploy" as const;
  constructor(private input?: { containers?: DockerMetadataInput[]; networks?: string[]; volumes?: string[] }) {}
  capabilities(): CapabilityMatrix {
    return DOKPLOY_SOURCE_CAPABILITIES;
  }
  async detect(): Promise<DetectedInstallation> {
    const has = (this.input?.containers ?? []).some((c) => /dokploy/i.test(c.name + (c.image ?? "") + c.labels));
    return {
      product: has ? "dokploy" : "unknown",
      version: "unknown",
      installationType: has ? "docker" : "unknown",
      confidence: has ? "high" : "low",
      evidence: has ? ["Docker metadata mentions dokploy"] : [],
    };
  }
  async inventory(detected: DetectedInstallation): Promise<MigrationInventory> {
    return buildInventoryFromDockerMetadata({
      direction: "dokploy-to-notploy",
      source: detected,
      containers: this.input?.containers ?? [],
      networks: this.input?.networks ?? [],
      volumes: this.input?.volumes ?? [],
    });
  }
}

export class NotployDestinationAdapter implements MigrationDestinationAdapter {
  readonly product = "notploy" as const;
  readonly direction = "dokploy-to-notploy" as const;
  capabilities(): CapabilityMatrix {
    return NOTPLOY_DESTINATION_CAPABILITIES;
  }
  async verifyDestination(): Promise<{ ok: boolean; errors: string[] }> {
    return { ok: true, errors: [] };
  }
  async preview(inventory: MigrationInventory, compatibility: CompatibilityReport): Promise<MigrationPlan> {
    return buildMigrationPlan(inventory, compatibility);
  }
  compatibility(inventory: MigrationInventory): CompatibilityReport {
    return buildCompatibilityReport(inventory, NOTPLOY_DESTINATION_CAPABILITIES);
  }
}

export class NotploySourceAdapter implements MigrationSourceAdapter {
  readonly product = "notploy" as const;
  readonly direction = "notploy-to-dokploy" as const;
  capabilities(): CapabilityMatrix {
    return NOTPLOY_SOURCE_CAPABILITIES;
  }
  async detect(): Promise<DetectedInstallation> {
    return {
      product: "notploy",
      version: "unknown",
      installationType: "swarm",
      confidence: "medium",
      evidence: ["Notploy source declared by caller"],
    };
  }
  async inventory(detected: DetectedInstallation): Promise<MigrationInventory> {
    return {
      direction: "notploy-to-dokploy",
      source: detected,
      resources: [],
      unattributedCount: 0,
      stoppedResourceIds: [],
      collectedAt: new Date().toISOString(),
    };
  }
}

export class DokployDestinationAdapter implements MigrationDestinationAdapter {
  readonly product = "dokploy" as const;
  readonly direction = "notploy-to-dokploy" as const;
  constructor(private targetVersion?: string) {}
  capabilities(): CapabilityMatrix {
    return DOKPLOY_DESTINATION_CAPABILITIES;
  }
  async verifyDestination(): Promise<{ ok: boolean; errors: string[] }> {
    if (!this.targetVersion) {
      return { ok: false, errors: ["Target Dokploy version must be declared before export."] };
    }
    return { ok: true, errors: [] };
  }
  async preview(inventory: MigrationInventory, compatibility: CompatibilityReport): Promise<MigrationPlan> {
    return buildMigrationPlan(inventory, compatibility);
  }
  compatibility(inventory: MigrationInventory): CompatibilityReport {
    return buildCompatibilityReport(inventory, DOKPLOY_DESTINATION_CAPABILITIES);
  }
}
