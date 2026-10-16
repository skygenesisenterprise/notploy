import { pickOnionNetwork } from "@notploy/server/services/onion";
import { describe, expect, it } from "vitest";

describe("pickOnionNetwork", () => {
	it("prefers the default project network", () => {
		expect(pickOnionNetwork(["notploy-network", "myapp_default"])).toBe(
			"myapp_default",
		);
	});

	it("never selects host or none", () => {
		expect(pickOnionNetwork(["host", "myapp_default"])).toBe("myapp_default");
		expect(pickOnionNetwork(["none"])).toBeNull();
		expect(pickOnionNetwork(["host", "none"])).toBeNull();
	});

	it("falls back to the first usable network", () => {
		expect(pickOnionNetwork(["backend", "frontend"])).toBe("backend");
	});

	it("ignores empty entries and duplicates", () => {
		expect(pickOnionNetwork(["", "  ", "myapp_default", "myapp_default"])).toBe(
			"myapp_default",
		);
	});

	it("returns null when nothing can be used", () => {
		expect(pickOnionNetwork([])).toBeNull();
		expect(pickOnionNetwork([null, undefined])).toBeNull();
	});
});
