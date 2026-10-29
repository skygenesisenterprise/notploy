import {
	GATEWAY_ERRORS,
	getGatewayErrorPageConfig,
	renderGatewayErrorPage,
	safeHttpUrl,
} from "@notploy/server";
import { describe, expect, test } from "vitest";

const config = getGatewayErrorPageConfig({
	NOTPLOY_GATEWAY_BRAND_NAME: "Acme Cloud",
	NOTPLOY_GATEWAY_DOCS_URL: "https://docs.example.com/",
	NOTPLOY_GATEWAY_STATUS_URL: "https://status.example.com",
	NOTPLOY_GATEWAY_SUPPORT_URL: "https://support.example.com",
	IS_CLOUD: "true",
});

describe("safeHttpUrl", () => {
	test("accepts http and https URLs", () => {
		expect(safeHttpUrl("https://example.com")).toBe("https://example.com/");
		expect(safeHttpUrl("http://example.com/path")).toBe(
			"http://example.com/path",
		);
	});

	test("rejects unsafe and malformed URLs", () => {
		expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
		expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
		expect(safeHttpUrl("https://user:pass@example.com")).toBeNull();
		expect(safeHttpUrl("not a url")).toBeNull();
		expect(safeHttpUrl("")).toBeNull();
		expect(safeHttpUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
	});
});

describe("getGatewayErrorPageConfig", () => {
	test("reads brand, links, locale and cloud flag", () => {
		expect(config.brandName).toBe("Acme Cloud");
		expect(config.docsUrl).toBe("https://docs.example.com/");
		expect(config.statusUrl).toBe("https://status.example.com/");
		expect(config.supportUrl).toBe("https://support.example.com/");
		expect(config.locale).toBe("en");
		expect(config.isCloud).toBe(true);
	});

	test("falls back to safe defaults", () => {
		const fallback = getGatewayErrorPageConfig({});
		expect(fallback.brandName).toBe("Notploy");
		expect(fallback.docsUrl).toBeNull();
		expect(fallback.statusUrl).toBeNull();
		expect(fallback.supportUrl).toBeNull();
		expect(fallback.locale).toBe("en");
		expect(fallback.isCloud).toBe(false);
	});

	test("rejects invalid links and locales", () => {
		const invalid = getGatewayErrorPageConfig({
			NOTPLOY_GATEWAY_DOCS_URL: "javascript:alert(1)",
			NOTPLOY_GATEWAY_LOCALE: "<script>",
		});
		expect(invalid.docsUrl).toBeNull();
		expect(invalid.locale).toBe("en");
	});

	test("caps the brand name length", () => {
		const longBrand = getGatewayErrorPageConfig({
			NOTPLOY_GATEWAY_BRAND_NAME: "a".repeat(200),
		});
		expect(longBrand.brandName).toHaveLength(64);
	});
});

describe("renderGatewayErrorPage", () => {
	test("renders codes, request id, timestamp and guidance", () => {
		const timestamp = new Date("2026-10-29T12:34:56.789Z");
		const html = renderGatewayErrorPage({
			error: GATEWAY_ERRORS["NP-1003"],
			requestId: "np_0123456789abcdef0123456789abcdef",
			timestamp,
			config,
		});

		expect(html).toContain("NP-1003");
		expect(html).toContain("np_0123456789abcdef0123456789abcdef");
		expect(html).toContain("2026-10-29T12:34:56Z");
		expect(html).toContain("2026-10-29 12:34:56 UTC");
		expect(html).toContain("Acme Cloud");
		expect(html).toContain("If you are visiting this site");
		expect(html).toContain("If you operate this application");
		expect(html).toContain("502 Bad Gateway");
		expect(html).toContain("Bad gateway");
		expect(html).toContain("Error code 502");
		expect(html).toContain("What happened?");
		expect(html).toContain("What can I do?");
		expect(html).toContain("Browser");
		expect(html).toContain("Working");
		expect(html).toContain("Application");
		expect(html).toContain("Host");
		expect(html).toContain('<p class="status-state is-error">Error</p>');
		expect(html).toContain('<p class="status-label">Cloud</p>');
		expect(html).toContain("https://docs.example.com/docs/core/domains");
		expect(html).toContain("https://status.example.com/");
		expect(html).toContain("https://support.example.com/");
		expect(html).toContain('lang="en"');
	});

	test("escapes every interpolated value", () => {
		const html = renderGatewayErrorPage({
			error: {
				...GATEWAY_ERRORS["NP-1999"],
				title: '<script>alert("xss")</script>',
				description: "<img src=x onerror=alert(1)>",
				visitorGuidance: "a & b",
				operatorGuidance: "'quoted'",
			},
			requestId: 'np_<script>',
			timestamp: new Date("2026-01-01T00:00:00Z"),
			config: {
				...config,
				brandName: "<b>Acme</b>",
				docsUrl: null,
				statusUrl: null,
				supportUrl: null,
			},
		});

		expect(html).not.toContain("<script>");
		expect(html).not.toContain("<img src=x");
		expect(html).not.toContain("<b>Acme</b>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
		expect(html).toContain("a &amp; b");
		expect(html).toContain("&#39;quoted&#39;");
	});

	test("omits links when no valid URL is configured", () => {
		const html = renderGatewayErrorPage({
			error: GATEWAY_ERRORS["NP-1001"],
			requestId: "np_0123456789abcdef0123456789abcdef",
			timestamp: new Date("2026-01-01T00:00:00Z"),
			config: {
				...config,
				docsUrl: null,
				statusUrl: null,
				supportUrl: null,
			},
		});
		expect(html).not.toContain("<a ");
	});

	test("shows the environment in the connection status table", () => {
		const cloud = renderGatewayErrorPage({
			error: GATEWAY_ERRORS["NP-1002"],
			requestId: "np_0123456789abcdef0123456789abcdef",
			timestamp: new Date("2026-01-01T00:00:00Z"),
			config: { ...config, brandName: "Acme", isCloud: true },
		});
		const selfHosted = renderGatewayErrorPage({
			error: GATEWAY_ERRORS["NP-1002"],
			requestId: "np_0123456789abcdef0123456789abcdef",
			timestamp: new Date("2026-01-01T00:00:00Z"),
			config: { ...config, brandName: "Acme", isCloud: false },
		});

		expect(cloud).toContain('<p class="status-label">Cloud</p>');
		expect(selfHosted).toContain('<p class="status-label">Self-hosted</p>');
	});
});
