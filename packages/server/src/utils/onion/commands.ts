import { quote } from "shell-quote";
import type { OnionIdentityFiles } from "./address";
import {
	assertDockerImageReference,
	assertOnionPort,
	assertOnionServiceName,
	type OnionServicePaths,
} from "./config";

/**
 * Shell builders for the managed Tor runtime.
 *
 * These commands run through the same `execAsync` / `execAsyncRemote` helpers as
 * the Compose deployments, so they must be safe to interpolate: every value
 * either comes from the database (already validated by the API schemas), from
 * this module's own path layout, or from configuration — and each one is
 * re-validated and shell-quoted before it reaches a command line.
 */

const DOCKER_NETWORK_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

export const assertDockerNetworkName = (network: string): string => {
	const value = network.trim();

	if (!DOCKER_NETWORK_NAME_REGEX.test(value)) {
		throw new Error(`Invalid Docker network name: ${value}`);
	}

	return value;
};

/**
 * Sources to bind into the Tor container. They are the paths of the daemon's
 * filesystem, not the ones Notploy sees: the two only match when the
 * configuration tree is mounted at the same path (see `toDockerHostPath`).
 */
export interface OnionServiceBindSources {
	/** Directory holding the Tor data directory, including the v3 identity. */
	dataDir: string;
	/** Generated `torrc`. */
	torrcPath: string;
}

/** Base64 payloads keep binary key material off the generated command line. */
const writeFileCommand = (path: string, content: Buffer) => {
	const encoded = content.toString("base64");

	return `printf '%s' ${quote([encoded])} | base64 -d > ${quote([
		path,
	])}; chmod 600 ${quote([path])};`;
};

/**
 * Create the protected storage and write the generated `torrc` plus, on first
 * provisioning, the v3 identity Tor will pick up instead of minting its own.
 */
export const getProvisionOnionServiceCommand = ({
	paths,
	torrc,
	files,
}: {
	paths: OnionServicePaths;
	torrc: string;
	files?: OnionIdentityFiles;
}) => {
	const commands = [
		"set -e;",
		`install -d -m 0700 ${quote([paths.root])} ${quote([paths.dataDir])} ${quote([paths.hiddenServiceDir])};`,
		`rm -f ${quote([paths.torrcPath])};`,
		writeFileCommand(paths.torrcPath, Buffer.from(torrc, "utf8")),
	];

	if (files) {
		commands.push(
			writeFileCommand(paths.secretKeyPath, files.secretKey),
			writeFileCommand(paths.publicKeyPath, files.publicKey),
			writeFileCommand(paths.hostnamePath, files.hostname),
		);
	}

	return commands.join("\n");
};

export const getStartOnionServiceCommand = ({
	paths,
	bindSources,
	image,
	network,
	onionServiceId,
	composeId,
}: {
	paths: OnionServicePaths;
	bindSources: OnionServiceBindSources;
	image: string;
	network: string;
	onionServiceId: string;
	composeId: string;
}) => {
	const dockerImage = assertDockerImageReference(image);
	const dockerNetwork = assertDockerNetworkName(network);

	return [
		"set -e;",
		// A previous managed container is replaced, never reused: the runtime is
		// derived from the current configuration on every start.
		`docker rm -f ${quote([paths.containerName])} >/dev/null 2>&1 || true;`,
		"docker run -d",
		`--name ${quote([paths.containerName])}`,
		"--restart unless-stopped",
		// The image's healthcheck dials its control port, which the generated
		// torrc turns off on purpose: reporting the runtime unhealthy for that
		// would be noise. The container is a publisher, not a probe target.
		"--no-healthcheck",
		`--network ${quote([dockerNetwork])}`,
		`--label ${quote([`notploy.onionServiceId=${onionServiceId}`])}`,
		`--label ${quote([`notploy.composeId=${composeId}`])}`,
		// No `--publish`: the onion address is the only ingress, the target
		// service is never exposed on a host port by enabling an Onion Service.
		`-v ${quote([`${bindSources.dataDir}:${paths.containerDataDir}`])}`,
		// The mount stays writable on purpose: the image runs Tor as its
		// unprivileged `tor` user and chowns /etc/tor to it on every start. A
		// read-only mount fails that chown, leaving the torrc root-owned, and
		// Tor then exits with "Unable to open configuration file".
		`-v ${quote([`${bindSources.torrcPath}:${paths.containerConfigPath}`])}`,
		`${quote([dockerImage])};`,
	].join(" ");
};

/** Stopping an already stopped (or absent) runtime is a no-op, not a failure. */
export const getStopOnionServiceCommand = (paths: OnionServicePaths) =>
	`docker stop ${quote([paths.containerName])} >/dev/null 2>&1 || true`;

export const getRestartOnionServiceCommand = (paths: OnionServicePaths) =>
	`docker restart ${quote([paths.containerName])}`;

export const getRemoveOnionContainerCommand = (paths: OnionServicePaths) =>
	`docker rm -f ${quote([paths.containerName])} >/dev/null 2>&1 || true`;

export const getInspectOnionServiceStatusCommand = (paths: OnionServicePaths) =>
	`docker inspect -f '{{.State.Status}}' ${quote([paths.containerName])} 2>/dev/null || echo missing`;

/** Verify that the Docker network the Tor container will join exists. */
export const getInspectOnionNetworkCommand = (network: string) => {
	const dockerNetwork = assertDockerNetworkName(network);

	return `docker network inspect -f '{{.Name}}' ${quote([dockerNetwork])} 2>/dev/null || true`;
};

/** Read the address Tor published, for verification and reconciliation. */
export const getReadOnionHostnameCommand = (paths: OnionServicePaths) =>
	`docker exec ${quote([paths.containerName])} cat ${quote([
		`${paths.containerHiddenServiceDir}/hostname`,
	])} 2>/dev/null || true`;

/**
 * Remove the managed runtime and the generated configuration. Identity data is
 * only removed when the caller asked for it, so an accidental delete keeps the
 * address recoverable.
 */
export const getRemoveOnionStorageCommand = (
	paths: OnionServicePaths,
	{ deleteIdentity }: { deleteIdentity: boolean },
) =>
	deleteIdentity
		? `rm -rf ${quote([paths.root])}`
		: `rm -f ${quote([paths.torrcPath])}`;

/** Validate the runtime inputs of an Onion Service without touching the host. */
export const assertOnionRuntimeInputs = ({
	serviceName,
	targetPort,
	virtualPort,
	image,
	network,
}: {
	serviceName: string;
	targetPort: number;
	virtualPort: number;
	image: string;
	network: string;
}) => {
	assertOnionServiceName(serviceName);
	assertOnionPort(targetPort, "Target port");
	assertOnionPort(virtualPort, "Virtual port");
	assertDockerImageReference(image);
	assertDockerNetworkName(network);
};
