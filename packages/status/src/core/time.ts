/**
 * Time helpers.
 *
 * Everything is stored and exchanged as ISO 8601 strings in UTC. Operators
 * may enter a maintenance window in a named IANA time zone (kept on the
 * record for display) but the persisted instants are always UTC, so ordering,
 * overlap and freshness computations are timezone-independent.
 */

/** Current instant as an ISO 8601 UTC string. */
export const nowIso = (): string => new Date().toISOString();

/** True when `value` parses as a date. */
export const isIsoDate = (value: string): boolean =>
	Number.isFinite(Date.parse(value));

/** Parse an ISO date, returning `null` instead of throwing. */
export const parseIso = (value: string | null | undefined): Date | null => {
	if (!value) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed : null;
};

/** Seconds between two ISO instants (`to - to` guards against NaN). */
export const secondsBetween = (fromIso: string, toIso: string): number => {
	const from = parseIso(fromIso);
	const to = parseIso(toIso);
	if (!from || !to) {
		return 0;
	}
	return (to.getTime() - from.getTime()) / 1000;
};

/** `true` when `instant` is older than `staleAfterSeconds` relative to `now`. */
export const isOlderThan = (
	instant: string | null | undefined,
	staleAfterSeconds: number,
	now: string = nowIso(),
): boolean => {
	const parsed = parseIso(instant ?? null);
	if (!parsed) {
		return true;
	}
	const nowParsed = parseIso(now);
	if (!nowParsed) {
		return true;
	}
	return (nowParsed.getTime() - parsed.getTime()) / 1000 > staleAfterSeconds;
};

/** True when `[aStart, aEnd)` overlaps `[bStart, bEnd)`. */
export const intervalsOverlap = (
	aStart: string,
	aEnd: string | null,
	bStart: string,
	bEnd: string | null,
): boolean => {
	const as = parseIso(aStart);
	const ae = aEnd ? parseIso(aEnd) : null;
	const bs = parseIso(bStart);
	const be = bEnd ? parseIso(bEnd) : null;
	if (!as || !bs) {
		return false;
	}
	// An open-ended window (no end) is treated as "still running".
	const aEndMs = ae ? ae.getTime() : Number.POSITIVE_INFINITY;
	const bEndMs = be ? be.getTime() : Number.POSITIVE_INFINITY;
	return as.getTime() < bEndMs && bs.getTime() < aEndMs;
};

/** Compute `start + seconds` as an ISO string (used by retry schedules). */
export const plusSeconds = (iso: string, seconds: number): string => {
	const parsed = parseIso(iso) ?? new Date();
	return new Date(parsed.getTime() + seconds * 1000).toISOString();
};

/** Truncate an ISO instant to its UTC minute (used for dedup buckets). */
export const minuteBucket = (iso: string): string => {
	const parsed = parseIso(iso) ?? new Date();
	parsed.setUTCSeconds(0, 0);
	return parsed.toISOString();
};

/** Validate an IANA time zone name (used for maintenance records). */
export const isValidTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
};
