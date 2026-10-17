import { metricState } from "./home-state";
import type {
	HomeStatusGroup,
	ServerLike,
	SourceState,
	WorkloadLike,
	WorkspaceCounts,
} from "./types";

/**
 * Status distributions shared by the environments whose perimeter is a
 * workspace: workload state and server state. Each builder reports its own
 * source and its own caveats, and prefers the per-service detail when the
 * caller may read it, falling back to the aggregate counts otherwise.
 */

const WORKLOAD_SEGMENTS = [
	{ id: "healthy", label: "Healthy", tone: "healthy" },
	{ id: "deploying", label: "Deploying", tone: "warning" },
	{ id: "failed", label: "Failed", tone: "critical" },
	{ id: "idle", label: "Idle", tone: "neutral" },
] as const;

export const workloadStatusGroup = ({
	title = "Workload state",
	description,
	services,
	servicesState,
	canReadServices,
	stats,
	statsState,
	note,
}: {
	title?: string;
	description: string;
	services: WorkloadLike[];
	servicesState: SourceState;
	canReadServices: boolean;
	stats: WorkspaceCounts | undefined;
	statsState: SourceState;
	note?: string;
}): HomeStatusGroup => {
	const detailState = metricState(servicesState, canReadServices);
	const aggregateState = metricState(statsState);

	if (detailState === "available") {
		const counts = { healthy: 0, deploying: 0, failed: 0, idle: 0 };
		for (const service of services) {
			if (service.status === "done") counts.healthy += 1;
			else if (service.status === "running") counts.deploying += 1;
			else if (service.status === "error") counts.failed += 1;
			else counts.idle += 1;
		}
		return {
			id: "workloads",
			title,
			description,
			state: "available",
			segments: WORKLOAD_SEGMENTS.map((segment) => ({
				...segment,
				value: counts[segment.id],
			})),
			note:
				note ??
				"Recorded from the last status Notploy stored for each service; it is not a live uptime probe.",
		};
	}

	if (aggregateState === "available" && stats) {
		return {
			id: "workloads",
			title,
			description,
			state: "available",
			segments: WORKLOAD_SEGMENTS.map((segment) => ({
				...segment,
				value:
					segment.id === "healthy"
						? stats.status.running
						: segment.id === "failed"
							? stats.status.error
							: segment.id === "idle"
								? stats.status.idle
								: 0,
			})),
			note:
				note ??
				"Aggregated counts only: the per-service detail requires the service read permission.",
		};
	}

	return {
		id: "workloads",
		title,
		description,
		state: detailState === "loading" || aggregateState === "loading"
			? "loading"
			: "unavailable",
		segments: WORKLOAD_SEGMENTS.map((segment) => ({ ...segment, value: 0 })),
		message: "The workload state could not be loaded.",
	};
};

export const serverStatusGroup = ({
	title = "Servers",
	description,
	servers,
	serversState,
	canReadServers,
	note,
}: {
	title?: string;
	description: string;
	servers: ServerLike[];
	serversState: SourceState;
	canReadServers: boolean;
	note?: string;
}): HomeStatusGroup => {
	const state = metricState(serversState, canReadServers);
	if (state !== "available") {
		return {
			id: "servers",
			title,
			description,
			state,
			segments: [],
			message:
				state === "restricted"
					? "The server read permission is required to see the fleet."
					: state === "loading"
						? "Loading the server fleet."
						: "The server fleet could not be loaded.",
		};
	}

	const active = servers.filter(
		(server) => server.serverStatus === "active",
	).length;
	return {
		id: "servers",
		title,
		description,
		state: "available",
		segments: [
			{ id: "active", label: "Active", value: active, tone: "healthy" },
			{
				id: "inactive",
				label: "Inactive",
				value: servers.length - active,
				tone: "neutral",
			},
		],
		note,
	};
};
