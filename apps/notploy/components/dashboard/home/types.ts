import type { LucideIcon } from "lucide-react";

/**
 * Availability of a single homepage datum.
 *
 * The distinction matters: an absent value is not `0`, a failed request is not
 * a healthy state, and a missing permission is not an incident. `restricted`
 * therefore exists next to `unavailable` so the UI never conflates a
 * permission gate with a broken data source.
 */
export type MetricState =
	| "available"
	| "loading"
	| "unavailable"
	| "restricted"
	| "not_applicable";

/** Semantic colour of a status value, mapped to the dashboard palette. */
export type HomeTone = "healthy" | "warning" | "critical" | "neutral" | "info";

/** State of the query a panel is built from. */
export interface SourceState {
	isLoading: boolean;
	isError: boolean;
}

export interface HomeMetric {
	id: string;
	label: string;
	/** `null` whenever the value is unknown: never rendered as `0`. */
	value: number | string | null;
	state: MetricState;
	description?: string;
	href?: string;
	icon?: LucideIcon;
	tone?: HomeTone;
}

export interface HomeStatusSegment {
	id: string;
	label: string;
	value: number;
	tone: HomeTone;
}

/**
 * One status overview panel: a state, a distribution and the caveats that
 * qualify it (which scope the numbers cover, which source produced them).
 */
export interface HomeStatusGroup {
	id: string;
	title: string;
	description: string;
	state: MetricState;
	/** Why the group is not available (error, missing permission, ...). */
	message?: string;
	segments: HomeStatusSegment[];
	/** Scope and data-source caveats shown under the numbers. */
	note?: string;
}

export interface HomeActivityItem {
	id: string;
	title: string;
	subtitle?: string;
	meta?: string;
	href?: string;
	badge?: string;
	tone?: HomeTone;
}

export interface HomeActivityPanel {
	state: MetricState;
	/** Set when a source failed or is partial, so the list is never silent. */
	message?: string;
	items: HomeActivityItem[];
}

/** One observed consumption against a plan limit (`null` = unlimited). */
export interface HomeUsageRow {
	resource: string;
	label: string;
	used: number;
	limit: number | null;
}

/*
 * Input contracts of the home data builders.
 *
 * Each builder declares the narrowest shape it actually reads, so a panel can
 * only be fed by a source that really carries those fields — and the builders
 * stay unit-testable without reconstructing a whole API payload.
 */

/** Aggregate counts of a workspace (`project.homeStats`). */
export interface WorkspaceCounts {
	projects: number;
	environments: number;
	applications: number;
	compose: number;
	databases: number;
	services: number;
	status: { running: number; error: number; idle: number };
}

/** A workload as far as its recorded state is concerned. */
export interface WorkloadLike {
	status: string | null;
}

/** A machine as far as its administrative state is concerned. */
export interface ServerLike {
	serverStatus: "active" | "inactive";
}

/** One side of a deployment (application or compose) and its location. */
export interface DeploymentServiceLike {
	name: string;
	environment: {
		environmentId: string;
		name: string;
		project: { projectId: string; name: string };
	};
}

/** A deployment as far as recent activity is concerned. */
export interface DeploymentLike {
	deploymentId: string;
	status: string | null;
	createdAt: string;
	application?: (DeploymentServiceLike & { applicationId: string }) | null;
	compose?: (DeploymentServiceLike & { composeId: string }) | null;
}

/** A deployment feed (recent deployments and the failed ones). */
export interface DeploymentFeedLike {
	recent: DeploymentLike[];
	failed: DeploymentLike[];
}

/** One operational event as recorded by the instance. */
export interface OperationalEventLike {
	eventId: string;
	title: string;
	message: string;
	severity: string;
	resourceHref: string | null;
	lastSeenAt: string;
}

/** Operational events, split between what needs action and what happened. */
export interface OperationalEventFeedLike {
	actionRequired: OperationalEventLike[];
	recent: OperationalEventLike[];
}

/** Observed consumption and plan limits (`stripe.getUsage`). */
export interface PlanUsageLike {
	resources: HomeUsageRow[];
}
