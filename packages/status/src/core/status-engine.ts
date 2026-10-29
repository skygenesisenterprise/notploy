/**
 * Status Core — global state engine.
 *
 * A single, deterministic, side-effect-free function computes what the public
 * page is allowed to show. It never reads storage and never performs I/O, so
 * every ambiguous combination can (and is) covered by unit tests.
 *
 * Design rules encoded here:
 *
 * - Worst state wins: a major outage can never be masked by healthy
 *   components. Ranking is `major_outage > partial_outage >
 *   degraded_performance > under_maintenance > operational`.
 * - Only *published, public* incidents and maintenances influence the public
 *   state. Drafts, private incidents and unpublished maintenances are
 *   invisible to the engine.
 * - A scheduled maintenance never degrades anything; only an in-progress
 *   published maintenance marks its components `under_maintenance`, and even
 *   then a real degradation always wins over maintenance.
 * - Absence of data is never a proof of health. When a monitoring source
 *   reports `unknown` (or stops reporting), the engine keeps the last
 *   published state, flags the component `stale`, and contributes nothing
 *   positive to the page state.
 * - A component that aggregates children (parentId) rolls up to the worst
 *   state of its public children, merged with its own incidents.
 */
import { isOlderThan, nowIso } from "./time";
import type {
	GlobalStatus,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
	ObservedStatus,
	PublicComponentStatus,
	Visibility,
} from "./types";

/** Ranking used to resolve the worst state. Higher is worse. */
export const STATUS_RANK: Record<PublicComponentStatus, number> = {
	operational: 0,
	under_maintenance: 1,
	degraded_performance: 2,
	partial_outage: 3,
	major_outage: 4,
};

/** Default mapping incident severity → public status. */
export const DEFAULT_SEVERITY_TO_STATUS: Record<
	IncidentSeverity,
	GlobalStatus
> = {
	minor: "degraded_performance",
	major: "partial_outage",
	critical: "major_outage",
};

/** Worst (highest-rank) status of the provided list. */
export const worstStatus = (
	...statuses: PublicComponentStatus[]
): PublicComponentStatus =>
	statuses.reduce<PublicComponentStatus>(
		(worst, status) =>
			STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst,
		"operational",
	);

/**
 * Map an observed monitoring state to the public vocabulary. `unknown` maps
 * to `null`: it contributes nothing and must never be rendered as
 * "operational".
 */
export const observedToPublicStatus = (
	observed: ObservedStatus,
): PublicComponentStatus | null => {
	switch (observed) {
		case "operational":
			return "operational";
		case "degraded":
			return "degraded_performance";
		case "outage":
			return "major_outage";
		case "unknown":
			return null;
	}
};

export interface EngineComponent {
	id: string;
	visibility: Visibility;
	parentId: string | null;
	observedStatus: ObservedStatus;
	observedAt: string | null;
	/** Last status persisted by the publication step (fallback for unknown data). */
	lastPublishedStatus: PublicComponentStatus | null;
	position: number;
}

export interface EngineIncident {
	id: string;
	severity: IncidentSeverity;
	state: IncidentState;
	published: boolean;
	visibility: Visibility;
	componentIds: string[];
}

export interface EngineMaintenance {
	id: string;
	state: MaintenanceState;
	published: boolean;
	visibility: Visibility;
	componentIds: string[];
}

export interface ComponentStatusResult {
	componentId: string;
	status: PublicComponentStatus;
	/** Observed data missing or older than the stale window. */
	stale: boolean;
	observedStatus: ObservedStatus;
	observedAt: string | null;
	/** True when at least one active published maintenance covers it. */
	underMaintenance: boolean;
	/** Active published incidents contributing to this component's state. */
	incidentIds: string[];
}

export interface PageStatusResult {
	status: GlobalStatus;
	stale: boolean;
	generatedAt: string;
	incidentIds: string[];
	maintenanceIds: string[];
	componentStatuses: ComponentStatusResult[];
}

export interface ComputePageStatusInput {
	components: EngineComponent[];
	incidents: EngineIncident[];
	maintenances: EngineMaintenance[];
	staleAfterSeconds?: number;
	severityToStatus?: Partial<Record<IncidentSeverity, GlobalStatus>>;
	now?: string;
}

const resolveSeverityToStatus = (
	partial?: Partial<Record<IncidentSeverity, GlobalStatus>>,
): Record<IncidentSeverity, GlobalStatus> => ({
	minor: partial?.minor ?? DEFAULT_SEVERITY_TO_STATUS.minor,
	major: partial?.major ?? DEFAULT_SEVERITY_TO_STATUS.major,
	critical: partial?.critical ?? DEFAULT_SEVERITY_TO_STATUS.critical,
});

/** Active = unresolved, published and public. Everything else stays internal. */
export const isActivePublicIncident = (incident: EngineIncident): boolean =>
	incident.state !== "resolved" &&
	incident.published &&
	incident.visibility === "public";

