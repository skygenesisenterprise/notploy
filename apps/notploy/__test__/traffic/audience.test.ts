import {
	audienceIngestPayloadSchema,
	isAudiencePayloadSizeAcceptable,
	MAX_AUDIENCE_EVENTS_PER_REQUEST,
	MAX_AUDIENCE_PAYLOAD_BYTES,
	normalizeAudienceEvents,
} from "@notploy/server/utils/traffic/audience";
import { isAudienceOriginAllowed } from "@notploy/server/services/traffic";
import { describe, expect, it } from "vitest";

const pageview = (overrides: Record<string, unknown> = {}) => ({
	type: "pageview",
	path: "/pricing",
	sessionId: "session-1",
	visitorId: "visitor-1",
	referrer: "https://www.google.com/search?q=notploy",
	timestamp: "2026-10-12T09:00:00.000Z",
	...overrides,
});

const payload = (events: unknown[] = [pageview()]) => ({
	publicKey: "pk_0123456789abcdef0123456789abcdef",
	events,
});

describe("audience payload validation", () => {
	it("accepts a well-formed batch", () => {
		const result = audienceIngestPayloadSchema.safeParse(payload());
		expect(result.success).toBe(true);
	});

	it("rejects unknown keys, so the collector cannot receive extra personal data", () => {
		const withExtra = pageview({ email: "someone@example.com" });
		expect(audienceIngestPayloadSchema.safeParse(payload([withExtra])).success).toBe(
			false,
		);
		expect(
			audienceIngestPayloadSchema.safeParse({
				...payload(),
				ip: "203.0.113.10",
			}).success,
		).toBe(false);
	});

	it("rejects oversized batches, bad identifiers and bad event names", () => {
		const tooMany = Array.from({ length: MAX_AUDIENCE_EVENTS_PER_REQUEST + 1 }, () =>
			pageview(),
		);
		expect(audienceIngestPayloadSchema.safeParse(payload(tooMany)).success).toBe(
			false,
		);

		expect(
			audienceIngestPayloadSchema.safeParse(
				payload([pageview({ sessionId: "spaces are not allowed" })]),
			).success,
		).toBe(false);
		expect(
			audienceIngestPayloadSchema.safeParse(
				payload([
					pageview({ type: "event", name: "Signup Completed!", path: undefined }),
				]),
			).success,
		).toBe(false);
		expect(
			audienceIngestPayloadSchema.safeParse(payload([pageview({ type: "click" })]))
				.success,
		).toBe(false);
		expect(
			audienceIngestPayloadSchema.safeParse({ ...payload(), events: [] }).success,
		).toBe(false);
		expect(
			audienceIngestPayloadSchema.safeParse({ publicKey: "short", events: [pageview()] })
				.success,
		).toBe(false);
	});

	it("bounds the request size before parsing", () => {
		expect(isAudiencePayloadSizeAcceptable("{}")).toBe(true);
		expect(
			isAudiencePayloadSizeAcceptable("x".repeat(MAX_AUDIENCE_PAYLOAD_BYTES + 1)),
		).toBe(false);
		expect(isAudiencePayloadSizeAcceptable(null)).toBe(false);
	});
});

describe("normalizeAudienceEvents", () => {
	const options = {
		now: new Date("2026-10-12T09:00:30.000Z"),
		siteHost: "notploy.com",
	};

	it("normalises a page view", () => {
		const parsed = audienceIngestPayloadSchema.parse(payload());
		const events = normalizeAudienceEvents(parsed, options);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			kind: "pageview",
			path: "/pricing",
			referrerHost: "www.google.com",
			sessionId: "session-1",
			visitorId: "visitor-1",
		});
	});

	it("drops an internal referrer instead of counting the site as its own source", () => {
		const parsed = audienceIngestPayloadSchema.parse(
			payload([pageview({ referrer: "https://notploy.com/docs?token=1" })]),
		);
		expect(normalizeAudienceEvents(parsed, options)[0]?.referrerHost).toBe("");
	});

	it("clamps an implausible client timestamp to the ingest time", () => {
		const parsed = audienceIngestPayloadSchema.parse(
			payload([pageview({ timestamp: "1999-01-01T00:00:00.000Z" })]),
		);
		const events = normalizeAudienceEvents(parsed, options);
		expect(events[0]?.timestamp.toISOString()).toBe("2026-10-12T09:00:30.000Z");
	});

	it("normalises an explicit event name and drops an unnamed one", () => {
		const parsed = audienceIngestPayloadSchema.parse(
			payload([
				{ type: "event", name: "signup_completed", sessionId: "s", visitorId: "v" },
				{ type: "event", sessionId: "s", visitorId: "v" },
			]),
		);
		const events = normalizeAudienceEvents(parsed, options);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			kind: "event",
			name: "signup_completed",
			path: "/",
		});
	});
});

describe("isAudienceOriginAllowed", () => {
	it("accepts the property domain and its sub-domains by default", () => {
		expect(
			isAudienceOriginAllowed({
				origin: "https://notploy.com",
				allowedOrigins: undefined,
				propertyDomain: "notploy.com",
			}),
		).toBe(true);
		expect(
			isAudienceOriginAllowed({
				origin: "https://www.notploy.com",
				allowedOrigins: undefined,
				propertyDomain: "notploy.com",
			}),
		).toBe(true);
	});

	it("refuses another origin and malformed origins", () => {
		expect(
			isAudienceOriginAllowed({
				origin: "https://evil.example.com",
				allowedOrigins: undefined,
				propertyDomain: "notploy.com",
			}),
		).toBe(false);
		expect(
			isAudienceOriginAllowed({
				origin: "not-an-origin",
				allowedOrigins: undefined,
				propertyDomain: "notploy.com",
			}),
		).toBe(false);
	});

	it("honours an explicit allow-list, including sub-domain look-alikes", () => {
		expect(
			isAudienceOriginAllowed({
				origin: "https://docs.notploy.com",
				allowedOrigins: ["docs.notploy.com"],
				propertyDomain: "notploy.com",
			}),
		).toBe(true);
		expect(
			isAudienceOriginAllowed({
				origin: "https://notploy.com",
				allowedOrigins: ["docs.notploy.com"],
				propertyDomain: "notploy.com",
			}),
		).toBe(false);
	});

	it("allows a server-side call without an Origin header", () => {
		expect(
			isAudienceOriginAllowed({
				origin: undefined,
				allowedOrigins: ["docs.notploy.com"],
				propertyDomain: "notploy.com",
			}),
		).toBe(true);
	});
});
