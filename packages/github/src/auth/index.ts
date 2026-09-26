/**
 * GitHub App authentication for Notploy.
 *
 * Wraps `@octokit/auth-app` to provide the chain:
 *
 *   App authentication (JWT)
 *     -> Installation authentication
 *       -> Installation access token
 *         -> GitHub API
 *
 * Credentials are supplied at runtime only. They are never logged, never
 * written to disk by this package, and never included in error messages.
 */

import { createAppAuth } from "@octokit/auth-app";
import {
	GitHubAuthenticationError,
	GitHubConfigurationError,
} from "../errors/index.js";
import type { GitHubInstallationPermissions } from "../types/index.js";

export interface GitHubAppCredentials {
	/** GitHub App ID. */
	appId: number | string;
	/**
	 * PEM-encoded private key generated for the GitHub App.
	 * Must be provided at runtime (env var, secret manager, ...); never
	 * committed or embedded in code.
	 */
	privateKey: string;
	/** Base URL of the GitHub instance (github.com or GHES / ghe.com tenant). */
	baseUrl?: string;
}

/** Result of app-level authentication (short-lived JWT). */
export interface GitHubAppAuthentication {
	type: "app";
	token: string;
	appId: number;
	expiresAt: string;
}

/** Result of installation-level authentication (installation access token). */
export interface GitHubInstallationAuthentication {
	type: "token";
	token: string;
	tokenType: "installation";
	installationId: number;
	permissions: Record<string, string>;
	repositorySelection: "all" | "selected";
	expiresAt: string;
	createdAt: string;
}

/**
 * Normalizes PEM input: environments frequently provide the key with escaped
 * newlines (`\n` inside a single env var). This restores real line breaks.
 */
export const normalizePrivateKey = (privateKey: string): string => {
	if (privateKey.includes("\\n") && !privateKey.includes("\n")) {
		return privateKey.replaceAll("\\n", "\n");
	}
	return privateKey;
};

export const validateGitHubAppCredentials = (
	credentials: GitHubAppCredentials,
): void => {
	if (!credentials) {
		throw new GitHubConfigurationError("GitHub App credentials are required");
	}
	if (
		credentials.appId === undefined ||
		credentials.appId === null ||
		`${credentials.appId}`.trim() === ""
	) {
		throw new GitHubConfigurationError("GitHub App appId is required");
	}
	if (!credentials.privateKey || credentials.privateKey.trim() === "") {
		throw new GitHubConfigurationError(
			"GitHub App privateKey is required (provide it at runtime, never in code)",
		);
	}
	if (!normalizePrivateKey(credentials.privateKey).includes("-----BEGIN")) {
		throw new GitHubConfigurationError(
			"GitHub App privateKey does not look like a PEM private key",
		);
	}
};

/**
 * Creates the underlying `@octokit/auth-app` auth strategy.
 * Exported for advanced use cases; most consumers should use the helpers below.
 */
export const createGitHubAppAuthStrategy = (
	credentials: GitHubAppCredentials,
) => {
	validateGitHubAppCredentials(credentials);

	return createAppAuth({
		appId: credentials.appId,
		privateKey: normalizePrivateKey(credentials.privateKey),
		...(credentials.baseUrl ? { baseUrl: credentials.baseUrl } : {}),
	});
};

/**
 * App authentication: signs a short-lived JWT as the GitHub App itself.
 * Used for app-level operations such as listing installations.
 *
 * ```ts
 * const appAuth = await createGitHubAppAuth({ appId, privateKey });
 * ```
 */
export const createGitHubAppAuth = async (
	credentials: GitHubAppCredentials,
): Promise<GitHubAppAuthentication> => {
	const auth = createGitHubAppAuthStrategy(credentials);

	try {
		const result = (await auth({ type: "app" })) as GitHubAppAuthentication;
		return result;
	} catch (error) {
		const wrapped = new GitHubAuthenticationError(
			"Could not authenticate as GitHub App. Verify appId and privateKey.",
		);
		wrapped.cause = error;
		throw wrapped;
	}
};

export interface CreateInstallationAuthOptions {
	credentials: GitHubAppCredentials;
	/** Installation to authenticate as. Required unless embedded in credentials. */
	installationId: number | string;
	/** Optionally scope the token to specific repositories. */
	repositoryNames?: string[];
	/** Optionally request a restricted permission set for the token. */
	permissions?: Record<string, string>;
	/** Force issuing a fresh token instead of using the strategy cache. */
	refresh?: boolean;
}

/**
 * Installation authentication: exchanges the App JWT for an installation
 * access token scoped to one installation.
 *
 * ```ts
 * const installationAuth = await createInstallationAuth({
 *   credentials: { appId, privateKey },
 *   installationId,
 * });
 * ```
 */
export const createInstallationAuth = async (
	options: CreateInstallationAuthOptions,
): Promise<GitHubInstallationAuthentication> => {
	const auth = createGitHubAppAuthStrategy(options.credentials);

	try {
		const result = (await auth({
			type: "installation",
			installationId: options.installationId,
			...(options.repositoryNames
				? { repositoryNames: options.repositoryNames }
				: {}),
			...(options.permissions ? { permissions: options.permissions } : {}),
			...(options.refresh !== undefined ? { refresh: options.refresh } : {}),
		})) as GitHubInstallationAuthentication;

		return result;
	} catch (error) {
		const wrapped = new GitHubAuthenticationError(
			"Could not create an installation access token. Verify installationId and App permissions.",
		);
		wrapped.cause = error;
		throw wrapped;
	}
};

/**
 * Lists installations of the App (App JWT required) using a plain request
 * through the auth strategy's underlying request.
 */
export interface ListInstallationsOptions {
	credentials: GitHubAppCredentials;
	page?: number;
	perPage?: number;
}

export interface GitHubAppInstallationListItem {
	id: number;
	accountLogin?: string;
	accountType?: string;
	targetType?: string;
	repositorySelection: string;
	permissions?: Record<string, string>;
	suspendedAt?: string | null;
}

/**
 * Retrieves the permission level of a user on a repository through the raw
 * REST endpoint. Kept minimal: higher-level wrappers live in the client.
 */
export const describeInstallationPermissions = (
	permissions: Record<string, string> | undefined,
): GitHubInstallationPermissions => {
	if (!permissions) {
		return { permission: "none" };
	}
	const level = permissions.contents ?? permissions.metadata ?? "read";
	if (level === "write" || level === "admin") {
		return { permission: level === "admin" ? "admin" : "write" };
	}
	if (level === "admin") {
		return { permission: "admin" };
	}
	if (level === "none") {
		return { permission: "none" };
	}
	return { permission: "read" };
};
