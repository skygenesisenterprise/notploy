import { hostname } from "node:os";
import { relative, resolve } from "node:path";
import { docker, paths } from "@notploy/server/constants";

/**
 * Map a path Notploy holds inside its own container onto the path the Docker
 * daemon resolves it to on the host.
 *
 * A bind source is resolved by the daemon, not by the process that builds the
 * command, so both agree only when the configuration tree is mounted at the same
 * absolute path — what the regular install does. An instance that keeps its
 * configuration in a Docker volume (the development stack) would otherwise hand
 * the daemon a path that does not exist on the host, and Docker answers by
 * creating an empty directory there: the container starts with an empty mount
 * instead of failing.
 */
export const mapPathToHostTree = (
	containerPath: string,
	basePath: string,
	hostBasePath: string,
): string => {
	if (containerPath !== basePath && !containerPath.startsWith(`${basePath}/`)) {
		return containerPath;
	}

	if (hostBasePath === basePath) {
		return containerPath;
	}

	return resolve(hostBasePath, relative(basePath, containerPath));
};

let configHostPath: Promise<string | undefined> | undefined;

/** Where the daemon mounts this container's configuration tree from. */
const findConfigHostPath = async (): Promise<string | undefined> => {
	try {
		const self = await docker.getContainer(hostname()).inspect();
		return self.Mounts?.find(
			(mount) => mount.Destination === paths().BASE_PATH,
		)?.Source;
	} catch {
		// Not running in a container (a plain `pnpm dev`), or the daemon does not
		// let us inspect this container: its own path is all we know.
		return undefined;
	}
};

/**
 * Path to give the daemon as a bind source for something Notploy wrote inside
 * its own container. Paths outside the configuration tree are returned as they
 * are.
 */
export const toDockerHostPath = async (
	containerPath: string,
	serverId?: string | null,
): Promise<string> => {
	// On a remote server the files are written over SSH on that server, so the
	// path already is a path of the machine running the daemon.
	if (serverId) {
		return containerPath;
	}

	const { BASE_PATH } = paths();
	configHostPath ??= findConfigHostPath();
	const hostBasePath = await configHostPath;

	if (!hostBasePath) {
		return containerPath;
	}

	return mapPathToHostTree(containerPath, BASE_PATH, hostBasePath);
};
