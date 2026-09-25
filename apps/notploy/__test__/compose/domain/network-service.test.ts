import { addNotployNetworkToService } from "@notploy/server";
import { describe, expect, it } from "vitest";

describe("addNotployNetworkToService", () => {
	it("should add network to an empty array", () => {
		const result = addNotployNetworkToService([]);
		expect(result).toEqual(["notploy-network", "default"]);
	});

	it("should not add duplicate network to an array", () => {
		const result = addNotployNetworkToService(["notploy-network"]);
		expect(result).toEqual(["notploy-network", "default"]);
	});

	it("should add network to an existing array with other networks", () => {
		const result = addNotployNetworkToService(["other-network"]);
		expect(result).toEqual(["other-network", "notploy-network", "default"]);
	});

	it("should add network to an object if networks is an object", () => {
		const result = addNotployNetworkToService({ "other-network": {} });
		expect(result).toEqual({
			"other-network": {},
			"notploy-network": {},
			default: {},
		});
	});

	it("should not duplicate default network when already present", () => {
		const result = addNotployNetworkToService(["default", "notploy-network"]);
		expect(result).toEqual(["default", "notploy-network"]);
	});
});
