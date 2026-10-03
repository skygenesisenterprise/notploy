import {
	clampPercentage,
	createMetricUsage,
	DEFAULT_METRIC_THRESHOLDS,
	DEFAULT_THRESHOLDS,
	getMetricStatus,
	getThresholdsForMetric,
	getUsagePercentage,
	normalizeThresholds,
} from "@notploy/server/monitoring/status";
import { describe, expect, test } from "vitest";

describe("getMetricStatus", () => {
	const thresholds = { warning: 80, critical: 90 };

	test("matches the thresholds specification", () => {
		expect(getMetricStatus(20, thresholds)).toBe("normal");
		expect(getMetricStatus(80, thresholds)).toBe("warning");
		expect(getMetricStatus(89, thresholds)).toBe("warning");
		expect(getMetricStatus(90, thresholds)).toBe("critical");
		expect(getMetricStatus(100, thresholds)).toBe("critical");
	});

	test("handles boundary values", () => {
		expect(getMetricStatus(79.99, thresholds)).toBe("normal");
		expect(getMetricStatus(0, thresholds)).toBe("normal");
		expect(getMetricStatus(89.99, thresholds)).toBe("warning");
		expect(getMetricStatus(90.01, thresholds)).toBe("critical");
	});

	test("values above 100 are critical", () => {
		expect(getMetricStatus(120, thresholds)).toBe("critical");
		expect(getMetricStatus(9999, thresholds)).toBe("critical");
	});

	test("invalid values are treated as normal", () => {
		expect(getMetricStatus(Number.NaN, thresholds)).toBe("normal");
		expect(getMetricStatus(Number.POSITIVE_INFINITY, thresholds)).toBe(
			"normal",
		);
		expect(getMetricStatus(undefined, thresholds)).toBe("normal");
		expect(getMetricStatus(null, thresholds)).toBe("normal");
		expect(getMetricStatus("not-a-number", thresholds)).toBe("normal");
	});

	test("accepts numeric strings", () => {
		expect(getMetricStatus("85", thresholds)).toBe("warning");
		expect(getMetricStatus("95", thresholds)).toBe("critical");
	});

	test("falls back to default thresholds", () => {
		expect(getMetricStatus(70)).toBe("normal");
		expect(getMetricStatus(85)).toBe("warning");
		expect(getMetricStatus(95)).toBe("critical");
	});

	test("invalid thresholds fall back to defaults", () => {
		expect(
			getMetricStatus(85, {
				warning: Number.NaN,
				critical: Number.NaN,
			}),
		).toBe("warning");
	});
});

describe("normalizeThresholds", () => {
	test("uses defaults for missing values", () => {
		expect(normalizeThresholds()).toEqual(DEFAULT_THRESHOLDS);
		expect(normalizeThresholds({})).toEqual(DEFAULT_THRESHOLDS);
		expect(normalizeThresholds({ warning: 70 })).toEqual({
			warning: 70,
			critical: 90,
		});
	});

	test("clamps values into 0..100", () => {
		expect(normalizeThresholds({ warning: -10, critical: 150 })).toEqual({
			warning: 0,
			critical: 100,
		});
	});

	test("swaps inverted pairs so warning <= critical", () => {
		expect(normalizeThresholds({ warning: 95, critical: 60 })).toEqual({
			warning: 60,
			critical: 95,
		});
	});

	test("ignores non-numeric values", () => {
		expect(
			normalizeThresholds({
				warning: "abc" as unknown as number,
				critical: "xyz" as unknown as number,
			}),
		).toEqual(DEFAULT_THRESHOLDS);
	});
});

describe("getThresholdsForMetric", () => {
	test("returns centralized defaults per metric", () => {
		expect(getThresholdsForMetric("cpu")).toEqual(DEFAULT_THRESHOLDS);
		expect(getThresholdsForMetric("memory")).toEqual(DEFAULT_THRESHOLDS);
		expect(getThresholdsForMetric("disk")).toEqual(DEFAULT_THRESHOLDS);
	});

	test("supports metric-specific overrides", () => {
		expect(
			getThresholdsForMetric("cpu", { cpu: { warning: 50, critical: 75 } }),
		).toEqual({ warning: 50, critical: 75 });
		expect(
			getThresholdsForMetric("memory", { cpu: { warning: 50, critical: 75 } }),
		).toEqual(DEFAULT_METRIC_THRESHOLDS.memory);
	});
});

describe("clampPercentage", () => {
	test("clamps to 0..100", () => {
		expect(clampPercentage(-5)).toBe(0);
		expect(clampPercentage(0)).toBe(0);
		expect(clampPercentage(42.5)).toBe(42.5);
		expect(clampPercentage(100)).toBe(100);
		expect(clampPercentage(150)).toBe(100);
	});

	test("handles invalid input", () => {
		expect(clampPercentage(Number.NaN)).toBe(0);
		expect(clampPercentage(undefined)).toBe(0);
		expect(clampPercentage(null)).toBe(0);
		expect(clampPercentage("12.5")).toBe(12.5);
	});
});

describe("getUsagePercentage", () => {
	test("computes percentage from used/total", () => {
		expect(getUsagePercentage(50, 100)).toBe(50);
		expect(getUsagePercentage(6.2, 16)).toBeCloseTo(38.75, 2);
	});

	test("zero or invalid total yields 0", () => {
		expect(getUsagePercentage(10, 0)).toBe(0);
		expect(getUsagePercentage(10, -1)).toBe(0);
		expect(getUsagePercentage(10, Number.NaN)).toBe(0);
	});

	test("clamps results above 100", () => {
		expect(getUsagePercentage(200, 100)).toBe(100);
	});
});

describe("createMetricUsage", () => {
	test("derives percentage and status for capacity metrics", () => {
		const usage = createMetricUsage({
			used: 6.2,
			total: 16,
			kind: "memory",
		});
		expect(usage.used).toBe(6.2);
		expect(usage.total).toBe(16);
		expect(usage.percentage).toBeCloseTo(38.75, 2);
		expect(usage.status).toBe("normal");
	});

	test("honors an explicit percentage (CPU)", () => {
		const usage = createMetricUsage({
			used: 42,
			percentage: 42,
			kind: "cpu",
		});
		expect(usage.percentage).toBe(42);
		expect(usage.status).toBe("normal");
	});

	test("clamps explicit percentages", () => {
		const usage = createMetricUsage({
			used: 120,
			percentage: 120,
			kind: "cpu",
		});
		expect(usage.percentage).toBe(100);
		expect(usage.status).toBe("critical");
	});

	test("classifies warning and critical capacity", () => {
		expect(
			createMetricUsage({ used: 13.5, total: 16, kind: "memory" }).status,
		).toBe("warning");
		expect(
			createMetricUsage({ used: 14.8, total: 16, kind: "memory" }).status,
		).toBe("critical");
	});

	test("missing values are safe", () => {
		const usage = createMetricUsage({ used: undefined, total: undefined });
		expect(usage.percentage).toBe(0);
		expect(usage.status).toBe("normal");
	});

	test("applies metric-specific thresholds", () => {
		const usage = createMetricUsage({
			used: 60,
			total: 100,
			kind: "disk",
			thresholds: { warning: 50, critical: 70 },
		});
		expect(usage.status).toBe("warning");
	});
});
