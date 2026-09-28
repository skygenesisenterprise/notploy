import { describe, expect, it } from "vitest";
import {
	applicationStatusLabel,
	connectionStatusLabel,
	dashboardUrl,
	deploymentStatusLabel,
	normalizeInstanceUrl,
	projectDashboardUrl,
	relativeTime,
	shorten,
} from "../src/core/formatting";

describe("statuses", () => {
	it("labels every deployment status the API can return", () => {
		expect(deploymentStatusLabel("running")).toBe("Running");
		expect(deploymentStatusLabel("done")).toBe("Done");
		expect(deploymentStatusLabel("error")).toBe("Failed");
		expect(deploymentStatusLabel("cancelled")).toBe("Cancelled");
		expect(deploymentStatusLabel(undefined)).toBe("Unknown");
	});

	it("labels application statuses", () => {
		expect(applicationStatusLabel("done")).toBe("Deployed");
		expect(applicationStatusLabel("idle")).toBe("Idle");
	});

	it("labels connection states, including the un-checked one", () => {
		expect(connectionStatusLabel("connected")).toBe("Connected");
		expect(connectionStatusLabel("unavailable")).toBe("Unavailable");
		expect(connectionStatusLabel(undefined)).toBe("Not checked");
	});
});

describe("normalizeInstanceUrl", () => {
	it("adds a scheme when missing", () => {
		expect(normalizeInstanceUrl("notploy.example.com")).toBe(
			"https://notploy.example.com",
		);
	});

	it("keeps http for local instances", () => {
		expect(normalizeInstanceUrl("http://localhost:3000")).toBe(
			"http://localhost:3000",
		);
	});

	it("drops paths, queries and fragments", () => {
		expect(normalizeInstanceUrl("https://notploy.example.com/api?x=1#y")).toBe(
			"https://notploy.example.com",
		);
		expect(
			normalizeInstanceUrl("https://notploy.example.com/dashboard/project/abc"),
		).toBe("https://notploy.example.com");
	});

	it("rejects empty and unusable input", () => {
		expect(normalizeInstanceUrl("")).toBe("");
		expect(normalizeInstanceUrl("   ")).toBe("");
	});
});

describe("dashboard URLs", () => {
	it("builds a dashboard URL without doubling slashes", () => {
		expect(dashboardUrl("https://notploy.example.com/")).toBe(
			"https://notploy.example.com/dashboard",
		);
	});

	it("builds the deep link the dashboard itself uses", () => {
		expect(
			projectDashboardUrl("https://notploy.example.com", "p1", "e1", "a1"),
		).toBe(
			"https://notploy.example.com/dashboard/project/p1/environment/e1/services/application/a1",
		);
	});

	it("degrades gracefully when ids are missing", () => {
		expect(projectDashboardUrl("https://x.dev", "p1")).toBe(
			"https://x.dev/dashboard/project/p1",
		);
	});
});

describe("relativeTime", () => {
	it("formats past timestamps in the ambient locale", () => {
		const now = Date.parse("2026-01-01T12:00:00.000Z");
		// `relativeTime` follows the VS Code locale, so the expectation is built
		// with the same formatter instead of hard-coding English.
		const expected = new Intl.RelativeTimeFormat(undefined, {
			numeric: "auto",
		}).format(-3, "minute");
		expect(relativeTime("2026-01-01T11:57:00.000Z", now)).toBe(expected);
	});

	it("switches units as the gap grows", () => {
		const now = Date.parse("2026-01-02T12:00:00.000Z");
		const formatter = new Intl.RelativeTimeFormat(undefined, {
			numeric: "auto",
		});
		expect(relativeTime("2026-01-02T09:00:00.000Z", now)).toBe(
			formatter.format(-3, "hour"),
		);
		expect(relativeTime("2025-12-30T12:00:00.000Z", now)).toBe(
			formatter.format(-3, "day"),
		);
	});

	it("returns an empty string for missing values", () => {
		expect(relativeTime(undefined)).toBe("");
		expect(relativeTime(null)).toBe("");
	});

	it("passes through unparseable values", () => {
		expect(relativeTime("not-a-date")).toBe("not-a-date");
	});
});

describe("shorten", () => {
	it("truncates with an ellipsis", () => {
		expect(shorten("abcdefghij", 5)).toBe("abcd…");
		expect(shorten("abc", 5)).toBe("abc");
	});
});
