/**
 * Capability discovery.
 *
 * The client never decides what to show from a "cloud vs self-hosted" flag. It
 * asks the instance what it can actually do:
 *
 * 1. Primary source — `settings.getOpenApiDocument`: the instance returns its
 *    own OpenAPI document, which lists the routers it really exposes. A future
 *    router is therefore picked up without a client release.
 * 2. Fallback — when the document cannot be read (restricted credential, older
 *    instance, oversized payload), a small set of read-only probes is used and
 *    each router is marked available, restricted or missing.
 *
 * Nothing here invents an endpoint: a capability the API does not have stays
 * `false` and the UI explains why instead of showing an empty page.
 */

import { EMPTY_CAPABILITIES, type InstanceCapabilities } from "@/shared/domain";
import { isNotployError, toNotployError } from "./errors";
import type { NotployClient } from "./notploy-client";

/** Router name the Kubernetes adapter is waiting for. */
export const KUBERNETES_ROUTER = "kubernetes";

export interface CapabilityReport {
	capabilities: InstanceCapabilities;
	/** Router names the instance exposes, sorted. */
	routers: string[];
	source: "openapi" | "probe";
	version?: string;
	/** Routers that answered with a permission error during probing. */
	restricted: string[];
	/** Human-readable notes about anything that could not be determined. */
	notes: string[];
}

/** Extracts the router names (`project`, `docker`, …) from a document. */
export function routersFromDocument(
	document: { paths?: Record<string, unknown> } | undefined,
): string[] {
	const paths = document?.paths;
	if (!paths || typeof paths !== "object") return [];
	const routers = new Set<string>();
	for (const path of Object.keys(paths)) {
		const trimmed = path.startsWith("/") ? path.slice(1) : path;
		const dot = trimmed.indexOf(".");
		const slash = trimmed.indexOf("/");
		const end = [dot, slash]
			.filter((index) => index >= 0)
			.sort((a, b) => a - b)[0];
		const router = end === undefined ? trimmed : trimmed.slice(0, end);
		if (router) routers.add(router);
	}
	return [...routers].sort();
}

export function capabilitiesFromRouters(
	routers: Iterable<string>,
	cloud: boolean,
): InstanceCapabilities {
	const set = new Set(routers);
	return {
		...EMPTY_CAPABILITIES,
		deployments: set.has("deployment") && set.has("application"),
		logs: set.has("application"),
		docker: set.has("docker"),
		dockerImages: set.has("dockerImage"),
		dockerVolumes: set.has("dockerVolume"),
		networks: set.has("network"),
		servers: set.has("server"),
		swarm: set.has("swarm") || set.has("cluster"),
		compose: set.has("compose"),
		environments: set.has("environment"),
		notifications: set.has("notification"),
		kubernetes: set.has(KUBERNETES_ROUTER),
		cloud,
	};
}

interface ProbeDefinition {
	readonly router: string;
	readonly capability: keyof InstanceCapabilities;
	readonly run: (client: NotployClient) => Promise<unknown>;
	readonly optional?: boolean;
}

const PROBES: ProbeDefinition[] = [
	{ router: "project", capability: "deployments", run: (c) => c.projects() },
	{
		router: "deployment",
		capability: "logs",
		run: (c) => c.allDeployments(),
	},
	{ router: "docker", capability: "docker", run: (c) => c.containers() },
	{ router: "server", capability: "servers", run: (c) => c.servers() },
	{ router: "network", capability: "networks", run: (c) => c.networks() },
	{
		router: "dockerImage",
		capability: "dockerImages",
		run: (c) => c.images(),
		optional: true,
	},
	{
		router: "dockerVolume",
		capability: "dockerVolumes",
		run: (c) => c.volumes(),
		optional: true,
	},
	{
		router: "compose",
		capability: "compose",
		run: (c) => c.composes(),
		optional: true,
	},
	{
		router: "environment",
		capability: "environments",
		run: (c) => c.projects(),
		optional: true,
	},
	{
		router: "notification",
		capability: "notifications",
		run: (c) => c.notifications(),
		optional: true,
	},
	{
		router: "swarm",
		capability: "swarm",
		run: (c) => c.swarmNodes(),
		optional: true,
	},
];

