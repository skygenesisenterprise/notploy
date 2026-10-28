import { formatDistanceToNow } from "date-fns";
import {
	AppWindow,
	BellRing,
	Gauge,
	Rocket,
	ServerCog,
	ShieldCheck,
} from "lucide-react";
import type { StatusOverview } from "@/lib/status";
import { deploymentTarget } from "../home-activity";
import {
	formatDuration,
	incidentStateTone,
	metricState,
	resolvedValue,
	segmentTotal,
	serviceStatusLabel,
	serviceStatusTone,
	severityTone,
} from "../home-state";
import { serverStatusGroup, workloadStatusGroup } from "../home-status";
import type {
	DeploymentFeedLike,
	HomeActivityItem,
	HomeActivityPanel,
	HomeMetric,
	HomeStatusGroup,
	HomeStatusSegment,
	HomeTone,
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
 * The page is a workbench, not a marketing dashboard: every panel answers an
 * operational question and names the source that answered it. Only the status
 * platform can legitimately claim to describe platform availability, and only
 * the probes on this host can describe this control plane. Everything else is
 * presented as this instance's own perimeter, never as the whole Cloud fleet.
 *
 * Three rules hold throughout:
 * - a source that failed is reported as failed, never as healthy or empty;
 * - an absent measurement stays `null`, never `0`;
 * - an item only gets a link when a real destination exists.
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

/** One backup run, as recorded by `overview.backups`. */
export interface BackupRunLike {
	deploymentId: string;
	kind: string;
	status: string | null;
	createdAt: string;
	destinationName: string;
	serviceName: string;
	serviceOwnerId: string | null;
	serviceOwnerType: string;
	projectId: string | null;
	environmentId: string | null;
}

/** One certificate of the inventory (`certificates.all`). */
export interface CertificateLike {
	certificateId: string;
	name: string;
	status: string;
	daysUntilExpiration: number | null;
	server: { name: string } | null;
}

/** The parts of `traffic.overview` this page reads. */
export interface TrafficLike {
	http: {
		requests: number;
		errors: number;
		errorRate: number | null;
		availability: { state: string; reasons: string[] };
	};
	lastEventAt: string | null;
	generatedAt: string;
}

/** A metric sample as exposed by the monitoring agent. */
export interface MonitoringPointLike {
	cpu: string;
	cpuCores: number;
	memUsedGB: string;
	memTotal: string;
	diskUsed: string;
	totalDisk: string;
	timestamp: string;
}

/** One monitored server and the samples it answered with (`null` on error). */
export interface MonitoringDatasetLike {
	serverId: string;
	name: string;
	data: MonitoringPointLike[] | null;
	error: string | null;
}

/** A workload as recorded by `overview.services`, with its server placement. */
export interface ConsoleServiceLike extends WorkloadLike {
	id: string;
	type: string;
	name: string;
	projectId: string;
	projectName: string;
	environmentId: string;
	environmentName: string;
	serverId: string | null;
	serverName: string | null;
}

export interface ConsoleHomeData {
	isOperator: boolean;
	stats: WorkspaceCounts | undefined;
	statsState: SourceState;
	services: ConsoleServiceLike[];
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
	backups: BackupRunLike[] | undefined;
	backupsState: SourceState;
	canReadBackups: boolean;
	certificates: CertificateLike[] | undefined;
	certificatesState: SourceState;
	canReadCertificates: boolean;
	monitoring: MonitoringDatasetLike[] | undefined;
	monitoringState: SourceState;
	canReadMonitoring: boolean;
	traffic: TrafficLike | undefined;
	trafficState: SourceState;
	canReadTraffic: boolean;
	/** Injectable clock, so the builders stay deterministic in tests. */
	now?: string;
}

export type ConsoleSeverity = "critical" | "warning" | "info";

export interface ConsoleAttentionItem {
	id: string;
	severity: ConsoleSeverity;
	title: string;
	description?: string;
	resource?: string;
	state?: string;
	meta?: string;
	href?: string;
	/** Source that produced the signal, shown so the operator can trust it. */
	source: string;
}

export interface ConsoleCoverageLine {
	id: string;
	label: string;
	value: string;
	tone: HomeTone;
}

export interface ConsoleAttentionModel {
	state: MetricState;
	items: ConsoleAttentionItem[];
	/** Number of signals before the display limit was applied. */
	total: number;
	message?: string;
	/** What each consulted source actually answered. */
	coverage: ConsoleCoverageLine[];
}

export interface ConsoleCapacityResource {
	id: "cpu" | "memory" | "disk";
	label: string;
	percentage: number | null;
	detail: string;
}

export interface ConsoleSaturatedServer {
	serverId: string;
	name: string;
	resource: "cpu" | "memory" | "disk";
	percentage: number;
}

export interface ConsoleCapacityModel {
	state: MetricState;
	message?: string;
	resources: ConsoleCapacityResource[];
	reportingServers: number;
	totalServers: number;
	/** Newest and oldest latest-sample timestamps, when samples exist. */
	sampledAt: string | null;
	oldestSampleAt: string | null;
	saturated: ConsoleSaturatedServer[];
	note: string;
}

export interface ConsoleDependencyServer {
	serverId: string;
	name: string;
	total: number;
	failed: number;
}

export interface ConsoleImpactedComponent {
	id: string;
	name: string;
	status: string;
	incidents: string[];
}

export interface ConsoleDependencyModel {
	state: MetricState;
	message?: string;
	servers: ConsoleDependencyServer[];
	unassigned: number;
	impactedComponents: ConsoleImpactedComponent[];
	note: string;
}

export interface ConsoleHomeModel {
	metrics: HomeMetric[];
	statusGroups: HomeStatusGroup[];
	activity: HomeActivityPanel;
	attention: ConsoleAttentionModel;
	capacity: ConsoleCapacityModel;
	dependencies: ConsoleDependencyModel;
	/** False for a non-operator: the platform surfaces stay gated. */
	isOperator: boolean;
	/** Missing aggregation sources and perimeter caveats, stated explicitly. */
	limitations: string[];
	hasPartialError: boolean;
}

export const OPERATOR_ONLY_MESSAGE =
	"Operator access required. The platform view is limited to the owners and administrators of this console instance.";

export const ATTENTION_LIMIT = 8;

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

const SECONDS = 1_000;
const MINUTE = 60 * SECONDS;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relativeTime = (value: string): string => {
	const date = new Date(value).getTime();
	if (!Number.isFinite(date)) return "unknown time";
	return formatDistanceToNow(date, { addSuffix: true });
};

const isoTime = (value: string | null | undefined): number => {
	if (!value) return Number.NEGATIVE_INFINITY;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const withinLast = (
	value: string | null | undefined,
	now: number,
	windowMs: number,
): boolean => {
	const time = isoTime(value);
	return Number.isFinite(time) && now - time <= windowMs;
};

const numeric = (value: string | number | null | undefined): number | null => {
	if (value === null || value === undefined || value === "") return null;
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : null;
};

const percentage = (
	used: number | null,
	total: number | null,
): number | null => {
	if (used === null || total === null || total <= 0) return null;
	return Math.min(100, Math.max(0, (used / total) * 100));
};

const round = (value: number, digits = 1): number => {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
};

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
			.join(
				", ",
			)}. Counts reflect the observed status recorded by the status platform. "No observation" means no usable data — it is not a healthy state${
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

	const runtimeDetail = runtimeState.isLoading
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

const serviceHref = (service: {
	type: string;
	id: string;
	projectId: string;
	environmentId: string;
}): string =>
	`/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`;

const backupHref = (backup: BackupRunLike): string | undefined => {
	if (
		!backup.projectId ||
		!backup.environmentId ||
		!backup.serviceOwnerId ||
		backup.serviceOwnerType === "web-server"
	) {
		return undefined;
	}
	return `/dashboard/project/${backup.projectId}/environment/${backup.environmentId}/services/${backup.serviceOwnerType}/${backup.serviceOwnerId}`;
};

const incidentSeverity = (severity: string): ConsoleSeverity =>
	severity === "critical"
		? "critical"
		: severity === "major"
			? "warning"
			: "info";

const eventSeverity = (severity: string): ConsoleSeverity =>
	severity === "critical"
		? "critical"
		: severity === "warning"
			? "warning"
			: "info";

const severityRank: Record<ConsoleSeverity, number> = {
	critical: 0,
	warning: 1,
	info: 2,
};

/* -------------------------------------------------------------------------- */
/* Capacity                                                                    */
/* -------------------------------------------------------------------------- */

const saturationThreshold = 85;

export const buildConsoleCapacity = ({
	monitoring,
	monitoringState,
	canReadMonitoring,
}: {
	monitoring: MonitoringDatasetLike[] | undefined;
	monitoringState: SourceState;
	canReadMonitoring: boolean;
}): ConsoleCapacityModel => {
	const base = {
		resources: [],
		reportingServers: 0,
		totalServers: 0,
		sampledAt: null,
		oldestSampleAt: null,
		saturated: [],
	};

	if (!canReadMonitoring) {
		return {
			...base,
			state: "restricted",
			message:
				"The monitoring read permission is required to measure compute capacity.",
			note: "Capacity is only shown when the monitoring agent actually reported a sample.",
		};
	}
	if (monitoringState.isLoading) {
		return { ...base, state: "loading", note: "Loading the latest samples." };
	}
	if (monitoringState.isError || !monitoring) {
		return {
			...base,
			state: "unavailable",
			message:
				"The monitoring query failed, so compute capacity is unknown for now.",
			note: "Capacity is only shown when the monitoring agent actually reported a sample.",
		};
	}

	const datasets = monitoring;
	const reporting = datasets
		.map((dataset) => {
			const point = dataset.data?.[dataset.data.length - 1];
			return point ? { dataset, point } : null;
		})
		.filter(
			(
				entry,
			): entry is {
				dataset: MonitoringDatasetLike;
				point: MonitoringPointLike;
			} => entry !== null,
		);
	const failed = datasets.filter((dataset) => dataset.error).length;
	const sampledTimes = reporting
		.map((entry) => entry.point.timestamp)
		.filter((timestamp) => Number.isFinite(isoTime(timestamp)))
		.sort();

	const message =
		failed > 0
			? `${failed} of ${datasets.length} monitored server(s) did not report a sample. The figures below only cover the ${reporting.length} that answered.`
			: undefined;

	if (reporting.length === 0) {
		return {
			...base,
			state: "available",
			totalServers: datasets.length,
			message:
				datasets.length === 0
					? undefined
					: "No monitored server reported a metrics sample.",
			note: "No measurement is presented as zero: without a sample, CPU, memory and storage stay unknown.",
		};
	}

	let cpuWeighted = 0;
	let cpuCores = 0;
	let memUsed = 0;
	let memTotal = 0;
	let diskUsed = 0;
	let diskTotal = 0;
	const saturated: ConsoleSaturatedServer[] = [];

	for (const { dataset, point } of reporting) {
		const cores = Math.max(point.cpuCores ?? 0, 0);
		const cpu = numeric(point.cpu);
		if (cpu !== null && cores > 0) {
			cpuWeighted += cpu * cores;
			cpuCores += cores;
		}
		const usedMemory = numeric(point.memUsedGB);
		const totalMemory = numeric(point.memTotal);
		if (usedMemory !== null && totalMemory !== null) {
			memUsed += usedMemory;
			memTotal += totalMemory;
		}
		const usedPercent = numeric(point.diskUsed);
		const totalDisk = numeric(point.totalDisk);
		if (usedPercent !== null && totalDisk !== null) {
			diskUsed += (totalDisk * usedPercent) / 100;
			diskTotal += totalDisk;
		}

		const perServerMemory = percentage(usedMemory, totalMemory);
		if (perServerMemory !== null && perServerMemory >= saturationThreshold) {
			saturated.push({
				serverId: dataset.serverId,
				name: dataset.name,
				resource: "memory",
				percentage: round(perServerMemory),
			});
		}
		if (usedPercent !== null && usedPercent >= saturationThreshold) {
			saturated.push({
				serverId: dataset.serverId,
				name: dataset.name,
				resource: "disk",
				percentage: round(usedPercent),
			});
		}
		if (cpu !== null && cpu >= saturationThreshold) {
			saturated.push({
				serverId: dataset.serverId,
				name: dataset.name,
				resource: "cpu",
				percentage: round(cpu),
			});
		}
	}

	const cpuPercent = cpuCores > 0 ? cpuWeighted / cpuCores : null;
	const memoryPercent = percentage(memUsed, memTotal);
	const diskPercent = percentage(diskUsed, diskTotal);

	const resources: ConsoleCapacityResource[] = [
		{
			id: "cpu",
			label: "CPU",
			percentage: cpuPercent === null ? null : round(cpuPercent),
			detail:
				cpuPercent === null
					? "No CPU sample"
					: `${round(cpuCores, 0)} cores weighted across ${reporting.length} server(s)`,
		},
		{
			id: "memory",
			label: "Memory",
			percentage: memoryPercent === null ? null : round(memoryPercent),
			detail:
				memoryPercent === null
					? "No memory sample"
					: `${round(memUsed, 1)} / ${round(memTotal, 1)} GB`,
		},
		{
			id: "disk",
			label: "Storage",
			percentage: diskPercent === null ? null : round(diskPercent),
			detail:
				diskPercent === null
					? "No storage sample"
					: `${round(diskUsed, 1)} / ${round(diskTotal, 1)} GB`,
		},
	];

	return {
		state: "available",
		message,
		resources,
		reportingServers: reporting.length,
		totalServers: datasets.length,
		sampledAt: sampledTimes.at(-1) ?? null,
		oldestSampleAt: sampledTimes[0] ?? null,
		saturated: saturated.sort(
			(left, right) => right.percentage - left.percentage,
		),
		note: "Latest sample reported by each monitored server. CPU is weighted by cores; memory and storage are summed. No projection is extrapolated from these figures.",
	};
};

const resourceLabel = (resource: ConsoleSaturatedServer["resource"]): string =>
	resource === "cpu" ? "CPU" : resource === "memory" ? "Memory" : "Storage";

/* -------------------------------------------------------------------------- */
/* Attention                                                                   */
/* -------------------------------------------------------------------------- */

export const buildConsoleAttention = ({
	data,
	capacity,
	now,
}: {
	data: ConsoleHomeData;
	capacity: ConsoleCapacityModel;
	now: number;
}): ConsoleAttentionModel => {
	const {
		isOperator,
		status,
		statusState,
		infrastructure,
		infrastructureState,
		services,
		servicesState,
		canReadServices,
		activity,
		activityState,
		canReadDeployments,
		events,
		eventsState,
		backups,
		backupsState,
		canReadBackups,
		certificates,
		certificatesState,
		canReadCertificates,
		traffic,
		trafficState,
		canReadTraffic,
		canReadMonitoring,
	} = data;

	const items: Array<ConsoleAttentionItem & { at: number }> = [];
	const coverage: ConsoleCoverageLine[] = [];
	const failedSources: string[] = [];
	const loadingSources: string[] = [];

	// --- Status platform: incidents, degraded components, maintenance --------
	const coveredComponents = new Set<string>();
	let activeIncidents = 0;
	if (!isOperator) {
		coverage.push({
			id: "status",
			label: "Status platform",
			value: "Operator access required",
			tone: "neutral",
		});
	} else if (statusState.isLoading) {
		loadingSources.push("status platform");
		coverage.push({
			id: "status",
			label: "Status platform",
			value: "Loading",
			tone: "neutral",
		});
	} else if (statusState.isError) {
		failedSources.push("status platform");
		coverage.push({
			id: "status",
			label: "Status platform",
			value: "Unavailable",
			tone: "critical",
		});
	} else if (!status || !status.configured) {
		coverage.push({
			id: "status",
			label: "Status platform",
			value: "Not connected",
			tone: "neutral",
		});
	} else if (status.error) {
		failedSources.push("status platform");
		coverage.push({
			id: "status",
			label: "Status platform",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const components = status.pages.flatMap((page) => page.components);
		const observed = components.filter(
			(component) => component.observedAt !== null,
		).length;

		for (const page of status.pages) {
			for (const incident of page.incidents.filter(
				(entry) => entry.state !== "resolved",
			)) {
				activeIncidents += 1;
				const linked = page.components.filter((component) =>
					incident.componentIds.includes(component.id),
				);
				for (const component of linked) {
					coveredComponents.add(`${page.page.slug}:${component.id}`);
				}
				items.push({
					id: `incident-${page.page.slug}-${incident.id}`,
					severity: incidentSeverity(incident.severity),
					title: incident.title,
					description: `${page.page.name} · ${incident.state}${
						linked.length > 0
							? ` · affects ${linked.map((component) => component.name).join(", ")}`
							: ""
					}`,
					resource: linked.length
						? linked.map((component) => component.name).join(", ")
						: page.page.name,
					state: incident.state,
					meta: `updated ${relativeTime(incident.updatedAt)}`,
					href: "/dashboard/incidents",
					source: "Status platform",
					at: isoTime(incident.updatedAt),
				});
			}

			for (const component of page.components) {
				if (
					component.observedAt === null ||
					coveredComponents.has(`${page.page.slug}:${component.id}`)
				) {
					continue;
				}
				const observedStatus = normalizeObservedStatus(
					component.observedStatus,
				);
				if (observedStatus !== "degraded" && observedStatus !== "outage") {
					continue;
				}
				items.push({
					id: `component-${page.page.slug}-${component.id}`,
					severity: observedStatus === "outage" ? "critical" : "warning",
					title: `${component.name} ${observedStatus}`,
					description: `${page.page.name}${
						component.groupName ? ` · ${component.groupName}` : ""
					}`,
					resource: component.name,
					state: observedStatus,
					meta: `observed ${relativeTime(component.observedAt)}`,
					href: "/dashboard/incidents",
					source: "Status platform",
					at: isoTime(component.observedAt),
				});
			}

			for (const maintenance of page.maintenances) {
				const ongoing = maintenance.state === "in_progress";
				const scheduled =
					maintenance.state === "scheduled" &&
					isoTime(maintenance.endAt) >= now;
				if (!ongoing && !scheduled) continue;
				items.push({
					id: `maintenance-${page.page.slug}-${maintenance.id}`,
					severity: ongoing ? "warning" : "info",
					title: maintenance.title,
					description: `${page.page.name} · maintenance ${maintenance.state} · ${new Date(
						maintenance.startAt,
					).toLocaleString()} → ${new Date(maintenance.endAt).toLocaleString()}`,
					resource: page.page.name,
					state: maintenance.state,
					meta: `updated ${relativeTime(maintenance.updatedAt)}`,
					href: "/dashboard/incidents",
					source: "Status platform",
					at: isoTime(maintenance.updatedAt),
				});
			}
		}

		coverage.push({
			id: "status",
			label: "Status platform",
			value: `${observed}/${components.length} components observed · ${activeIncidents} open incident(s)`,
			tone:
				components.length > 0 && observed === components.length
					? activeIncidents > 0
						? "warning"
						: "healthy"
					: "warning",
		});
	}

	// --- Control plane probes on this host ------------------------------------
	if (!isOperator) {
		coverage.push({
			id: "control-plane",
			label: "Control plane",
			value: "Operator access required",
			tone: "neutral",
		});
	} else if (infrastructureState.isLoading) {
		loadingSources.push("control plane");
		coverage.push({
			id: "control-plane",
			label: "Control plane",
			value: "Loading",
			tone: "neutral",
		});
	} else if (infrastructureState.isError || !infrastructure) {
		failedSources.push("control plane");
		coverage.push({
			id: "control-plane",
			label: "Control plane",
			value: "Probe failed",
			tone: "critical",
		});
	} else {
		const probes = [
			{ id: "postgres", label: "PostgreSQL", ...infrastructure.postgres },
			{ id: "traefik", label: "Traefik", ...infrastructure.traefik },
		];
		const unhealthy = probes.filter((probe) => probe.status === "unhealthy");
		for (const probe of unhealthy) {
			items.push({
				id: `probe-${probe.id}`,
				severity: "critical",
				title: `${probe.label} probe is unhealthy`,
				description:
					"The control plane probe on this host reported an unhealthy dependency.",
				resource: probe.label,
				state: "unhealthy",
				meta: "current probe",
				href: "/dashboard/monitoring",
				source: "Control plane",
				at: now,
			});
		}
		coverage.push({
			id: "control-plane",
			label: "Control plane",
			value: `${probes.length - unhealthy.length}/${probes.length} probes healthy on this host`,
			tone: unhealthy.length === 0 ? "healthy" : "critical",
		});
	}

	// --- Workloads ------------------------------------------------------------
	if (!canReadServices) {
		coverage.push({
			id: "workloads",
			label: "Workloads",
			value: "Service read permission required",
			tone: "neutral",
		});
	} else if (servicesState.isLoading) {
		loadingSources.push("workloads");
		coverage.push({
			id: "workloads",
			label: "Workloads",
			value: "Loading",
			tone: "neutral",
		});
	} else if (servicesState.isError) {
		failedSources.push("workloads");
		coverage.push({
			id: "workloads",
			label: "Workloads",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const failedWorkloads = services.filter(
			(service) => service.status === "error",
		);
		for (const service of failedWorkloads) {
			items.push({
				id: `workload-${service.id}`,
				severity: "critical",
				title: `Workload failed · ${service.name}`,
				description: `${service.projectName} / ${service.environmentName}${
					service.serverName
						? ` · ${service.serverName}`
						: " · no server recorded"
				}`,
				resource: service.serverName ?? undefined,
				state: serviceStatusLabel(service.status),
				meta: "last recorded state",
				href: serviceHref(service),
				source: "Workloads",
				at: now,
			});
		}
		coverage.push({
			id: "workloads",
			label: "Workloads",
			value: `${services.length} service(s) · ${failedWorkloads.length} failed`,
			tone: failedWorkloads.length === 0 ? "healthy" : "critical",
		});
	}

	// --- Deployments ----------------------------------------------------------
	if (!canReadDeployments) {
		coverage.push({
			id: "deployments",
			label: "Deployments",
			value: "Deployment read permission required",
			tone: "neutral",
		});
	} else if (activityState.isLoading) {
		loadingSources.push("deployments");
		coverage.push({
			id: "deployments",
			label: "Deployments",
			value: "Loading",
			tone: "neutral",
		});
	} else if (activityState.isError) {
		failedSources.push("deployments");
		coverage.push({
			id: "deployments",
			label: "Deployments",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const failedDeployments = activity?.failed ?? [];
		for (const deployment of failedDeployments) {
			const target = deploymentTarget(deployment);
			if (!target) continue;
			items.push({
				id: `deployment-${deployment.deploymentId}`,
				severity: "warning",
				title: `Deployment failed · ${target.name}`,
				description: `${target.project} / ${target.environment}`,
				resource: target.name,
				state: serviceStatusLabel(deployment.status),
				meta: `created ${relativeTime(deployment.createdAt)}`,
				href: target.href,
				source: "Deployments",
				at: isoTime(deployment.createdAt),
			});
		}
		coverage.push({
			id: "deployments",
			label: "Deployments",
			value: `${activity?.recent.length ?? 0} recent · ${failedDeployments.length} failed`,
			tone: failedDeployments.length === 0 ? "healthy" : "warning",
		});
	}

	// --- Operational events requiring action ---------------------------------
	if (eventsState.isLoading) {
		loadingSources.push("operational events");
		coverage.push({
			id: "events",
			label: "Operational events",
			value: "Loading",
			tone: "neutral",
		});
	} else if (eventsState.isError) {
		failedSources.push("operational events");
		coverage.push({
			id: "events",
			label: "Operational events",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const actionRequired = events?.actionRequired ?? [];
		for (const event of actionRequired) {
			items.push({
				id: `event-${event.eventId}`,
				severity: eventSeverity(event.severity),
				title: event.title,
				description: event.message,
				state: "action required",
				meta: `last seen ${relativeTime(event.lastSeenAt)}`,
				href: event.resourceHref ?? undefined,
				source: "Operational events",
				at: isoTime(event.lastSeenAt),
			});
		}
		coverage.push({
			id: "events",
			label: "Operational events",
			value: `${actionRequired.length} requiring action`,
			tone: actionRequired.length === 0 ? "healthy" : "warning",
		});
	}

	// --- Backups --------------------------------------------------------------
	if (!canReadBackups) {
		coverage.push({
			id: "backups",
			label: "Backups",
			value: "Backup read permission required",
			tone: "neutral",
		});
	} else if (backupsState.isLoading) {
		loadingSources.push("backups");
		coverage.push({
			id: "backups",
			label: "Backups",
			value: "Loading",
			tone: "neutral",
		});
	} else if (backupsState.isError || !backups) {
		failedSources.push("backups");
		coverage.push({
			id: "backups",
			label: "Backups",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const recentRuns = backups.filter((run) =>
			withinLast(run.createdAt, now, 7 * DAY),
		);
		const failures = recentRuns.filter((run) => run.status === "error");
		for (const run of failures) {
			const kind = run.kind === "volumeBackup" ? "Volume backup" : "Backup";
			items.push({
				id: `backup-${run.deploymentId}`,
				severity: "warning",
				title: `${kind} failed · ${run.serviceName}`,
				description: `Destination ${run.destinationName}`,
				resource: run.serviceName,
				state: "error",
				meta: `created ${relativeTime(run.createdAt)}`,
				href: backupHref(run) ?? "/dashboard/overview",
				source: "Backups",
				at: isoTime(run.createdAt),
			});
		}
		coverage.push({
			id: "backups",
			label: "Backups",
			value: `${recentRuns.length} run(s) in 7 days · ${failures.length} failed`,
			tone: failures.length === 0 ? "healthy" : "warning",
		});
	}

	// --- Certificates ---------------------------------------------------------
	if (!canReadCertificates) {
		coverage.push({
			id: "certificates",
			label: "Certificates",
			value: "Certificate read permission required",
			tone: "neutral",
		});
	} else if (certificatesState.isLoading) {
		loadingSources.push("certificates");
		coverage.push({
			id: "certificates",
			label: "Certificates",
			value: "Loading",
			tone: "neutral",
		});
	} else if (certificatesState.isError || !certificates) {
		failedSources.push("certificates");
		coverage.push({
			id: "certificates",
			label: "Certificates",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const expired = certificates.filter(
			(certificate) => certificate.status === "expired",
		);
		const expiring = certificates.filter(
			(certificate) => certificate.status === "expiring",
		);
		for (const certificate of [...expired, ...expiring]) {
			const days = certificate.daysUntilExpiration;
			items.push({
				id: `certificate-${certificate.certificateId}`,
				severity: certificate.status === "expired" ? "critical" : "warning",
				title:
					certificate.status === "expired"
						? `Certificate expired · ${certificate.name}`
						: `Certificate expires soon · ${certificate.name}`,
				description: certificate.server?.name
					? `Target server ${certificate.server.name}`
					: "No target server recorded",
				resource: certificate.server?.name ?? undefined,
				state: certificate.status,
				meta:
					days === null
						? "expiry date unavailable"
						: days < 0
							? `expired ${Math.abs(days)} day(s) ago`
							: `expires in ${days} day(s)`,
				href: "/dashboard/settings/certificates",
				source: "Certificates",
				at: now,
			});
		}
		coverage.push({
			id: "certificates",
			label: "Certificates",
			value: `${certificates.length} monitored · ${expired.length + expiring.length} expired or expiring`,
			tone:
				expired.length > 0
					? "critical"
					: expiring.length > 0
						? "warning"
						: "healthy",
		});
	}

	// --- Traffic --------------------------------------------------------------
	if (!canReadTraffic) {
		coverage.push({
			id: "traffic",
			label: "Traffic",
			value: "Traffic read permission required",
			tone: "neutral",
		});
	} else if (trafficState.isLoading) {
		loadingSources.push("traffic");
		coverage.push({
			id: "traffic",
			label: "Traffic",
			value: "Loading",
			tone: "neutral",
		});
	} else if (trafficState.isError || !traffic) {
		failedSources.push("traffic");
		coverage.push({
			id: "traffic",
			label: "Traffic",
			value: "Unavailable",
			tone: "critical",
		});
	} else {
		const availability = traffic.http.availability;
		if (
			availability.state === "unavailable" ||
			availability.state === "partial"
		) {
			items.push({
				id: "traffic-availability",
				severity: "warning",
				title:
					availability.state === "unavailable"
						? "Traffic collection is unavailable"
						: "Traffic collection is incomplete",
				description:
					availability.reasons.join(" ") ||
					"At least one HTTP source is not delivering data.",
				resource: "HTTP observability",
				state: availability.state,
				meta: "last 24 hours",
				href: "/dashboard/website/traffic",
				source: "Traffic",
				at: isoTime(traffic.lastEventAt ?? traffic.generatedAt),
			});
		} else if (availability.state === "no-data") {
			items.push({
				id: "traffic-no-data",
				severity: "info",
				title: "No traffic recorded in the last 24 hours",
				description:
					availability.reasons[0] ??
					"The sources are configured but returned no request in the period.",
				resource: "HTTP observability",
				state: "no data",
				meta: "last 24 hours",
				href: "/dashboard/website/traffic",
				source: "Traffic",
				at: isoTime(traffic.generatedAt),
			});
		}
		coverage.push({
			id: "traffic",
			label: "Traffic (24 h)",
			value:
				availability.state === "ok"
					? `${traffic.http.requests} request(s) · ${traffic.http.errors} error(s)`
					: availability.state.replace("-", " "),
			tone:
				availability.state === "ok"
					? (traffic.http.errorRate ?? 0) > 5
						? "warning"
						: "healthy"
					: "warning",
		});
	}

	// --- Measured saturation --------------------------------------------------
	if (canReadMonitoring && capacity.state === "available") {
		for (const entry of capacity.saturated) {
			items.push({
				id: `saturation-${entry.serverId}-${entry.resource}`,
				severity: "warning",
				title: `${resourceLabel(entry.resource)} pressure on ${entry.name}`,
				description: `${entry.percentage}% used in the latest reported sample`,
				resource: entry.name,
				state: "saturated",
				meta: "latest monitoring sample",
				href: `/dashboard/monitoring?workspace=server:${encodeURIComponent(
					entry.serverId,
				)}`,
				source: "Monitoring",
				at: now,
			});
		}
		coverage.push({
			id: "monitoring",
			label: "Monitoring",
			value: `${capacity.reportingServers}/${capacity.totalServers} server(s) reporting`,
			tone:
				capacity.reportingServers === 0
					? "warning"
					: capacity.reportingServers < capacity.totalServers
						? "warning"
						: "healthy",
		});
	} else if (canReadMonitoring) {
		coverage.push({
			id: "monitoring",
			label: "Monitoring",
			value:
				capacity.state === "loading"
					? "Loading"
					: capacity.state === "unavailable"
						? "Unavailable"
						: "No sample",
			tone: capacity.state === "unavailable" ? "critical" : "neutral",
		});
	}

	const sorted = items
		.sort(
			(left, right) =>
				severityRank[left.severity] - severityRank[right.severity] ||
				right.at - left.at,
		)
		.slice(0, ATTENTION_LIMIT)
		.map(({ at: _at, ...item }) => item);

	const enabledSources =
		(isOperator ? 2 : 0) +
		(canReadServices ? 1 : 0) +
		(canReadDeployments ? 1 : 0) +
		1 +
		(canReadBackups ? 1 : 0) +
		(canReadCertificates ? 1 : 0) +
		(canReadMonitoring ? 1 : 0) +
		(canReadTraffic ? 1 : 0);

	let state: MetricState = "available";
	if (enabledSources === 0) {
		state = "restricted";
	} else if (items.length === 0 && loadingSources.length > 0) {
		state = "loading";
	} else if (
		items.length === 0 &&
		failedSources.length >= enabledSources &&
		failedSources.length > 0
	) {
		state = "unavailable";
	}

	const messageParts: string[] = [];
	if (failedSources.length > 0) {
		messageParts.push(
			`Could not read: ${failedSources.join(", ")}. No state is assumed for these sources.`,
		);
	}
	if (state === "restricted") {
		messageParts.push(
			"No source this account may read can report an operational signal.",
		);
	}

	return {
		state,
		items: sorted,
		total: items.length,
		message: messageParts.length > 0 ? messageParts.join(" ") : undefined,
		coverage,
	};
};

/* -------------------------------------------------------------------------- */
/* Dependencies                                                                */
/* -------------------------------------------------------------------------- */

export const buildConsoleDependencies = ({
	services,
	servicesState,
	canReadServices,
	servers,
	status,
	isOperator,
}: {
	services: ConsoleServiceLike[];
	servicesState: SourceState;
	canReadServices: boolean;
	servers: ServerLike[];
	status: StatusOverview | undefined;
	isOperator: boolean;
}): ConsoleDependencyModel => {
	const note =
		"Notploy records the server that runs each workload. It records no relation between status components and workloads, so the two views are shown side by side rather than joined.";

	if (!canReadServices) {
		return {
			state: "restricted",
			message:
				"The service read permission is required to see workload placement.",
			servers: [],
			unassigned: 0,
			impactedComponents: [],
			note,
		};
	}
	if (servicesState.isLoading) {
		return {
			state: "loading",
			servers: [],
			unassigned: 0,
			impactedComponents: [],
			note,
		};
	}
	if (servicesState.isError) {
		return {
			state: "unavailable",
			message: "Workload placement could not be loaded.",
			servers: [],
			unassigned: 0,
			impactedComponents: [],
			note,
		};
	}

	const placement = new Map<string, ConsoleDependencyServer>();
	// Seed with the registered fleet so a server with no workload is still a
	// truthful dependency edge (it simply hosts nothing yet).
	for (const server of servers as Array<
		ServerLike & { serverId?: string; name?: string }
	>) {
		if (!server.serverId || !server.name) continue;
		placement.set(server.serverId, {
			serverId: server.serverId,
			name: server.name,
			total: 0,
			failed: 0,
		});
	}
	let unassigned = 0;
	for (const service of services) {
		if (!service.serverId || !service.serverName) {
			unassigned += 1;
			continue;
		}
		const entry = placement.get(service.serverId) ?? {
			serverId: service.serverId,
			name: service.serverName,
			total: 0,
			failed: 0,
		};
		entry.total += 1;
		if (service.status === "error") entry.failed += 1;
		placement.set(service.serverId, entry);
	}

	const impactedComponents: ConsoleImpactedComponent[] = [];
	if (isOperator && status && status.configured && !status.error) {
		for (const page of status.pages) {
			const openIncidents = page.incidents.filter(
				(incident) => incident.state !== "resolved",
			);
			for (const component of page.components) {
				if (component.observedAt === null) continue;
				const observed = normalizeObservedStatus(component.observedStatus);
				if (observed !== "degraded" && observed !== "outage") continue;
				impactedComponents.push({
					id: `${page.page.slug}:${component.id}`,
					name: component.name,
					status: observed,
					incidents: openIncidents
						.filter((incident) => incident.componentIds.includes(component.id))
						.map((incident) => incident.title),
				});
			}
		}
	}

	return {
		state: "available",
		servers: [...placement.values()]
			.sort(
				(left, right) => right.failed - left.failed || right.total - left.total,
			)
			.slice(0, 6),
		unassigned,
		impactedComponents: impactedComponents.slice(0, 6),
		note,
	};
};

/* -------------------------------------------------------------------------- */
/* Activity                                                                    */
/* -------------------------------------------------------------------------- */

type TimedActivityItem = HomeActivityItem & { at: number };

export const buildConsoleActivity = ({
	data,
	now,
}: {
	data: ConsoleHomeData;
	now: number;
}): HomeActivityPanel => {
	const {
		status,
		statusState,
		isOperator,
		activity,
		activityState,
		canReadDeployments,
		events,
		eventsState,
		backups,
		backupsState,
		canReadBackups,
	} = data;

	const items: TimedActivityItem[] = [];
	const issues: string[] = [];

	if (isOperator && status && status.configured && !status.error) {
		for (const page of status.pages) {
			for (const incident of page.incidents.filter(
				(entry) => entry.state !== "resolved",
			)) {
				if (!withinLast(incident.updatedAt, now, 14 * DAY)) continue;
				items.push({
					id: `status-incident-${page.page.slug}-${incident.id}`,
					title: incident.title,
					subtitle: `${page.page.name} · incident ${incident.state}`,
					href: "/dashboard/incidents",
					badge: incident.state,
					tone: incidentStateTone(incident.state),
					meta: relativeTime(incident.updatedAt),
					at: isoTime(incident.updatedAt),
				});
			}
			for (const maintenance of page.maintenances) {
				if (!withinLast(maintenance.updatedAt, now, 14 * DAY)) continue;
				items.push({
					id: `status-maintenance-${page.page.slug}-${maintenance.id}`,
					title: maintenance.title,
					subtitle: `${page.page.name} · maintenance ${maintenance.state}`,
					href: "/dashboard/incidents",
					badge: maintenance.state,
					tone:
						maintenance.state === "in_progress"
							? "warning"
							: maintenance.state === "completed"
								? "healthy"
								: "info",
					meta: relativeTime(maintenance.updatedAt),
					at: isoTime(maintenance.updatedAt),
				});
			}
		}
	} else if (isOperator && statusState.isError) {
		issues.push("status incidents could not be loaded");
	}

	if (canReadDeployments && activity) {
		for (const deployment of activity.recent) {
			const target = deploymentTarget(deployment);
			if (!target) continue;
			items.push({
				id: `deployment-${deployment.deploymentId}`,
				title: target.name,
				subtitle: `Deployment · ${target.project} / ${target.environment}`,
				href: target.href,
				badge: serviceStatusLabel(deployment.status),
				tone: serviceStatusTone(deployment.status),
				meta: relativeTime(deployment.createdAt),
				at: isoTime(deployment.createdAt),
			});
		}
	} else if (canReadDeployments && activityState.isError) {
		issues.push("deployments could not be loaded");
	}

	if (events) {
		for (const event of [...events.actionRequired, ...events.recent]) {
			items.push({
				id: `event-${event.eventId}`,
				title: event.title,
				subtitle: event.message,
				href: event.resourceHref ?? undefined,
				badge: event.severity,
				tone: severityTone(event.severity),
				meta: relativeTime(event.lastSeenAt),
				at: isoTime(event.lastSeenAt),
			});
		}
	} else if (eventsState.isError) {
		issues.push("operational events could not be loaded");
	}

	if (canReadBackups && backups) {
		for (const run of backups) {
			if (!withinLast(run.createdAt, now, 7 * DAY)) continue;
			items.push({
				id: `backup-${run.deploymentId}`,
				title: `${run.kind === "volumeBackup" ? "Volume backup" : "Backup"} · ${run.serviceName}`,
				subtitle: `Destination ${run.destinationName}`,
				href: backupHref(run) ?? "/dashboard/overview",
				badge: run.status ?? "unknown",
				tone:
					run.status === "done"
						? "healthy"
						: run.status === "error"
							? "critical"
							: "neutral",
				meta: relativeTime(run.createdAt),
				at: isoTime(run.createdAt),
			});
		}
	} else if (canReadBackups && backupsState.isError) {
		issues.push("backups could not be loaded");
	}

	const seen = new Set<string>();
	const ordered = items
		.sort((left, right) => right.at - left.at)
		.filter((item) => {
			if (seen.has(item.id)) return false;
			seen.add(item.id);
			return true;
		})
		.slice(0, 8)
		.map(({ at: _at, ...item }) => item);

	if (ordered.length > 0) {
		return {
			state: "available",
			items: ordered,
			message:
				issues.length > 0
					? `Partial activity: ${issues.join(" and ")}.`
					: undefined,
		};
	}

	const deploymentUnavailable = canReadDeployments && activityState.isError;
	const eventsUnavailable = eventsState.isError;
	if (
		(isOperator && statusState.isLoading) ||
		(canReadDeployments && activityState.isLoading) ||
		eventsState.isLoading ||
		(canReadBackups && backupsState.isLoading)
	) {
		return { state: "loading", items: [] };
	}
	if (
		(!isOperator || statusState.isError) &&
		deploymentUnavailable &&
		eventsUnavailable
	) {
		return {
			state: "unavailable",
			items: [],
			message:
				"No activity source could be read, so recent activity is unknown rather than empty.",
		};
	}
	return {
		state: "available",
		items: [],
		message:
			issues.length > 0
				? `Partial activity: ${issues.join(" and ")}.`
				: undefined,
	};
};

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

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
		backupsState,
		canReadBackups,
		certificates,
		certificatesState,
		canReadCertificates,
		monitoring,
		monitoringState,
		canReadMonitoring,
		trafficState,
		canReadTraffic,
		now: nowInput,
	} = data;

	const now = isoTime(nowInput ?? new Date().toISOString());
	const effectiveNow = Number.isFinite(now) ? now : Date.now();
	const statsMetricState = metricState(statsState);
	const platformGroup = statusPlatformGroup({
		status,
		statusState,
		isOperator,
	});
	const controlPlane = controlPlaneGroup({
		isOperator,
		infrastructure,
		infrastructureState,
		runtime,
		runtimeState,
	});
	const platformSegments = platformGroup.segments;
	const operationalComponents =
		platformSegments.find((segment) => segment.id === "operational")?.value ??
		0;
	const totalComponents = segmentTotal(platformSegments);
	const unobservedComponents =
		platformSegments.find((segment) => segment.id === "unknown")?.value ?? 0;
	const activeIncidents = (status?.pages ?? []).flatMap((page) =>
		page.incidents.filter((incident) => incident.state !== "resolved"),
	);
	const activeCriticalIncidents = activeIncidents.filter(
		(incident) => incident.severity === "critical",
	).length;
	const statusAvailable = platformGroup.state === "available";

	const capacity = buildConsoleCapacity({
		monitoring,
		monitoringState,
		canReadMonitoring,
	});
	const attention = buildConsoleAttention({
		data,
		capacity,
		now: effectiveNow,
	});
	const dependencies = buildConsoleDependencies({
		services,
		servicesState,
		canReadServices,
		servers,
		status,
		isOperator,
	});
	const activityPanel = buildConsoleActivity({ data, now: effectiveNow });

	const failedWorkloads = services.filter(
		(service) => service.status === "error",
	).length;
	const failedDeployments = activity?.failed.length ?? 0;
	const expiredCertificates = (certificates ?? []).filter(
		(certificate) => certificate.status === "expired",
	).length;
	const expiringCertificates = (certificates ?? []).filter(
		(certificate) => certificate.status === "expiring",
	).length;
	const certificatesMetricState = metricState(
		certificatesState,
		canReadCertificates,
	);
	const cpuResource = capacity.resources.find(
		(resource) => resource.id === "cpu",
	);

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
			icon: ShieldCheck,
		},
		{
			id: "open-incidents",
			label: "Open incidents",
			value: statusAvailable
				? resolvedValue("available", activeIncidents.length)
				: null,
			state: statusAvailable ? "available" : platformGroup.state,
			description: statusAvailable
				? activeCriticalIncidents > 0
					? `${activeCriticalIncidents} critical severity`
					: `Across ${status?.pages.length ?? 0} status page(s)`
				: "Depends on the status platform",
			tone:
				activeIncidents.length > 0
					? activeCriticalIncidents > 0
						? "critical"
						: "warning"
					: "neutral",
			href: "/dashboard/incidents",
			icon: BellRing,
		},
		{
			id: "failed-workloads",
			label: "Failed workloads",
			value: resolvedValue(
				metricState(servicesState, canReadServices),
				failedWorkloads,
			),
			state: metricState(servicesState, canReadServices),
			description: canReadServices
				? `${services.length} service(s) with a recorded state`
				: "The service read permission is required",
			tone: failedWorkloads > 0 ? "critical" : "neutral",
			href: "/dashboard/overview",
			icon: AppWindow,
		},
		{
			id: "failed-deployments",
			label: "Failed deployments",
			value: resolvedValue(
				metricState(activityState, canReadDeployments),
				failedDeployments,
			),
			state: metricState(activityState, canReadDeployments),
			description: canReadDeployments
				? "Latest failed deployments recorded (up to 5)"
				: "The deployment read permission is required",
			tone: failedDeployments > 0 ? "warning" : "neutral",
			href: "/dashboard/deployments",
			icon: Rocket,
		},
		{
			id: "certificates-at-risk",
			label: "Certificates at risk",
			value: resolvedValue(
				certificatesMetricState,
				expiredCertificates + expiringCertificates,
			),
			state: certificatesMetricState,
			description: canReadCertificates
				? `${certificates?.length ?? 0} monitored · expired or ≤30 days`
				: "The certificate read permission is required",
			tone:
				expiredCertificates > 0
					? "critical"
					: expiringCertificates > 0
						? "warning"
						: "neutral",
			href: "/dashboard/settings/certificates",
			icon: ShieldCheck,
		},
		{
			id: "capacity-cpu",
			label: "CPU utilisation",
			value:
				capacity.state === "available" &&
				cpuResource &&
				cpuResource.percentage !== null
					? `${cpuResource.percentage}%`
					: null,
			state: capacity.state,
			description:
				capacity.state === "available"
					? `${capacity.reportingServers} reporting · latest sample`
					: (capacity.message ?? "Measured by the monitoring agent"),
			tone:
				cpuResource?.percentage !== null &&
				(cpuResource?.percentage ?? 0) >= saturationThreshold
					? "warning"
					: "neutral",
			href: "/dashboard/monitoring",
			icon: Gauge,
		},
	];

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
	if (canReadMonitoring && monitoringState.isError) {
		limitations.push(
			"Compute capacity is unknown: the monitoring query failed. No figure is inferred from the fleet list.",
		);
	}
	limitations.push(
		"The server and workload panels cover this console instance's own organisation only. The console has no aggregated view across Cloud tenants.",
	);
	limitations.push(
		"No recorded relation links status components to workloads or servers. The dependency panel shows the relations Notploy actually stores: workload → server placement and status incident → component.",
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
		attention,
		capacity,
		dependencies,
		isOperator,
		limitations,
		hasPartialError:
			statsState.isError ||
			(canReadServices && servicesState.isError) ||
			(canReadDeployments && activityState.isError) ||
			eventsState.isError ||
			(canReadBackups && backupsState.isError) ||
			(canReadCertificates && certificatesState.isError) ||
			(canReadMonitoring && monitoringState.isError) ||
			(canReadTraffic && trafficState.isError) ||
			(isOperator && (statusState.isError || infrastructureState.isError)),
	};
};
