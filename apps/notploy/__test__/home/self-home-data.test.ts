import { describe, expect, it } from "vitest";
import { buildSelfHomeModel } from "@/components/dashboard/home/self/self-home-data";
import type {
	DeploymentFeedLike,
	OperationalEventFeedLike,
	ServerLike,
	WorkloadLike,
	WorkspaceCounts,
} from "@/components/dashboard/home/types";

const settled = { isLoading: false, isError: false };
const failedSource = { isLoading: false, isError: true };
const loadingSource = { isLoading: true, isError: false };

const stats: WorkspaceCounts = {
	projects: 4,
	environments: 6,
	applications: 5,
	compose: 1,
	databases: 3,
	services: 9,
	status: { running: 7, error: 1, idle: 1 },
};

const services: WorkloadLike[] = [
	{ status: "done" },
	{ status: "done" },
	{ status: "error" },
	{ status: "running" },
	{ status: null },
];

const servers: ServerLike[] = [
	{ serverStatus: "active" },
	{ serverStatus: "active" },
	{ serverStatus: "inactive" },
];

const activity: DeploymentFeedLike = {
	recent: [
		{
			deploymentId: "d-1",
			status: "running",
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
		},
	],
	failed: [],
};

const events: OperationalEventFeedLike = {
	actionRequired: [],
	recent: [
		{
			eventId: "e-1",
			title: "Backup failed",
			message: "The backup destination rejected the upload.",
			severity: "warning",
			resourceHref: "/dashboard/settings/destinations",
			lastSeenAt: "2026-10-16T08:00:00.000Z",
		},
	],
};

const full = {
	stats,
	statsState: settled,
	services,
	servicesState: settled,
	canReadServices: true,
	activity,
	activityState: settled,
	canReadDeployments: true,
	servers,
	serversState: settled,
	canReadServers: true,
	events,
	eventsState: settled,
};

const metric = (
	model: ReturnType<typeof buildSelfHomeModel>,
	id: string,
) => {
	const found = model.metrics.find((entry) => entry.id === id);
	if (!found) throw new Error(`metric ${id} is missing`);
	return found;
};

describe("buildSelfHomeModel", () => {
	it("summarises the instance from the sources it can read", () => {
		const model = buildSelfHomeModel(full);

		expect(metric(model, "projects")).toMatchObject({
			value: 4,
			state: "available",
			description: "6 environments",
		});
		expect(metric(model, "workloads")).toMatchObject({ value: 9 });
		expect(metric(model, "deployments")).toMatchObject({
			value: 1,
			description: "1 in progress · 0 failed",
		});
		expect(metric(model, "servers")).toMatchObject({
			value: 2,
			description: "Active out of 3 registered",
		});
		expect(model.isEmpty).toBe(false);
		expect(model.hasPartialError).toBe(false);
	});

	it("distributes workload state from the per-service detail", () => {
		const model = buildSelfHomeModel(full);
		const workloads = model.statusGroups.find(
			(group) => group.id === "workloads",
		);
		expect(workloads?.state).toBe("available");
		expect(
			Object.fromEntries(
				(workloads?.segments ?? []).map((segment) => [
					segment.id,
					segment.value,
				]),
			),
		).toEqual({ healthy: 2, deploying: 1, failed: 1, idle: 1 });
	});

	it("falls back to the aggregate when the service detail is not permitted", () => {
		const model = buildSelfHomeModel({
			...full,
			canReadServices: false,
			services: [],
			servicesState: settled,
		});
		const workloads = model.statusGroups.find(
			(group) => group.id === "workloads",
		);
		expect(
			Object.fromEntries(
				(workloads?.segments ?? []).map((segment) => [
					segment.id,
					segment.value,
				]),
			),
		).toEqual({ healthy: 7, deploying: 0, failed: 1, idle: 1 });
		expect(workloads?.note).toContain("permission");
	});

	it("reports a failed statistics source as unavailable, not as zero", () => {
		const model = buildSelfHomeModel({
			...full,
			stats: undefined,
			statsState: failedSource,
		});
		expect(metric(model, "projects")).toMatchObject({
			value: null,
			state: "unavailable",
		});
		expect(model.hasPartialError).toBe(true);
	});

	it("reports missing permissions as restricted, never as an incident", () => {
		const model = buildSelfHomeModel({
			...full,
			canReadDeployments: false,
			activity: undefined,
			canReadServers: false,
			servers: [],
			serversState: settled,
		});
		expect(metric(model, "deployments")).toMatchObject({
			value: null,
			state: "restricted",
		});
		expect(metric(model, "servers")).toMatchObject({
			value: null,
			state: "restricted",
		});
		const serverGroup = model.statusGroups.find(
			(group) => group.id === "servers",
		);
		expect(serverGroup?.state).toBe("restricted");
		expect(serverGroup?.message).toContain("permission");
		// A permission gate is not an availability problem.
		expect(model.hasPartialError).toBe(false);
	});

	it("distinguishes an empty instance from a loading one", () => {
		const empty = buildSelfHomeModel({
			...full,
			stats: {
				projects: 0,
				environments: 0,
				applications: 0,
				compose: 0,
				databases: 0,
				services: 0,
				status: { running: 0, error: 0, idle: 0 },
			},
			services: [],
			activity: { recent: [], failed: [] },
			events: { actionRequired: [], recent: [] },
		});
		expect(empty.isEmpty).toBe(true);
		expect(metric(empty, "projects")).toMatchObject({
			value: 0,
			state: "available",
		});

		const loading = buildSelfHomeModel({
			...full,
			stats: undefined,
			statsState: loadingSource,
			services: [],
			servicesState: loadingSource,
		});
		expect(loading.isEmpty).toBe(false);
		expect(metric(loading, "projects").state).toBe("loading");
	});

	it("keeps the activity list populated from operational events", () => {
		const model = buildSelfHomeModel(full);
		expect(model.activity.state).toBe("available");
		expect(model.activity.items.map((item) => item.id)).toEqual([
			"event-e-1",
			"deployment-d-1",
		]);
	});
});
