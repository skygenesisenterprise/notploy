import {
	cidrOverlaps,
	findOverlappingCidr,
	isIpInCidr,
	isValidCidr,
	isValidIp,
	parseCidr,
} from "@notploy/server/utils/network/cidr";
import { describe, expect, it } from "vitest";

describe("isValidCidr", () => {
	it.each([
		"10.80.0.0/16",
		"192.168.1.1/32",
		"0.0.0.0/0",
		"172.16.0.0/12",
		"fd00::/64",
		"2001:db8::/32",
		"::/0",
		"::1/128",
		"::ffff:192.168.1.0/120",
	])("accepts %s", (cidr) => {
		expect(isValidCidr(cidr)).toBe(true);
	});

	it.each([
		"",
		"10.80.0.0/33",
		"10.80.0.0/",
		"10.80.0.0/16/8",
		"300.1.1.1/24",
		"not-a-cidr",
		"fd00::/129",
		"gggg::/64",
		"10.80.0.0/-1",
	])("rejects %s", (cidr) => {
		expect(isValidCidr(cidr)).toBe(false);
	});
});

describe("isValidIp", () => {
	it("accepts bare addresses and rejects CIDRs", () => {
		expect(isValidIp("10.80.0.2")).toBe(true);
		expect(isValidIp("fd00::2")).toBe(true);
		expect(isValidIp("10.80.0.0/16")).toBe(false);
	});
});

describe("parseCidr", () => {
	it("returns the prefix and address family", () => {
		expect(parseCidr("10.80.0.0/16")).toMatchObject({ prefix: 16, version: 4 });
		expect(parseCidr("fd00::/64")).toMatchObject({ prefix: 64, version: 6 });
	});

	it("treats a bare address as a host route", () => {
		expect(parseCidr("10.80.0.2")).toMatchObject({ prefix: 32, version: 4 });
		expect(parseCidr("fd00::2")).toMatchObject({ prefix: 128, version: 6 });
	});

	it("rejects malformed input", () => {
		expect(parseCidr("10.80.0.0/")).toBeNull();
		expect(parseCidr("")).toBeNull();
	});
});

describe("cidrOverlaps", () => {
	it("detects overlapping ranges", () => {
		expect(cidrOverlaps("10.80.0.0/16", "10.80.5.0/24")).toBe(true);
		expect(cidrOverlaps("fd00::/48", "fd00::/64")).toBe(true);
	});

	it("treats adjacent subnets as disjoint", () => {
		expect(cidrOverlaps("10.80.0.0/16", "10.81.0.0/16")).toBe(false);
		expect(cidrOverlaps("fd00::/64", "fd00:1::/64")).toBe(false);
	});

	it("never overlaps across address families", () => {
		expect(cidrOverlaps("10.80.0.0/16", "fd00::/64")).toBe(false);
	});
});

describe("isIpInCidr", () => {
	it("matches addresses inside the network", () => {
		expect(isIpInCidr("10.80.0.5", "10.80.0.0/16")).toBe(true);
		expect(isIpInCidr("fd00::5", "fd00::/64")).toBe(true);
	});

	it("rejects addresses outside the network", () => {
		expect(isIpInCidr("10.81.0.5", "10.80.0.0/16")).toBe(false);
		expect(isIpInCidr("fd00:1::5", "fd00::/64")).toBe(false);
	});
});

describe("findOverlappingCidr", () => {
	it("returns the first overlapping pair", () => {
		expect(findOverlappingCidr(["10.80.0.0/16", "10.81.0.0/16"])).toBeNull();
		expect(
			findOverlappingCidr(["10.80.0.0/16", "10.81.0.0/16", "10.80.4.0/24"]),
		).toEqual(["10.80.0.0/16", "10.80.4.0/24"]);
	});
});
