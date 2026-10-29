import type { AddressInfo } from "node:net";
import {
	startGatewayErrorsServer,
	type GatewayErrorLogRecord,
} from "@notploy/server";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const now = () => new Date("2026-10-29T12:34:56.789Z");
const logs: GatewayErrorLogRecord[] = [];
let server: ReturnType<typeof startGatewayErrorsServer>;
let baseUrl = "";

beforeAll(async () => {
	server = startGatewayErrorsServer({
		port: 0,
		env: {
			NOTPLOY_GATEWAY_BRAND_NAME: "Acme",
			NOTPLOY_GATEWAY_PORT: "8080",
		},
		now,
		logger: (record) => logs.push(record),
	});
	await new Promise<void>((resolve) => server.on("listening", resolve));
	const address = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("gateway error server", () => {
	test("serves the 404 page for unmatched routes by default", async () => {
		const response = await fetch(`${baseUrl}/missing`);
		const body = await response.text();

		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("x-robots-tag")).toContain("noindex");
		expect(response.headers.get("x-notploy-error-code")).toBe("NP-1001");
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(response.headers.get("retry-after")).toBeNull();

		const requestId = response.headers.get("x-notploy-request-id");
		expect(requestId).toMatch(/^np_[0-9a-f]{32}$/);
		expect(body).toContain("NP-1001");
		expect(body).toContain(requestId);
		expect(body).toContain("2026-10-29T12:34:56Z");
		expect(body).toContain("If you are visiting this site");
		expect(body).toContain("If you operate this application");
	});

	test("renders the status provided by the Traefik errors middleware", async () => {
		const response = await fetch(
			`${baseUrl}/__notploy_error?status=502`,
		);
		const body = await response.text();

		expect(response.status).toBe(502);
		expect(response.headers.get("x-notploy-error-code")).toBe("NP-1003");
		expect(response.headers.get("retry-after")).toBe("30");
		expect(body).toContain("Cannot reach the application");
		expect(body).toContain("502 Bad Gateway");
	});

	test("honours an explicit code when it matches the status", async () => {
		const response = await fetch(
			`${baseUrl}/__notploy_error?status=503&code=NP-1503`,
		);
		const body = await response.text();

		expect(response.status).toBe(503);
		expect(response.headers.get("x-notploy-error-code")).toBe("NP-1503");
		expect(body).toContain("Scheduled maintenance");
	});

	test("ignores a code that does not match the status", async () => {
		const response = await fetch(
			`${baseUrl}/__notploy_error?status=502&code=NP-1503`,
		);

		expect(response.headers.get("x-notploy-error-code")).toBe("NP-1003");
	});

	test("maps malformed and non-error statuses to 404", async () => {
		for (const status of ["200", "abc", "999"]) {
			const response = await fetch(
				`${baseUrl}/__notploy_error?status=${status}`,
			);
			expect(response.status).toBe(404);
			expect(response.headers.get("x-notploy-error-code")).toBe("NP-1001");
		}
	});

	test("never reflects the Host header in the page", async () => {
		const response = await fetch(`${baseUrl}/`, {
			headers: { Host: "<script>alert(1)</script>" },
		});
		const body = await response.text();

		expect(body).not.toContain("<script>alert(1)</script>");
	});

	test("responds to HEAD without a body", async () => {
		const response = await fetch(`${baseUrl}/missing`, { method: "HEAD" });
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	test("answers health checks without rendering a page", async () => {
		const response = await fetch(`${baseUrl}/healthz`);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe("ok\n");
	});

	test("logs structured records without the query string", async () => {
		logs.length = 0;
		await fetch(`${baseUrl}/__notploy_error?status=504&secret=value`);

		expect(logs).toHaveLength(1);
		const record = logs[0];
		expect(record.event).toBe("gateway_error");
		expect(record.code).toBe("NP-1004");
		expect(record.status).toBe(504);
		expect(record.requestId).toMatch(/^np_[0-9a-f]{32}$/);
		expect(record.timestamp).toBe("2026-10-29T12:34:56.789Z");
		expect(record.path).toBe("/__notploy_error");
		expect(JSON.stringify(record)).not.toContain("secret");
	});
});
