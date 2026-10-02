import { getDomainRequirements } from "@notploy/server";
import { describe, expect, it } from "vitest";

describe("getDomainRequirements", () => {
	it.each([
		["api.example.com", "public", true, true],
		["app.localhost", "localhost", false, false],
		["api.lan", "lan", false, false],
		["app.home.arpa", "custom", false, false],
		["service.internal.example", "custom", false, false],
	] as const)(
		"classifies %s",
		(host, scope, requiresPublicDns, allowsPublicAcme) => {
			expect(getDomainRequirements(host)).toEqual({
				scope,
				requiresPublicDns,
				allowsPublicAcme,
			});
		},
	);
});
