import { Boxes, FolderInput, Rocket, Server } from "lucide-react";
import { buildActivityPanel } from "../home-activity";
import { metricState, resolvedValue } from "../home-state";
import { serverStatusGroup, workloadStatusGroup } from "../home-status";
import type {
	DeploymentFeedLike,
	HomeActivityPanel,
	HomeMetric,
	HomeStatusGroup,
	OperationalEventFeedLike,
	ServerLike,
	SourceState,
	WorkloadLike,
	WorkspaceCounts,
} from "../types";

/**
 * Self-hosted overview: what the instance operates, from the data the instance
 * itself records. No third party is required, and every indicator is either
 * measured locally or reported as unavailable.
 */

export interface SelfHomeData {
	stats: WorkspaceCounts | undefined;
	statsState: SourceState;
	services: WorkloadLike[];
	servicesState: SourceState;
	canReadServices: boolean;
	activity: DeploymentFeedLike | undefined;
	activityState: SourceState;
	canReadDeployments: boolean;
	servers: ServerLike[];
	serversState: SourceState;
	canReadServers: boolean;
	events: OperationalEventFeedLike | undefined;
	eventsState: SourceState;
}

export interface SelfHomeModel {
	metrics: HomeMetric[];
	statusGroups: HomeStatusGroup[];
	activity: HomeActivityPanel;
	/** No project and no service: the instance has nothing to summarise yet. */
	isEmpty: boolean;
	/** At least one operational source failed: the page is showing partial data. */
	hasPartialError: boolean;
}

export const buildSelfHomeModel = (data: SelfHomeData): SelfHomeModel => {
	const {
		stats,
		statsState,
		services,
		servicesState,
		canReadServices,
		activity,
		activityState,
		canReadDeployments,
		servers,
		serversState,
		canReadServers,
		events,
		eventsState,
	} = data;

	const statsMetricState = metricState(statsState);
	const deploymentsState = metricState(activityState, canReadDeployments);
	const serversMetricState = metricState(serversState, canReadServers);
	const activeServers = servers.filter(
		(server) => server.serverStatus === "active",
	).length;
	const recentDeployments = activity?.recent ?? [];
	const inProgress = recentDeployments.filter(
		(deployment) => deployment.status === "running",
	).length;
	const failedDeployments = activity?.failed ?? [];

	const metrics: HomeMetric[] = [
		{
			id: "projects",
			label: "Projects",
			value: resolvedValue(statsMetricState, stats?.projects ?? null),
			state: statsMetricState,
			description: stats
				? `${stats.environments} environments`
				: "Projects on this instance",
			href: "/dashboard/projects",
			icon: FolderInput,
		},
		{
			id: "workloads",
			label: "Services",
			value: resolvedValue(statsMetricState, stats?.services ?? null),
			state: statsMetricState,
			description: stats
				? `${stats.status.running} running · ${stats.status.error} failed`
				: "Applications, compose stacks and databases",
			href: "/dashboard/overview",
			icon: Boxes,
			tone: "info",
		},
		{
			id: "deployments",
			label: "Recent deployments",
			value: resolvedValue(deploymentsState, recentDeployments.length),
			state: deploymentsState,
			description: canReadDeployments
				? `${inProgress} in progress · ${failedDeployments.length} failed`
				: "The deployment read permission is required",
			href: "/dashboard/deployments",
			icon: Rocket,
			tone: failedDeployments.length > 0 ? "critical" : "neutral",
		},
		{
			id: "servers",
			label: "Servers",
			value: resolvedValue(serversMetricState, activeServers),
			state: serversMetricState,
			description: canReadServers
				? `Active out of ${servers.length} registered`
				: "The server read permission is required",
			href: "/dashboard/settings/servers",
			icon: Server,
			tone: "neutral",
		},
	];

	const statusGroups: HomeStatusGroup[] = [
		workloadStatusGroup({
			description: "State of the services on this instance",
			services,
			servicesState,
			canReadServices,
			stats,
			statsState,
		}),
		serverStatusGroup({
			description: "Machines registered with this instance",
			servers,
			serversState,
			canReadServers,
			note: "Counts the servers declared on this instance only.",
		}),
	];

	return {
		metrics,
		statusGroups,
		activity: buildActivityPanel({
			activity,
			activityState,
			canReadDeployments,
			events,
			eventsState,
		}),
		isEmpty:
			statsMetricState === "available" &&
			(stats?.projects ?? 0) === 0 &&
			services.length === 0,
		hasPartialError:
			statsState.isError ||
			(canReadServices && servicesState.isError) ||
			(canReadDeployments && activityState.isError),
	};
};
