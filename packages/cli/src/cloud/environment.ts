import * as fs from "node:fs";
import * as path from "node:path";
import type { CommandRunner, DockerAccess } from "./docker.js";
import { Docker, detectDockerAccess } from "./docker.js";
import { normalizeCloudVersion } from "./release.js";

/**
 * Read-only discovery of a Notploy installation.
 *
 * The official Linux installer (`install.sh`) creates Docker Swarm services:
 * `notploy`, `notploy-postgres` and the `notploy-traefik` container, with the
 * state volume mounted at `/etc/notploy`. That layout is what the CLI manages.
 * A Compose stack is detected and reported, but mutations are refused because
 * its lifecycle is owned by Compose, not by this CLI.
 */

export type DeploymentMode = "swarm" | "compose" | "none";
export type CloudProduct = "cloud" | "self" | "console" | "unknown";

export interface ServiceStatus {
	name: string;
	kind: "service" | "container";
	desiredReplicas: number | null;
	runningReplicas: number | null;
	state: string | null;
	image: string | null;
	healthy: boolean;
	detail?: string;
}

export interface IdentitySummary {
	present: boolean;
	path: string;
	product: string | null;
	instanceId: string | null;
	issue?: string;
}

export interface CapabilitySet {
	update: boolean;
	rollback: boolean;
	backup: boolean;
	health: boolean;
	reasons: Record<string, string>;
}

export interface Installation {
	detected: boolean;
	product: CloudProduct;
	deployment: DeploymentMode;
	configDir: string;
	configDirSource: "service-mount" | "environment" | "default";
	image: string | null;
	imageRepository: string | null;
	imageTag: string | null;
	imageDigest: string | null;
	installedVersion: string | null;
	releaseTag: string | null;
	services: ServiceStatus[];
	identity: IdentitySummary;
	healthUrl: string;
	capabilities: CapabilitySet;
	issues: string[];
	discoveredAt: string;
	docker: DockerAccess;
}

export interface DetectInstallationOptions {
	runner: CommandRunner;
	env?: NodeJS.ProcessEnv;
	docker?: Docker;
	dockerAccess?: DockerAccess;
	uid?: number;
	now?: () => Date;
}

const DEFAULT_CONFIG_DIR = "/etc/notploy";
const DEFAULT_PORT = 3000;

interface ContainerSpec {
	Image?: string;
	Env?: string[];
	Mounts?: Array<{ Source?: string; Target?: string }>;
}

interface ServiceInspect {
	Spec?: {
		TaskTemplate?: {
			ContainerSpec?: ContainerSpec;
		};
		Mode?: { Replicated?: { Replicas?: number } };
	};
	Endpoint?: { Ports?: Array<{ PublishedPort?: number }> };
	UpdateStatus?: { State?: string };
}

function parseEnv(entries: string[] | undefined): Map<string, string> {
	const map = new Map<string, string>();
	for (const entry of entries ?? []) {
		const index = entry.indexOf("=");
		if (index === -1) continue;
		map.set(entry.slice(0, index), entry.slice(index + 1));
	}
	return map;
}

function splitImage(image: string): {
	repository: string | null;
	tag: string | null;
	digest: string | null;
} {
	const at = image.lastIndexOf("@");
	const digest = at === -1 ? null : image.slice(at + 1);
	const withoutDigest = at === -1 ? image : image.slice(0, at);
	const lastSlash = withoutDigest.lastIndexOf("/");
	const lastColon = withoutDigest.lastIndexOf(":");
	if (lastColon > lastSlash) {
		return {
			repository: withoutDigest.slice(0, lastColon),
			tag: withoutDigest.slice(lastColon + 1),
			digest,
		};
	}
	return { repository: withoutDigest, tag: null, digest };
}

function productFromRepository(repository: string | null): CloudProduct {
	if (!repository) return "unknown";
	if (/(^|\/)notploy-cloud$/.test(repository)) return "cloud";
	if (/(^|\/)notploy-console$/.test(repository)) return "console";
	if (/(^|\/)notploy$/.test(repository)) return "self";
	return "unknown";
}

