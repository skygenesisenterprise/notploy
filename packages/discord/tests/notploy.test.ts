import { describe, expect, it } from "vitest";
import { extractVersion } from "../src/integrations/notploy/index.js";

describe("extractVersion", () => {
	it("reads a version string", () => {
		expect(extractVersion({ version: "1.2.3" })).toBe("1.2.3");
	});

	it("reads alternative field names", () => {
		expect(extractVersion({ notployVersion: "1.0.0" })).toBe("1.0.0");
		expect(extractVersion({ tag: "v2" })).toBe("v2");
		expect(extractVersion({ releaseTag: "v3" })).toBe("v3");
	});

	it("accepts a raw string payload", () => {
		expect(extractVersion("4.5.6")).toBe("4.5.6");
	});

	it("returns null for unsupported payloads", () => {
		expect(extractVersion(null)).toBeNull();
		expect(extractVersion(undefined)).toBeNull();
		expect(extractVersion(42)).toBeNull();
		expect(extractVersion({})).toBeNull();
		expect(extractVersion({ version: "" })).toBeNull();
	});
});
