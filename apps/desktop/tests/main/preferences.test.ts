import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizePreferences, PreferencesService } from "@/main/preferences";
import { DEFAULT_PREFERENCES } from "@/shared/ipc";
import { type TempContext, tempUserData } from "../helpers/harness";

let context: TempContext;

beforeEach(() => {
	context = tempUserData();
});

afterEach(() => context.cleanup());

describe("normalizePreferences", () => {
	it("returns the defaults for empty input", () => {
		expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES);
	});

	it("clamps the refresh interval into its bounds", () => {
		expect(
			normalizePreferences({ autoRefreshSeconds: -5 }).autoRefreshSeconds,
		).toBe(0);
		expect(
			normalizePreferences({ autoRefreshSeconds: 999_999 }).autoRefreshSeconds,
		).toBe(3_600);
	});

	it("clamps the log tail and the request timeout", () => {
		expect(normalizePreferences({ logTailLines: 1 }).logTailLines).toBe(10);
		expect(normalizePreferences({ logTailLines: 1_000_000 }).logTailLines).toBe(
			100_000,
		);
		expect(normalizePreferences({ requestTimeout: 5 }).requestTimeout).toBe(
			1_000,
		);
		expect(
			normalizePreferences({ requestTimeout: 10_000_000 }).requestTimeout,
		).toBe(600_000);
	});

	it("ignores a non-numeric value instead of storing NaN", () => {
		expect(
			normalizePreferences({ logTailLines: Number.NaN }).logTailLines,
		).toBe(DEFAULT_PREFERENCES.logTailLines);
	});

	it("keeps the confirmation toggle boolean", () => {
		expect(
			normalizePreferences({ confirmDestructiveActions: false })
				.confirmDestructiveActions,
		).toBe(false);
	});
});

describe("PreferencesService", () => {
	it("starts from the defaults", () => {
		const service = new PreferencesService(context.userDataPath);
		expect(service.get()).toEqual(DEFAULT_PREFERENCES);
	});

	it("persists an update and survives a restart", () => {
		const first = new PreferencesService(context.userDataPath);
		first.update({ confirmDestructiveActions: false, logTailLines: 500 });

		const second = new PreferencesService(context.userDataPath);
		expect(second.get()).toMatchObject({
			confirmDestructiveActions: false,
			logTailLines: 500,
		});
	});

	it("keeps the other values when a single field is patched", () => {
		const service = new PreferencesService(context.userDataPath);
		service.update({ logTailLines: 42 });
		expect(service.get().requestTimeout).toBe(
			DEFAULT_PREFERENCES.requestTimeout,
		);
	});

	it("writes the file with owner-only permissions", () => {
		const service = new PreferencesService(context.userDataPath);
		service.update({ logTailLines: 42 });
		const file = path.join(context.userDataPath, "preferences.json");
		expect(fs.statSync(file).mode & 0o777).toBe(0o600);
	});

	it("falls back to the defaults when the file is corrupt", () => {
		fs.writeFileSync(
			path.join(context.userDataPath, "preferences.json"),
			"not json",
			"utf8",
		);
		const service = new PreferencesService(context.userDataPath);
		expect(service.get()).toEqual(DEFAULT_PREFERENCES);
	});
});
