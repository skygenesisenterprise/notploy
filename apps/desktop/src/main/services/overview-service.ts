/**
 * The Overview page's aggregate.
 *
 * Everything on it is real data from the instance. A section the instance does
 * not expose (or the credential is not allowed to read) is reported in `notes`
 * instead of being quietly filled with a zero — "0 containers" and "containers
 * could not be read" mean very different things to an operator.
 */

import type { OverviewSummary } from "@/shared/ipc";
import { isNotployError, notConfigured } from "../client/errors";
import type { ConnectionManager } from "../connection/connection-manager";

export class OverviewService {
	constructor(private readonly manager: ConnectionManager) {}

	async summary(recentLimit = 8): Promise<OverviewSummary> {
		const connection = this.manager.active();
		if (!connection) throw notConfigured();

		const client = await this.manager.activeClient();
		const notes: string[] = [];

		// Connectivity first: without it every other read fails for the same
		// reason and the page would show one note per section.
		await client.health();

		const [deployments, projects, applications, composes, servers, containers] =
			await Promise.all([
				client.allDeployments(),
				client.projects().catch((error) => this.note(error, "projects", notes)),
				client
					.allApplications()
					.catch((error) => this.note(error, "applications", notes)),
				client
					.composes()
					.catch((error) => this.note(error, "compose projects", notes)),
				client.servers().catch((error) => this.note(error, "servers", notes)),
				client
					.containers()
					.catch((error) => this.note(error, "Docker containers", notes)),
			]);

		// Optional aggregate: a trimmed-down instance may not expose it, which is
		// not worth a note — the page simply renders without the service list.
		const services = await client.services().catch(() => undefined);

		// The health probe succeeded, so the instance answered. The manager's own
		// state keeps the credential distinction (`disconnected` when no API key
		// is stored or it was rejected).
		const state = await this.manager.summary(connection.id);

		return {
			connectionId: connection.id,
			status:
				state.status === "unknown" || state.status === "checking"
					? "connected"
					: state.status,
			version: state.version,
			cloud: state.cloud,
			capabilities: state.capabilities,
			checkedAt: new Date().toISOString(),
			counts: {
				projects: projects.length,
				applications: applications.length,
				composes: composes.length,
				deployments: deployments.length,
				runningDeployments: deployments.filter(
					(deployment) => deployment.status === "running",
				).length,
				servers: servers.length,
				containers: containers.length,
			},
			recentDeployments: deployments.slice(0, recentLimit),
			services,
			notes,
		};
	}

	/**
	 * Records why a section is missing and returns an empty list, so one
	 * restricted router never blanks the whole page.
	 */
	private note(error: unknown, label: string, notes: string[]): [] {
		if (isNotployError(error)) {
			notes.push(
				error.code === "forbidden"
					? `${label}: not permitted for this API key.`
					: `${label}: unavailable (${error.code}).`,
			);
		} else {
			notes.push(`${label}: unavailable.`);
		}
		return [];
	}
}