function resolveProduct(
	identityProduct: string | null,
	env: Map<string, string>,
	repository: string | null,
): CloudProduct {
	if (
		identityProduct === "cloud" ||
		identityProduct === "console" ||
		identityProduct === "self" ||
		identityProduct === "selfhosted"
	) {
		return identityProduct === "selfhosted" ? "self" : identityProduct;
	}
	const fromEnv = productFromEnv(env);
	if (fromEnv !== "unknown") return fromEnv;
	return productFromRepository(repository);
}

function productFromEnv(env: Map<string, string>): CloudProduct {
	const explicit = env.get("NOTPLOY_PRODUCT")?.trim().toLowerCase();
	if (explicit === "cloud") return "cloud";
	if (explicit === "console") return "console";
	if (explicit === "self" || explicit === "selfhosted") return "self";
	const flavor = env.get("NOTPLOY_FLAVOR")?.trim().toLowerCase();
	if (flavor === "cloud") return "cloud";
	if (flavor === "console") return "console";
	if (flavor === "self" || flavor === "selfhosted") return "self";
	if (env.get("IS_CLOUD")?.trim().toLowerCase() === "true") return "cloud";
	return "unknown";
}

export function readIdentity(configDir: string): IdentitySummary {
	const file = path.join(configDir, "identity", "identity.json");
	if (!fs.existsSync(file)) {
		return { present: false, path: file, product: null, instanceId: null };
	}
	try {
		const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
			string,
			unknown
		>;
		return {
			present: true,
			path: file,
			product: typeof raw.product === "string" ? raw.product : null,
			instanceId: typeof raw.instanceId === "string" ? raw.instanceId : null,
		};
	} catch {
		return {
			present: true,
			path: file,
			product: null,
			instanceId: null,
			issue: "identity.json exists but cannot be parsed.",
		};
	}
}

