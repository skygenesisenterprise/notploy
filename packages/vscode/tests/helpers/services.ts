import type { NotployClient } from "../../src/api/notploy-client";
import type { NotployInstance } from "../../src/core/domain";
import { Logger } from "../../src/core/logger";
import type { InstanceManager } from "../../src/services/instance-manager";

export function testLogger(): Logger {
	return new Logger();
}

export function testInstance(
	overrides: Partial<NotployInstance> = {},
): NotployInstance {
	return {
		id: "local",
		name: "Local",
		url: "http://127.0.0.1:3000",
		label: "local",
		allowInsecureTls: false,
		lastStatus: "connected",
		hasCredential: true,
		...overrides,
	};
}

/**
 * A stand-in for `InstanceManager` returning a prepared client.
 *
 * Only the members the services under test actually call are implemented, which
 * keeps the tests about behaviour rather than plumbing.
 */
export function stubInstanceManager(
	client: Partial<NotployClient>,
	instance: NotployInstance = testInstance(),
): InstanceManager {
	return {
		active: () => instance,
		get: (id?: string) => (id === instance.id ? instance : undefined),
		list: () => [instance],
		authenticatedClient: async () => client as NotployClient,
		clientFor: async () => client as NotployClient,
		connectionResult: () => undefined,
		statusOf: () => instance.lastStatus ?? "unknown",
	} as unknown as InstanceManager;
}