export interface DetectCapabilitiesOptions {
	/** Values forced on by the user (reserved; nothing uses it today). */
	overrides?: Partial<InstanceCapabilities>;
}

export async function detectCapabilities(
	client: NotployClient,
	options: DetectCapabilitiesOptions = {},
): Promise<CapabilityReport> {
	const notes: string[] = [];
	const [version, cloud] = await Promise.all([
		client.version().catch(() => undefined),
		client.isCloud().catch(() => false),
	]);

	let report: CapabilityReport | undefined;

	try {
		const document = await client.openApiDocument();
		const routers = routersFromDocument(document);
		if (routers.length > 0) {
			report = {
				capabilities: capabilitiesFromRouters(routers, cloud),
				routers,
				source: "openapi",
				version,
				restricted: [],
				notes,
			};
		} else {
			notes.push(
				"The instance returned an empty OpenAPI document; capabilities were probed instead.",
			);
		}
	} catch (error) {
		notes.push(
			isNotployError(error) && error.code === "forbidden"
				? "Reading the OpenAPI document is not permitted for this credential; capabilities were probed instead."
				: "The OpenAPI document could not be read; capabilities were probed instead.",
		);
	}

	if (!report) {
		report = await probeCapabilities(client, { version, cloud, notes });
	}

	if (options.overrides) {
		report.capabilities = { ...report.capabilities, ...options.overrides };
	}
	return report;
}

async function probeCapabilities(
	client: NotployClient,
	context: { version?: string; cloud: boolean; notes: string[] },
): Promise<CapabilityReport> {
	const capabilities: InstanceCapabilities = {
		...EMPTY_CAPABILITIES,
		cloud: context.cloud,
	};
	const routers: string[] = [];
	const restricted: string[] = [];

	await Promise.all(
		PROBES.map(async (probe) => {
			try {
				await probe.run(client);
				capabilities[probe.capability] = true;
				routers.push(probe.router);
			} catch (error) {
				const failure = toNotployError(error, {
					operation: `probe /${probe.router}`,
				});
				if (failure.code === "forbidden") {
					// The router exists; the credential may simply lack the
					// permission. Do not advertise the capability, but say so.
					restricted.push(probe.router);
					routers.push(probe.router);
					return;
				}
				if (failure.code === "unauthorized" || failure.code === "connection") {
					// Credential or connectivity problem: the probe is
					// inconclusive, so we claim the capability neither way.
					return;
				}
				if (!probe.optional) {
					context.notes.push(`Could not probe /${probe.router}.`);
				}
			}
		}),
	);

	routers.sort();
	return {
		capabilities,
		routers,
		source: "probe",
		version: context.version,
		restricted,
		notes: context.notes,
	};
}

const CAPABILITY_LABELS: Array<[keyof InstanceCapabilities, string]> = [
	["deployments", "Deployments"],
	["logs", "Logs"],
	["servers", "Servers"],
	["docker", "Docker containers"],
	["dockerImages", "Docker images"],
	["dockerVolumes", "Docker volumes"],
	["networks", "Networks"],
	["swarm", "Docker Swarm"],
	["compose", "Compose projects"],
	["environments", "Environments"],
	["notifications", "Notifications"],
	["cloud", "Notploy Cloud"],
	["kubernetes", "Kubernetes"],
];

/** Rows for the capabilities panel: label, enabled, and the reason when not. */
export function describeCapabilities(report: CapabilityReport): Array<{
	label: string;
	enabled: boolean;
	note?: string;
}> {
	return CAPABILITY_LABELS.map(([key, label]) => {
		const enabled = report.capabilities[key];
		if (enabled) return { label, enabled };
		if (key === "kubernetes") {
			return {
				label,
				enabled,
				note: "The Notploy API exposes no Kubernetes router, so no Kubernetes resources can be listed.",
			};
		}
		return { label, enabled };
	});
}
