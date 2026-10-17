import axios, { type AxiosError, type AxiosInstance } from "axios";
import type { McpConfig } from "../config.js";
import type { ApiPort, ApiRequest } from "../contracts/api.js";
import type { ToolErrorCode } from "../contracts/result.js";
import { getRegisteredSecrets } from "../observability/secrets.js";
import { createLogger } from "../utils/logger.js";
import { redactKnownSecrets } from "../utils/redactSensitive.js";

const logger = createLogger("NotployApi");

const PACKAGE_VERSION = "0.31.0";
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ERROR_MESSAGE_LENGTH = 500;

const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9._\-/]+$/;

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: ToolErrorCode;
  readonly retryable: boolean;

  constructor(options: {
    message: string;
    code: ToolErrorCode;
    status?: number;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

function mapStatus(status: number): { code: ToolErrorCode; retryable: boolean } {
  if (status === 401) return { code: "unauthenticated", retryable: false };
  if (status === 403) return { code: "permission_denied", retryable: false };
  if (status === 404) return { code: "not_found", retryable: false };
  if (status === 409) return { code: "conflict", retryable: false };
  if (status === 429) return { code: "rate_limited", retryable: true };
  if (status === 408 || status === 502 || status === 503 || status === 504) {
    return { code: "api_error", retryable: true };
  }
  return { code: "api_error", retryable: status >= 500 };
}

function extractServerMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  if (data === null || typeof data !== "object") return undefined;

  const record = data as Record<string, unknown>;
  for (const key of ["message", "error"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.slice(0, MAX_ERROR_MESSAGE_LENGTH);
    }
  }
  return undefined;
}

/**
 * Translates an Axios failure without copying the request configuration.
 *
 * Axios error text can include URLs and headers; the normalized error keeps
 * only the status and a bounded, redacted message from the response body.
 */
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError({ message: "The request was cancelled", code: "cancelled" });
  }

  const axiosError = error as AxiosError;
  if (axiosError.response) {
    const status = axiosError.response.status;
    const mapping = mapStatus(status);
    const serverMessage = extractServerMessage(axiosError.response.data);
    const message =
      status >= 500
        ? `Notploy API returned HTTP ${status}`
        : (serverMessage ?? `Notploy API returned HTTP ${status}`);

    return new ApiError({
      message: redactKnownSecrets(message, getRegisteredSecrets()),
      code: mapping.code,
      status,
      retryable: mapping.retryable,
    });
  }

  if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
    return new ApiError({
      message: "The Notploy API did not respond before the timeout",
      code: "timeout",
      retryable: true,
    });
  }

  return new ApiError({
    message: "Could not reach the Notploy API",
    code: "network_error",
    retryable: true,
  });
}

function assertSafePath(path: string): void {
  if (!SAFE_PATH_PATTERN.test(path) || path.includes("..") || path.includes("//")) {
    throw new ApiError({ message: "The API path is invalid", code: "internal_error" });
  }
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError({ message: "The request was cancelled", code: "cancelled" }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError({ message: "The request was cancelled", code: "cancelled" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer.unref?.();
  });
}

export class NotployApi implements ApiPort {
  private readonly http: AxiosInstance;
  private readonly config: McpConfig;

  constructor(config: McpConfig, http?: AxiosInstance) {
    this.config = config;
    this.http =
      http ??
      axios.create({
        baseURL: `${config.notployUrl}/api`,
        timeout: Math.min(config.timeoutMs, config.limits.toolTimeoutMs),
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_BODY_BYTES,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": config.apiKey,
          "User-Agent": `notploy-mcp/${PACKAGE_VERSION}`,
          ...config.customHeaders,
        },
      });
  }

  async request<T = unknown>(request: ApiRequest): Promise<T> {
    assertSafePath(request.path);

    const method = request.method;
    // Mutations are never retried unless the caller explicitly marks them
    // idempotent; a blind retry can duplicate a deployment or a deletion.
    const retryable = method === "GET" || request.idempotent === true;
    const attempts = retryable ? this.config.retryAttempts : 0;

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.send<T>(request);
      } catch (error) {
        const apiError = normalizeApiError(error);
        const canRetry = attempt < attempts && apiError.retryable && !request.signal?.aborted;
        if (!canRetry) {
          if (apiError.code !== "cancelled") {
            logger.debug("API request failed", {
              method,
              path: request.path,
              code: apiError.code,
              status: apiError.status,
              attempt: attempt + 1,
            });
          }
          throw apiError;
        }

        const backoff = this.config.retryDelayMs * 2 ** attempt;
        const jitter = Math.floor(Math.random() * Math.min(500, backoff / 2));
        logger.debug("Retrying API request", {
          method,
          path: request.path,
          code: apiError.code,
          attempt: attempt + 1,
        });
        await abortableDelay(backoff + jitter, request.signal);
      }
    }
  }

  private async send<T>(request: ApiRequest): Promise<T> {
    const timeout = Math.min(
      request.timeoutMs ?? this.config.timeoutMs,
      this.config.limits.toolTimeoutMs,
    );

    const options: Parameters<AxiosInstance["request"]>[0] = {
      method: request.method,
      url: request.path,
      timeout,
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_BODY_BYTES,
      ...(request.signal ? { signal: request.signal } : {}),
    };

    if (request.method === "GET") {
      options.params = request.params ?? {};
    } else {
      options.data = request.body ?? {};
    }

    const response = await this.http.request<T>(options);
    return response.data;
  }
}
