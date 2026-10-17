import { describe, expect, it } from "vitest";
import {
	displayMetricValue,
	formatDuration,
	formatLimit,
	metricState,
	resolvedValue,
	segmentTotal,
	serviceStatusLabel,
	serviceStatusTone,
} from "@/components/dashboard/home/home-state";

const loading = { isLoading: true, isError: false };
const failed = { isLoading: false, isError: true };
const settled = { isLoading: false, isError: false };

describe("metricState", () => {
	it("reports a gated source as restricted, never as a failure", () => {
		expect(metricState(failed, false)).toBe("restricted");
		expect(metricState(loading, false)).toBe("restricted");
	});

	it("separates loading from unavailable", () => {
		expect(metricState(loading)).toBe("loading");
		expect(metricState(failed)).toBe("unavailable");
		expect(metricState(settled)).toBe("available");
	});
});

describe("displayMetricValue", () => {
	it("never renders an unknown value as zero", () => {
		expect(
			displayMetricValue({
				id: "x",
				label: "X",
				value: null,
				state: "unavailable",
			}),
		).toBe("Unavailable");
		expect(
			displayMetricValue({
				id: "x",
				label: "X",
				value: null,
				state: "restricted",
			}),
		).toBe("Restricted");
		expect(
			displayMetricValue({
				id: "x",
				label: "X",
				value: 0,
				state: "available",
			}),
		).toBe("0");
	});

	it("labels a not-applicable datum instead of leaving it blank", () => {
		expect(
			displayMetricValue({
				id: "x",
				label: "X",
				value: null,
				state: "not_applicable",
			}),
		).toBe("N/A");
	});
});

describe("resolvedValue", () => {
	it("drops the value of every state that is not available", () => {
		expect(resolvedValue("available", 3)).toBe(3);
		expect(resolvedValue("available", 0)).toBe(0);
		expect(resolvedValue("loading", 3)).toBeNull();
		expect(resolvedValue("unavailable", 3)).toBeNull();
		expect(resolvedValue("restricted", 3)).toBeNull();
	});
});

describe("service status vocabulary", () => {
	it("maps the recorded statuses to a label and a tone", () => {
		expect(serviceStatusLabel("done")).toBe("Healthy");
		expect(serviceStatusTone("done")).toBe("healthy");
		expect(serviceStatusLabel("running")).toBe("Deploying");
		expect(serviceStatusTone("running")).toBe("warning");
		expect(serviceStatusLabel("error")).toBe("Failed");
		expect(serviceStatusTone("error")).toBe("critical");
		expect(serviceStatusLabel(null)).toBe("Idle");
		expect(serviceStatusTone(null)).toBe("neutral");
	});
});

describe("formatting", () => {
	it("formats durations and unlimited limits", () => {
		expect(formatDuration(90)).toBe("1m");
		expect(formatDuration(3 * 86_400 + 4 * 3_600)).toBe("3d 4h");
		expect(formatDuration(2 * 3_600 + 30 * 60)).toBe("2h 30m");
		expect(formatDuration(0)).toBe("0m");
		expect(formatLimit(null)).toBe("Unlimited");
		expect(formatLimit(0)).toBe("0");
	});

	it("sums a distribution", () => {
		expect(segmentTotal([{ value: 2 }, { value: 3 }])).toBe(5);
		expect(segmentTotal([])).toBe(0);
	});
});
