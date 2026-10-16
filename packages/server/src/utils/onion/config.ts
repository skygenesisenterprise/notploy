import { join } from "node:path";
import { paths } from "@notploy/server/constants";
import {
	ONION_PORT_MAX,
	ONION_PORT_MIN,
	ONION_SERVICE_NAME_MESSAGE,
	ONION_SERVICE_NAME_REGEX,
} from "@notploy/server/db/schema";

/**
 * Layout of a managed Onion Service on disk and inside its Tor container.
 *
 * Everything a managed Onion Service owns lives in one directory inside the
 * instance configuration tree (`paths().ONION_PATH`), which is the volume that
 * already holds the Traefik configuration and the certificates:
 *
 * ```text
 * <ONION_PATH>/<onionServiceId>/
 * ├── torrc                 # generated, handed to Tor inside the container
 * └── data/                 # bind mounted on /var/lib/tor
 *     └── hidden_service/   # v3 identity: hs_ed25519_*_key + hostname
 * ```
 *
 * The torrc mount is writable: the Tor image runs Tor as an unprivileged user
 * and chowns its configuration directory on every start.
 *
 * The private key never leaves that directory: the database stores the path and
 * the public address only.
 */

export const TOR_CONTAINER_DATA_PATH = "/var/lib/tor";
export const TOR_CONTAINER_CONFIG_PATH = "/etc/tor/torrc";
export const TOR_HIDDEN_SERVICE_DIR_NAME = "hidden_service";
export const ONION_CONTAINER_PREFIX = "notploy-onion-";

/**
 * Conservative Docker image reference check. The image name ends up in a
 * generated `docker run` command, so anything that could break out of it is
 * refused instead of escaped silently.
 */
export const DOCKER_IMAGE_REFERENCE_REGEX =
	/^[a-zA-Z0-9][a-zA-Z0-9._\-/:@]{0,254}$/;

export interface OnionServicePaths {
	/** Directory owning the whole managed state of one onion service. */
	root: string;
	/** Bind mounted on the container's Tor data directory. */
	dataDir: string;
	/** Directory holding the v3 identity, inside `HiddenServiceDir`. */
	hiddenServiceDir: string;
	/** Generated `torrc`, bind mounted on `/etc/tor/torrc`. */
	torrcPath: string;
	hostnamePath: string;
	secretKeyPath: string;
	publicKeyPath: string;
	/** Name of the managed Tor container. */
	containerName: string;
	containerDataDir: string;
	containerHiddenServiceDir: string;
	containerConfigPath: string;
}

/** Docker only accepts `[a-zA-Z0-9][a-zA-Z0-9_.-]*` as a container name. */
export const toContainerSafeName = (value: string): string => {
	const sanitized = value.replace(/[^a-zA-Z0-9_.-]/g, "-");
	return /^[a-zA-Z0-9]/.test(sanitized) ? sanitized : `n${sanitized}`;
};

export const getOnionServicePaths = (
	onionServiceId: string,
	isServer = false,
): OnionServicePaths => {
	const { ONION_PATH } = paths(isServer);
	const root = join(ONION_PATH, onionServiceId);
	const dataDir = join(root, "data");
	const hiddenServiceDir = join(dataDir, TOR_HIDDEN_SERVICE_DIR_NAME);

	return {
		root,
		dataDir,
		hiddenServiceDir,
		torrcPath: join(root, "torrc"),
		hostnamePath: join(hiddenServiceDir, "hostname"),
		secretKeyPath: join(hiddenServiceDir, "hs_ed25519_secret_key"),
		publicKeyPath: join(hiddenServiceDir, "hs_ed25519_public_key"),
		containerName: toContainerSafeName(
			`${ONION_CONTAINER_PREFIX}${onionServiceId}`,
		),
		containerDataDir: TOR_CONTAINER_DATA_PATH,
		containerHiddenServiceDir: `${TOR_CONTAINER_DATA_PATH}/${TOR_HIDDEN_SERVICE_DIR_NAME}`,
		containerConfigPath: TOR_CONTAINER_CONFIG_PATH,
	};
};

export const assertOnionServiceName = (serviceName: string): string => {
	const value = serviceName.trim();

	if (!ONION_SERVICE_NAME_REGEX.test(value)) {
		throw new Error(ONION_SERVICE_NAME_MESSAGE);
	}

	return value;
};

export const assertOnionPort = (port: number, label = "Port"): number => {
	if (!Number.isInteger(port) || port < ONION_PORT_MIN || port > ONION_PORT_MAX) {
		throw new Error(`${label} must be an integer between 1 and 65535`);
	}

	return port;
};

export const assertDockerImageReference = (image: string): string => {
	const value = image.trim();

	if (!DOCKER_IMAGE_REFERENCE_REGEX.test(value)) {
		throw new Error(`Invalid Tor image reference: ${value}`);
	}

	return value;
};

/**
 * Errors surface in the API and the dashboard, and end up in the audit trail.
 * Docker stderr is useful, but a raw Tor startup log can quote key paths, so it
 * is reduced to a single bounded line.
 */
export const sanitizeOnionError = (
	error: unknown,
	fallback = "The Tor Onion Service operation failed",
): string => {
	const raw =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";

	const singleLine = raw.replace(/\s+/g, " ").trim();

	if (!singleLine) {
		return fallback;
	}

	return singleLine.slice(0, 500);
};

export const renderTorrc = ({
	hiddenServiceDir,
	serviceName,
	targetPort,
	virtualPort,
}: {
	hiddenServiceDir: string;
	serviceName: string;
	targetPort: number;
	virtualPort: number;
}): string => {
	const service = assertOnionServiceName(serviceName);
	const target = assertOnionPort(targetPort, "Target port");
	const virtual = assertOnionPort(virtualPort, "Virtual port");

	return [
		"# Managed by Notploy — do not edit by hand.",
		"# The address, the keys and this configuration are owned by the",
		"# Onion Service resource and are rewritten on every lifecycle action.",
		"DataDirectory /var/lib/tor",
		"# Tor is used strictly as a hidden service publisher: no SOCKS or",
		"# control port is exposed, not even on the container network.",
		"SocksPort 0",
		"ControlPort 0",
		`HiddenServiceDir ${hiddenServiceDir}`,
		"HiddenServiceVersion 3",
		`HiddenServicePort ${virtual} ${service}:${target}`,
		"",
	].join("\n");
};

/** Map a Docker container state to the Onion Service lifecycle status. */
export const onionStatusFromDockerState = (
	state: string | null | undefined,
): "running" | "stopped" | "idle" => {
	switch ((state ?? "").trim().toLowerCase()) {
		case "running":
		case "restarting":
			return "running";
		case "created":
		case "exited":
		case "paused":
		case "dead":
			return "stopped";
		default:
			return "idle";
	}
};
