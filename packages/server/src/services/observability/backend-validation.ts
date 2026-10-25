/**
 * Configuration-time validation for external Prometheus/Grafana URLs.
 *
 * Modeled on the AI endpoint guard (`utils/ai/runtime.ts`) so reviewers see
 * one familiar policy: http/https only, no embedded credentials, cloud
 * metadata/link-local always blocked, private networks allowed by default on
 * Self (`allowPrivateNetworks: true`) and denied on Cloud.
 *
 * This does not resolve DNS: proxies and network policies remain the
 * enforcement point against DNS rebinding. Callers must apply request
 * timeouts, redirect limits, and minimal credential scopes separately.
 */

export type ObservabilityBackendKind = "prometheus" | "grafana";

export class ObservabilityBackendError extends Error {
	readonly kind: ObservabilityBackendKind;
	readonly retryable = false;

	constructor(kind: ObservabilityBackendKind, message: string) {
		super(message, { cause: undefined });
		this.name = "ObservabilityBackendError";
		this.kind = kind;
	}
}

const BLOCKED_HOSTNAMES = new Set([
	"metadata",
	"metadata.google.internal",
	"metadata.goog",
	"metadata.azure.internal",
	"instance-data",
	"instance-data.ec2.internal",
]);

const BLOCKED_IPS = new Set([
	"169.254.169.254",
	"169.254.170.2",
	"100.100.100.200",
	"fd00:ec2::254",
]);

const normalizeHostname = (hostname: string): string =>
	hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "");

const isPrivateIpv4 = (hostname: string): boolean => {
	const parts = hostname.split(".").map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
		return false;
	}
	const [a = -1, b = -1] = parts;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
};

const isPrivateIpv6 = (hostname: string): boolean => {
	const value = normalizeHostname(hostname);
	return (
		value === "::1" ||
		value === "::" ||
		value.startsWith("fc") ||
		value.startsWith("fd") ||
		value.startsWith("fe8") ||
		value.startsWith("fe9") ||
		value.startsWith("fea") ||
		value.startsWith("feb") ||
		value.startsWith("::ffff:127.") ||
		value.startsWith("::ffff:10.") ||
		value.startsWith("::ffff:192.168.")
	);
};

const isPrivateHostname = (hostname: string): boolean => {
	const value = normalizeHostname(hostname);
	return (
		value === "localhost" ||
		value.endsWith(".localhost") ||
		value.endsWith(".local") ||
		value.endsWith(".internal") ||
		value.endsWith(".home.arpa") ||
		isPrivateIpv4(value) ||
		isPrivateIpv6(value)
	);
};

const invalid = (kind: ObservabilityBackendKind, message: string): never => {
	throw new ObservabilityBackendError(kind, message);
};

/**
 * Validate and normalize an external backend URL before it is stored or used.
 * Returns the canonical URL without credentials, query, or fragment.
 */
export const validateObservabilityBackendUrl = (
	rawUrl: string,
	kind: ObservabilityBackendKind,
	{ allowPrivateNetworks = true }: { allowPrivateNetworks?: boolean } = {},
): string => {
	let url: URL;
	try {
		url = new URL(rawUrl.trim());
	} catch {
		return invalid(kind, "Enter a valid absolute HTTP(S) backend URL.");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return invalid(kind, "Observability backends must use HTTP or HTTPS.");
	}

	if (url.username || url.password) {
		return invalid(
			kind,
			"Credentials must not be embedded in the backend URL. Use dedicated credentials.",
		);
	}

	const hostname = normalizeHostname(url.hostname);
	if (!hostname) {
		return invalid(kind, "Enter a valid absolute HTTP(S) backend URL.");
	}

	if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_IPS.has(hostname)) {
		return invalid(
			kind,
			"Cloud metadata and link-local endpoints are not allowed as observability backends.",
		);
	}

	if (!allowPrivateNetworks && isPrivateHostname(hostname)) {
		return invalid(
			kind,
			"Private and loopback backends are disabled for this deployment.",
		);
	}

	// Defense in depth for numeric host spellings when private ranges are off.
	if (!allowPrivateNetworks && /^\d+$/.test(hostname)) {
		return invalid(
			kind,
			"Private and loopback backends are disabled for this deployment.",
		);
	}

	url.username = "";
	url.password = "";
	url.hash = "";
	const canonical = `${url.protocol}//${url.host}${url.pathname.replace(/\/*$/, "") || "/"}`;
	return canonical === `${url.protocol}//${url.host}/`
		? `${url.protocol}//${url.host}`
		: canonical;
};
