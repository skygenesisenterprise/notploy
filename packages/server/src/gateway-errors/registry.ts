export const GATEWAY_ERROR_CODES = [
	"NP-1001",
	"NP-1002",
	"NP-1003",
	"NP-1004",
	"NP-1033",
	"NP-1052",
	"NP-1503",
	"NP-1999",
] as const;

export type GatewayErrorCode = (typeof GATEWAY_ERROR_CODES)[number];

export interface GatewayErrorDefinition {
	code: GatewayErrorCode;
	httpStatus: number;
	category: "routing" | "availability" | "connectivity" | "maintenance" | "fallback";
	title: string;
	description: string;
	visitorGuidance: string;
	operatorGuidance: string;
	retryable: boolean;
	docsPath?: string;
}

export const GATEWAY_ERRORS: Record<
	GatewayErrorCode,
	GatewayErrorDefinition
> = {
	"NP-1001": {
		code: "NP-1001",
		httpStatus: 404,
		category: "routing",
		title: "Page not found",
		description:
			"This address does not match an application configured on this Notploy instance.",
		visitorGuidance:
			"Check the address for typos. If someone shared this link with you, ask them to confirm it is still valid.",
		operatorGuidance:
			"Confirm the domain is attached to a service and that its DNS record still points at this server. If you recently added the domain, wait for DNS and Traefik to pick it up.",
		retryable: false,
		docsPath: "/docs/core/domains",
	},
	"NP-1002": {
		code: "NP-1002",
		httpStatus: 503,
		category: "availability",
		title: "Application unavailable",
		description:
			"The application is configured, but it has no healthy instance ready to receive traffic.",
		visitorGuidance:
			"The service is temporarily unavailable. Try again in a few moments.",
		operatorGuidance:
			"Check that the deployment succeeded and that at least one replica is running and passing its health check. Review the container logs and the deployment history.",
		retryable: true,
		docsPath: "/docs/core/domains",
	},
	"NP-1003": {
		code: "NP-1003",
		httpStatus: 502,
		category: "connectivity",
		title: "Cannot reach the application",
		description:
			"The gateway reached the application route, but the connection to the application was refused or reset.",
		visitorGuidance:
			"The service is temporarily unreachable. Try again in a few moments.",
		operatorGuidance:
			"Verify the container is running, that it listens on the configured port and that it accepts connections from the notploy-network. Restarting the deployment can clear a stuck process.",
		retryable: true,
		docsPath: "/docs/core/domains",
	},
	"NP-1004": {
		code: "NP-1004",
		httpStatus: 504,
		category: "connectivity",
		title: "Application timed out",
		description:
			"The application accepted the request but did not respond before the gateway timeout.",
		visitorGuidance:
			"The service is taking too long to respond. Try again shortly.",
		operatorGuidance:
			"Check the application logs for slow requests, blocked event loops or database contention. If the workload is expected to be long-running, increase the relevant timeout or move it to a background job.",
		retryable: true,
		docsPath: "/docs/core/logs-monitoring",
	},
	"NP-1033": {
		code: "NP-1033",
		httpStatus: 502,
		category: "connectivity",
		title: "Tunnel or connector unavailable",
		description:
			"The gateway could not reach the application through its tunnel or remote connector.",
		visitorGuidance:
			"The service is temporarily unreachable. Try again in a few moments.",
		operatorGuidance:
			"Check that the connector or tunnel client is connected, that its credentials are valid and that the target server is reachable. Reconnect the tunnel after fixing the underlying issue.",
		retryable: true,
		docsPath: "/docs/core/cloudflare-tunnels",
	},
	"NP-1052": {
		code: "NP-1052",
		httpStatus: 502,
		category: "connectivity",
		title: "Secure connection failed",
		description:
			"The gateway could not establish a trusted TLS connection to the application.",
		visitorGuidance:
			"The service is temporarily unavailable. Try again in a few moments.",
		operatorGuidance:
			"Verify the origin certificate is valid for the configured hostname and that its trust chain is complete. If the origin uses a private CA, make sure the gateway trusts it.",
		retryable: true,
		docsPath: "/docs/core/certificates",
	},
	"NP-1503": {
		code: "NP-1503",
		httpStatus: 503,
		category: "maintenance",
		title: "Scheduled maintenance",
		description:
			"This application is temporarily offline for maintenance.",
		visitorGuidance:
			"The service is intentionally paused. Try again after the maintenance window.",
		operatorGuidance:
			"This code is reserved for an explicit maintenance response. Check the maintenance window and bring the deployment back online when the work is complete.",
		retryable: true,
		docsPath: "/docs/core/administration",
	},
	"NP-1999": {
		code: "NP-1999",
		httpStatus: 502,
		category: "fallback",
		title: "Unexpected gateway error",
		description:
			"The gateway could not complete the request because of an unexpected error.",
		visitorGuidance:
			"The service is temporarily unavailable. Try again in a few moments.",
		operatorGuidance:
			"Review the Traefik logs and the gateway error service logs for the request ID shown below. Fix the upstream error and redeploy if necessary.",
		retryable: true,
		docsPath: "/docs/core/traefik",
	},
};

const STATUS_TO_CODE: Record<number, GatewayErrorCode> = {
	404: "NP-1001",
	502: "NP-1003",
	503: "NP-1002",
	504: "NP-1004",
};

export const getGatewayErrorByCode = (
	code: string | null | undefined,
): GatewayErrorDefinition | null => {
	if (!code) return null;
	if (!(GATEWAY_ERROR_CODES as readonly string[]).includes(code)) {
		return null;
	}
	return GATEWAY_ERRORS[code as GatewayErrorCode];
};

export const getDefaultGatewayError = (
	httpStatus: number,
): GatewayErrorDefinition => {
	const code = STATUS_TO_CODE[httpStatus];
	return code ? GATEWAY_ERRORS[code] : GATEWAY_ERRORS["NP-1999"];
};

export const resolveGatewayError = (
	httpStatus: number,
	requestedCode?: string | null,
): GatewayErrorDefinition => {
	const normalizedStatus =
		Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599
			? httpStatus
			: 502;
	const requested = getGatewayErrorByCode(requestedCode);
	if (requested && requested.httpStatus === normalizedStatus) {
		return requested;
	}
	const definition = getDefaultGatewayError(normalizedStatus);
	return { ...definition, httpStatus: normalizedStatus };
};
