import {
	bucketStartFor,
	dayBucketOf,
	deviceTypeOf,
	normalizeHost,
	normalizeRoute,
	NOTPLOY_SERVICE_NAME,
	parseTraefikAccessLog,
	parseTraefikAccessLogLine,
	referrerHostOf,
	resolvePropertyId,
	statusClassOf,
	stripQueryAndHash,
} from "@notploy/server/utils/traffic/parse";
import { describe, expect, it } from "vitest";

const traefikLine = (overrides: Record<string, unknown> = {}) =>
	JSON.stringify({
		ClientAddr: "172.19.0.1:56732",
		ClientHost: "172.19.0.1",
		DownstreamContentSize: 4096,
		DownstreamStatus: 200,
		Duration: 45_000_000,
		OriginStatus: 200,
		RequestContentSize: 12,
		RequestHost: "notploy.com",
		RequestMethod: "get",
		RequestPath: "/pricing?token=super-secret#anchor",
		RequestProtocol: "HTTP/2.0",
		RouterName: "notploy-com-web@file",
		ServiceName: NOTPLOY_SERVICE_NAME,
		StartUTC: "2026-10-12T09:04:05.123456789Z",
		entryPointName: "websecure",
		level: "info",
		...overrides,
	});

describe("stripQueryAndHash", () => {
	it("removes the query string and the fragment", () => {
		expect(stripQueryAndHash("/pricing?token=abc#x")).toBe("/pricing");
		expect(stripQueryAndHash("/a?b=1")).toBe("/a");
		expect(stripQueryAndHash("/a#b")).toBe("/a");
		expect(stripQueryAndHash("/a")).toBe("/a");
	});
});

describe("normalizeRoute", () => {
	it("collapses identifiers so a route is a stable aggregate key", () => {
		expect(normalizeRoute("/users/42/profile")).toBe("/users/:id/profile");
		expect(
			normalizeRoute("/orders/8f14e45f-ceea-467a-9d0b-1c2d3e4f5a6b"),
		).toBe("/orders/:id");
		expect(normalizeRoute("/builds/9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c")).toBe(
			"/builds/:hash",
		);
		expect(normalizeRoute("/share/Dk3n1kdm3oW9zkdn3jHf73bVd0")).toBe(
			"/share/:token",
		);
	});

	it("keeps readable segments and groups static assets", () => {
		expect(normalizeRoute("/dashboard/Website/Traffic/")).toBe(
			"/dashboard/website/traffic",
		);
		expect(normalizeRoute("/_next/static/chunks/main-1a2b3c/dashboard.js")).toBe(
			"/:static/js",
		);
		expect(normalizeRoute("/images/og.png")).toBe("/:static/png");
	});

	it("attributes a Next.js data request to the page it hydrates", () => {
		expect(normalizeRoute("/_next/data/cb_zzI4Rp9G7Q7djrFKh0/en/faq.json")).toBe(
			"/en/faq",
		);
	});

it("bounds the fragmented path", () => {
		expect(normalizeRoute("/a/b/c/d/e/f/g/h/i/j/k")).toBe("/a/b/c/d/e/f/g/h");
		// Data endpoints stay visible instead of being folded into static assets.
		expect(normalizeRoute("/api/logs.json")).toBe("/api/logs.json");
		expect(normalizeRoute("/robots.txt")).toBe("/robots.txt");
		expect(normalizeRoute("")).toBe("/");
		expect(normalizeRoute(null)).toBe("/");
		expect(normalizeRoute("/")).toBe("/");
	});

	it("never keeps a query string in the stored route", () => {
		const route = normalizeRoute("/api/logs?filter=email%3Dfoo@bar.com");
		expect(route).toBe("/api/logs");
		expect(route).not.toContain("foo@bar.com");
	});
});

describe("host and referrer normalisation", () => {
	it("lowercases hosts and drops the port", () => {
		expect(normalizeHost("NotPloy.COM:8443")).toBe("notploy.com");
		expect(normalizeHost("notploy.com.")).toBe("notploy.com");
		expect(normalizeHost("[::1]:3000")).toBe("::1");
		expect(normalizeHost(null)).toBe("");
	});

	it("keeps only the referrer host", () => {
		expect(referrerHostOf("https://www.google.com/search?q=secret")).toBe(
			"www.google.com",
		);
		expect(referrerHostOf("")).toBe("");
		expect(referrerHostOf("not a url")).toBe("");
	});
});

