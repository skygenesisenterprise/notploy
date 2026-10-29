import {
	GATEWAY_ERRORS_MIDDLEWARE_NAME,
	buildGatewayErrorsConfig,
	createDomainLabels,
	createRouterConfig,
	type ApplicationNested,
	type Domain,
} from "@notploy/server";
import { describe, expect, test } from "vitest";

const app = {
	appName: "my-app",
	redirects: [],
	security: [],
} as unknown as ApplicationNested;

const domain: Domain = {
	applicationId: "app-1",
	certificateType: "none",
	cloudManaged: false,
	createdAt: "",
	domainId: "domain-1",
	host: "app.example.com",
	https: false,
	path: null,
	port: 3000,
	customEntrypoint: null,
	serviceName: "",
	composeId: "",
	customCertResolver: null,
	domainType: "application",
	uniqueConfigKey: 7,
	previewDeploymentId: "",
	internalPath: "/",
	stripPath: false,
	middlewares: null,
	forwardAuthEnabled: false,
	enabled: true,
};

describe("buildGatewayErrorsConfig", () => {
	test("defines the 5xx errors middleware, sidecar service and catch-all routers", () => {
		const config = buildGatewayErrorsConfig();
		const http = config.http;

		expect(http?.middlewares?.[GATEWAY_ERRORS_MIDDLEWARE_NAME]).toEqual({
			errors: {
				status: ["500-599"],
				service: "notploy-gateway-errors",
				query: "/__notploy_error?status={status}",
			},
		});
		expect(http?.services?.["notploy-gateway-errors"]).toEqual({
			loadBalancer: {
				servers: [{ url: "http://notploy-gateway-errors:8080" }],
				passHostHeader: true,
			},
		});
		expect(http?.routers?.["notploy-gateway-errors-web"]).toMatchObject({
			rule: "PathPrefix(`/`)",
			priority: 1,
			service: "notploy-gateway-errors",
			entryPoints: ["web"],
		});
		expect(
			http?.routers?.["notploy-gateway-errors-websecure"],
		).toMatchObject({
			rule: "PathPrefix(`/`)",
			priority: 1,
			service: "notploy-gateway-errors",
			entryPoints: ["websecure"],
		});
	});
});

describe("gateway error middleware wiring", () => {
	test("attaches the middleware to application routers", async () => {
		const router = await createRouterConfig(app, domain, "websecure");
		expect(router.middlewares?.[0]).toBe(GATEWAY_ERRORS_MIDDLEWARE_NAME);
	});

	test("does not attach the middleware to the HTTPS redirect router", async () => {
		const router = await createRouterConfig(
			app,
			{ ...domain, https: true },
			"web",
		);
		expect(router.middlewares).toEqual(["redirect-to-https"]);
	});

	test("attaches the file-provider middleware to compose routers", () => {
		const labels = createDomainLabels("my-stack", domain, "web");
		const middlewareLabel = labels.find((label) =>
			label.includes("middlewares="),
		);
		expect(middlewareLabel).toContain(
			`${GATEWAY_ERRORS_MIDDLEWARE_NAME}@file`,
		);
	});

	test("does not attach the middleware to compose redirect routers", () => {
		const labels = createDomainLabels(
			"my-stack",
			{ ...domain, https: true },
			"web",
		);
		const middlewareLabel = labels.find((label) =>
			label.includes("middlewares="),
		);
		expect(middlewareLabel).toContain("redirect-to-https@file");
		expect(middlewareLabel).not.toContain(GATEWAY_ERRORS_MIDDLEWARE_NAME);
	});
});
