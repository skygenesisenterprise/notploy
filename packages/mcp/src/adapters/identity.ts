import type { ApiPort } from "../contracts/api.js";
import type { AuthenticatedIdentity } from "../contracts/context.js";
import type { ResolvedPermissions } from "../contracts/core.js";
import { ApiError } from "./notployApi.js";

const DEFAULT_TTL_MS = 30_000;

interface SessionResponse {
  user?: { id?: unknown };
  session?: { activeOrganizationId?: unknown };
}

export interface ResolvedIdentity {
  identity: AuthenticatedIdentity;
  permissions: ResolvedPermissions;
  resolvedAt: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parsePermissions(value: unknown): ResolvedPermissions | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const permissions: ResolvedPermissions = {};
  for (const [resource, actions] of Object.entries(record)) {
    const actionsRecord = asRecord(actions);
    if (!actionsRecord) return undefined;
    permissions[resource] = {};
    for (const [action, allowed] of Object.entries(actionsRecord)) {
      permissions[resource][action] = allowed === true;
    }
  }
  return permissions;
}

/**
 * Resolves the identity behind the configured API key and its effective
 * permissions.
 *
 * The result is cached briefly to avoid two extra API calls per tool call.
 * Failures are never cached and are surfaced to the caller, which fails closed.
 */
export class IdentityResolver {
  private cached: ResolvedIdentity | undefined;
  private inflight: Promise<ResolvedIdentity> | undefined;

  constructor(
    private readonly api: ApiPort,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  async resolve(signal?: AbortSignal): Promise<ResolvedIdentity> {
    if (this.cached && Date.now() - this.cached.resolvedAt < this.ttlMs) {
      return this.cached;
    }

    this.inflight ??= this.fetch(signal).finally(() => {
      this.inflight = undefined;
    });

    return this.inflight;
  }

  invalidate(): void {
    this.cached = undefined;
  }

  private async fetch(signal?: AbortSignal): Promise<ResolvedIdentity> {
    const common = {
      method: "GET" as const,
      idempotent: true,
      ...(signal ? { signal } : {}),
    };

    const session = await this.api.request<SessionResponse | null>({
      ...common,
      path: "/user.session",
    });

    const userId = session?.user?.id;
    const organizationId = session?.session?.activeOrganizationId;
    if (typeof userId !== "string" || userId === "" || typeof organizationId !== "string") {
      throw new ApiError({
        message:
          "The configured Notploy API key is not valid or has no active organization. Check NOTPLOY_API_KEY.",
        code: "unauthenticated",
      });
    }

    const permissions = parsePermissions(
      await this.api.request<unknown>({ ...common, path: "/user.getPermissions" }),
    );
    if (!permissions) {
      throw new ApiError({
        message: "The Notploy API returned an unexpected permission set; refusing to execute",
        code: "internal_error",
      });
    }

    const resolved: ResolvedIdentity = {
      identity: { id: userId, organizationId },
      permissions,
      resolvedAt: Date.now(),
    };
    this.cached = resolved;
    return resolved;
  }
}
