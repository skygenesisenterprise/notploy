import { randomBytes, randomUUID } from "node:crypto";

/**
 * Stable, non-guessable identifiers.
 *
 * IDs are prefixed so a leaked identifier is self-describing in logs and
 * support conversations (`inc_`, `cmp_`, ...) and random enough that guessing
 * one never grants access — authorization always goes through the token
 * layer, never through knowledge of an id.
 */

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export type IdPrefix =
	| "pg"
	| "cmp"
	| "inc"
	| "mnt"
	| "evt"
	| "tok"
	| "aud"
	| "idem"
	| "ing"
	| "out"
	| "wh";

const randomId = (bytes: number): string => {
	const buf = randomBytes(bytes);
	let out = "";
	for (const byte of buf) {
		out += ID_ALPHABET[byte % ID_ALPHABET.length];
	}
	return out;
};

/** Generate a prefixed, non-guessable identifier. */
export const newId = (prefix: IdPrefix): string => `${prefix}_${randomId(12)}`;

/** Generate a cryptographically random bearer token value (never stored). */
export const newTokenValue = (): string =>
	`nps_${randomBytes(32).toString("base64url")}`;

/** A request id used to correlate logs without exposing internals publicly. */
export const newRequestId = (): string => randomUUID();
