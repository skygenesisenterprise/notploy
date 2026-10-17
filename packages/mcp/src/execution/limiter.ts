import type { ToolErrorCode } from "../contracts/result.js";

export interface Permit {
  allowed: true;
  release(): void;
}

export interface LimitDenied {
  allowed: false;
  code: Extract<ToolErrorCode, "rate_limited" | "concurrency_limited">;
  message: string;
  retryAfterMs?: number;
}

export type LimitDecision = Permit | LimitDenied;

export interface LimiterOptions {
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
  windowMs?: number;
  now?: () => number;
}

/**
 * Per-identity sliding-window rate limit and concurrency cap.
 *
 * Limits are process-local. A multi-instance deployment enforces the budget
 * per instance; the documented limit is therefore an upper bound per process.
 */
export class ExecutionLimiter {
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly requests = new Map<string, number[]>();
  private readonly active = new Map<string, number>();

  constructor(private readonly options: LimiterOptions) {
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  acquire(key: string): LimitDecision {
    const now = this.now();
    const recent = (this.requests.get(key) ?? []).filter(
      (timestamp) => timestamp > now - this.windowMs,
    );

    if (recent.length >= this.options.maxRequestsPerMinute) {
      const oldest = recent[0] ?? now;
      this.requests.set(key, recent);
      return {
        allowed: false,
        code: "rate_limited",
        message: `Rate limit exceeded (${this.options.maxRequestsPerMinute} requests per minute)`,
        retryAfterMs: Math.max(1, oldest + this.windowMs - now),
      };
    }

    const active = this.active.get(key) ?? 0;
    if (active >= this.options.maxConcurrentRequests) {
      return {
        allowed: false,
        code: "concurrency_limited",
        message: `Too many concurrent tool calls (limit ${this.options.maxConcurrentRequests})`,
      };
    }

    recent.push(now);
    this.requests.set(key, recent);
    this.active.set(key, active + 1);

    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        const current = this.active.get(key) ?? 1;
        if (current <= 1) this.active.delete(key);
        else this.active.set(key, current - 1);
      },
    };
  }

  /** Test helper. */
  reset(): void {
    this.requests.clear();
    this.active.clear();
  }
}
