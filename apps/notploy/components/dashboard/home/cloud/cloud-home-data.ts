import { AppWindow, Boxes, Layers, Rocket } from "lucide-react";
import { buildActivityPanel } from "../home-activity";
import { metricState, resolvedValue } from "../home-state";
import { workloadStatusGroup } from "../home-status";
import type {
	DeploymentFeedLike,
	HomeActivityPanel,
	HomeMetric,
	HomeStatusGroup,
	HomeUsageRow,
	MetricState,
	OperationalEventFeedLike,
	PlanUsageLike,
	SourceState,
	WorkloadLike,
	WorkspaceCounts,
} from "../types";

/**
 * Cloud overview: the customer's own workspace.
 *
 * Deliberately workspace-scoped: it never touches the server fleet, the
 * infrastructure topology or any data outside the active organisation. What
 * cannot be measured from the workspace's own data (live uptime, quota
 * consumption) is either reported as a recorded state or omitted.
 */

export interface CloudHomeData {
	stats: WorkspaceCounts | undefined;
	statsState: SourceState;
	services: WorkloadLike[];
	servicesState: SourceState;
	canReadServices: boolean;
	activity: DeploymentFeedLike | undefined;
	activityState: SourceState;
	canReadDeployments: boolean;
	events: OperationalEventFeedLike | undefined;
	eventsState: SourceState;
	usage: PlanUsageLike | undefined;
	usageState: SourceState;
	canReadUsage: boolean;
}

export interface CloudHomeModel {
	metrics: HomeMetric[];
	statusGroups: HomeStatusGroup[];
	activity: HomeActivityPanel;
	/** Observed consumption per plan limit; `null` when not measurable here. */
	usage: HomeUsageRow[] | null;
	usageState: MetricState;
	isEmpty: boolean;
	hasPartialError: boolean;
}

export const buildCloudHomeModel = (data: CloudHomeData): CloudHomeModel => {
	const {
		stats,
		statsState,
		services,
		servicesState,
		canReadServices,
		activity,
		activityState,
		canReadDeployments,
		events,
		eventsState,
		usage,
		usageState,
		canReadUsage,
	} = data;

	const statsMetricState = metricState(statsState);
	const deploymentsState = metricState(activityState, canReadDeployments);
	const planUsageState = metricState(usageState, canReadUsage);
	const recentDeployments = activity?.recent ?? [];
	const inProgress = recentDeployments.filter(
		(deployment) => deployment.status === "running",
	).length;
	const failedDeployments = activity?.failed ?? [];

	const metrics: HomeMetric[] = [
		{
			id: "applications",
			label: "Applications",
			value: resolvedValue(statsMetricState, stats?.applications ?? null),
			state: statsMetricState,
			description: stats
				? `${stats.compose} compose stacks · ${stats.databases} databases`
				: "Applications in this workspace",
			href: "/dashboard/overview",
			icon: AppWindow,
			tone: "info",
		},
		{
			id: "workloads",
			label: "Workloads",
			value: resolvedValue(statsMetricState, stats?.services ?? null),
			state: statsMetricState,
			description: stats
				? `${stats.status.running} running · ${stats.status.error} failed`
				: "Everything this workspace runs",
			href: "/dashboard/overview",
			icon: Boxes,
		},
		{
			id: "environments",
			label: "Environments",
			value: resolvedValue(statsMetricState, stats?.environments ?? null),
			state: statsMetricState,
			description: stats
				? `Across ${stats.projects} projects`
				: "Environments in this workspace",
			href: "/dashboard/projects",
			icon: Layers,
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
	];

	return {
		metrics,
		statusGroups: [
			workloadStatusGroup({
				description: "State of the applications and workloads you can access",
				services,
				servicesState,
				canReadServices,
				stats,
				statsState,
				note: "Recorded from the last deployment state Notploy stored for each workload. This is not a live uptime measurement, and it covers this workspace only.",
			}),
		],
		activity: buildActivityPanel({
			activity,
			activityState,
			canReadDeployments,
			events,
			eventsState,
		}),
		usage:
			planUsageState === "available" && usage
				? usage.resources.map((resource) => ({
						resource: resource.resource,
						label: resource.label,
						used: resource.used,
						limit: resource.limit,
					}))
				: null,
		usageState: planUsageState,
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
