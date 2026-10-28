import { describe, expect, it } from "vitest";
import {
	OPERATOR_ONLY_MESSAGE,
	buildConsoleHomeModel,
	type ConsoleHomeData,
	type ConsoleServiceLike,
} from "@/components/dashboard/home/console/console-home-data";
import type {
	DeploymentFeedLike,
	OperationalEventFeedLike,
	ServerLike,
	WorkspaceCounts,
} from "@/components/dashboard/home/types";

const settled = { isLoading: false, isError: false };
const failedSource = { isLoading: false, isError: true };

const stats: WorkspaceCounts = {
	projects: 1,
	environments: 1,
	applications: 2,
	compose: 0,
	databases: 1,
	services: 3,
	status: { running: 3, error: 0, idle: 0 },
};

const services = [
	{ status: "done" },
	{ status: "done" },
] as ConsoleServiceLike[];
const servers: ServerLike[] = [
	{ serverStatus: "active" },
	{ serverStatus: "inactive" },
];
const activity: DeploymentFeedLike = { recent: [], failed: [] };
const events: OperationalEventFeedLike = { actionRequired: [], recent: [] };

const component = (
	id: string,
	observedStatus: string,
	observedAt: string | null = "2026-10-16T09:00:00.000Z",
) => ({
	id,
	pageId: "page-1",
	name: id,
	description: "",
	category: "core" as const,
	groupName: null,
	position: 0,
	visibility: "public" as const,
	parentId: null,
	source: "monitoring" as const,
	observedStatus,
	observedAt,
	lastPublishedStatus: "operational" as const,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-10-16T09:00:00.000Z",
});

const incident = (id: string, state: string) => ({
	id,
	pageId: "page-1",
	title: `incident ${id}`,
	description: "",
	severity: "major" as const,
	state: state as "resolved" | "investigating",
	visibility: "public" as const,
	published: true,
	publishedAt: "2026-10-16T08:00:00.000Z",
	correlationKey: null,
	componentIds: ["api"],
	startedAt: "2026-10-16T08:00:00.000Z",
	resolvedAt: null,
	createdAt: "2026-10-16T08:00:00.000Z",
	updatedAt: "2026-10-16T09:30:00.000Z",
});

const page = (
	slug: string,
	name: string,
	components: ReturnType<typeof component>[],
	incidents: ReturnType<typeof incident>[] = [],
) => ({
	page: {
		id: `page-${slug}`,
		slug,
		name,
		description: "",
		status: "operational" as const,
		stale: false,
		settings: {},
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-10-16T09:00:00.000Z",
	},
	components,
	incidents,
	maintenances: [],
});

const base: ConsoleHomeData = {
	isOperator: true,
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
	status: {
		configured: true,
		error: null,
		pages: [
			page(
				"cloud",
				"Notploy Cloud",
				[
					component("api", "operational"),
					component("db", "degraded"),
					component("edge", "outage"),
					component("worker", "operational", null),
				],
				[incident("i-1", "investigating"), incident("i-2", "resolved")],
			),
		],
	},
	statusState: settled,
	runtime: { version: "1.2.3", uptimeSeconds: 90_000, https: true, certificateType: "letsencrypt" },
	runtimeState: settled,
	infrastructure: {
		postgres: { status: "healthy" },
		traefik: { status: "unhealthy" },
	},
	infrastructureState: settled,
	backups: undefined,
	backupsState: settled,
	canReadBackups: false,
	certificates: undefined,
	certificatesState: settled,
	canReadCertificates: false,
	monitoring: undefined,
	monitoringState: settled,
	canReadMonitoring: false,
	traffic: undefined,
	trafficState: settled,
	canReadTraffic: false,
};

const group = (model: ReturnType<typeof buildConsoleHomeModel>, id: string) => {
	const found = model.statusGroups.find((entry) => entry.id === id);
	if (!found) throw new Error(`group ${id} is missing`);
	return found;
};

const metric = (
	model: ReturnType<typeof buildConsoleHomeModel>,
	id: string,
) => {
	const found = model.metrics.find((entry) => entry.id === id);
	if (!found) throw new Error(`metric ${id} is missing`);
	return found;
};

