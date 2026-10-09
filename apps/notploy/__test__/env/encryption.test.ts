import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
} from "node:crypto";
import { betterAuthSecret } from "@notploy/server/lib/auth-secret";
import {
	decryptValue,
	encryptValue,
	exportEncryptionKeys,
	isEncrypted,
} from "@notploy/server/lib/encryption";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("encryptValue / decryptValue", () => {
	it("round-trips a value", () => {
		const value =
			"DATABASE_URL=postgres://user:secret@host:5432/db\nAPI_KEY=123";
		const encrypted = encryptValue(value);

		expect(encrypted).not.toBe(value);
		expect(isEncrypted(encrypted)).toBe(true);
		expect(encrypted).not.toContain("secret");
		expect(decryptValue(encrypted)).toBe(value);
	});

	it("uses a random IV so equal inputs produce different ciphertexts", () => {
		const value = "KEY=value";
		expect(encryptValue(value)).not.toBe(encryptValue(value));
	});

	it("passes legacy plaintext through on decrypt", () => {
		const plaintext = "KEY=legacy-plaintext-value";
		expect(decryptValue(plaintext)).toBe(plaintext);
	});

	it("passes empty values through unchanged", () => {
		expect(encryptValue("")).toBe("");
		expect(decryptValue("")).toBe("");
	});

	it("does not double-encrypt an already encrypted value", () => {
		const encrypted = encryptValue("KEY=value");
		expect(encryptValue(encrypted)).toBe(encrypted);
	});

	it("throws a descriptive error on tampered ciphertext", () => {
		const encrypted = encryptValue("KEY=value");
		const tampered = `${encrypted.slice(0, -4)}AAAA`;
		expect(() => decryptValue(tampered)).toThrow(/BETTER_AUTH_SECRET/);
	});

	it("exports the derived keys as 32-byte hex lines for backups", () => {
		expect(exportEncryptionKeys()).toMatch(/^[0-9a-f]{64}(\n[0-9a-f]{64})*$/);
	});
});

describe("dedicated ENCRYPTION_KEY", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	const loadWithEncryptionKey = async (key: string) => {
		vi.stubEnv("ENCRYPTION_KEY", key);
		vi.resetModules();
		return await import("@notploy/server/lib/encryption");
	};

	it("encrypts with the dedicated key when set", async () => {
		const withKey = await loadWithEncryptionKey("my-dedicated-key");
		const encrypted = withKey.encryptValue("KEY=value");

		expect(withKey.decryptValue(encrypted)).toBe("KEY=value");
		// The default (auth-secret derived) module cannot read it
		expect(() => decryptValue(encrypted)).toThrow(/ENCRYPTION_KEY/);
	});

	it("still decrypts legacy values via the auth-secret fallback", async () => {
		// Encrypted before the install adopted a dedicated key
		const legacyEncrypted = encryptValue("KEY=legacy-value");

		const withKey = await loadWithEncryptionKey("my-dedicated-key");
		expect(withKey.decryptValue(legacyEncrypted)).toBe("KEY=legacy-value");
	});

	it("re-encrypts with the dedicated key on write", async () => {
		const withKey = await loadWithEncryptionKey("my-dedicated-key");
		const reEncrypted = withKey.encryptValue(
			withKey.decryptValue(encryptValue("KEY=migrated")),
		);

		const other = await loadWithEncryptionKey("another-key");
		// Readable only by the dedicated key (or its own fallback), proving
		// the write used the primary key, not the legacy one
		expect(withKey.decryptValue(reEncrypted)).toBe("KEY=migrated");
		expect(() => other.decryptValue(reEncrypted)).toThrow();
	});
});

const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveWithTag = (tag: string, secret: string) =>
	createHmac("sha256", secret).update(tag).digest();

// Produces a ciphertext exactly as Dokploy would have written it, so the
// migration compatibility of the decrypt-only fallback is exercised for real.
const sealWithTag = (tag: string, secret: string, value: string) => {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", deriveWithTag(tag, secret), iv);
	const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	return `${PREFIX}${Buffer.concat([
		iv,
		cipher.getAuthTag(),
		body,
	]).toString("base64")}`;
};

const openWithTag = (tag: string, secret: string, value: string) => {
	const payload = Buffer.from(value.slice(PREFIX.length), "base64");
	const iv = payload.subarray(0, IV_LENGTH);
	const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const body = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
	const decipher = createDecipheriv(
		"aes-256-gcm",
		deriveWithTag(tag, secret),
		iv,
	);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(body), decipher.final()]).toString(
		"utf8",
	);
};

describe("Dokploy-encrypted values (migration compatibility)", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("decrypts values encrypted by Dokploy with the same auth secret", () => {
		const value = "DATABASE_URL=postgres://user:secret@host:5432/db";
		const fromDokploy = sealWithTag(
			"dokploy:db-encryption:v1",
			betterAuthSecret,
			value,
		);

		expect(decryptValue(fromDokploy)).toBe(value);
	});

	it("re-encrypts migrated values under the Notploy key on write", () => {
		const value = "KEY=migrated";
		const fromDokploy = sealWithTag(
			"dokploy:db-encryption:v1",
			betterAuthSecret,
			value,
		);
		const reEncrypted = encryptValue(decryptValue(fromDokploy));

		expect(reEncrypted).not.toBe(fromDokploy);
		expect(
			openWithTag("notploy:db-encryption:v1", betterAuthSecret, reEncrypted),
		).toBe(value);
	});

	it("decrypts Dokploy values even after adopting a dedicated ENCRYPTION_KEY", async () => {
		const fromDokploy = sealWithTag(
			"dokploy:db-encryption:v1",
			betterAuthSecret,
			"KEY=value",
		);
		vi.stubEnv("ENCRYPTION_KEY", "my-dedicated-key");
		vi.resetModules();
		const withKey = await import("@notploy/server/lib/encryption");

		expect(withKey.decryptValue(fromDokploy)).toBe("KEY=value");
	});
});
