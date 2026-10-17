/**
 * Minimal port implemented by the Notploy API adapter.
 *
 * Capabilities depend on this interface rather than on Axios so that they can
 * be tested without a network and so that every call goes through one place
 * that owns authentication, timeouts, retries and redaction.
 */

export interface ApiRequest {
  method: "GET" | "POST";
  /** API path relative to the Notploy `/api` prefix, e.g. `/project.all`. */
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  /**
   * Marks the operation safe to retry. Mutations must not set this unless they
   * are idempotent by contract (for example, a deployment keyed by an
   * idempotency key).
   */
  idempotent?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiPort {
  request<T = unknown>(request: ApiRequest): Promise<T>;
}
