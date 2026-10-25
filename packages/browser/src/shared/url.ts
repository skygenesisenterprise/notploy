/**
 * Instance URL handling.
 *
 * Same contract as `normalizeInstanceUrl` in the VS Code extension and
 * `normalizeServerUrl` in the CLI: users may paste an API base (`…/api`) or a
 * deep dashboard URL, we always reduce it to the origin the SDK can use.
 *
 * Security rules enforced here (and re-checked before every request):
 * - only `http:` and `https:` are accepted, never credentials in the URL;
 * - `http:` is only accepted for loopback hosts (`localhost`, `127.0.0.1`,
 *   `[::1]`). Everywhere else requires `https:`.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeInstanceUrl(input: string): string {
	let candidate = input.trim();
	if (!candidate) return "";
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
		candidate = `https://${candidate}`;
	}
	try {
		const parsed = new URL(candidate);
		if (parsed.username || parsed.password) return "";
		parsed.hash = "";
		parsed.search = "";
		// Users frequently paste the API base or a deep dashboard URL.
		parsed.pathname = "";
		return parsed.origin;
	} catch {
		return "";
	}
}

export interface UrlValidation {
	valid: boolean;
	normalized?: string;
	error?: string;
}

export function validateInstanceUrl(input: string): UrlValidation {
	const raw = input.trim();
	if (!raw)
		return { valid: false, error: "Enter the base URL of the instance." };
	const normalized = normalizeInstanceUrl(raw);
	if (!normalized) {
		return {
			valid: false,
			error:
				"That is not a valid URL. Expected something like https://notploy.example.com.",
		};
	}
	let parsed: URL;
	try {
		parsed = new URL(normalized);
	} catch {
		return { valid: false, error: "That is not a valid URL." };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { valid: false, error: "Only http and https URLs are supported." };
	}
	if (
		parsed.protocol === "http:" &&
		!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())
	) {
		return {
			valid: false,
			normalized,
			error:
				"Plain HTTP is only allowed for local instances (localhost). Use https:// for anything else.",
		};
	}
	return { valid: true, normalized };
}

/** The dashboard lives at `<origin>/dashboard`. */
export function dashboardUrl(instanceUrl: string, path = ""): string {
	const base = instanceUrl.replace(/\/+$/, "");
	const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
	return `${base}/dashboard${suffix}`;
}

/** Canonical page where API keys are created. */
export function apiKeysUrl(instanceUrl: string): string {
	return dashboardUrl(instanceUrl, "/settings/api-keys");
}

export function projectDashboardUrl(
	instanceUrl: string,
	projectId: string,
	environmentId?: string,
	applicationId?: string,
): string {
	if (applicationId && environmentId) {
		return dashboardUrl(
			instanceUrl,
			`/project/${projectId}/environment/${environmentId}/services/application/${applicationId}`,
		);
	}
	if (environmentId) {
		return dashboardUrl(
			instanceUrl,
			`/project/${projectId}/environment/${environmentId}`,
		);
	}
	return dashboardUrl(instanceUrl, `/project/${projectId}`);
}
