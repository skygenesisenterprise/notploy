import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Environment, RiskLevel } from "../contracts/core.js";
import type { ToolErrorCode } from "../contracts/result.js";
import { createLogger } from "../utils/logger.js";
import { redactKnownSecrets } from "../utils/redactSensitive.js";
import { getRegisteredSecrets } from "./secrets.js";

const logger = createLogger("Audit");

export interface AuditPort {
  record(event: AuditEvent): Promise<void>;
  close?(): Promise<void>;
}

export interface AuditEvent {
  requestId: string;
  sessionId?: string;
  identityId: string;
  organizationId: string;
  environment: Environment;
  capability: string;
  mode: "business" | "advanced";
  risk: RiskLevel;
  decision: "allowed" | "denied" | "failed";
  code: ToolErrorCode | "ok";
  durationMs: number;
  approvalUsed: boolean;
  operationId?: string;
  resourceIds?: Record<string, string>;
}

/**
 * Append-only audit trail for every tool call, including refusals.
 *
 * Events contain identifiers, decisions and outcome codes only — never inputs,
 * headers or credentials. The JSONL file is optional; the structured log line
 * is always emitted so an existing log pipeline can collect it.
 */
export class AuditLog implements AuditPort {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly path?: string) {}

  async record(event: AuditEvent): Promise<void> {
    const safeEvent = redactKnownSecrets(event, getRegisteredSecrets());
    const entry = { type: "audit", timestamp: new Date().toISOString(), ...safeEvent };

    logger.info("MCP tool call", entry);

    if (!this.path) return;

    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        try {
          await mkdir(dirname(this.path as string), { recursive: true });
          await appendFile(this.path as string, `${JSON.stringify(entry)}\n`, {
            encoding: "utf8",
            mode: 0o600,
          });
        } catch (error) {
          logger.error("Could not append to NOTPLOY_MCP_AUDIT_LOG", {
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      });

    await this.writeChain;
  }

  async close(): Promise<void> {
    await this.writeChain;
  }
}
