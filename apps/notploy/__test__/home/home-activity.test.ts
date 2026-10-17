import { describe, expect, it } from "vitest";
import { buildActivityPanel } from "@/components/dashboard/home/home-activity";
import type {
	DeploymentFeedLike,
	DeploymentLike,
	OperationalEventFeedLike,
	OperationalEventLike,
} from "@/components/dashboard/home/types";

const settled = { isLoading: false, isError: false };
const failedSource = { isLoading: false, isError: true };
const loadingSource = { isLoading: true, isError: false };

const deployment = (
	overrides: Partial<DeploymentLike> &
		Pick<DeploymentLike, "deploymentId" | "status">,
): DeploymentLike => ({
	createdAt: "2026-10-16T10:00:00.000Z",
	application: {
		applicationId: "app-1",
		name: "api",
		environment: {
			environmentId: "env-1",
			name: "production",
			project: { projectId: "proj-1", name: "core" },
		},
	},
	...overrides,
});

const event = (
	overrides: Partial<OperationalEventLike> & Pick<OperationalEventLike, "eventId">,
): OperationalEventLike => ({
	title: "Server unreachable",
	message: "The monitoring agent lost contact with the node.",
	severity: "critical",
	resourceHref: "/dashboard/settings/servers",
	lastSeenAt: "2026-10-16T09:00:00.000Z",
	...overrides,
});

const feed: DeploymentFeedLike = {
	recent: [
		deployment({ deploymentId: "d-1", status: "done" }),
		deployment({ deploymentId: "d-2", status: "running" }),
	],
	failed: [deployment({ deploymentId: "d-3", status: "error" })],
};

const events: OperationalEventFeedLike = {
	actionRequired: [event({ eventId: "e-1" })],
	recent: [event({ eventId: "e-2", severity: "success", title: "Deployment done" })],
};

describe("buildActivityPanel", () => {
	it("surfaces what needs attention before what simply happened", () => {
		const panel = buildActivityPanel({
			activity: feed,
			activityState: settled,
			canReadDeployments: true,
			events,
			eventsState: settled,
		});

		expect(panel.state).toBe("available");
		expect(panel.items.map((item) => item.id)).toEqual([
			"deployment-d-3",
			"event-e-1",
			"event-e-2",
			"deployment-d-1",
			"deployment-d-2",
		]);
		expect(panel.items[0]?.badge).toBe("Failed");
		expect(panel.items[0]?.href).toBe(
			"/dashboard/project/proj-1/environment/env-1/services/application/app-1",
		);
	});

	it("honours the item limit", () => {
		const panel = buildActivityPanel({
			activity: feed,
			activityState: settled,
			canReadDeployments: true,
			events,
			eventsState: settled,
			limit: 2,
		});
		expect(panel.items).toHaveLength(2);
	});

	it("reports a failed source instead of hiding it behind the items it did get", () => {
		const panel = buildActivityPanel({
			activity: feed,
			activityState: failedSource,
			canReadDeployments: true,
			events,
			eventsState: settled,
		});
		expect(panel.items.length).toBeGreaterThan(0);
		expect(panel.message).toContain("deployments could not be loaded");
	});

	it("never reports a collection failure as an empty activity list", () => {
		const panel = buildActivityPanel({
			activity: { recent: [], failed: [] },
			activityState: failedSource,
			canReadDeployments: true,
			events: { actionRequired: [], recent: [] },
			eventsState: failedSource,
		});
		expect(panel.state).toBe("unavailable");
		expect(panel.items).toEqual([]);
		expect(panel.message).toContain("unknown");
	});

	it("reports a missing permission as restricted", () => {
		const panel = buildActivityPanel({
			activity: undefined,
			activityState: settled,
			canReadDeployments: false,
			events: { actionRequired: [], recent: [] },
			eventsState: settled,
		});
		expect(panel.state).toBe("restricted");
		expect(panel.message).toContain("deployment history");
	});

	it("distinguishes an empty instance from a source still loading", () => {
		expect(
			buildActivityPanel({
				activity: { recent: [], failed: [] },
				activityState: settled,
				canReadDeployments: true,
				events: { actionRequired: [], recent: [] },
				eventsState: settled,
			}).state,
		).toBe("available");
		expect(
			buildActivityPanel({
				activity: undefined,
				activityState: loadingSource,
				canReadDeployments: true,
				events: undefined,
				eventsState: loadingSource,
			}).state,
		).toBe("loading");
	});

	it("drops deployments whose project is unknown", () => {
		const panel = buildActivityPanel({
			activity: {
				recent: [
					deployment({
						deploymentId: "d-orphan",
						status: "done",
						application: null,
						compose: null,
					}),
				],
				failed: [],
			},
			activityState: settled,
			canReadDeployments: true,
			events: { actionRequired: [], recent: [] },
			eventsState: settled,
		});
		expect(panel.items).toEqual([]);
	});
});
