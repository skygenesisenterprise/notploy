/**
 * Local UI preferences.
 *
 * These are display and confirmation settings only — never a credential — so
 * they live in a plain JSON file next to the connection metadata. Every value
 * is clamped on the way in: a preference that arrives from the renderer is
 * untrusted, and an out-of-range poll interval or timeout would be felt as a
 * hang rather than as a validation error.
 */

import path from "node:path";
import { DEFAULT_PREFERENCES, type DesktopPreferences } from "@/shared/ipc";
import { JsonStore } from "./store/json-store";

const LIMITS = {
	autoRefreshSeconds: { min: 0, max: 3_600 },
	logTailLines: { min: 10, max: 100_000 },
	requestTimeout: { min: 1_000, max: 600_000 },
} as const;

function clamp(
	value: number,
	min: number,
	max: number,
	fallback: number,
): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizePreferences(
	input: Partial<DesktopPreferences>,
	base: DesktopPreferences = DEFAULT_PREFERENCES,
): DesktopPreferences {
	return {
		confirmDestructiveActions:
			typeof input.confirmDestructiveActions === "boolean"
				? input.confirmDestructiveActions
				: base.confirmDestructiveActions,
		autoRefreshSeconds: clamp(
			input.autoRefreshSeconds ?? base.autoRefreshSeconds,
			LIMITS.autoRefreshSeconds.min,
			LIMITS.autoRefreshSeconds.max,
			base.autoRefreshSeconds,
		),
		logTailLines: clamp(
			input.logTailLines ?? base.logTailLines,
			LIMITS.logTailLines.min,
			LIMITS.logTailLines.max,
			base.logTailLines,
		),
		requestTimeout: clamp(
			input.requestTimeout ?? base.requestTimeout,
			LIMITS.requestTimeout.min,
			LIMITS.requestTimeout.max,
			base.requestTimeout,
		),
	};
}

export class PreferencesService {
	private readonly store: JsonStore<DesktopPreferences>;

	constructor(userDataPath: string) {
		this.store = new JsonStore<DesktopPreferences>(
			path.join(userDataPath, "preferences.json"),
			DEFAULT_PREFERENCES,
		);
	}

	get(): DesktopPreferences {
		return normalizePreferences(this.store.read());
	}

	update(patch: Partial<DesktopPreferences>): DesktopPreferences {
		const next = normalizePreferences(patch, this.get());
		this.store.write(next);
		return next;
	}
}
