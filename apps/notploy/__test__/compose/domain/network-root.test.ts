import { addNotployNetworkToRoot } from "@notploy/server";
import { describe, expect, it } from "vitest";

describe("addNotployNetworkToRoot", () => {
	it("should create network object if networks is undefined", () => {
		const result = addNotployNetworkToRoot(undefined);
		expect(result).toEqual({ "notploy-network": { external: true } });
	});

	it("should add network to an empty object", () => {
		const result = addNotployNetworkToRoot({});
		expect(result).toEqual({ "notploy-network": { external: true } });
	});

	it("should not modify existing network configuration", () => {
		const existing = { "notploy-network": { external: false } };
		const result = addNotployNetworkToRoot(existing);
		expect(result).toEqual({ "notploy-network": { external: true } });
	});

	it("should add network alongside existing networks", () => {
		const existing = { "other-network": { external: true } };
		const result = addNotployNetworkToRoot(existing);
		expect(result).toEqual({
			"other-network": { external: true },
			"notploy-network": { external: true },
		});
	});
});
