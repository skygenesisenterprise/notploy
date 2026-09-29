import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	credentialKey,
	EncryptedSecureStorage,
	type EncryptionBackend,
	MemorySecureStorage,
} from "@/main/security/secure-storage";
import { type TempContext, tempUserData } from "../helpers/harness";

/** A reversible "encryption" so the tests can assert on the on-disk form. */
function fakeBackend(
	overrides: Partial<EncryptionBackend> = {},
): EncryptionBackend {
	return {
		info: { available: true, backend: "memory" },
		encrypt: (plaintext) => Buffer.from(`enc:${plaintext}`, "utf8"),
		decrypt: (ciphertext) => ciphertext.toString("utf8").replace(/^enc:/, ""),
		...overrides,
	};
}

describe("EncryptedSecureStorage", () => {
	let context: TempContext;
	let file: string;

	beforeEach(() => {
		context = tempUserData();
		file = path.join(context.userDataPath, "secrets", "credentials.json");
	});

	afterEach(() => context.cleanup());

	it("round-trips a value", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await store.set("key", "npk_abcdef");
		expect(await store.get("key")).toBe("npk_abcdef");
	});

	it("never writes the value in clear", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await store.set("key", "npk_abcdef");

		const raw = fs.readFileSync(file, "utf8");
		expect(raw).not.toContain("npk_abcdef");

		// What lands on disk is the ciphertext, base64-encoded — here the fake
		// backend's `enc:` prefix, never the plaintext itself.
		const stored = JSON.parse(raw) as { entries: Record<string, string> };
		expect(Buffer.from(stored.entries.key, "base64").toString("utf8")).toBe(
			"enc:npk_abcdef",
		);
	});

	it("does not leak one store's entries into another", async () => {
		// Two stores over two different files, both starting from an unreadable
		// file, must not share state through a cached empty document.
		const other = path.join(context.userDataPath, "secrets", "other.json");
		const first = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await first.set("key", "value");

		const second = new EncryptedSecureStorage({
			file: other,
			backend: fakeBackend(),
		});
		expect(await second.get("key")).toBeUndefined();
	});

	it("writes the file with owner-only permissions", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await store.set("key", "value");
		const mode = fs.statSync(file).mode & 0o777;
		expect(mode).toBe(0o600);
	});

	it("reads back what a previous instance wrote", async () => {
		const first = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await first.set("key", "persisted");
		const second = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		expect(await second.get("key")).toBe("persisted");
	});

	it("returns undefined for an unknown key", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		expect(await store.get("missing")).toBeUndefined();
	});

	it("deletes a value and drops it from the file", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await store.set("key", "value");
		await store.delete("key");
		expect(await store.get("key")).toBeUndefined();
		expect(fs.readFileSync(file, "utf8")).not.toContain("value");
	});

	it("ignores an empty value rather than storing a blank credential", async () => {
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await store.set("key", "   ");
		expect(await store.get("key")).toBeUndefined();
	});

	it("drops an entry that can no longer be decrypted", async () => {
		const writer = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		await writer.set("key", "value");

		const broken = new EncryptedSecureStorage({
			file,
			backend: fakeBackend({
				decrypt: () => {
					throw new Error("cannot decrypt");
				},
			}),
		});
		expect(await broken.get("key")).toBeUndefined();
		// The unusable ciphertext is removed rather than retried forever.
		expect(fs.readFileSync(file, "utf8")).not.toContain("enc:value");
	});

	it("starts empty when the file is corrupt", async () => {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, "{ not json", "utf8");
		const store = new EncryptedSecureStorage({ file, backend: fakeBackend() });
		expect(await store.get("key")).toBeUndefined();
		await store.set("key", "value");
		expect(await store.get("key")).toBe("value");
	});
});

describe("MemorySecureStorage", () => {
	it("keeps values for the session only", async () => {
		const store = new MemorySecureStorage();
		await store.set("key", "value");
		expect(await store.get("key")).toBe("value");
		await store.delete("key");
		expect(await store.get("key")).toBeUndefined();
	});

	it("reports that nothing will be persisted", () => {
		const store = new MemorySecureStorage();
		expect(store.info.available).toBe(false);
		expect(store.info.backend).toBe("unavailable");
		expect(store.info.reason).toContain("session only");
	});
});

describe("credentialKey", () => {
	it("namespaces the key per connection", () => {
		expect(credentialKey("abc")).toBe("notploy.connection.abc");
		expect(credentialKey("abc")).not.toBe(credentialKey("def"));
	});
});
