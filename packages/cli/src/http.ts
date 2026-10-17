import axios, { type AxiosInstance } from "axios";
import {
	collectSecretValues,
	normalizeServerUrl,
	type ResolvedAuth,
	resolveAuth,
	resolveTimeout,
	saveProfile,
} from "./config.js";
import { CliError, ExitCode, normalizeError, usageError } from "./errors.js";
import { USER_AGENT } from "./version.js";

export interface AuthConfig {
	url: string;
	token: string;
}

export interface RequestOptions {
	auth?: Pick<ResolvedAuth, "url" | "token">;
	timeout?: number;
}

function resolveRequestAuth(
	options: RequestOptions,
): Pick<ResolvedAuth, "url" | "token"> {
	if (options.auth) {
		return {
			url: normalizeServerUrl(options.auth.url),
			token: options.auth.token,
		};
	}
	const auth = resolveAuth();
	return { url: auth.url, token: auth.token };
}

/**
 * Creates the shared Axios client. Every request has an explicit timeout and
 * a stable User-Agent; credentials live only in the header.
 */
export function createClient(
	auth: Pick<ResolvedAuth, "url" | "token"> = resolveAuth(),
	timeout: number = resolveTimeout(),
): AxiosInstance {
	return axios.create({
		baseURL: `${normalizeServerUrl(auth.url)}/api`,
		timeout,
		headers: {
			"x-api-key": auth.token,
			"Content-Type": "application/json",
			Accept: "application/json",
			"User-Agent": USER_AGENT,
		},
	});
}

function unwrapResponse(data: unknown): unknown {
	if (!data || typeof data !== "object") return data;
	const record = data as Record<string, unknown>;
	const error = record.error;
	if (error) {
		const errorRecord = error as Record<string, unknown>;
		const json = errorRecord.json as Record<string, unknown> | undefined;
		const dataRecord = json?.data as Record<string, unknown> | undefined;
		const message =
			(typeof json?.message === "string" && json.message) ||
			(typeof errorRecord.message === "string" && errorRecord.message) ||
			"API request failed.";
		const trpcCode = dataRecord?.code;
		const code =
			trpcCode === "UNAUTHORIZED" || trpcCode === "FORBIDDEN"
				? ExitCode.Auth
				: ExitCode.Api;
		throw new CliError(message, {
			code,
			hint:
				code === ExitCode.Auth
					? "Check your API key with 'notploy auth status'."
					: undefined,
		});
	}

	const result = record.result as Record<string, unknown> | undefined;
	const resultData = result?.data as Record<string, unknown> | undefined;
	if (resultData && Object.hasOwn(resultData, "json")) {
		return resultData.json;
	}
	return data;
}

async function execute(
	method: "get" | "post",
	endpoint: string,
	data: Record<string, unknown> | undefined,
	options: RequestOptions = {},
): Promise<unknown> {
	const auth = resolveRequestAuth(options);
	const timeout = options.timeout ?? resolveTimeout();
	const client = createClient(auth, timeout);
	const path = `/trpc/${endpoint}`;

	try {
		if (method === "get") {
			const cleaned: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(data ?? {})) {
				if (value !== undefined) cleaned[key] = value;
			}
			const query =
				Object.keys(cleaned).length > 0
					? `?input=${encodeURIComponent(JSON.stringify(cleaned))}`
					: "";
			const response = await client.get(`${path}${query}`);
			return unwrapResponse(response.data);
		}

		const body = data ? { json: data } : undefined;
		const response = await client.post(path, body);
		return unwrapResponse(response.data);
	} catch (error) {
		throw normalizeError(error, collectSecretValues());
	}
}

export async function apiPost(
	endpoint: string,
	data?: Record<string, unknown>,
	options: RequestOptions = {},
): Promise<unknown> {
	return execute("post", endpoint, data, options);
}

export async function apiGet(
	endpoint: string,
	params?: Record<string, unknown>,
	options: RequestOptions = {},
): Promise<unknown> {
	return execute("get", endpoint, params, options);
}

/**
 * Verifies credentials without storing them. Used by auth, profile and doctor
 * so every login check follows the same timeout and error rules.
 */
export async function verifyCredentials(
	url: string,
	token: string,
	timeout: number = resolveTimeout(),
): Promise<{ url: string; user: unknown }> {
	const normalizedUrl = normalizeServerUrl(url);
	if (!token.trim()) {
		throw usageError("API key cannot be empty.");
	}
	const user = await apiGet("user.get", undefined, {
		auth: { url: normalizedUrl, token: token.trim() },
		timeout,
	});
	return { url: normalizedUrl, user };
}

/**
 * Compatibility helper for code that only needs URL and token. Prefer
 * resolveAuth() in new code.
 */
export function readAuthConfig(): AuthConfig {
	const auth = resolveAuth();
	return { url: auth.url, token: auth.token };
}

/**
 * Compatibility helper. Stores credentials in the selected profile, never in
 * the package directory.
 */
export function saveAuthConfig(
	url: string,
	token: string,
	profile = "default",
): string {
	return saveProfile(profile, url, token);
}
