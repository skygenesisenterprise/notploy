import { describe, expect, it } from "vitest";
import { resolveAppEnvironment } from "@/lib/product";

/**
 * Environment resolution is the single decision that selects a homepage
 * composition and a navigation tree. It must never depend on a URL parameter or
 * a browser-side preference, and Cloud and Console — which both report
 * `isCloud` — must stay distinguishable.
 */
describe("resolveAppEnvironment", () => {
	it("resolves console from the product, despite isCloud being true", () => {
		expect(resolveAppEnvironment({ product: "console", isCloud: true })).toBe(
			"console",
		);
	});

	it("resolves cloud from the product", () => {
		expect(resolveAppEnvironment({ product: "cloud", isCloud: true })).toBe(
			"cloud",
		);
	});

	it("falls back to self-hosted for an explicit self product", () => {
		expect(resolveAppEnvironment({ product: "self", isCloud: false })).toBe(
			"self",
		);
	});

	it("keeps a self-hosted product even if the legacy cloud flag is set", () => {
		expect(resolveAppEnvironment({ product: "self", isCloud: true })).toBe(
			"self",
		);
	});

	it("uses the cloud flag only while the product is still loading", () => {
		expect(
			resolveAppEnvironment({ product: undefined, isCloud: true }),
		).toBe("cloud");
		expect(
			resolveAppEnvironment({ product: undefined, isCloud: false }),
		).toBe("self");
	});

	it("defaults to self-hosted when nothing is known yet", () => {
		expect(
			resolveAppEnvironment({ product: undefined, isCloud: undefined }),
		).toBe("self");
	});
});
