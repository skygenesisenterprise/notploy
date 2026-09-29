/**
 * The Electron side of credential storage.
 *
 * `safeStorage` is the cross-platform front end to the OS keychain: DPAPI on
 * Windows, the login Keychain on macOS, and Secret Service (gnome-libsecret,
 * kwallet) on Linux. Two Electron-specific details are handled here:
 *
 * - On Linux, `safeStorage.getSelectedStorageBackend()` reports which provider
 *   was selected. `basic_text` means no keyring was found and Electron would
 *   fall back to a hard-coded key — obfuscation, not encryption — so that case
 *   is treated as *no keyring* and the app uses session-only memory storage
 *   instead of pretending the credential is protected.
 * - `isEncryptionAvailable()` can be false before the app is ready or on a
 *   machine with no usable keyring, so it is checked at call time.
 */

import path from "node:path";
import { app, safeStorage } from "electron";
import type { SecureStorageInfo } from "@/shared/ipc";
import {
	credentialKey,
	EncryptedSecureStorage,
	type EncryptionBackend,
	MemorySecureStorage,
	type SecureStorage,
} from "./secure-storage";

export { credentialKey };

interface LinuxBackendLike {
	getSelectedStorageBackend?: () => string;
}

function linuxBackend(): SecureStorageInfo {
	const selected = (
		safeStorage as LinuxBackendLike
	).getSelectedStorageBackend?.();

	switch (selected) {
		case "gnome_libsecret":
		case "kwallet":
		case "kwallet5":
		case "kwallet6":
			return { available: true, backend: "libsecret" };
		case "basic_text":
			return {
				available: false,
				backend: "unavailable",
				reason:
					"No Secret Service provider (gnome-libsecret or kwallet) was found, so Electron would fall back to a hard-coded key. Credentials stay in memory for this session only.",
			};
		default:
			return {
				available: false,
				backend: "unavailable",
				reason:
					"The Linux keyring backend could not be determined, so credentials stay in memory for this session only.",
			};
	}
}

function describeBackend(): SecureStorageInfo {
	if (!safeStorage.isEncryptionAvailable()) {
		return {
			available: false,
			backend: "unavailable",
			reason:
				"The operating system keychain is not available, so credentials stay in memory for this session only.",
		};
	}
	if (process.platform === "win32") {
		return { available: true, backend: "dpapi" };
	}
	if (process.platform === "darwin") {
		return { available: true, backend: "keychain" };
	}
	return linuxBackend();
}

class SafeStorageBackend implements EncryptionBackend {
	get info(): SecureStorageInfo {
		return describeBackend();
	}

	encrypt(plaintext: string): Buffer {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error("safeStorage is not available");
		}
		return safeStorage.encryptString(plaintext);
	}

	decrypt(ciphertext: Buffer): string {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error("safeStorage is not available");
		}
		return safeStorage.decryptString(ciphertext);
	}
}

/**
 * Resolution order:
 *
 * 1. OS keyring, when Electron reports one is usable → encrypted file store.
 * 2. Otherwise → memory store, with the reason surfaced to the UI.
 *
 * There is deliberately no plaintext file fallback.
 */
export function resolveSecureStorage(userDataPath: string): SecureStorage {
	const backend = new SafeStorageBackend();
	const info = backend.info;

	if (!info.available) {
		return new MemorySecureStorage(info);
	}

	return new EncryptedSecureStorage({
		file: path.join(userDataPath, "secrets", "credentials.json"),
		backend,
	});
}

/** The directory the secrets file lives in, for the diagnostics panel. */
export function secretsDirectoryFor(userDataPath: string): string {
	return path.join(userDataPath, "secrets");
}

/** Convenience for callers that only have the `app` module available. */
export function resolveAppSecureStorage(): SecureStorage {
	return resolveSecureStorage(app.getPath("userData"));
}
