import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { CommunityService } from "../src/services/community.js";

const config = loadConfig({
	DISCORD_TOKEN: "token",
	DISCORD_CLIENT_ID: "1",
	NOTPLOY_DOCS_URL: "https://docs.example.com",
});

describe("CommunityService", () => {
	const community = new CommunityService(config);

	it("exposes project information", () => {
		expect(community.about.name).toBe("Notploy");
		expect(community.about.repository).toBe("skygenesisenterprise/notploy");
		expect(community.about.license).toBe("Apache-2.0");
	});

	it("lists the official resources", () => {
		const links = community.officialLinks();
		const labels = links.map((link) => link.label);
		expect(labels).toContain("Documentation");
		expect(labels).toContain("GitHub");
		expect(labels).toContain("Discord");

		for (const link of links) {
			expect(link.url).toMatch(/^https:\/\//);
			expect(link.description.length).toBeGreaterThan(0);
		}
	});

	it("builds documentation deep links against the configured base URL", () => {
		const links = community.docsLinks();
		expect(links.length).toBeGreaterThan(0);
		for (const link of links) {
			expect(link.url.startsWith("https://docs.example.com")).toBe(true);
		}
	});

	it("does not produce a double slash when the base URL ends with one", () => {
		const trailing = new CommunityService(
			loadConfig({
				DISCORD_TOKEN: "token",
				DISCORD_CLIENT_ID: "1",
				NOTPLOY_DOCS_URL: "https://docs.example.com/",
			}),
		);
		for (const link of trailing.docsLinks()) {
			expect(link.url).not.toMatch(/[^:]\/\//);
		}
	});
});
