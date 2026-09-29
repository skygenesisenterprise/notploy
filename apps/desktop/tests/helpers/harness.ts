/**
 * Test harness for the main-process modules.
 *
 * A connection store needs a user-data directory and a keychain; the tests get a
 * throw-away directory under the OS temp directory and an in-memory keychain, so
 * nothing touches the developer's real profile.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConnectionStore } from "@/main/connection/connection-store";
import { noopLogger } from "@/main/logging";
import {
	MemorySecureStorage,
	type SecureStorage,
} from "@/main/security/secure-storage";

export interface TempContext {
	userDataPath: string;
	cleanup: () => void;
}

/** A fresh user-data directory, removed by `cleanup()`. */
export function tempUserData(prefix = "notploy-desktop-test-"): TempContext {
	const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	return {
		userDataPath,
		cleanup: () => {
			fs.rmSync(userDataPath, { recursive: true, force: true });
		},
	};
}

/** A keychain stand-in that stores plainly, in memory only. */
export function memorySecrets(): SecureStorage {
	return new MemorySecureStorage({
		available: true,
		backend: "memory",
	});
}

export function testConnectionStore(
	userDataPath: string,
	secrets: SecureStorage = memorySecrets(),
): ConnectionStore {
	return new ConnectionStore(userDataPath, secrets, noopLogger);
}