describe("status and device classification", () => {
	it("maps statuses to their class", () => {
		expect(statusClassOf(204)).toBe("2xx");
		expect(statusClassOf(301)).toBe("3xx");
		expect(statusClassOf(404)).toBe("4xx");
		expect(statusClassOf(500)).toBe("5xx");
		expect(statusClassOf(0)).toBe("other");
		expect(statusClassOf(101)).toBe("other");
	});

	it("derives a coarse device category without storing the user agent", () => {
		expect(
			deviceTypeOf(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
			),
		).toBe("mobile");
		expect(
			deviceTypeOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148"),
		).toBe("tablet");
		expect(
			deviceTypeOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605"),
		).toBe("desktop");
		expect(deviceTypeOf("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(
			"unknown",
		);
		expect(deviceTypeOf(null)).toBe("unknown");
	});
});

describe("parseTraefikAccessLogLine", () => {
	it("keeps only the pipeline fields and redacts the sensitive ones", () => {
		const event = parseTraefikAccessLogLine(traefikLine());
		expect(event).not.toBeNull();
		expect(event).toMatchObject({
			host: "notploy.com",
			route: "/pricing",
			method: "GET",
			status: 200,
			statusClass: "2xx",
			bytesIn: 12,
			bytesOut: 4096,
			durationMs: 45,
			serviceName: NOTPLOY_SERVICE_NAME,
			protocol: "HTTP/2.0",
		});
		expect(event?.timestamp.toISOString()).toBe("2026-10-12T09:04:05.123Z");
		// Nothing that could identify a visitor or a session may survive.
		expect(JSON.stringify(event)).not.toContain("172.19.0.1");
		expect(JSON.stringify(event)).not.toContain("super-secret");
	});

	it("rejects incomplete or malformed lines instead of guessing", () => {
		expect(parseTraefikAccessLogLine("not json")).toBeNull();
		expect(parseTraefikAccessLogLine("")).toBeNull();
		expect(parseTraefikAccessLogLine('{"ClientAddr":"1.2.3.4:1"}')).toBeNull();
		expect(
			parseTraefikAccessLogLine(traefikLine({ StartUTC: "not-a-date" })),
		).toBeNull();
		expect(
			parseTraefikAccessLogLine(traefikLine({ RequestHost: undefined })),
		).toBeNull();
		// A record truncated by log rotation must be dropped, not guessed at.
		expect(
			parseTraefikAccessLogLine(
				'{"StartUTC":"2026-01-01","RequestHost":"notploy.com"',
			),
		).toBeNull();
	});

	it("tolerates missing optional fields", () => {
		const event = parseTraefikAccessLogLine(
			traefikLine({ DownstreamContentSize: undefined, RequestContentSize: undefined }),
		);
		expect(event?.bytesIn).toBe(0);
		expect(event?.bytesOut).toBe(0);
	});

	it("falls back to the origin status and cleans negative durations", () => {
		const event = parseTraefikAccessLogLine(
			traefikLine({ DownstreamStatus: undefined, OriginStatus: 503, Duration: -10 }),
		);
		expect(event?.status).toBe(503);
		expect(event?.statusClass).toBe("5xx");
		expect(event?.durationMs).toBe(0);
	});
});

describe("parseTraefikAccessLog", () => {
	it("parses a chunk and counts the unusable lines", () => {
		const chunk = [traefikLine(), "{truncated", "", traefikLine()].join("\n");
		const { events, invalidLines } = parseTraefikAccessLog(chunk);
		expect(events).toHaveLength(2);
		expect(invalidLines).toBe(1);
	});

	it("bounds the number of events it returns", () => {
		const chunk = [traefikLine(), traefikLine(), traefikLine()].join("\n");
		expect(parseTraefikAccessLog(chunk, { maxEvents: 2 }).events).toHaveLength(2);
	});

	it("handles an empty input", () => {
		expect(parseTraefikAccessLog("").events).toEqual([]);
		expect(parseTraefikAccessLog(null).events).toEqual([]);
	});
});

describe("resolvePropertyId", () => {
	const properties = [
		{ id: "apex", domain: "notploy.com", matchesSubdomains: true },
		{ id: "docs", domain: "docs.notploy.com", matchesSubdomains: false },
		{ id: "api", domain: "api.notploy.com", matchesSubdomains: false },
	];

	it("prefers the most specific declared domain", () => {
		expect(resolvePropertyId("notploy.com", properties)).toBe("apex");
		expect(resolvePropertyId("www.notploy.com", properties)).toBe("apex");
		expect(resolvePropertyId("docs.notploy.com", properties)).toBe("docs");
		expect(
			resolvePropertyId("deep.docs.notploy.com", properties),
		).toBe("apex");
	});

	it("returns undefined for an unwatched host", () => {
		expect(resolvePropertyId("example.com", properties)).toBeUndefined();
		expect(resolvePropertyId("", properties)).toBeUndefined();
	});

	it("ignores sub-domains when the property forbids them", () => {
		expect(
			resolvePropertyId("extra.api.notploy.com", [
				{ id: "api", domain: "api.notploy.com", matchesSubdomains: false },
			]),
		).toBeUndefined();
	});
});

describe("bucket helpers", () => {
	it("aligns buckets on Unix time", () => {
		const bucket = bucketStartFor(new Date("2026-10-12T09:04:05.123Z"));
		expect(bucket.toISOString()).toBe("2026-10-12T09:00:00.000Z");
		const coarse = bucketStartFor(new Date("2026-10-12T09:14:05.123Z"), 900);
		expect(coarse.toISOString()).toBe("2026-10-12T09:00:00.000Z");
	});

	it("derives the UTC day bucket used by session retention", () => {
		expect(dayBucketOf(new Date("2026-10-12T23:59:59.999Z"))).toBe("2026-10-12");
	});
});
