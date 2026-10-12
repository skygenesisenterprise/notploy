import {
	MAX_TRAFFIC_RANGE_DAYS,
	resolveTrafficRange,
	TrafficRangeError,
} from "@notploy/server/services/traffic-analytics";
import { describe, expect, it } from "vitest";

const now = new Date("2026-10-12T12:00:00.000Z");

describe("resolveTrafficRange", () => {
	it("resolves each preset and its comparison window", () => {
		const hour = resolveTrafficRange({ preset: "1h" }, now);
		expect(hour.from.toISOString()).toBe("2026-10-12T11:00:00.000Z");
		expect(hour.to.toISOString()).toBe(now.toISOString());
		expect(hour.intervalSeconds).toBe(300);
		expect(hour.previousFrom.toISOString()).toBe("2026-10-12T10:00:00.000Z");
		expect(hour.previousTo.toISOString()).toBe(hour.from.toISOString());

		expect(resolveTrafficRange({ preset: "24h" }, now).intervalSeconds).toBe(900);
		expect(resolveTrafficRange({ preset: "7d" }, now).intervalSeconds).toBe(3600);
		expect(resolveTrafficRange({ preset: "30d" }, now).intervalSeconds).toBe(
			21_600,
		);
	});

	it("defaults to the last 24 hours", () => {
		const range = resolveTrafficRange({}, now);
		expect(range.to.toISOString()).toBe(now.toISOString());
		expect(range.from.toISOString()).toBe("2026-10-11T12:00:00.000Z");
	});

	it("accepts a custom window and picks a readable resolution", () => {
		const range = resolveTrafficRange(
			{ preset: "custom", from: "2026-10-10T00:00:00.000Z", to: "2026-10-11T00:00:00.000Z" },
			now,
		);
		expect(range.from.toISOString()).toBe("2026-10-10T00:00:00.000Z");
		expect(range.previousTo.toISOString()).toBe("2026-10-10T00:00:00.000Z");
		expect(range.previousFrom.toISOString()).toBe("2026-10-09T00:00:00.000Z");
		expect(range.intervalSeconds).toBe(900);
	});

	it("rejects an incomplete custom window", () => {
		expect(() => resolveTrafficRange({ preset: "custom" }, now)).toThrow(
			TrafficRangeError,
		);
		expect(() =>
			resolveTrafficRange(
				{ preset: "custom", from: "2026-10-10T00:00:00.000Z" },
				now,
			),
		).toThrow(/from\D+and\D+to|both/i);
	});

	it("rejects an inverted or oversized window", () => {
		expect(() =>
			resolveTrafficRange(
				{
					preset: "custom",
					from: "2026-10-12T00:00:00.000Z",
					to: "2026-10-11T00:00:00.000Z",
				},
				now,
			),
		).toThrow(/earlier/);
		expect(() =>
			resolveTrafficRange(
				{
					preset: "custom",
					from: "2025-01-01T00:00:00.000Z",
					to: "2026-10-11T00:00:00.000Z",
				},
				now,
			),
		).toThrow(new RegExp(String(MAX_TRAFFIC_RANGE_DAYS)));
	});

	it("rejects unparseable timestamps", () => {
		expect(() =>
			resolveTrafficRange(
				{ preset: "custom", from: "yesterday", to: "today" },
				now,
			),
		).toThrow(TrafficRangeError);
	});
});
