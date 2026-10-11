/**
 * Monitoring and notifications.
 *
 * `settings.getDockerDiskUsage` is admin-only on the server, so a non-admin
 * credential gets a `forbidden`. That is reported as `restricted` rather than
 * as an empty result, and a missing router as `serviceUnavailable` — an empty
 * chart and "you may not read this" must not look the same.
 */

import type { ContainerHealth } from "@/shared/domain";
import type { DiskUsageResult, NotployNotification } from "@/shared/ipc";
import { isNotployError } from "../client/errors";
import type { ConnectionManager } from "../connection/connection-manager";

export type { DiskUsageResult };

export class MonitoringService {
	constructor(private readonly manager: ConnectionManager) {}

	async serverHealth(serverId?: string): Promise<ContainerHealth[]> {
		const client = await this.manager.authenticatedClient();
		return await client.serverHealth(serverId);
	}

	async diskUsage(): Promise<DiskUsageResult> {
		const client = await this.manager.authenticatedClient();
		try {
			return {
				usage: await client.diskUsage(),
				restricted: false,
				serviceUnavailable: false,
			};
		} catch (error) {
			if (isNotployError(error) && error.code === "forbidden") {
				return { usage: {}, restricted: true, serviceUnavailable: false };
			}
			if (isNotployError(error) && error.code === "not-found") {
				return { usage: {}, restricted: false, serviceUnavailable: true };
			}
			throw error;
		}
	}

	async notifications(): Promise<NotployNotification[]> {
		const client = await this.manager.authenticatedClient();
		return await client.notifications();
	}
}
