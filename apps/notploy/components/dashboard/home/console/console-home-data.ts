import { AppWindow } from "lucide-react";
import type { StatusOverview } from "@/lib/status";
import { buildActivityPanel } from "../home-activity";
import { formatDuration, incidentStateTone, metricState, resolvedValue, severityTone } from "../home-state";
import { serverStatusGroup, workloadStatusGroup } from "../home-status";
import type {
	DeploymentFeedLike,
	HomeActivityItem,
	HomeActivityPanel,
	HomeMetric,
	HomeStatusGroup,
	HomeStatusSegment,
	MetricState,
	OperationalEventFeedLike,
	ServerLike,
	SourceState,
	WorkloadLike,
	WorkspaceCounts,
} from "../types";

/**
 * Console overview for Sky Genesis Enterprise operators.
 *
 * Only two sources can legitimately claim to describe the platform: the status
 * platform (the public, cross-surface availability record) and the control
 * plane probes run on this host. Everything else on this page is explicitly
 * presented as this instance's own perimeter, never as the whole platform, and
 * a source that cannot be read is reported as such instead of being rendered as
 * a healthy state.
 */

export type ControlPlaneRuntime =
	| {
			version: string;
			uptimeSeconds: number;
			https: boolean;
			certificateType: string;
	  }
	| null
	| undefined;

export type InfrastructureProbe = { status: "healthy" | "unhealthy" };

export type InfrastructureHealth =
	| { postgres: InfrastructureProbe; traefik: InfrastructureProbe }
	| null
	| undefined;

export interface ConsoleHomeData {
	isOperator: boolean;
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
	status: StatusOverview | undefined;
	statusState: SourceState;
	runtime: ControlPlaneRuntime;
	runtimeState: SourceState;
	infrastructure: InfrastructureHealth;
	infrastructureState: SourceState;
}

export interface ConsoleHomeModel {
	metrics: HomeMetric[];
	statusGroups: HomeStatusGroup[];
	activity: HomeActivityPanel;
	/** False for a non-operator: the platform surfaces stay gated. */
	isOperator: boolean;
	/** Missing aggregation sources and perimeter caveats, stated explicitly. */
	limitations: string[];
	hasPartialError: boolean;
}

export const OPERATOR_ONLY_MESSAGE =
	"Operator access required. The platform view is limited to the owners and administrators of this console instance.";

/** Vocabulary of a monitoring source; anything else means "no usable data". */
export const normalizeObservedStatus = (
	observed: string | null | undefined,
): "operational" | "degraded" | "outage" | "unknown" => {
	if (observed === "operational") return "operational";
	if (observed === "degraded") return "degraded";
	if (observed === "outage") return "outage";
	return "unknown";
};

const STATUS_SEGMENTS = [
	{ id: "operational", label: "Operational", tone: "healthy" },
	{ id: "degraded", label: "Degraded", tone: "warning" },
	{ id: "outage", label: "Outage", tone: "critical" },
	{ id: "unknown", label: "No observation", tone: "neutral" },
] as const;

const observationSegments = (
	components: Array<{ observedStatus: string; observedAt: string | null }>,
): HomeStatusSegment[] => {
	const counts = { operational: 0, degraded: 0, outage: 0, unknown: 0 };
	for (const component of components) {
		// A component with no recorded observation has no usable data, whatever
		// status it was last published with: it counts as unknown, never healthy.
		counts[
			component.observedAt === null
				? "unknown"
				: normalizeObservedStatus(component.observedStatus)
		] += 1;
	}
	return STATUS_SEGMENTS.map((segment) => ({
		...segment,
		value: counts[segment.id],
	}));
};

const statusPlatformGroup = ({
	status,
	statusState,
	isOperator,
}: {
	status: StatusOverview | undefined;
	statusState: SourceState;
	isOperator: boolean;
}): HomeStatusGroup => {
	const base = {
		id: "platform-status",
		title: "Platform status",
		description: "Availability the status platform records across its pages",
	};

	if (!isOperator) {
		return {
			...base,
			state: "restricted",
			segments: [],
			message: OPERATOR_ONLY_MESSAGE,
		};
	}
	if (statusState.isLoading) {
		return {
			...base,
			state: "loading",
			segments: [],
			message: "Loading the status platform.",
		};
	}
	if (statusState.isError) {
		return {
			...base,
			state: "unavailable",
			segments: [],
			message:
				"The status platform query failed. No availability can be reported until it answers again.",
		};
	}
	if (!status || !status.configured) {
		return {
			...base,
			state: "unavailable",
			segments: [],
			message:
				"No status instance is connected. Set STATUS_URL and STATUS_TOKEN to report platform availability from the status platform.",
		};
	}
	if (status.error) {
		return {
			...base,
			state: "unavailable",
			segments: [],
			message: `The status instance could not be read: ${status.error}`,
		};
	}
	if (status.pages.length === 0) {
		return {
			...base,
			state: "unavailable",
			segments: [],
			message: "The status instance has no status page configured.",
		};
	}

	const components = status.pages.flatMap((page) => page.components);
	const neverObserved = components.filter(
		(component) => component.observedAt === null,
	).length;
	return {
		...base,
		state: "available",
		segments: observationSegments(components),
		note: `${components.length} components across ${status.pages.length} status page(s): ${status.pages
			.map((page) => page.page.name)
			.join(", ")}. Counts reflect the observed status recorded by the status platform. "No observation" means no usable data — it is not a healthy state${
			neverObserved > 0
				? `, and ${neverObserved} component(s) have never reported one`
				: ""
		}.`,
	};
};

