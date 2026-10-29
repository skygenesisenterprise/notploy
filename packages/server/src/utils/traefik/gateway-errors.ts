import { writeTraefikConfig, writeTraefikConfigRemote } from "./application";
import type { FileConfig } from "./file-types";

export const GATEWAY_ERRORS_CONFIG_NAME = "gateway-errors";
export const GATEWAY_ERRORS_MIDDLEWARE_NAME = "notploy-gateway-errors";
export const GATEWAY_ERRORS_SERVICE_NAME = "notploy-gateway-errors";
export const GATEWAY_ERRORS_ERROR_PATH = "/__notploy_error";

const GATEWAY_ERRORS_PORT = 8080;

export const buildGatewayErrorsConfig = (): FileConfig => ({
	http: {
		routers: {
			"notploy-gateway-errors-web": {
				rule: "PathPrefix(`/`)",
				priority: 1,
				service: GATEWAY_ERRORS_SERVICE_NAME,
				entryPoints: ["web"],
			},
			"notploy-gateway-errors-websecure": {
				rule: "PathPrefix(`/`)",
				priority: 1,
				service: GATEWAY_ERRORS_SERVICE_NAME,
				entryPoints: ["websecure"],
			},
		},
		services: {
			[GATEWAY_ERRORS_SERVICE_NAME]: {
				loadBalancer: {
					servers: [
						{
							url: `http://${GATEWAY_ERRORS_SERVICE_NAME}:${GATEWAY_ERRORS_PORT}`,
						},
					],
					passHostHeader: true,
				},
			},
		},
		middlewares: {
			[GATEWAY_ERRORS_MIDDLEWARE_NAME]: {
				errors: {
					status: ["500-599"],
					service: GATEWAY_ERRORS_SERVICE_NAME,
					query: `${GATEWAY_ERRORS_ERROR_PATH}?status={status}`,
				},
			},
		},
	},
});

export const writeGatewayErrorsConfig = async (
	serverId?: string | null,
): Promise<void> => {
	const config = buildGatewayErrorsConfig();
	if (serverId) {
		await writeTraefikConfigRemote(
			config,
			GATEWAY_ERRORS_CONFIG_NAME,
			serverId,
		);
		return;
	}
	writeTraefikConfig(config, GATEWAY_ERRORS_CONFIG_NAME);
};
