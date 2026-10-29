import {
	buildGatewayErrorsEnv,
	getGatewayErrorsImage,
} from "@notploy/server";
import { describe, expect, test } from "vitest";

const dockerWithImage = (image: string) =>
	({
		getContainer: () => ({
			inspect: async () => ({ Config: { Image: image } }),
		}),
	}) as unknown as Parameters<typeof getGatewayErrorsImage>[0];

describe("buildGatewayErrorsEnv", () => {
	test("passes the validated page configuration to the sidecar", () => {
		const env = buildGatewayErrorsEnv({
			NOTPLOY_GATEWAY_BRAND_NAME: "Acme",
			NOTPLOY_GATEWAY_DOCS_URL: "https://docs.example.com",
			NOTPLOY_GATEWAY_STATUS_URL: "https://status.example.com",
			NOTPLOY_GATEWAY_SUPPORT_URL: "javascript:alert(1)",
			NOTPLOY_GATEWAY_LOCALE: "fr",
			IS_CLOUD: "true",
		});

		expect(env).toContain("NOTPLOY_GATEWAY_BRAND_NAME=Acme");
		expect(env).toContain(
			"NOTPLOY_GATEWAY_DOCS_URL=https://docs.example.com/",
		);
		expect(env).toContain(
			"NOTPLOY_GATEWAY_STATUS_URL=https://status.example.com/",
		);
		expect(env).toContain("NOTPLOY_GATEWAY_LOCALE=fr");
		expect(env).toContain("NOTPLOY_GATEWAY_PORT=8080");
		expect(env).toContain("IS_CLOUD=true");
		expect(env.some((value) => value.startsWith("NOTPLOY_GATEWAY_SUPPORT_URL="))).toBe(
			false,
		);
	});

	test("uses safe defaults when no overrides are present", () => {
		const env = buildGatewayErrorsEnv({});
		expect(env).toContain("NOTPLOY_GATEWAY_BRAND_NAME=Notploy");
		expect(env).toContain("NOTPLOY_GATEWAY_LOCALE=en");
		expect(env).toContain("IS_CLOUD=false");
	});
});

describe("getGatewayErrorsImage", () => {
	test("prefers the explicit sidecar image", async () => {
		const image = await getGatewayErrorsImage(
			dockerWithImage("ignored:latest"),
			undefined,
			{ NOTPLOY_GATEWAY_ERRORS_IMAGE: "node:24-alpine" },
		);
		expect(image).toBe("node:24-alpine");
	});

	test("reuses the running control-plane image", async () => {
		const image = await getGatewayErrorsImage(
			dockerWithImage("notploy:local"),
			undefined,
			{},
		);
		expect(image).toBe("notploy:local");
	});

	test("builds the image from NOTPLOY_IMAGE and NOTPLOY_VERSION", async () => {
		const image = await getGatewayErrorsImage(
			dockerWithImage("notploy:local"),
			"server-1",
			{
				NOTPLOY_IMAGE: "ghcr.io/example/notploy",
				NOTPLOY_VERSION: "v1.2.3",
			},
		);
		expect(image).toBe("ghcr.io/example/notploy:v1.2.3");
	});

	test("does not append a tag to an image that already has one", async () => {
		const image = await getGatewayErrorsImage(
			dockerWithImage("notploy:local"),
			"server-1",
			{ NOTPLOY_IMAGE: "ghcr.io/example/notploy:canary" },
		);
		expect(image).toBe("ghcr.io/example/notploy:canary");
	});
});
