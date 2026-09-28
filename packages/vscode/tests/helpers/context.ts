import type * as vscode from "vscode";

export interface FakeContext extends vscode.ExtensionContext {
	globalStateValues: Map<string, unknown>;
	workspaceStateValues: Map<string, unknown>;
	secretValues: Map<string, string>;
}

/**
 * A minimal `ExtensionContext` with the two storages the extension uses.
 *
 * `globalState`/`workspaceState`/`secrets` behave like the real ones, so tests
 * can assert on what was persisted — including that no token ever reaches
 * anything other than `secrets`.
 */
export function createFakeContext(): FakeContext {
	const globalStateValues = new Map<string, unknown>();
	const workspaceStateValues = new Map<string, unknown>();
	const secretValues = new Map<string, string>();

	const globalState = {
		get<T>(key: string, defaultValue?: T): T | undefined {
			return (
				globalStateValues.has(key) ? globalStateValues.get(key) : defaultValue
			) as T | undefined;
		},
		async update(key: string, value: unknown): Promise<void> {
			if (value === undefined) globalStateValues.delete(key);
			else globalStateValues.set(key, value);
			return undefined;
		},
		keys(): readonly string[] {
			return [...globalStateValues.keys()];
		},
		setKeysForSync(): void {},
	};

	const workspaceState = {
		get<T>(key: string, defaultValue?: T): T | undefined {
			return (
				workspaceStateValues.has(key)
					? workspaceStateValues.get(key)
					: defaultValue
			) as T | undefined;
		},
		async update(key: string, value: unknown): Promise<void> {
			if (value === undefined) workspaceStateValues.delete(key);
			else workspaceStateValues.set(key, value);
			return undefined;
		},
		keys(): readonly string[] {
			return [...workspaceStateValues.keys()];
		},
		setKeysForSync(): void {},
	};

	const secrets = {
		async get(key: string): Promise<string | undefined> {
			return secretValues.get(key);
		},
		async store(key: string, value: string): Promise<void> {
			secretValues.set(key, value);
		},
		async delete(key: string): Promise<void> {
			secretValues.delete(key);
		},
		onDidChange: () => ({ dispose: () => {} }),
	};

	return {
		subscriptions: [],
		extensionPath: "/tmp/notploy-vscode",
		extensionUri: {
			scheme: "file",
			path: "/tmp/notploy-vscode",
			toString: () => "",
		} as never,
		globalState: globalState as never,
		workspaceState: workspaceState as never,
		secrets: secrets as never,
		environmentVariableCollection: {} as never,
		storageUri: undefined,
		storagePath: "/tmp/notploy-vscode",
		globalStorageUri: {} as never,
		logUri: {} as never,
		extensionMode: 3 as never,
		extension: {} as never,
		asAbsolutePath: (relativePath: string) =>
			`/tmp/notploy-vscode/${relativePath}`,
		globalStoragePath: "/tmp/notploy-vscode",
		logPath: "/tmp/notploy-vscode",
		languageModelAccessInformation: {} as never,
		globalStateValues,
		workspaceStateValues,
		secretValues,
	};
}