const pageStatusGroups = ({
	status,
	isOperator,
}: {
	status: StatusOverview | undefined;
	isOperator: boolean;
}): HomeStatusGroup[] => {
	if (!isOperator || !status || !status.configured || status.error) return [];
	// A single page is already described by the aggregate panel above.
	if (status.pages.length < 2) return [];
	return status.pages.map((page) => ({
		id: `status-page-${page.page.slug}`,
		title: page.page.name,
		description: "Components published on this status page",
		state: "available" as MetricState,
		segments: observationSegments(page.components),
		note: `${page.components.length} component(s) on this page.`,
	}));
};

const controlPlaneGroup = ({
	isOperator,
	infrastructure,
	infrastructureState,
	runtime,
	runtimeState,
}: {
	isOperator: boolean;
	infrastructure: InfrastructureHealth;
	infrastructureState: SourceState;
	runtime: ControlPlaneRuntime;
	runtimeState: SourceState;
}): HomeStatusGroup => {
	const base = {
		id: "control-plane",
		title: "Control plane",
		description: "PostgreSQL and Traefik as probed on this host",
	};

	const runtimeDetail =
		runtimeState.isLoading
			? "Runtime details are loading."
			: runtime
				? `Runtime: Notploy ${runtime.version}, uptime ${formatDuration(runtime.uptimeSeconds)}.`
				: "Runtime details are unavailable.";
	const scopeNote = `${runtimeDetail} Probes run against this instance's own host; they do not cover the whole Cloud fleet.`;

	if (!isOperator) {
		return {
			...base,
			state: "restricted",
			segments: [],
			message: OPERATOR_ONLY_MESSAGE,
		};
	}
	if (infrastructureState.isLoading) {
		return { ...base, state: "loading", segments: [], note: scopeNote };
	}
	if (infrastructureState.isError || !infrastructure) {
		return {
			...base,
			state: "unavailable",
			segments: [],
			message:
				"The control plane probes did not return a result, so their state is unknown.",
			note: scopeNote,
		};
	}

	const probes = [infrastructure.postgres, infrastructure.traefik];
	const healthy = probes.filter((probe) => probe.status === "healthy").length;
	return {
		...base,
		state: "available",
		segments: [
			{ id: "healthy", label: "Healthy", value: healthy, tone: "healthy" },
			{
				id: "unhealthy",
				label: "Unhealthy",
				value: probes.length - healthy,
				tone: "critical",
			},
		],
		note: scopeNote,
	};
};

