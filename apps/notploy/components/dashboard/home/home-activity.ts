import { formatDistanceToNow } from "date-fns";
import {
	metricState,
	severityTone,
	serviceStatusLabel,
	serviceStatusTone,
} from "./home-state";
import type {
	DeploymentFeedLike,
	DeploymentLike,
	HomeActivityItem,
	HomeActivityPanel,
	OperationalEventFeedLike,
	OperationalEventLike,
	SourceState,
} from "./types";

/**
 * Recent activity, assembled from the two operational sources the instance
 * actually records: deployments and operational events.
 *
 * A source that failed is reported instead of being rendered as an empty list,
 * so a collection error can never look like "nothing happened".
 */

/** Project, environment and link of a deployment, or `null` when orphaned. */
export const deploymentTarget = (deployment: DeploymentLike) => {
	const owner = deployment.application ?? deployment.compose ?? null;
	if (!owner?.environment?.project) return null;
	const { environment } = owner;
	const serviceId = deployment.application
		? deployment.application.applicationId
		: (deployment.compose?.composeId ?? "");
	const serviceType = deployment.application ? "application" : "compose";
	return {
		name: owner.name,
		project: environment.project.name,
		environment: environment.name,
		href: `/dashboard/project/${environment.project.projectId}/environment/${environment.environmentId}/services/${serviceType}/${serviceId}`,
	};
};

const relativeTime = (value: string): string =>
	formatDistanceToNow(new Date(value), { addSuffix: true });

const deploymentItem = (deployment: DeploymentLike): HomeActivityItem | null => {
	const target = deploymentTarget(deployment);
	if (!target) return null;
	return {
		id: `deployment-${deployment.deploymentId}`,
		title: target.name,
		subtitle: `Deployment · ${target.project} / ${target.environment}`,
		href: target.href,
		badge: serviceStatusLabel(deployment.status),
		tone: serviceStatusTone(deployment.status),
		meta: relativeTime(deployment.createdAt),
	};
};

const eventItem = (event: OperationalEventLike): HomeActivityItem => ({
	id: `event-${event.eventId}`,
	title: event.title,
	subtitle: event.message,
	href: event.resourceHref ?? undefined,
	badge: event.severity,
	tone: severityTone(event.severity),
	meta: relativeTime(event.lastSeenAt),
});

export const buildActivityPanel = ({
	activity,
	activityState,
	canReadDeployments,
	events,
	eventsState,
	limit = 6,
}: {
	activity: DeploymentFeedLike | undefined;
	activityState: SourceState;
	canReadDeployments: boolean;
	events: OperationalEventFeedLike | undefined;
	eventsState: SourceState;
	limit?: number;
}): HomeActivityPanel => {
	const deploymentsState = metricState(activityState, canReadDeployments);
	const allEventsState = metricState(eventsState);

	// What needs attention first, then what simply happened.
	const attention: HomeActivityItem[] = [
		...(canReadDeployments
			? (activity?.failed ?? [])
					.map(deploymentItem)
					.filter((item): item is HomeActivityItem => item !== null)
			: []),
		...(events?.actionRequired ?? []).map(eventItem),
	];
	const recent: HomeActivityItem[] = [
		...(events?.recent ?? []).map(eventItem),
		...(canReadDeployments
			? (activity?.recent ?? [])
					.map(deploymentItem)
					.filter((item): item is HomeActivityItem => item !== null)
			: []),
	];

	const seen = new Set<string>();
	const items: HomeActivityItem[] = [];
	for (const item of [...attention, ...recent]) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		items.push(item);
		if (items.length >= limit) break;
	}

	if (items.length > 0) {
		const issues: string[] = [];
		if (canReadDeployments && deploymentsState === "unavailable") {
			issues.push("deployments could not be loaded");
		}
		if (allEventsState === "unavailable") {
			issues.push("operational events could not be loaded");
		}
		return {
			state: "available",
			items,
			message:
				issues.length > 0
					? `Partial activity: ${issues.join(" and ")}.`
					: undefined,
		};
	}

	if (deploymentsState === "loading" || allEventsState === "loading") {
		return { state: "loading", items: [] };
	}
	if (!canReadDeployments) {
		return {
			state: "restricted",
			items: [],
			message: "You do not have access to deployment history.",
		};
	}
	if (deploymentsState === "unavailable" && allEventsState === "unavailable") {
		return {
			state: "unavailable",
			items: [],
			message:
				"Neither deployments nor operational events could be loaded, so recent activity is unknown.",
		};
	}
	return { state: "available", items: [] };
};
