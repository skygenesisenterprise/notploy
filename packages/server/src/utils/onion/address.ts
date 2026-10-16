import {
	createHash,
	createPrivateKey,
	createPublicKey,
	randomBytes,
} from "node:crypto";

/**
 * v3 onion address generation.
 *
 * A `.onion` address is *derived* from an ed25519 identity, it is never
 * registered anywhere: `onion_address = base32(PUBKEY | CHECKSUM | VERSION)`
 * with `CHECKSUM = H(".onion checksum" | PUBKEY | VERSION)[:2]` (see Tor's
 * `rend-spec-v3`). Generating the identity here — instead of letting Tor mint
 * it on first start — means the address is known the moment the Onion Service
 * is created, so it can be stored, shown and validated without a running
 * container. Tor then loads the very same identity from the protected storage.
 *
 * Nothing in this module ever logs or returns the secret key outside of the
 * explicit `onionIdentityFiles` helper used to write it to disk.
 */

/** 32-byte on-disk header, padded with NULs exactly like Tor writes it. */
const SECRET_KEY_HEADER = "== ed25519v1-secret: type0 ==\u0000\u0000\u0000";
const PUBLIC_KEY_HEADER = "== ed25519v1-public: type0 ==\u0000\u0000\u0000";

const ONION_CHECKSUM_PREFIX = ".onion checksum";
const ONION_VERSION = 0x03;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A v3 address is 56 base32 characters followed by the `.onion` suffix. */
export const ONION_ADDRESS_LENGTH = 56;
export const ONION_HOSTNAME_REGEX = /^[a-z2-7]{56}\.onion$/;

export interface OnionIdentity {
	/** Public `.onion` address, safe to persist and display. */
	onionAddress: string;
	/** 32-byte ed25519 public key. */
	publicKey: Buffer;
	/** 64-byte expanded ed25519 secret key, as Tor expects on disk. */
	secretKey: Buffer;
}

export interface OnionIdentityFiles {
	/** Contents of Tor's `hs_ed25519_secret_key` file. */
	secretKey: Buffer;
	/** Contents of Tor's `hs_ed25519_public_key` file. */
	publicKey: Buffer;
	/** Contents of Tor's `hostname` file, including the trailing newline. */
	hostname: Buffer;
}

/** RFC 4648 base32, without padding when the input is a whole number of groups. */
export const base32Encode = (input: Buffer): string => {
	let bits = 0;
	let value = 0;
	let output = "";

	for (const byte of input) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}

	if (bits > 0) {
		output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	}

	return output;
};

export const base32Decode = (input: string): Buffer => {
	const normalized = input.trim().toUpperCase().replace(/=+$/, "");
	let bits = 0;
	let value = 0;
	const output: number[] = [];

	for (const character of normalized) {
		const index = BASE32_ALPHABET.indexOf(character);
		if (index === -1) {
			throw new Error("Invalid base32 character");
		}
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	return Buffer.from(output);
};

/**
 * PKCS#8 wrapper for a raw ed25519 seed (`RFC 8410` private key):
 * `302e020100300506032b657004220420` followed by the 32-byte seed.
 */
const ED25519_PKCS8_PREFIX = Buffer.from(
	"302e020100300506032b657004220420",
	"hex",
);

/** Derive the ed25519 public key of a 32-byte seed. */
export const ed25519PublicKeyFromSeed = (seed: Buffer): Buffer => {
	if (seed.length !== 32) {
		throw new Error("An ed25519 seed must be 32 bytes long");
	}

	const privateKey = createPrivateKey({
		key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
		format: "der",
		type: "pkcs8",
	});

	const spki = createPublicKey(privateKey).export({
		format: "der",
		type: "spki",
	});

	return Buffer.from(spki.subarray(spki.length - 32));
};

/**
 * Tor stores the *expanded* ed25519 secret key: the SHA-512 of the seed with
 * the standard clamping applied, which is the 64 bytes its ref10
 * implementation consumes.
 */
export const expandEd25519SecretKey = (seed: Buffer): Buffer => {
	if (seed.length !== 32) {
		throw new Error("An ed25519 seed must be 32 bytes long");
	}

	const expanded = createHash("sha512").update(seed).digest();
	expanded[0] = (expanded[0] ?? 0) & 248;
	expanded[31] = ((expanded[31] ?? 0) & 127) | 64;

	return expanded;
};

/** `base32(PUBKEY | CHECKSUM | VERSION).onion` for a 32-byte public key. */
export const deriveOnionAddress = (publicKey: Buffer): string => {
	if (publicKey.length !== 32) {
		throw new Error("An ed25519 public key must be 32 bytes long");
	}

	const checksum = createHash("sha3-256")
		.update(
			Buffer.concat([
				Buffer.from(ONION_CHECKSUM_PREFIX, "utf8"),
				publicKey,
				Buffer.from([ONION_VERSION]),
			]),
		)
		.digest();

	const address = base32Encode(
		Buffer.concat([
			publicKey,
			checksum.subarray(0, 2),
			Buffer.from([ONION_VERSION]),
		]),
	);

	return `${address.toLowerCase()}.onion`;
};

/** Generate a brand new v3 onion identity from a fresh random seed. */
export const generateOnionIdentity = (): OnionIdentity => {
	const seed = randomBytes(32);

	return {
		onionAddress: deriveOnionAddress(ed25519PublicKeyFromSeed(seed)),
		publicKey: ed25519PublicKeyFromSeed(seed),
		secretKey: expandEd25519SecretKey(seed),
	};
};

/** Serialize an identity into the three files Tor expects in `HiddenServiceDir`. */
export const onionIdentityFiles = (
	identity: OnionIdentity,
): OnionIdentityFiles => ({
	secretKey: Buffer.concat([
		Buffer.from(SECRET_KEY_HEADER, "latin1"),
		identity.secretKey,
	]),
	publicKey: Buffer.concat([
		Buffer.from(PUBLIC_KEY_HEADER, "latin1"),
		identity.publicKey,
	]),
	hostname: Buffer.from(`${identity.onionAddress}\n`, "utf8"),
});

/** Cheap shape check, used before an address is stored or displayed. */
export const isOnionHostname = (
	value: string | null | undefined,
): value is string =>
	typeof value === "string" &&
	ONION_HOSTNAME_REGEX.test(value.trim().toLowerCase());

/** Structural check: shape **and** checksum of a v3 address. */
export const isValidOnionAddress = (
	value: string | null | undefined,
): boolean => {
	if (!isOnionHostname(value)) {
		return false;
	}

	const [label] = (value as string).trim().toLowerCase().split(".");

	try {
		const decoded = base32Decode(label ?? "");
		if (decoded.length < 35) {
			return false;
		}

		const publicKey = decoded.subarray(0, 32);
		const checksum = decoded.subarray(32, 34);
		const version = decoded[34];

		if (version !== ONION_VERSION) {
			return false;
		}

		const expected = createHash("sha3-256")
			.update(
				Buffer.concat([
					Buffer.from(ONION_CHECKSUM_PREFIX, "utf8"),
					publicKey,
					Buffer.from([ONION_VERSION]),
				]),
			)
			.digest()
			.subarray(0, 2);

		return checksum.equals(expected);
	} catch {
		return false;
	}
};
