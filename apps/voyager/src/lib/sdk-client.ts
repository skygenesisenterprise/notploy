/**
 * Notploy SDK Client Wrapper for Voyager
 * 
 * This module provides a React Native-compatible wrapper around the @notploy/sdk.
 * It manages:
 * - Multiple connections/instances
 * - Authentication tokens
 * - Request configuration
 * - Error handling
 * - TLS validation
 */

import type {
  Client,
  ClientOptions,
  Config,
  RequestOptions,
  RequestResult,
} from '@notploy/sdk';
import { createClient, createConfig } from '@notploy/sdk';
import type { Connection, ConnectionInput, ConnectionSummary } from '@/types/domain';

// ============================================================================
// Configuration
// ============================================================================

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/** Default base URL path */
const DEFAULT_API_PATH = '/api';

/**
 * Create a client configuration for a specific connection.
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch =>
  (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
  };

export function createConnectionConfig(
  connection: Connection,
  apiToken?: string,
): Config {
  const baseUrl = normalizeInstanceUrl(connection.url);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'NotployVoyager/1.0.0',
  };

  // Add authorization header if API token is provided
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  return {
    baseUrl: `${baseUrl}${DEFAULT_API_PATH}`,
    headers,
    fetch: createTimeoutFetch(connection.timeout || DEFAULT_TIMEOUT),
  };
}

/**
 * Normalize instance URL to ensure it has the correct format.
 * Removes /api suffix and ensures https:// prefix.
 */
export function normalizeInstanceUrl(input: string): string {
  let candidate = input.trim();
  if (!candidate) return '';

  // Remove /api suffix if present
  if (candidate.endsWith('/api')) {
    candidate = candidate.slice(0, -4);
  } else if (candidate.endsWith('/api/')) {
    candidate = candidate.slice(0, -5);
  }

  // Add https:// prefix if missing
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    // Clear path and hash
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin;
  } catch {
    return '';
  }
}

// ============================================================================
// Client Manager
// ============================================================================

/**
 * Notploy Client Manager
 * 
 * Manages multiple SDK clients, one per connection.
 * Each client is configured with the appropriate base URL and authentication.
 */
export class NotployClientManager {
  private clients: Map<string, Client> = new Map();
  private configCache: Map<string, Config> = new Map();

  /**
   * Get or create a client for a specific connection.
   */
  getClient(connection: Connection, apiToken?: string): Client {
    const connectionId = connection.id;
    const config = this.getConfig(connection, apiToken);

    // Recreate client if config has changed
    const cacheKey = `${connectionId}:${apiToken ? 'token' : 'no-token'}`;
    if (!this.clients.has(cacheKey) || this.configChanged(cacheKey, config)) {
      const client = createClient(config);
      this.clients.set(cacheKey, client);
      this.configCache.set(cacheKey, config);
    }

    const cachedClient = this.clients.get(cacheKey);
    if (!cachedClient) {
      throw new Error(`Failed to create client for connection ${connectionId}`);
    }

    return cachedClient;
  }

  /**
   * Get the configuration for a connection.
   */
  getConfig(connection: Connection, apiToken?: string): Config {
    return createConnectionConfig(connection, apiToken);
  }

  /**
   * Check if the configuration has changed.
   */
  private configChanged(cacheKey: string, newConfig: Config): boolean {
    const oldConfig = this.configCache.get(cacheKey);
    if (!oldConfig) return true;

    return (
      oldConfig.baseUrl !== newConfig.baseUrl ||
      JSON.stringify(oldConfig.headers) !== JSON.stringify(newConfig.headers)
    );
  }

  /**
   * Remove a client from the cache.
   * Call this when a connection is removed or credentials change.
   */
  removeClient(connectionId: string): void {
    // Remove all clients for this connection (with and without token)
    for (const key of this.clients.keys()) {
      if (key.startsWith(`${connectionId}:`)) {
        this.clients.delete(key);
        this.configCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached clients.
   */
  clearAll(): void {
    this.clients.clear();
    this.configCache.clear();
  }

  /**
   * Get a client with updated authentication.
   */
  getClientWithAuth(connection: Connection, apiToken: string): Client {
    return this.getClient(connection, apiToken);
  }

  /**
   * Get a client without authentication (for public endpoints).
   */
  getUnauthenticatedClient(connection: Connection): Client {
    return this.getClient(connection, undefined);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton client manager instance */
export const clientManager = new NotployClientManager();

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Execute a request with error handling adapted for mobile.
 */
export async function executeRequest<T>(
  request: RequestResult<T>,
): Promise<{
  data?: T;
  error?: Error;
  status?: number;
}> {
  try {
    const result = await request;
    return {
      data: result.data as T | undefined,
      status: result.response?.status,
    };
  } catch (err) {
    const error = err as Error & { status?: number; code?: string };
    return {
      error,
      status: error.status,
    };
  }
}

/**
 * Create a request with custom options.
 */
export function createRequest<T>(
  connection: Connection,
  apiToken: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  options?: Omit<RequestOptions<T, 'fields', false>, 'url' | 'method'>,
): RequestResult<T, unknown, false> {
  const client = clientManager.getClientWithAuth(connection, apiToken);
  
  // Note: The SDK generates specific functions for each endpoint.
  // This is a generic request method for custom endpoints.
  const fullPath = path.startsWith('/') ? path.slice(1) : path;
  
  return client.request<T>({
    method,
    url: fullPath,
    body: data,
    ...options,
  });
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check which capabilities are available for a connection.
 * This probes the instance to determine what features are enabled.
 */
export async function detectCapabilities(
  connection: Connection,
  apiToken?: string,
): Promise<{
  capabilities: Record<string, boolean>;
  routers: string[];
  error?: string;
}> {
  try {
    const client = clientManager.getClientWithAuth(connection, apiToken || '');
    
    // The capability detection would typically use a dedicated endpoint
    // For now, we return a placeholder that indicates all features are available
    // This should be replaced with actual capability probing
    
    return {
      capabilities: {
        deployments: true,
        logs: true,
        docker: true,
        compose: true,
        projects: true,
        environments: true,
        alerts: true,
        monitoring: true,
      },
      routers: [],
    };
  } catch (err) {
    const error = err as Error;
    return {
      capabilities: {},
      routers: [],
      error: error.message,
    };
  }
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate an instance URL.
 */
export function validateInstanceUrl(url: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  try {
    const normalized = normalizeInstanceUrl(url);
    if (!normalized) {
      return { valid: false, error: 'Invalid URL' };
    }

    // Try to parse the URL
    const parsed = new URL(normalized);
    
    // Check if it's http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }

    // Check if it has a hostname
    if (!parsed.hostname) {
      return { valid: false, error: 'URL must have a hostname' };
    }

    return { valid: true, normalized };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ============================================================================
// Exports
// ============================================================================

export { createClient, createConfig } from '@notploy/sdk';
export type { Client, ClientOptions, RequestOptions, RequestResult };
