import { describe, expect, it } from "vitest";
import {
	calculatePrice,
	calculatePriceHobby,
	calculatePriceStartup,
	PLAN_DEFINITIONS,
	STARTUP_SERVERS_INCLUDED,
} from "@/utils/plans";

describe("plan pricing helpers", () => {
	it("keeps the documented startup included-server count", () => {
		expect(STARTUP_SERVERS_INCLUDED).toBe(3);
	});

	it("calculates the legacy tiered price", () => {
		expect(calculatePrice(1, false)).toBe(4.5);
		expect(calculatePrice(2, false)).toBe(7);
		expect(calculatePrice(1, true)).toBe(45.9);
	});

	it("calculates the hobby per-server price", () => {
		expect(calculatePriceHobby(1, false)).toBe(4.5);
		expect(calculatePriceHobby(3, false)).toBe(13.5);
		expect(calculatePriceHobby(1, true)).toBe(43.2);
		expect(calculatePriceHobby(2, true)).toBe(86.4);
	});

	it("calculates the startup account price with extra servers", () => {
		expect(calculatePriceStartup(STARTUP_SERVERS_INCLUDED, false)).toBe(15);
		expect(calculatePriceStartup(4, false)).toBe(19.5);
		expect(calculatePriceStartup(STARTUP_SERVERS_INCLUDED, true)).toBe(144);
		expect(calculatePriceStartup(4, true)).toBe(187.2);
	});
});

describe("plan catalogue", () => {
	it("exposes the three marketed plans", () => {
		expect(PLAN_DEFINITIONS.map((plan) => plan.id)).toEqual([
			"hobby",
			"startup",
			"enterprise",
		]);
	});

	it("marks startup as the recommended purchasable plan", () => {
		const startup = PLAN_DEFINITIONS.find((plan) => plan.id === "startup");
		expect(startup?.recommended).toBe(true);
		expect(startup?.purchaseEnabled).toBe(true);
		expect(startup?.contactSales).toBe(false);
	});

	it("routes enterprise to contact sales without public pricing", () => {
		const enterprise = PLAN_DEFINITIONS.find(
			(plan) => plan.id === "enterprise",
		);
		expect(enterprise?.contactSales).toBe(true);
		expect(enterprise?.purchaseEnabled).toBe(false);
		expect(enterprise?.pricing).toBeNull();
	});
});
