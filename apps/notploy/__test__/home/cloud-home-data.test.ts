import { describe, expect, it } from "vitest";
import { buildCloudHomeModel } from "@/components/dashboard/home/cloud/cloud-home-data";
import type {
	DeploymentFeedLike,
	OperationalEventFeedLike,
	PlanUsageLike,
	WorkloadLike,
	WorkspaceCounts,
} from "@/components/dashboard/home/types";

const settled = { isLoading: false, isError: false };
const failedSource = { isLoading: false, isError: true };

const stats: WorkspaceCounts = {
	projects: 2,
	environments: 3,
	applications: 4,
	compose: 2,
	databases: 1,
	services: 7,
	status: { running: 6, error: 1, idle: 0 },
};

const services: WorkloadLike[] = [{ status: "done" }, { status: "error" }];

const activity: DeploymentFeedLike = { recent: [], failed: [] };

const events: OperationalEventFeedLike = {
	actionRequired: [],
	recent: [],
};

const usage: PlanUsageLike = {
	resources: [
		{ resource: "server", label: "Servers", used: 2, limit: 5 },
		{ resource: "organization", label: "Organizations", used: 1, limit: null },
	],
};

const base = {
	stats,
	statsState: settled,
	services,
	servicesState: settled,
	canReadServices: true,
	activity,
	activityState: settled,
	canReadDeployments: true,
	events,
	eventsState: settled,
	usage,
	usageState: settled,
	canReadUsage: true,
};

const metric = (
	model: ReturnType<typeof buildCloudHomeModel>,
	id: string,
) => {
	const found = model.metrics.find((entry) => entry.id === id);
	if (!found) throw new Error(`metric ${id} is missing`);
	return found;
};

describe("buildCloudHomeModel", () => {
	it("summarises the workspace only", () => {
		const model = buildCloudHomeModel(base);

		expect(metric(model, "applications")).toMatchObject({
			value: 4,
			description: "2 compose stacks · 1 databases",
			href: "/dashboard/overview",
		});
		expect(metric(model, "environments")).toMatchObject({ value: 3 });
		expect(metric(model, "deployments")).toMatchObject({ value: 0 });
	});

	it("never exposes an infrastructure or fleet panel", () => {
		const model = buildCloudHomeModel(base);
		expect(model.statusGroups.map((group) => group.id)).toEqual(["workloads"]);
		expect(model.metrics.map((entry) => entry.id)).toEqual([
			"applications",
			"workloads",
			"environments",
			"deployments",
		]);
		// No server fleet, no host name, no infrastructure topology.
		expect(Object.keys(model)).not.toContain("servers");
		expect(JSON.stringify(model.statusGroups)).not.toContain("serverStatus");
	});

	it("reports observed consumption next to the plan limits", () => {
		const model = buildCloudHomeModel(base);
		expect(model.usageState).toBe("available");
		expect(model.usage).toEqual([
			{ resource: "server", label: "Servers", used: 2, limit: 5 },
			{ resource: "organization", label: "Organizations", used: 1, limit: null },
		]);
	});

	it("omits consumption when it is not readable, keeping the reason", () => {
		const restricted = buildCloudHomeModel({
			...base,
			usage: undefined,
			canReadUsage: false,
		});
		expect(restricted.usage).toBeNull();
		expect(restricted.usageState).toBe("restricted");

		const broken = buildCloudHomeModel({
			...base,
			usage: undefined,
			usageState: failedSource,
		});
		expect(broken.usage).toBeNull();
		expect(broken.usageState).toBe("unavailable");
	});

	it("describes workload state as a recorded deployment state", () => {
		const model = buildCloudHomeModel(base);
		const workloads = model.statusGroups[0];
		expect(workloads?.note).toContain("not a live uptime measurement");
		expect(workloads?.note).toContain("this workspace only");
	});

	it("flags a partial load without inventing a value", () => {
		const model = buildCloudHomeModel({
			...base,
			stats: undefined,
			statsState: failedSource,
		});
		expect(model.hasPartialError).toBe(true);
		expect(metric(model, "applications")).toMatchObject({
			value: null,
			state: "unavailable",
		});
	});

	it("treats an empty workspace as an onboarding state", () => {
		const model = buildCloudHomeModel({
			...base,
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
		});
		expect(model.isEmpty).toBe(true);
	});
});
