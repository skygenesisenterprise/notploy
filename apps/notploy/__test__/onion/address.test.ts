import {
	base32Decode,
	base32Encode,
	deriveOnionAddress,
	ed25519PublicKeyFromSeed,
	expandEd25519SecretKey,
	generateOnionIdentity,
	isOnionHostname,
	isValidOnionAddress,
	onionIdentityFiles,
} from "@notploy/server/utils/onion/address";
import { describe, expect, it } from "vitest";

/**
 * Test vectors cross-checked against two independent implementations, so the
 * expectations do not come from the code under test:
 *
 * - the ed25519 public key of `SEED` was produced with
 *   `openssl pkey -inform DER -pubout`;
 * - the expanded secret key with a Python `hashlib.sha512` + clamping script;
 * - the v3 addresses with a Python `hashlib.sha3_256` + `base64.b32encode`
 *   implementation of Tor's `rend-spec-v3` address derivation.
 */
const SEED = Buffer.from(
	"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
	"hex",
);
const PUBLIC_KEY =
	"03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8";
const EXPANDED_SECRET =
	"3894eea49c580aef816935762be049559d6d1440dede12e6a125f1841fff8e6fa9d71862a3e5746b571be3d187b0041046f52ebd850c7cbd5fde8ee38473b649";
const ONION_ADDRESS =
	"aoqqpp7tzyil4hlq3umoos6atft6jvrqtosq2xy53sdgiesvgg4bqead.onion";
const SEQUENTIAL_PUBLIC_KEY =
	"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const SEQUENTIAL_ADDRESS =
	"aaaqeayeaudaocajbifqydiob4ibceqtcqkrmfyydenbwha5dyp3kead.onion";

describe("ed25519 identity derivation", () => {
	it("derives the public key of a seed", () => {
		expect(ed25519PublicKeyFromSeed(SEED).toString("hex")).toBe(PUBLIC_KEY);
	});

	it("refuses a seed that is not 32 bytes", () => {
		expect(() => ed25519PublicKeyFromSeed(Buffer.alloc(16))).toThrow(
			/32 bytes/,
		);
	});

	it("expands the secret key the way Tor stores it", () => {
		const expanded = expandEd25519SecretKey(SEED);
		expect(expanded).toHaveLength(64);
		expect(expanded.toString("hex")).toBe(EXPANDED_SECRET);
	});

	it("clamps the expanded secret key", () => {
		for (const seed of [Buffer.alloc(32), SEED, Buffer.alloc(32, 0xff)]) {
			const expanded = expandEd25519SecretKey(seed);
			expect(expanded[0]! & 7).toBe(0);
			expect(expanded[31]! & 0x80).toBe(0);
			expect(expanded[31]! & 64).toBe(64);
		}
	});
});

describe("deriveOnionAddress", () => {
	it("builds the address of a public key", () => {
		expect(deriveOnionAddress(Buffer.from(SEQUENTIAL_PUBLIC_KEY, "hex"))).toBe(
			SEQUENTIAL_ADDRESS,
		);
	});

	it("builds the address of the identity derived from a seed", () => {
		expect(deriveOnionAddress(ed25519PublicKeyFromSeed(SEED))).toBe(
			ONION_ADDRESS,
		);
	});

	it("refuses a public key that is not 32 bytes", () => {
		expect(() => deriveOnionAddress(Buffer.alloc(31))).toThrow(/32 bytes/);
	});
});

describe("base32", () => {
	it("encodes without padding for a 35-byte payload", () => {
		expect(base32Encode(Buffer.alloc(35))).toHaveLength(56);
	});

	it("round-trips", () => {
		const payload = Buffer.from(ONION_ADDRESS.replace(".onion", "").toUpperCase());
		expect(base32Encode(base32Decode(payload.toString()))).toBe(
			payload.toString(),
		);
	});
});

describe("onionIdentityFiles", () => {
	it("writes the exact Tor file layout", () => {
		const identity = {
			onionAddress: ONION_ADDRESS,
			publicKey: Buffer.from(PUBLIC_KEY, "hex"),
			secretKey: Buffer.from(EXPANDED_SECRET, "hex"),
		};
		const files = onionIdentityFiles(identity);

		// Tor pads both tags with NULs so the header is exactly 32 bytes.
		const secretHeader = files.secretKey.subarray(0, 32).toString("latin1");
		const publicHeader = files.publicKey.subarray(0, 32).toString("latin1");
		expect(secretHeader).toBe("== ed25519v1-secret: type0 ==\u0000\u0000\u0000");
		expect(publicHeader).toBe("== ed25519v1-public: type0 ==\u0000\u0000\u0000");
		expect(files.secretKey.subarray(32).toString("hex")).toBe(EXPANDED_SECRET);
		expect(files.publicKey.subarray(32).toString("hex")).toBe(PUBLIC_KEY);
		expect(files.hostname.toString()).toBe(`${ONION_ADDRESS}\n`);
	});
});

describe("address validation", () => {
	it("accepts a v3 address", () => {
		expect(isOnionHostname(ONION_ADDRESS)).toBe(true);
		expect(isValidOnionAddress(ONION_ADDRESS)).toBe(true);
		expect(isValidOnionAddress(ONION_ADDRESS.toUpperCase())).toBe(true);
	});

	it("rejects dns names, v2 addresses and junk", () => {
		expect(isOnionHostname("example.com")).toBe(false);
		expect(isValidOnionAddress(null)).toBe(false);
		expect(isValidOnionAddress("")).toBe(false);
		expect(isValidOnionAddress("expyuzz4wqqyqhjn.onion")).toBe(false);
		expect(isValidOnionAddress("a".repeat(56) + ".onion")).toBe(false);
	});

	it("rejects an address whose checksum does not match its key", () => {
		const label = ONION_ADDRESS.replace(".onion", "");
		const tampered = `${label.slice(0, 10)}${label[10] === "a" ? "b" : "a"}${label.slice(11)}.onion`;

		expect(isOnionHostname(tampered)).toBe(true);
		expect(isValidOnionAddress(tampered)).toBe(false);
	});

	it("rejects an address built with a bad checksum", () => {
		const publicKey = Buffer.from(PUBLIC_KEY, "hex");
		const fake = `${base32Encode(
			Buffer.concat([publicKey, Buffer.from([0x00, 0x00]), Buffer.from([0x03])]),
		).toLowerCase()}.onion`;

		expect(isValidOnionAddress(fake)).toBe(false);
	});
});

describe("generateOnionIdentity", () => {
	it("generates a valid, unique identity", () => {
		const first = generateOnionIdentity();
		const second = generateOnionIdentity();

		expect(first.secretKey).toHaveLength(64);
		expect(first.publicKey).toHaveLength(32);
		expect(isValidOnionAddress(first.onionAddress)).toBe(true);
		expect(first.onionAddress).not.toBe(second.onionAddress);
		expect(deriveOnionAddress(first.publicKey)).toBe(first.onionAddress);
	});
});
