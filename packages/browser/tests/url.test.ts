import { describe, expect, it } from "vitest";
import {
	apiKeysUrl,
	dashboardUrl,
	normalizeInstanceUrl,
	projectDashboardUrl,
	validateInstanceUrl,
} from "../src/shared/url.js";

describe("normalizeInstanceUrl", () => {
	it("adds https when missing", () => {
		expect(normalizeInstanceUrl("notploy.example.com")).toBe(
			"https://notploy.example.com",
		);
	});

	it("strips /api and dashboard paths", () => {
		expect(normalizeInstanceUrl("https://notploy.example.com/api")).toBe(
			"https://notploy.example.com",
		);
		expect(
			normalizeInstanceUrl("https://notploy.example.com/dashboard/project/1"),
		).toBe("https://notploy.example.com");
	});

	it("rejects credentials in the URL", () => {
		expect(normalizeInstanceUrl("https://user:pass@notploy.example.com")).toBe(
			"",
		);
	});

	it("returns empty for blank input", () => {
		expect(normalizeInstanceUrl("   ")).toBe("");
	});
});

describe("validateInstanceUrl", () => {
	it("accepts https origins", () => {
		expect(validateInstanceUrl("https://notploy.example.com")).toEqual({
			valid: true,
			normalized: "https://notploy.example.com",
		});
	});

	it("accepts http on localhost", () => {
		expect(validateInstanceUrl("http://localhost:3000").valid).toBe(true);
		expect(validateInstanceUrl("http://127.0.0.1:3000").valid).toBe(true);
	});

	it("rejects http outside localhost", () => {
		const result = validateInstanceUrl("http://notploy.example.com");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/localhost/i);
	});

	it("rejects non-http schemes", () => {
		expect(validateInstanceUrl("ftp://notploy.example.com").valid).toBe(false);
	});
});

describe("dashboard links", () => {
	it("builds dashboard and api-keys urls", () => {
		expect(dashboardUrl("https://notploy.example.com/")).toBe(
			"https://notploy.example.com/dashboard",
		);
		expect(apiKeysUrl("https://notploy.example.com")).toBe(
			"https://notploy.example.com/dashboard/settings/api-keys",
		);
	});

	it("builds deep project links", () => {
		expect(projectDashboardUrl("https://n.example.com", "p1")).toBe(
			"https://n.example.com/dashboard/project/p1",
		);
		expect(projectDashboardUrl("https://n.example.com", "p1", "e1", "a1")).toBe(
			"https://n.example.com/dashboard/project/p1/environment/e1/services/application/a1",
		);
	});
});
