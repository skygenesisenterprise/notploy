/**
 * Engine wiring for the Next.js host.
 *
 * The status platform (storage + services + HTTP application) is created
 * once per process and cached on `globalThis`, the same pattern the console
 * app uses for its database pool — dev servers and route handlers all share
 * one SQLite handle. The notification outbox worker is started alongside.
 */

import type { OutboxWorkerHandle } from "@notploy/status";
import { createStatusPlatform, type StatusPlatform } from "@notploy/status";

const globalForStatus = globalThis as unknown as {
	notployStatus?: StatusPlatform;
	notployStatusWorker?: OutboxWorkerHandle | null;
};

export const getPlatform = (): StatusPlatform => {
	if (!globalForStatus.notployStatus) {
		const platform = createStatusPlatform();
		globalForStatus.notployStatus = platform;
		if (platform.mode === "read-write") {
			globalForStatus.notployStatusWorker = platform.startWorkers();
		}
	}
	return globalForStatus.notployStatus;
};
