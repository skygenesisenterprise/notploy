import {
	classifyIpAddress,
	describeIpScope,
	isLocalIpScope,
	isValidIpAddress,
	sortIpCandidates,
} from "@notploy/server/utils/ip-address";
import { describe, expect, it } from "vitest";

describe("isValidIpAddress", () => {
	it.each([
		"192.168.1.122",
		"10.0.0.1",
		"172.16.0.1",
		"203.0.113.7",
		"2001:db8::10",
		"::1",
		"::",
		"::ffff:192.168.1.122",
		"fe80::1%eth0",
		"1:2:3:4:5:6:7:8",
	])("accepts %s", (address) => {
		expect(isValidIpAddress(address)).toBe(true);
	});

	it.each([
		"",
		"notploy.example.com",
		"192.168.1.",
		"999.1.1.1",
		"localhost",
		"1:2:3:4:5:6:7",
		"1::2::3",
		"gggg::1",
	])("rejects %s", (address) => {
		expect(isValidIpAddress(address)).toBe(false);
	});
});

describe("classifyIpAddress", () => {
	it.each([
		["192.168.1.122", "private"],
		["10.4.0.9", "private"],
		["172.16.5.4", "private"],
		["172.31.255.254", "private"],
		["172.32.0.1", "public"],
		["127.0.0.1", "loopback"],
		["169.254.10.1", "link-local"],
		["203.0.113.7", "public"],
		["::1", "loopback"],
		["fe80::1", "link-local"],
		["fd00::1", "unique-local"],
		["2001:db8::10", "public"],
	] as const)("classifies %s as %s", (address, scope) => {
		expect(classifyIpAddress(address)).toBe(scope);
	});

	it("returns public for anything that is not an address", () => {
		expect(classifyIpAddress("not-an-ip")).toBe("public");
	});

	it("marks only non-public scopes as local", () => {
		expect(isLocalIpScope("private")).toBe(true);
		expect(isLocalIpScope("loopback")).toBe(true);
		expect(isLocalIpScope("link-local")).toBe(true);
		expect(isLocalIpScope("unique-local")).toBe(true);
		expect(isLocalIpScope("public")).toBe(false);
	});

	it("labels each scope", () => {
		expect(describeIpScope("private")).toBe("Local network");
		expect(describeIpScope("public")).toBe("Public");
	});
});

describe("sortIpCandidates", () => {
	it("de-duplicates and offers LAN addresses before public ones", () => {
		expect(
			sortIpCandidates([
				"203.0.113.7",
				"192.168.1.122",
				"192.168.1.122",
				"127.0.0.1",
				"not-an-ip",
			]),
		).toEqual([
			{ address: "192.168.1.122", scope: "private" },
			{ address: "203.0.113.7", scope: "public" },
			{ address: "127.0.0.1", scope: "loopback" },
		]);
	});
});
