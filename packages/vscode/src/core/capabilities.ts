import type { NotployClient } from "../api/notploy-client";
import { EMPTY_CAPABILITIES, type InstanceCapabilities } from "./domain";
import { isNotployError, toNotployError } from "./errors";

/**
 * Capability discovery.
 *
 * The extension never decides what to show from a "cloud vs self-hosted" flag.
 * It asks the instance what it can actually do:
 *
 * 1. Primary source — `settings.getOpenApiDocument`: the instance returns its
 *    own OpenAPI document, which lists the routers it really exposes. This also
 *    means a future `kubernetes` router will be picked up automatically.
 * 2. Fallback — when the document cannot be read (restricted permissions, older
 *    instance, oversized payload), a small set of read-only probes is used and
 *    each router is marked available, restricted or missing.
 *
 * `notploy.kubernetes.enabled` only *adds* the Kubernetes section for users who
 * want to see the adapter state; it can never turn a missing API into a working
 * one.
 */

/** Router name the Kubernetes adapter is waiting for. See `kubernetes.ts`. */
export const KUBERNETES_ROUTER = "kubernetes";

export type CapabilitySource = "openapi" | "probe";

export interface CapabilityReport {
	capabilities: InstanceCapabilities;
	/** Router names the instance exposes, sorted. */
	routers: string[];
	source: CapabilitySource;
	version?: string;
	/** Routers that answered with a permission error during probing. */
	restricted: string[];
	/** Human-readable notes about anything that could not be determined. */
	notes: string[];
}

export interface DetectCapabilitiesOptions {
	/** Values forced on by the user (e.g. the Kubernetes section opt-in). */
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
		// Kubernetes is not part of the Notploy API today. This stays false
		// until an instance actually advertises the router.
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
	{
		router: "project",
		capability: "deployments",
		run: (client) => client.projects(),
	},
	{
		router: "deployment",
		capability: "logs",
		run: (client) => client.allDeployments(),
	},
	{
		router: "docker",
		capability: "docker",
		run: (client) => client.containers(),
	},
	{
		router: "server",
		capability: "servers",
		run: (client) => client.servers(),
	},
	{
		router: "network",
		capability: "networks",
		run: (client) => client.networks(),
	},
	{
		router: "dockerImage",
		capability: "dockerImages",
		run: (client) => client.images(),
		optional: true,
	},
	{
		router: "dockerVolume",
		capability: "dockerVolumes",
		run: (client) => client.volumes(),
		optional: true,
	},
	{
		router: "compose",
		capability: "compose",
		run: (client) => client.composes(),
		optional: true,
	},
	{
		router: "environment",
		capability: "environments",
		run: (client) => client.projects(),
		optional: true,
	},
	{
		router: "swarm",
		capability: "swarm",
		run: (client) => client.swarmNodes(),
		optional: true,
	},
];

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
				// The client normalises its own failures; normalising again is a no-op
				// for those and covers errors injected by callers or other sources.
				const failure = toNotployError(error, {
					operation: `probe /${probe.router}`,
				});
				if (failure.code === "forbidden") {
					// The router exists; the credential may simply not have the
					// permission. Do not advertise the capability, but say so.
					restricted.push(probe.router);
					routers.push(probe.router);
					return;
				}
				if (failure.code === "unauthorized" || failure.code === "connection") {
					// Credential or connectivity problem: the probe is inconclusive,
					// so we do not claim the capability either way.
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

/** Multi-line summary used by `Notploy: Show Instance Capabilities`. */
export function describeCapabilities(report: CapabilityReport): string {
	const lines: string[] = [];
	lines.push(
		`Capability source: ${report.source === "openapi" ? "instance OpenAPI document" : "endpoint probes"}`,
	);
	if (report.version) lines.push(`Version: ${report.version}`);
	lines.push(`Cloud: ${report.capabilities.cloud ? "yes" : "no"}`);
	lines.push("");
	lines.push("Capabilities:");
	for (const [name, enabled] of Object.entries(report.capabilities)) {
		lines.push(`  ${enabled ? "✓" : "✗"} ${name}`);
	}
	if (report.restricted.length > 0) {
		lines.push("");
		lines.push(
			`Restricted for this credential: ${report.restricted.join(", ")}`,
		);
	}
	if (!report.capabilities.kubernetes) {
		lines.push("");
		lines.push(
			"Kubernetes: the Notploy API exposes no Kubernetes router, so no Kubernetes resources can be listed.",
		);
	}
	if (report.notes.length > 0) {
		lines.push("");
		lines.push(...report.notes);
	}
	return lines.join("\n");
}