export const buildConsoleHomeModel = (
	data: ConsoleHomeData,
): ConsoleHomeModel => {
	const {
		isOperator,
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
		status,
		statusState,
		runtime,
		runtimeState,
		infrastructure,
		infrastructureState,
	} = data;

	const statsMetricState = metricState(statsState);
	const platformGroup = statusPlatformGroup({ status, statusState, isOperator });
	const controlPlane = controlPlaneGroup({
		isOperator,
		infrastructure,
		infrastructureState,
		runtime,
		runtimeState,
	});
	const serversMetricState = metricState(serversState, canReadServers);
	const activeServers = servers.filter(
		(server) => server.serverStatus === "active",
	).length;

	const platformSegments = platformGroup.segments;
	const operationalComponents =
		platformSegments.find((segment) => segment.id === "operational")?.value ?? 0;
	const totalComponents = platformSegments.reduce(
		(total, segment) => total + segment.value,
		0,
	);
	const unobservedComponents =
		platformSegments.find((segment) => segment.id === "unknown")?.value ?? 0;
	const activeIncidents = (status?.pages ?? []).flatMap((page) =>
		page.incidents.filter((incident) => incident.state !== "resolved"),
	);
	const statusAvailable = platformGroup.state === "available";

	const metrics: HomeMetric[] = [
		{
			id: "platform-components",
			label: "Platform components",
			value: statusAvailable
				? `${operationalComponents}/${totalComponents}`
				: null,
			state: platformGroup.state,
			description: statusAvailable
				? `${unobservedComponents} without a usable observation`
				: isOperator
					? "Reported by the status platform"
					: "Operator access required",
			tone:
				statusAvailable && unobservedComponents === 0
					? "healthy"
					: statusAvailable
						? "warning"
						: "neutral",
		},
		{
			id: "open-incidents",
			label: "Open incidents",
			value: statusAvailable
				? resolvedValue("available", activeIncidents.length)
				: null,
			state: statusAvailable ? "available" : platformGroup.state,
			description: statusAvailable
				? `Across ${status?.pages.length ?? 0} status page(s)`
				: "Depends on the status platform",
			tone: activeIncidents.length > 0 ? "critical" : "neutral",
		},
		{
			id: "services",
			label: "Services",
			value: resolvedValue(statsMetricState, stats?.services ?? null),
			state: statsMetricState,
			description: stats
				? `${stats.status.running} running · ${stats.status.error} failed`
				: "Workloads on this instance",
			href: "/dashboard/overview",
			icon: AppWindow,
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
		},
	];

	const incidents: HomeActivityItem[] = [...activeIncidents]
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
		.slice(0, 4)
		.map((incident) => ({
			id: `incident-${incident.id}`,
			title: incident.title,
			subtitle: `${incident.severity} severity · ${incident.state}`,
			href: "/dashboard/incidents",
			badge: incident.state,
			tone: incidentStateTone(incident.state),
			meta: `updated ${incident.updatedAt.slice(0, 10)}`,
		}));
	const eventItems: HomeActivityItem[] = [
		...(events?.actionRequired ?? []),
		...(events?.recent ?? []),
	]
		.slice(0, 4)
		.map((event) => ({
			id: `event-${event.eventId}`,
			title: event.title,
			subtitle: event.message,
			href: event.resourceHref ?? undefined,
			badge: event.severity,
			tone: severityTone(event.severity),
			meta: event.lastSeenAt.slice(0, 10),
		}));
	const instanceActivity = buildActivityPanel({
		activity,
		activityState,
		canReadDeployments,
		events,
		eventsState,
		limit: 3,
	});
	const activityPanel: HomeActivityPanel = incidents.length
		? {
				state: "available",
				items: [...incidents, ...eventItems].slice(0, 6),
				message: statusAvailable
					? undefined
					: "Incidents are listed from the status platform as recorded; other platform activity is not included because the status source is unavailable.",
			}
		: eventItems.length
			? {
					state: "available",
					items: eventItems,
					message: instanceActivity.message,
				}
			: statusAvailable && instanceActivity.items.length === 0
				? {
						state: "available",
						items: [],
						message:
							"No open incident and no recent operational event was recorded.",
					}
				: { ...instanceActivity, items: instanceActivity.items.slice(0, 4) };

	const limitations: string[] = [];
	if (!isOperator) {
		limitations.push(OPERATOR_ONLY_MESSAGE);
	} else if (!status || !status.configured) {
		limitations.push(
			"Platform availability is not reported: no status instance is connected to this console (STATUS_URL / STATUS_TOKEN).",
		);
	} else if (status.error) {
		limitations.push(
			`Platform availability is partial: the status instance could not be read (${status.error}).`,
		);
	} else if (status.pages.length === 0) {
		limitations.push(
			"Platform availability is not reported: the status instance has no status page configured.",
		);
	}
	limitations.push(
		"The server and workload panels cover this console instance's own organisation only. The console has no aggregated view across Cloud tenants.",
	);

	return {
		metrics,
		statusGroups: [
			platformGroup,
			...pageStatusGroups({ status, isOperator }),
			controlPlane,
			serverStatusGroup({
				description: "Fleet registered with this console instance",
				servers,
				serversState,
				canReadServers,
				note: "This instance's own servers only; not an aggregate of the Cloud fleet.",
			}),
			workloadStatusGroup({
				title: "Workloads on this instance",
				description: "State of the services this instance runs",
				services,
				servicesState,
				canReadServices,
				stats,
				statsState,
			}),
		],
		activity: activityPanel,
		isOperator,
		limitations,
		hasPartialError:
			statsState.isError ||
			(canReadServices && servicesState.isError) ||
			(canReadDeployments && activityState.isError) ||
			eventsState.isError ||
			(isOperator && (statusState.isError || infrastructureState.isError)),
	};
};