async function inspectService(
	docker: Docker,
	name: string,
): Promise<ServiceStatus | null> {
	const result = await docker.run(
		["service", "inspect", name, "--format", "{{json .}}"],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	if (result.code !== 0) return null;

	let spec: ServiceInspect;
	try {
		spec = JSON.parse(result.stdout) as ServiceInspect;
	} catch {
		return null;
	}

	const desired = spec.Spec?.Mode?.Replicated?.Replicas ?? 1;
	const tasks = await docker.run(
		[
			"service",
			"ps",
			name,
			"--filter",
			"desired-state=running",
			"--format",
			"{{.CurrentState}}",
		],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	const states = tasks.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const running = states.filter((state) => state.startsWith("Running")).length;
	const updateState = spec.UpdateStatus?.State ?? null;

	return {
		name,
		kind: "service",
		desiredReplicas: desired,
		runningReplicas: tasks.code === 0 ? running : null,
		state: updateState,
		image: spec.Spec?.TaskTemplate?.ContainerSpec?.Image ?? null,
		healthy:
			tasks.code === 0 &&
			desired > 0 &&
			running >= desired &&
			updateState !== "updating" &&
			updateState !== "paused" &&
			updateState !== "rollback_started",
		detail:
			updateState && updateState !== "completed"
				? `update state: ${updateState}`
				: undefined,
	};
}

async function inspectContainer(
	docker: Docker,
	name: string,
): Promise<ServiceStatus | null> {
	const result = await docker.run(
		["inspect", name, "--format", "{{json .State}}|{{json .Config.Image}}"],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	if (result.code !== 0) return null;
	const [stateJson, imageJson] = result.stdout.trim().split("|");
	let status = "unknown";
	try {
		status = (JSON.parse(stateJson) as { Status?: string }).Status ?? "unknown";
	} catch {
		// Keep the container visible with an unknown state.
	}
	let image: string | null = null;
	try {
		image = JSON.parse(imageJson) as string;
	} catch {
		// Optional field.
	}
	return {
		name,
		kind: "container",
		desiredReplicas: 1,
		runningReplicas: status === "running" ? 1 : 0,
		state: status,
		image,
		healthy: status === "running",
	};
}

async function findPostgresService(
	docker: Docker,
): Promise<ServiceStatus | null> {
	return inspectService(docker, "notploy-postgres");
}

interface ComposeContainer {
	ID?: string;
	Names?: string;
	Labels?: Record<string, string>;
	Image?: string;
	State?: string;
}

async function detectCompose(
	docker: Docker,
): Promise<{ found: boolean; image: string | null; env: Map<string, string> }> {
	const listed = await docker.run(
		[
			"ps",
			"-a",
			"--filter",
			"label=com.docker.compose.service=notploy",
			"--format",
			"{{json .}}",
		],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	if (listed.code !== 0 || !listed.stdout.trim()) {
		return { found: false, image: null, env: new Map() };
	}

	const lines = listed.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	for (const line of lines) {
		let entry: ComposeContainer;
		try {
			entry = JSON.parse(line) as ComposeContainer;
		} catch {
			continue;
		}
		const id = entry.ID;
		if (!id) continue;
		const inspected = await docker.run(
			["inspect", id, "--format", "{{json .Config.Env}}"],
			{ allowFailure: true, timeoutMs: 20_000 },
		);
		let env = new Map<string, string>();
		if (inspected.code === 0) {
			try {
				env = parseEnv(JSON.parse(inspected.stdout) as string[]);
			} catch {
				// Environment is optional for detection.
			}
		}
		return { found: true, image: entry.Image ?? null, env };
	}
	return { found: false, image: null, env: new Map() };
}

function capabilitiesFor(
	deployment: DeploymentMode,
	product: CloudProduct,
	serviceReady: boolean,
): CapabilitySet {
	const reasons: Record<string, string> = {};
	if (!serviceReady) {
		reasons.update = "The 'notploy' Swarm service was not found.";
	}
	if (deployment === "compose") {
		reasons.update =
			"Compose stacks are updated with 'docker compose', not by this CLI.";
	}
	if (deployment === "none") {
		reasons.update = "No supported Notploy installation was detected.";
	}
	if (product !== "cloud") {
		reasons.update = `The detected product is '${product}', not Cloud.`;
	}
	if (product === "unknown") {
		reasons.rollback = "The installation product is unknown.";
	}
	return {
		update: !reasons.update,
		rollback: Object.keys(reasons).length === 0 || product === "cloud",
		backup: product === "cloud" && deployment === "swarm" && serviceReady,
		health: product === "cloud",
		reasons,
	};
}

export async function detectInstallation(
	options: DetectInstallationOptions,
): Promise<Installation> {
	const env = options.env ?? process.env;
	const now = options.now ?? (() => new Date());
	const dockerAccess =
		options.dockerAccess ??
		(await detectDockerAccess(options.runner, { uid: options.uid }));
	const docker = options.docker ?? new Docker(options.runner, dockerAccess);

	const envConfigDir =
		env.NOTPLOY_CONFIG_PATH?.trim() || env.NOTPLOY_CONFIG_DIR?.trim() || null;

	const base: Installation = {
		detected: false,
		product: "unknown",
		deployment: "none",
		configDir: envConfigDir || DEFAULT_CONFIG_DIR,
		configDirSource: envConfigDir ? "environment" : "default",
		image: null,
		imageRepository: null,
		imageTag: null,
		imageDigest: null,
		installedVersion: null,
		releaseTag: null,
		services: [],
		identity: { present: false, path: "", product: null, instanceId: null },
		healthUrl: `http://127.0.0.1:${DEFAULT_PORT}`,
		capabilities: capabilitiesFor("none", "unknown", false),
		issues: [],
		discoveredAt: now().toISOString(),
		docker: dockerAccess,
	};

	if (!dockerAccess.available) {
		return {
			...base,
			issues: [
				dockerAccess.error
					? `Docker is unavailable: ${dockerAccess.error}`
					: "Docker is unavailable.",
			],
		};
	}

	const swarm = await docker.run(
		[
			"info",
			"--format",
			"{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}",
		],
		{ allowFailure: true, timeoutMs: 20_000 },
	);
	const [nodeState, controlAvailable] = swarm.stdout.trim().split("|");

	if (nodeState === "active") {
		const service = await inspectService(docker, "notploy");
		if (service) {
			const inspect = await docker.json<ServiceInspect>(
				["service", "inspect", "notploy", "--format", "{{json .}}"],
				{ timeoutMs: 20_000 },
			);
			const containerSpec = inspect.Spec?.TaskTemplate?.ContainerSpec;
			const serviceEnv = parseEnv(containerSpec?.Env);
			const image = service.image;
			const split = image
				? splitImage(image)
				: { repository: null, tag: null, digest: null };

			const mount = containerSpec?.Mounts?.find(
				(mount) => mount.Target === "/etc/notploy",
			);
			const configDir = mount?.Source?.trim() ? mount.Source : base.configDir;
			const configDirSource = mount?.Source
				? "service-mount"
				: base.configDirSource;

			const identity = readIdentity(configDir);
			const product = resolveProduct(
				identity.product,
				serviceEnv,
				split.repository,
			);

			const postgres = await findPostgresService(docker);
			const traefik = await inspectContainer(docker, "notploy-traefik");
			const services = [
				service,
				...(postgres ? [postgres] : []),
				...(traefik ? [traefik] : []),
			];

			const releaseTag =
				serviceEnv.get("RELEASE_TAG")?.trim() || split.tag || null;
			const installedVersion =
				normalizeCloudVersion(releaseTag) ?? normalizeCloudVersion(split.tag);

			const publishedPort =
				inspect.Endpoint?.Ports?.find((port) => port.PublishedPort)
					?.PublishedPort ?? DEFAULT_PORT;

			const issues: string[] = [];
			if (!controlAvailable || controlAvailable !== "true") {
				issues.push(
					"This host is not a Docker Swarm manager; mutating operations are refused.",
				);
			}
			if (
				product === "cloud" &&
				split.repository &&
				!/notploy-cloud$/.test(split.repository)
			) {
				issues.push(
					`The 'notploy' service runs ${split.repository}, which is not the Cloud image. Verify the installation before updating it.`,
				);
			}
			if (identity.issue) issues.push(identity.issue);
			if (!identity.present) {
				issues.push(
					`No instance identity found at ${identity.path || path.join(configDir, "identity", "identity.json")}.`,
				);
			}
			if (!installedVersion) {
				issues.push(
					"The installed Cloud version cannot be determined from RELEASE_TAG or the image tag.",
				);
			}

			const capabilities = capabilitiesFor("swarm", product, true);
			if (controlAvailable !== "true") {
				capabilities.update = false;
				capabilities.rollback = false;
				capabilities.backup = false;
				capabilities.reasons.update =
					"Docker Swarm is active but this node is not a manager.";
			}

			return {
				...base,
				detected: true,
				product,
				deployment: "swarm",
				configDir,
				configDirSource,
				image,
				imageRepository: split.repository,
				imageTag: split.tag,
				imageDigest: split.digest,
				installedVersion,
				releaseTag,
				services,
				identity,
				healthUrl: `http://127.0.0.1:${publishedPort}`,
				capabilities,
				issues,
			};
		}
	}

	const compose = await detectCompose(docker);
	if (compose.found) {
		const split = compose.image
			? splitImage(compose.image)
			: { repository: null, tag: null, digest: null };
		const identity = readIdentity(base.configDir);
		const product = resolveProduct(
			identity.product,
			compose.env,
			split.repository,
		);
		const releaseTag = compose.env.get("RELEASE_TAG")?.trim() || split.tag;
		return {
			...base,
			detected: true,
			product,
			deployment: "compose",
			image: compose.image,
			imageRepository: split.repository,
			imageTag: split.tag,
			imageDigest: split.digest,
			installedVersion:
				normalizeCloudVersion(releaseTag) ?? normalizeCloudVersion(split.tag),
			releaseTag,
			services: [
				{
					name: "notploy",
					kind: "container",
					desiredReplicas: 1,
					runningReplicas: null,
					state: null,
					image: compose.image,
					healthy: false,
					detail: "Docker Compose deployment",
				},
			],
			identity,
			capabilities: capabilitiesFor("compose", product, false),
			issues: [
				"This installation is managed by Docker Compose. The CLI reports its state but does not update it; use the documented 'docker compose pull' procedure.",
			],
		};
	}

	return {
		...base,
		issues: [
			"No Notploy Swarm service or Compose stack was found on this host.",
		],
	};
}

export function configDirWritable(configDir: string): boolean {
	try {
		fs.accessSync(configDir, fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
