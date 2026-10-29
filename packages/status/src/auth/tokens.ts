/**
 * Token primitives.
 *
 * A token value looks like `nps_<tokenId>_<secret>`. Only a SHA-256 hash of
 * the secret is stored, so a database leak never exposes usable credentials;
 * the embedded id lets verification look the record up without scanning.
 * Comparison is constant-time. Possession of a token *and* its scopes is the
 * only authorization path — identifiers alone never grant anything.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { TokenScope } from "../core/types";

export const TOKEN_PREFIX = "nps";

export interface GeneratedToken {
	/** Database id of the token record. */
	id: string;
	/** Full value returned exactly once, at creation time. */
	value: string;
	/** Public, displayable prefix (`nps_<id>`). */
	prefix: string;
}

const TOKEN_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Length (in characters) of the random suffix of a token id. One byte maps to
 * exactly one character, so the id keeps a fixed, parseable shape
 * (`tok_` + 12 chars) even though the secret may contain `_`.
 */
const TOKEN_ID_LENGTH = 12;

/** `tok_` + the random suffix: the exact shape the parser relies on. */
const TOKEN_ID_PREFIX = "tok_";

const randomTokenId = (): string => {
	const buf = randomBytes(TOKEN_ID_LENGTH);
	let out = "";
	for (const byte of buf) {
		out += TOKEN_ID_ALPHABET[byte % TOKEN_ID_ALPHABET.length];
	}
	return out;
};

export const hashSecret = (secret: string): string =>
	createHash("sha256").update(secret, "utf8").digest("hex");

export const generateToken = (): GeneratedToken => {
	const id = `${TOKEN_ID_PREFIX}${randomTokenId()}`;
	const secret = randomBytes(32).toString("base64url");
	return {
		id,
		value: `${TOKEN_PREFIX}_${id}_${secret}`,
		prefix: `${TOKEN_PREFIX}_${id}`,
	};
};

export interface ParsedToken {
	id: string;
	secret: string;
}

export const parseToken = (value: string): ParsedToken | null => {
	// A value is `nps_<tok_id>_<secret>`. The id may not be recovered by
	// splitting on `_`: the id itself starts with `tok_`, and the secret is
	// base64url (its alphabet also contains `_`). The id therefore has a fixed
	// shape, and the first `_` after it is the separator.
	const trimmed = value.trim();
	const head = `${TOKEN_PREFIX}_`;
	if (!trimmed.startsWith(head)) {
		return null;
	}
	const body = trimmed.slice(head.length);
	if (!body.startsWith(TOKEN_ID_PREFIX)) {
		return null;
	}
	const idEnd = TOKEN_ID_PREFIX.length + TOKEN_ID_LENGTH;
	const id = body.slice(0, idEnd);
	const suffix = body.slice(TOKEN_ID_PREFIX.length);
	if (
		suffix.length <= TOKEN_ID_LENGTH ||
		!/^[a-z0-9]+$/.test(suffix.slice(0, TOKEN_ID_LENGTH)) ||
		body.charAt(idEnd) !== "_"
	) {
		return null;
	}
	const secret = body.slice(idEnd + 1);
	if (secret.length < 16) {
		return null;
	}
	return { id, secret };
};

export const verifySecret = (secret: string, storedHash: string): boolean => {
	const candidate = Buffer.from(hashSecret(secret), "utf8");
	const stored = Buffer.from(storedHash, "utf8");
	if (candidate.length !== stored.length) {
		return false;
	}
	return timingSafeEqual(candidate, stored);
};

/** `admin` implies every other scope; otherwise the scope must be listed. */
export const scopeAllows = (
	granted: readonly TokenScope[],
	required: TokenScope,
): boolean => granted.includes("admin") || granted.includes(required);

export const parseScopes = (json: string): TokenScope[] => {
	try {
		const parsed = JSON.parse(json) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(value): value is TokenScope => typeof value === "string",
		);
	} catch {
		return [];
	}
};