describe("buildConsoleHomeModel", () => {
	it("aggregates the status platform without inventing a healthy state", () => {
		const model = buildConsoleHomeModel(base);
		const platform = group(model, "platform-status");

		expect(platform.state).toBe("available");
		// The component with no recorded observation is counted as unknown even
		// though its last published status was operational.
		expect(
			Object.fromEntries(
				platform.segments.map((segment) => [segment.id, segment.value]),
			),
		).toEqual({ operational: 1, degraded: 1, outage: 1, unknown: 1 });
		expect(platform.note).toContain("Notploy Cloud");
		expect(platform.note).toContain("is not a healthy state");
		expect(metric(model, "platform-components")).toMatchObject({
			value: "1/4",
			state: "available",
			tone: "warning",
			description: "1 without a usable observation",
		});
	});

	it("counts components that never reported an observation separately", () => {
		const data: ConsoleHomeData = {
			...base,
			status: {
				configured: true,
				error: null,
				pages: [
					page("cloud", "Notploy Cloud", [
						component("api", "operational"),
						component("worker", "unknown", null),
					]),
				],
			},
		};
		const model = buildConsoleHomeModel(data);
		const platform = group(model, "platform-status");

		expect(platform.segments.find((segment) => segment.id === "unknown")?.value).toBe(1);
		expect(platform.note).toContain("never reported one");
		expect(metric(model, "platform-components")).toMatchObject({
			value: "1/2",
			tone: "warning",
			description: "1 without a usable observation",
		});
	});

	it("reports an unconfigured status platform as unavailable with its remedy", () => {
		const model = buildConsoleHomeModel({
			...base,
			status: { configured: false, pages: [], error: null },
		});
		const platform = group(model, "platform-status");
		expect(platform.state).toBe("unavailable");
		expect(platform.message).toContain("STATUS_URL");
		expect(model.limitations.join(" ")).toContain("no status instance is connected");
		expect(metric(model, "open-incidents")).toMatchObject({
			value: null,
			state: "unavailable",
		});
	});

	it("reports a status collection error instead of an empty platform", () => {
		const model = buildConsoleHomeModel({
			...base,
			status: { configured: true, pages: [], error: "connection refused" },
		});
		const platform = group(model, "platform-status");
		expect(platform.state).toBe("unavailable");
		expect(platform.message).toContain("connection refused");
		expect(model.limitations.join(" ")).toContain("could not be read");
	});

	it("keeps the platform surfaces gated for a non-operator", () => {
		const model = buildConsoleHomeModel({ ...base, isOperator: false });
		expect(group(model, "platform-status").state).toBe("restricted");
		expect(group(model, "platform-status").message).toBe(OPERATOR_ONLY_MESSAGE);
		expect(group(model, "control-plane").state).toBe("restricted");
		expect(metric(model, "platform-components")).toMatchObject({
			value: null,
			state: "restricted",
		});
		expect(model.limitations).toContain(OPERATOR_ONLY_MESSAGE);
	});

	it("never turns a failed probe into a healthy control plane", () => {
		const model = buildConsoleHomeModel({
			...base,
			infrastructure: undefined,
			infrastructureState: failedSource,
		});
		const controlPlane = group(model, "control-plane");
		expect(controlPlane.state).toBe("unavailable");
		expect(controlPlane.segments).toEqual([]);
		expect(controlPlane.message).toContain("unknown");
		expect(model.hasPartialError).toBe(true);
	});

	it("reports the probed control plane state and its perimeter", () => {
		const model = buildConsoleHomeModel(base);
		const controlPlane = group(model, "control-plane");
		expect(controlPlane.state).toBe("available");
		expect(
			Object.fromEntries(
				controlPlane.segments.map((segment) => [segment.id, segment.value]),
			),
		).toEqual({ healthy: 1, unhealthy: 1 });
		expect(controlPlane.note).toContain("Notploy 1.2.3");
		expect(controlPlane.note).toContain("uptime 1d 1h");
		expect(controlPlane.note).toContain("this instance's own host");
	});

	it("labels the fleet and workload panels as this instance's own perimeter", () => {
		const model = buildConsoleHomeModel(base);
		expect(group(model, "servers").note).toContain("not an aggregate of the Cloud fleet");
		expect(group(model, "servers").segments).toEqual([
			{ id: "active", label: "Active", value: 1, tone: "healthy" },
			{ id: "inactive", label: "Inactive", value: 1, tone: "neutral" },
		]);
		expect(model.limitations.join(" ")).toContain(
			"no aggregated view across Cloud tenants",
		);
	});

	it("lists open incidents as operational activity and ignores resolved ones", () => {
		const model = buildConsoleHomeModel(base);
		expect(model.activity.state).toBe("available");
		expect(model.activity.items.map((item) => item.id)).toEqual([
			"status-incident-cloud-i-1",
		]);
		expect(model.activity.items[0]).toMatchObject({
			href: "/dashboard/incidents",
			tone: "critical",
		});
	});

	it("only splits status pages when more than one is published", () => {
		const single = buildConsoleHomeModel(base);
		expect(single.statusGroups.some((entry) => entry.id.startsWith("status-page-"))).toBe(
			false,
		);

		const multiple = buildConsoleHomeModel({
			...base,
			status: {
				configured: true,
				error: null,
				pages: [
					page("cloud", "Notploy Cloud", [component("api", "operational")]),
					page("status", "Notploy Status", [component("web", "operational")]),
				],
			},
		});
		expect(
			multiple.statusGroups
				.filter((entry) => entry.id.startsWith("status-page-"))
				.map((entry) => entry.title),
		).toEqual(["Notploy Cloud", "Notploy Status"]);
	});
});