/** An in-progress, published, public maintenance. */
export const isActivePublicMaintenance = (
	maintenance: EngineMaintenance,
): boolean =>
	maintenance.state === "in_progress" &&
	maintenance.published &&
	maintenance.visibility === "public";

/**
 * Compute the public state of every component and of the page itself.
 *
 * The result is deterministic for a given input: the same components,
 * incidents and maintenances always produce the same output, regardless of
 * insertion order.
 */
export const computePageStatus = ({
	components,
	incidents,
	maintenances,
	staleAfterSeconds = 120,
	severityToStatus,
	now = nowIso(),
}: ComputePageStatusInput): PageStatusResult => {
	const severityMap = resolveSeverityToStatus(severityToStatus);
	const activeIncidents = incidents.filter(isActivePublicIncident);
	const activeMaintenances = maintenances.filter(isActivePublicMaintenance);

	const byId = new Map(
		components.map((component) => [component.id, component]),
	);
	const childrenOf = new Map<string, EngineComponent[]>();
	for (const component of components) {
		if (component.parentId && byId.has(component.parentId)) {
			const siblings = childrenOf.get(component.parentId) ?? [];
			siblings.push(component);
			childrenOf.set(component.parentId, siblings);
		}
	}

	const memo = new Map<string, ComponentStatusResult>();
	const visiting = new Set<string>();

	const computeFor = (component: EngineComponent): ComponentStatusResult => {
		const cached = memo.get(component.id);
		if (cached) {
			return cached;
		}
		// Cycle guard: a malformed parent chain must not crash the page.
		if (visiting.has(component.id)) {
			return {
				componentId: component.id,
				status: component.lastPublishedStatus ?? "operational",
				stale: true,
				observedStatus: component.observedStatus,
				observedAt: component.observedAt,
				underMaintenance: false,
				incidentIds: [],
			};
		}
		visiting.add(component.id);

		const stale =
			component.observedStatus === "unknown" ||
			isOlderThan(component.observedAt, staleAfterSeconds, now);

		const coveringIncidents = activeIncidents.filter((incident) =>
			incident.componentIds.includes(component.id),
		);
		const coveringMaintenances = activeMaintenances.filter((maintenance) =>
			maintenance.componentIds.includes(component.id),
		);

		const contributions: PublicComponentStatus[] = [];
		const observed = observedToPublicStatus(component.observedStatus);
		if (observed) {
			contributions.push(observed);
		}
		for (const incident of coveringIncidents) {
			contributions.push(severityMap[incident.severity]);
		}
		if (coveringMaintenances.length > 0) {
			contributions.push("under_maintenance");
		}
		// Roll-up: public children aggregate into their parent.
		const children = (childrenOf.get(component.id) ?? []).filter(
			(child) => child.visibility === "public",
		);
		for (const child of children) {
			contributions.push(computeFor(child).status);
		}

		const result: ComponentStatusResult = {
			componentId: component.id,
			// No contribution at all (unknown data, no incident): keep the last
			// published state instead of declaring health we cannot prove.
			status:
				contributions.length > 0
					? worstStatus(...contributions)
					: (component.lastPublishedStatus ?? "operational"),
			stale,
			observedStatus: component.observedStatus,
			observedAt: component.observedAt,
			underMaintenance: coveringMaintenances.length > 0,
			incidentIds: coveringIncidents.map((incident) => incident.id),
		};
		visiting.delete(component.id);
		memo.set(component.id, result);
		return result;
	};

	const publicComponents = components.filter(
		(component) => component.visibility === "public",
	);
	const componentStatuses = publicComponents.map((component) =>
		computeFor(component),
	);

	const pageStatuses: PublicComponentStatus[] = componentStatuses.map(
		(result) => result.status,
	);
	// A published incident is visible on the page even when it does not map to
	// any public component (e.g. it affects private infrastructure): it still
	// contributes its severity so the indicator never looks rosier than reality.
	const maintenanceComponentIds = new Set(
		activeMaintenances.flatMap((maintenance) => maintenance.componentIds),
	);
	const affectingPublicComponent = publicComponents.some((component) =>
		maintenanceComponentIds.has(component.id),
	);
	if (affectingPublicComponent) {
		pageStatuses.push("under_maintenance");
	}
	for (const incident of activeIncidents) {
		pageStatuses.push(severityMap[incident.severity]);
	}

	const maintenanceIds = activeMaintenances
		.filter((maintenance) =>
			maintenance.componentIds.some((componentId) =>
				publicComponents.some((component) => component.id === componentId),
			),
		)
		.map((maintenance) => maintenance.id);

	return {
		status: worstStatus(...pageStatuses),
		stale: componentStatuses.some((result) => result.stale),
		generatedAt: now,
		incidentIds: activeIncidents.map((incident) => incident.id),
		maintenanceIds,
		componentStatuses,
	};
};
