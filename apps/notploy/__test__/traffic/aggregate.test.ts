import {
	addLatencySample,
	aggregateHttpEvents,
	changeRateOf,
	emptyLatencyHistogram,
	errorRateOf,
	histogramTotal,
	LATENCY_BUCKET_BOUNDS_MS,
	LATENCY_BUCKET_COUNT,
	latencyBucketIndex,
	mergeHistograms,
	percentileFromHistogram,
} from "@notploy/server/utils/traffic/aggregate";
import type { TrafficHttpEvent } from "@notploy/server/utils/traffic/parse";
import { describe, expect, it } from "vitest";

const event = (overrides: Partial<TrafficHttpEvent> = {}): TrafficHttpEvent => ({
	timestamp: new Date("2026-10-12T09:04:05.000Z"),
	host: "notploy.com",
	route: "/pricing",
	method: "GET",
	status: 200,
	statusClass: "2xx",
	bytesIn: 0,
	bytesOut: 1024,
	durationMs: 40,
	serviceName: null,
	protocol: "HTTP/2.0",
	...overrides,
});

describe("latency histogram", () => {
	it("places a sample in the first bin that can contain it", () => {
		expect(latencyBucketIndex(0)).toBe(0);
		expect(latencyBucketIndex(10)).toBe(0);
		expect(latencyBucketIndex(11)).toBe(1);
		// 400 ms is above the 250 ms bound and below the 500 ms one.
		expect(latencyBucketIndex(400)).toBe(5);
		// Anything above the last bound lands in the overflow bin.
		expect(latencyBucketIndex(60_000)).toBe(LATENCY_BUCKET_BOUNDS_MS.length);
		expect(emptyLatencyHistogram()).toHaveLength(LATENCY_BUCKET_COUNT);
	});

	it("counts samples and merges histograms without losing any", () => {
		const first = emptyLatencyHistogram();
		addLatencySample(first, 5);
		addLatencySample(first, 50);
		const second = emptyLatencyHistogram();
		addLatencySample(second, 5);

		expect(histogramTotal(first)).toBe(2);
		expect(histogramTotal(mergeHistograms([first, second]))).toBe(3);
		expect(histogramTotal(mergeHistograms([null, undefined]))).toBe(0);
	});
});

describe("percentileFromHistogram", () => {
	it("returns the bin bound that crosses the requested percentile", () => {
		const histogram = emptyLatencyHistogram();
		for (let index = 0; index < 95; index++) {
			addLatencySample(histogram, 20);
		}
		for (let index = 0; index < 5; index++) {
			addLatencySample(histogram, 300);
		}
		// 95 % of the samples are ≤ 25 ms, so the p95 is the 25 ms bin bound.
		expect(percentileFromHistogram(histogram, 0.95)).toBe(25);
		expect(percentileFromHistogram(histogram, 0.5)).toBe(25);
		// The 300 ms samples live in the “≤ 500 ms” bin, so that bound is the
		// highest percentile the stored data can honestly report.
		expect(percentileFromHistogram(histogram, 1)).toBe(500);
		expect(percentileFromHistogram(histogram, 1)).toBeLessThanOrEqual(
			LATENCY_BUCKET_BOUNDS_MS.at(-1)!,
		);
	});

	it("reports no percentile rather than zero when there is no sample", () => {
		expect(percentileFromHistogram(emptyLatencyHistogram(), 0.95)).toBeNull();
		expect(percentileFromHistogram(undefined, 0.95)).toBeNull();
		expect(percentileFromHistogram([], 0.95)).toBeNull();
	});
});

describe("aggregateHttpEvents", () => {
	it("folds events into one row per bucket, route and status class", () => {
		const rows = aggregateHttpEvents([
			event(),
			event({ durationMs: 60, bytesOut: 100 }),
			event({ route: "/docs", status: 404, statusClass: "4xx" }),
			event({
				timestamp: new Date("2026-10-12T09:09:00.000Z"),
				route: "/docs",
			}),
		]);

		expect(rows).toHaveLength(3);
		const pricing = rows.find((row) => row.route === "/pricing");
		expect(pricing).toMatchObject({
			requests: 2,
			bytesOut: 1124,
			latencyCount: 2,
			latencyMsSum: 100,
			latencyMsMax: 60,
			statusClass: "2xx",
		});
		expect(histogramTotal(pricing?.latencyBuckets ?? [])).toBe(2);
		expect(pricing?.bucketStart.toISOString()).toBe("2026-10-12T09:00:00.000Z");
		expect(pricing?.bucketSeconds).toBe(300);
	});

	it("keeps buckets apart and is order-independent", () => {
		const forward = aggregateHttpEvents([
			event({ timestamp: new Date("2026-10-12T09:04:00.000Z") }),
			event({ timestamp: new Date("2026-10-12T10:04:00.000Z") }),
		]);
		const backward = aggregateHttpEvents([
			event({ timestamp: new Date("2026-10-12T10:04:00.000Z") }),
			event({ timestamp: new Date("2026-10-12T09:04:00.000Z") }),
		]);
		expect(forward.map((row) => row.bucketStart.toISOString())).toEqual([
			"2026-10-12T09:00:00.000Z",
			"2026-10-12T10:00:00.000Z",
		]);
		// Same events, same rows: the upsert key stays stable whatever the order.
		expect(
			forward.map((row) => [row.route, row.bucketStart.toISOString(), row.statusClass]),
		).toEqual(
			backward
				.map((row) => [
					row.route,
					row.bucketStart.toISOString(),
					row.statusClass,
				])
				.sort(
					(a, b) =>
						new Date(String(a[1])).getTime() - new Date(String(b[1])).getTime(),
				),
		);
	});

	it("returns nothing for an empty batch", () => {
		expect(aggregateHttpEvents([])).toEqual([]);
	});
});

describe("derived rates", () => {
	it("computes the error rate only when requests exist", () => {
		expect(errorRateOf({ requests: 200, errors: 10 })).toBe(5);
		expect(errorRateOf({ requests: 0, errors: 0 })).toBeNull();
	});

	it("refuses to compare against a zero or missing base", () => {
		expect(changeRateOf(120, 100)).toBeCloseTo(20);
		expect(changeRateOf(50, 100)).toBeCloseTo(-50);
		expect(changeRateOf(10, 0)).toBeNull();
		expect(changeRateOf(10, Number.NaN)).toBeNull();
	});
});
