/**
 * Daily uptime rollup tests.
 *
 * The rollup is the only part of the platform that aggregates *time*, so its
 * denominator is worth pinning down: a day without observation must stay
 * unknown (never 100%), planned maintenance must not silently become
 * availability, and the window must always contain exactly the advertised
 * number of days, oldest first.
 */
import { describe, expect, it } from "vitest";
import {
	availabilityPercent,
	createComponent,
	createPage,
	dayWindow,
	emptyComponentUptime,
	getComponentUptime,
	isAvailable,
	sampleUptime,
	setComponentObservedState,
	UPTIME_WINDOW_DAYS,
	utcDay,
} from "../src/index";
import { createHarness } from "./helpers";

const ACTOR = { type: "system" as const, id: null, label: "test" };

const harness = (start = "2026-01-01T09:00:00.000Z") => createHarness(start);

describe("uptime helpers", () => {
	it("builds an inclusive UTC day window, oldest first", () => {
		expect(dayWindow("2026-01-03", 3)).toEqual([
			"2026-01-01",
			"2026-01-02",
			"2026-01-03",
		]);
	});

	it("returns an empty window for a non-positive length", () => {
		expect(dayWindow("2026-01-03", 0)).toEqual([]);
	});

	it("derives availability from samples and refuses to guess without data", () => {
		expect(availabilityPercent(0, 0)).toBeNull();
		expect(availabilityPercent(1, 2)).toBe(50);
		expect(availabilityPercent(9999, 10_000)).toBe(99.99);
	});

	it("counts only operational as available", () => {
		expect(isAvailable("operational")).toBe(true);
		expect(isAvailable("under_maintenance")).toBe(false);
		expect(isAvailable("major_outage")).toBe(false);
	});

	it("truncates an instant to its UTC day", () => {
		expect(utcDay("2026-01-01T23:59:59.999Z")).toBe("2026-01-01");
	});
});

describe("daily uptime rollup", () => {
	it("records the worst status of the day and exposes the window", () => {
		const { ctx, setNow } = harness();
		const page = createPage(
			ctx,
			{ slug: "acme", name: "Acme", description: "", settings: {} },
			ACTOR,
		);
		const component = createComponent(
			ctx,
			page.slug,
			{
				name: "API",
				description: "",
				category: "api",
				visibility: "public",
				source: "manual",
				observedStatus: "operational",
			},
			ACTOR,
		);

		// Same day, second observation: a degradation. The day must keep the
		// worst status but count both samples.
		setComponentObservedState(
			ctx,
			page.slug,
			component.id,
			{ observedStatus: "outage" },
			ACTOR,
		);

		const sameDay = getComponentUptime(ctx, component.id, {
			windowDays: 3,
			now: "2026-01-03T00:00:00.000Z",
		});
		expect(sameDay.days.map((day) => day.date)).toEqual([
			"2026-01-01",
			"2026-01-02",
			"2026-01-03",
		]);
		expect(sameDay.days[0]?.status).toBe("major_outage");
		expect(sameDay.days[1]?.status).toBeNull();
		expect(sameDay.days[2]?.status).toBeNull();
		// 2 samples on the first day, 1 of them operational.
		expect(sameDay.uptimePercent).toBe(50);

		// A new day with an operational observation.
		setNow("2026-01-02T09:00:00.000Z");
		setComponentObservedState(
			ctx,
			page.slug,
			component.id,
			{ observedStatus: "operational" },
			ACTOR,
		);
		const twoDays = getComponentUptime(ctx, component.id, {
			windowDays: 3,
			now: "2026-01-03T00:00:00.000Z",
		});
		expect(twoDays.days[1]?.status).toBe("operational");
		// 3 samples, 2 operational.
		expect(twoDays.uptimePercent).toBeCloseTo(66.67, 2);
	});

	it("returns no data (never 100%) when nothing was observed", () => {
		const { ctx } = harness();
		expect(emptyComponentUptime(5).uptimePercent).toBeNull();
		const page = createPage(
			ctx,
			{ slug: "empty", name: "Empty", description: "", settings: {} },
			ACTOR,
		);
		const component = createComponent(
			ctx,
			page.slug,
			{
				name: "API",
				description: "",
				category: "api",
				visibility: "public",
				source: "manual",
				observedStatus: "unknown",
			},
			ACTOR,
		);
		// `observedStatus: unknown` is not an observation of health.
		const uptime = getComponentUptime(ctx, component.id, {
			windowDays: UPTIME_WINDOW_DAYS,
		});
		expect(uptime.windowDays).toBe(90);
		expect(uptime.days).toHaveLength(90);
		expect(uptime.uptimePercent).toBeNull();
	});

	it("samples every page without publishing", () => {
		const { ctx } = harness();
		const page = createPage(
			ctx,
			{ slug: "quiet", name: "Quiet", description: "", settings: {} },
			ACTOR,
		);
		createComponent(
			ctx,
			page.slug,
			{
				name: "API",
				description: "",
				category: "api",
				visibility: "public",
				source: "manual",
				observedStatus: "operational",
			},
			ACTOR,
		);
		const before = ctx.repos.pages.findBySlug("quiet")?.updated_at;
		sampleUptime(ctx, "2026-01-01T10:00:00.000Z");
		const after = ctx.repos.pages.findBySlug("quiet")?.updated_at;
		expect(after).toBe(before);
		const bucket = ctx.repos.uptimeDaily.find(
			ctx.repos.components.listByPage(page.id)[0]?.id ?? "",
			"2026-01-01",
		);
		expect(bucket?.samples).toBeGreaterThanOrEqual(2);
	});

	it("keeps private components out of the rollup", () => {
		const { ctx } = harness();
		const page = createPage(
			ctx,
			{ slug: "private", name: "Private", description: "", settings: {} },
			ACTOR,
		);
		const component = createComponent(
			ctx,
			page.slug,
			{
				name: "Internal",
				description: "",
				category: "infrastructure",
				visibility: "private",
				source: "manual",
				observedStatus: "operational",
			},
			ACTOR,
		);
		expect(
			ctx.repos.uptimeDaily.listForPage(page.id, "2026-01-01", "2026-01-01"),
		).toHaveLength(0);
		expect(getComponentUptime(ctx, component.id).uptimePercent).toBeNull();
	});
});
