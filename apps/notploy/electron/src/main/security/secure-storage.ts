/**
 * Credential storage.
 *
 * The rest of the app depends on this interface only — never on the OS
 * implementation. Three properties matter:
 *
 * 1. **Nothing is written in clear.** Values are encrypted by the OS keychain
 *    (Windows DPAPI, macOS Keychain, Linux Secret Service/libsecret — through
 *    Electron's `safeStorage`) before they reach the disk, and the file is
 *    created with owner-only permissions.
 * 2. **A missing keyring degrades honestly.** When the OS has no usable
 *    keyring, the app must not silently write plaintext: it falls back to
 *    session-only memory storage and reports why, so the UI can tell the user
 *    that credentials will not survive a restart.
 * 3. **Secrets never enter the config file.** This store is separate from
 *    `JsonStore`, which holds connection metadata only.
 *
 * This module has no Electron import: the encryption backend is injected.
 */

import fs from "node:fs";
import path from "node:path";
import type { SecureStorageBackend, SecureStorageInfo } from "@/shared/ipc";
import { redact } from "../client/errors";

export type { SecureStorageBackend, SecureStorageInfo };

export interface SecureStorage {
	/** Whether credentials can be persisted for longer than this session. */
	readonly info: SecureStorageInfo;
	get(key: string): Promise<string | undefined>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/** The OS encryption primitive, split out so tests can supply a fake. */
export interface EncryptionBackend {
	readonly info: SecureStorageInfo;
	encrypt(plaintext: string): Buffer;
	decrypt(ciphertext: Buffer): string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

/**
 * Keeps credentials for the lifetime of the process only.
 *
 * Used when no OS keyring is available. Login still works for the session; the
 * `reason` explains that nothing will be remembered.
 */
export class MemorySecureStorage implements SecureStorage {
	private readonly values = new Map<string, string>();

	constructor(private readonly infoOverride?: SecureStorageInfo) {}

	get info(): SecureStorageInfo {
		return (
			this.infoOverride ?? {
				available: false,
				backend: "unavailable",
				reason:
					"No OS keyring is available, so credentials are kept for this session only and are not written to disk.",
			}
		);
	}

	async get(key: string): Promise<string | undefined> {
		const value = this.values.get(key);
		return value?.trim() ? value : undefined;
	}

	async set(key: string, value: string): Promise<void> {
		if (!value.trim()) return;
		this.values.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.values.delete(key);
	}
}

// ---------------------------------------------------------------------------
// Encrypted file store
// ---------------------------------------------------------------------------

interface SecretsFile {
	version: 1;
	/** key → base64 of the keychain-encrypted value. */
	entries: Record<string, string>;
}

export interface EncryptedSecureStorageOptions {
	/** Absolute path of the secrets file. Never inside the config file. */
	file: string;
	backend: EncryptionBackend;
}

/**
 * A *fresh* empty file value.
 *
 * A function, not a shared constant: `set()` mutates `file.entries` in place, so
 * handing the same object to two stores would let one instance's credentials
 * appear in another's empty state.
 */
function emptyFile(): SecretsFile {
	return { version: 1, entries: {} };
}

export class EncryptedSecureStorage implements SecureStorage {
	private cache: SecretsFile | undefined;

	constructor(private readonly options: EncryptedSecureStorageOptions) {}

	get info(): SecureStorageInfo {
		return this.options.backend.info;
	}

	private load(): SecretsFile {
		if (this.cache) return this.cache;
		try {
			const raw = fs.readFileSync(this.options.file, "utf8");
			const parsed = JSON.parse(raw) as Partial<SecretsFile>;
			if (!parsed || typeof parsed !== "object" || !parsed.entries) {
				this.cache = emptyFile();
				return this.cache;
			}
			this.cache = {
				version: 1,
				entries: { ...parsed.entries } as Record<string, string>,
			};
		} catch {
			// Missing or unreadable file: start empty rather than failing. A
			// corrupt file means the credentials must be entered again, which is
			// recoverable and much better than refusing to start.
			this.cache = emptyFile();
		}
		return this.cache;
	}

	private persist(file: SecretsFile): void {
		const directory = path.dirname(this.options.file);
		fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
		const temporary = `${this.options.file}.tmp`;
		fs.writeFileSync(temporary, JSON.stringify(file, null, "\t"), {
			encoding: "utf8",
			mode: 0o600,
		});
		// Atomic replace: a crash mid-write can never truncate the previous file.
		fs.renameSync(temporary, this.options.file);
		this.cache = file;
	}

	async get(key: string): Promise<string | undefined> {
		const file = this.load();
		const encoded = file.entries[key];
		if (!encoded) return undefined;
		try {
			const value = this.options.backend.decrypt(
				Buffer.from(encoded, "base64"),
			);
			return value.trim() ? value : undefined;
		} catch {
			// The ciphertext cannot be read (different OS user, rotated keyring
			// key, moved profile). Drop the entry instead of leaving a value that
			// can never be used but keeps being retried.
			delete file.entries[key];
			this.persist(file);
			return undefined;
		}
	}

	async set(key: string, value: string): Promise<void> {
		if (!value.trim()) return;
		const file = this.load();
		const encrypted = this.options.backend.encrypt(value);
		file.entries[key] = encrypted.toString("base64");
		this.persist(file);
	}

	async delete(key: string): Promise<void> {
		const file = this.load();
		if (!(key in file.entries)) return;
		delete file.entries[key];
		this.persist(file);
	}
}

/**
 * The keys the desktop app uses. Namespaced so a keychain entry is
 * self-describing and two connections can never collide.
 */
export function credentialKey(connectionId: string): string {
	return `notploy.connection.${connectionId}`;
}

/** Never log the key itself; only that an operation touched one. */
export function describeCredentialKey(key: string): string {
	return redact(key.replace(/[0-9a-f-]{8,}/gi, "<id>"));
}
