import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
	execAsync,
	execAsyncRemote,
} from "@notploy/server/utils/process/execAsync";
import { and, eq } from "drizzle-orm";

import semver from "semver";
import { db } from "../db";
import { compose } from "../db/schema";
import {
	initializeStandaloneTraefik,
	initializeTraefikService,
	type TraefikOptions,
} from "../setup/traefik-setup";
export interface IUpdateData {
	/** Release tag of the newest self-hosted release, also the container image tag (`v1.2.3-app`). */
	latestVersion: string | null;
	updateAvailable: boolean;
}

export const DEFAULT_UPDATE_DATA: IUpdateData = {
	latestVersion: null,
	updateAvailable: false,
};

/** Repository publishing the Notploy releases. */
const NOTPLOY_GITHUB_REPOSITORY = "skygenesisenterprise/notploy";

/**
 * Self-hosted image published by .github/workflows/docker-publish.yml. Releases
 * are consumed from the GitHub Releases API, images from the GitHub Container
 * Registry, so no Docker Hub credential is involved anymore.
 */
export const NOTPLOY_IMAGE = `ghcr.io/${NOTPLOY_GITHUB_REPOSITORY}`;

/** Suffix docker-publish.yml appends to the self-hosted image: `v1.2.3-app` publishes `ghcr.io/skygenesisenterprise/notploy:v1.2.3-app`. */
const APP_TAG_SUFFIX = "-app";

/** Matches the self-hosted release tags only, so the other images of the publish matrix (`-cloud`, `-mcp`, ...) are ignored. */
const SELF_HOSTED_RELEASE_REGEX = /^v?(\d+)\.(\d+)\.(\d+)-app$/;

/** GitHub allows 60 anonymous requests per hour and IP, the dashboard polls this every few minutes. */
const RELEASES_CACHE_TTL_MS = 15 * 60 * 1000;
const RELEASES_REQUEST_TIMEOUT_MS = 10_000;
const RELEASES_URL = `https://api.github.com/repos/${NOTPLOY_GITHUB_REPOSITORY}/releases?per_page=100`;

interface SelfHostedRelease {
	/** Release tag, usable as is as the container image tag. */
	tag: string;
	version: semver.SemVer;
}

let releasesCache: { fetchedAt: number; releases: SelfHostedRelease[] } | undefined;

/** Returns current Notploy docker image tag or `latest` by default. */
export const getNotployImageTag = () => {
	return process.env.RELEASE_TAG || "latest";
};

/**
 * Turns a bare version into the published release tag (`1.2.3` becomes
 * `v1.2.3-app`). Channels such as `latest`, `canary`, `feature` or a branch name
 * are returned untouched, they are already valid image tags.
 */
export const toReleaseTag = (version: string) => {
	const tag = version.trim();
	const release =
		parseSelfHostedRelease(tag) ?? parseSelfHostedRelease(`${tag}-app`);
	return release?.tag ?? tag;
};

const parseSelfHostedRelease = (tag: string): SelfHostedRelease | null => {
	const match = SELF_HOSTED_RELEASE_REGEX.exec(tag.trim());
	if (!match) return null;

	const version = semver.parse(`${match[1]}.${match[2]}.${match[3]}`);
	if (!version) return null;

	return {
		tag: `v${match[1]}.${match[2]}.${match[3]}${APP_TAG_SUFFIX}`,
		version,
	};
};

const getLatestOf = (releases: SelfHostedRelease[]) =>
	releases.reduce<SelfHostedRelease | null>(
		(latest, release) =>
			!latest || semver.gt(release.version, latest.version) ? release : latest,
		null,
	);

const fetchSelfHostedReleases = async (): Promise<SelfHostedRelease[]> => {
	const now = Date.now();
	if (releasesCache && now - releasesCache.fetchedAt < RELEASES_CACHE_TTL_MS) {
		return releasesCache.releases;
	}

	const response = await fetch(RELEASES_URL, {
		method: "GET",
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "notploy",
			// A token is optional, it only raises the rate limit from 60 to 5000
			// requests per hour.
			...(process.env.GITHUB_TOKEN
				? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
				: {}),
		},
		signal: AbortSignal.timeout(RELEASES_REQUEST_TIMEOUT_MS),
	});

	// Rate limit, repository not reachable or GitHub outage: fall back to the
	// previously known releases instead of reporting that no update exists.
	if (!response.ok) {
		throw new Error(`GitHub Releases answered with ${response.status}`);
	}

	const releases = (await response.json()) as {
		draft?: boolean;
		prerelease?: boolean;
		tag_name?: string;
	}[];

	if (!Array.isArray(releases)) {
		throw new Error("Unexpected GitHub Releases payload");
	}

	const parsed = releases
		.filter((release) => !release?.draft && !release?.prerelease)
		.map((release) => parseSelfHostedRelease(String(release?.tag_name)))
		.filter((release): release is SelfHostedRelease => release !== null);

	releasesCache = { fetchedAt: now, releases: parsed };
	return parsed;
};

/** Returns the highest published self-hosted release, or `null` when none is reachable. */
const getLatestSelfHostedRelease = async () => {
	try {
		return getLatestOf(await fetchSelfHostedReleases());
	} catch (error) {
		// The update check is best-effort: an unreachable or rate-limited GitHub
		// must never surface as a server error in the logs on every call.
		console.warn(
			`Could not fetch releases from GitHub: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return getLatestOf(releasesCache?.releases ?? []);
	}
};

/** Returns the latest release tag and whether it is newer than the running version. */
export const getUpdateData = async (
	currentVersion: string,
	channel: string = getNotployImageTag(),
): Promise<IUpdateData> => {
	// `canary` and `feature` installations change too often to be updated from a
	// dashboard, and docker-publish.yml does not publish those tags: they update
	// themselves.
	if (["canary", "feature"].includes(channel)) {
		return DEFAULT_UPDATE_DATA;
	}

	const cleanedCurrent = semver.clean(currentVersion);
	const current = cleanedCurrent ? semver.parse(cleanedCurrent) : null;
	if (!current) return DEFAULT_UPDATE_DATA;

	const latestRelease = await getLatestSelfHostedRelease();
	if (!latestRelease) return DEFAULT_UPDATE_DATA;

	return {
		latestVersion: latestRelease.tag,
		updateAvailable: semver.gt(latestRelease.version, current),
	};
};

interface TreeDataItem {
	id: string;
	name: string;
	type: "file" | "directory";
	children?: TreeDataItem[];
}

export const readDirectory = async (
	dirPath: string,
	serverId?: string,
): Promise<TreeDataItem[]> => {
	if (serverId) {
		const { stdout } = await execAsyncRemote(
			serverId,
			`
process_items() {
    local parent_dir="$1"
    local __resultvar=$2

    local items_json=""
    local first=true
    for item in "$parent_dir"/*; do
        [ -e "$item" ] || continue
        process_item "$item" item_json
        if [ "$first" = true ]; then
            first=false
            items_json="$item_json"
        else
            items_json="$items_json,$item_json"
        fi
    done

    eval $__resultvar="'[$items_json]'"
}

process_item() {
    local item_path="$1"
    local __resultvar=$2

    local item_name=$(basename "$item_path")
    local escaped_name=$(echo "$item_name" | sed 's/"/\\"/g')
    local escaped_path=$(echo "$item_path" | sed 's/"/\\"/g')

    if [ -d "$item_path" ]; then
        # Is directory
        process_items "$item_path" children_json
        local json='{"id":"'"$escaped_path"'","name":"'"$escaped_name"'","type":"directory","children":'"$children_json"'}'
    else
        # Is file
        local json='{"id":"'"$escaped_path"'","name":"'"$escaped_name"'","type":"file"}'
    fi

    eval $__resultvar="'$json'"
}

root_dir=${dirPath}

process_items "$root_dir" json_output

echo "$json_output"
			`,
		);
		const result = JSON.parse(stdout);
		return result;
	}

	const stack = [dirPath];
	const result: TreeDataItem[] = [];
	const parentMap: Record<string, TreeDataItem[]> = {};

	while (stack.length > 0) {
		const currentPath = stack.pop();
		if (!currentPath) continue;

		const items = readdirSync(currentPath, { withFileTypes: true });
		const currentDirectoryResult: TreeDataItem[] = [];

		for (const item of items) {
			const fullPath = join(currentPath, item.name);
			if (item.isDirectory()) {
				stack.push(fullPath);
				const directoryItem: TreeDataItem = {
					id: fullPath,
					name: item.name,
					type: "directory",
					children: [],
				};
				currentDirectoryResult.push(directoryItem);
				parentMap[fullPath] = directoryItem.children as TreeDataItem[];
			} else {
				const fileItem: TreeDataItem = {
					id: fullPath,
					name: item.name,
					type: "file",
				};
				currentDirectoryResult.push(fileItem);
			}
		}

		if (parentMap[currentPath]) {
			parentMap[currentPath].push(...currentDirectoryResult);
		} else {
			result.push(...currentDirectoryResult);
		}
	}
	return result;
};

export const getDockerResourceType = async (
	resourceName: string,
	serverId?: string,
) => {
	try {
		let result = "";
		const command = `
RESOURCE_NAME="${resourceName}"
if docker service inspect "$RESOURCE_NAME" >/dev/null 2>&1; then
	echo "service"
elif docker inspect "$RESOURCE_NAME" >/dev/null 2>&1; then
	echo "standalone"
else
	echo "unknown"
fi`;

		if (serverId) {
			const { stdout } = await execAsyncRemote(serverId, command);
			result = stdout.trim();
		} else {
			const { stdout } = await execAsync(command);
			result = stdout.trim();
		}
		if (result === "service") {
			return "service";
		}
		if (result === "standalone") {
			return "standalone";
		}
		return "unknown";
	} catch (error) {
		console.error(error);
		return "unknown";
	}
};

export const reloadDockerResource = async (
	resourceName: string,
	serverId?: string,
	version?: string,
) => {
	const resourceType = await getDockerResourceType(resourceName, serverId);
	let command = "";
	if (resourceType === "service") {
		if (resourceName === "notploy") {
			const currentImageTag = getNotployImageTag();
			// `canary` and `feature` installations stay on their channel, every
			// other one moves to the released version when one is given.
			const imageTag =
				currentImageTag === "canary" || currentImageTag === "feature"
					? currentImageTag
					: toReleaseTag(version || currentImageTag);

			command = `docker service update --force --image ${NOTPLOY_IMAGE}:${imageTag} ${resourceName}`;
		} else {
			command = `docker service update --force ${resourceName}`;
		}
	} else if (resourceType === "standalone") {
		command = `docker restart ${resourceName}`;
	} else {
		throw new Error("Resource type not found");
	}
	if (serverId) {
		await execAsyncRemote(serverId, command);
	} else {
		await execAsync(command);
	}
};

export const readEnvironmentVariables = async (
	resourceName: string,
	serverId?: string,
) => {
	const resourceType = await getDockerResourceType(resourceName, serverId);
	let command = "";
	if (resourceType === "service") {
		command = `docker service inspect ${resourceName} --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'`;
	} else if (resourceType === "standalone") {
		command = `docker container inspect ${resourceName} --format '{{json .Config.Env}}'`;
	}
	let result = "";
	if (serverId) {
		const { stdout } = await execAsyncRemote(serverId, command);
		result = stdout.trim();
	} else {
		const { stdout } = await execAsync(command);
		result = stdout.trim();
	}
	if (result === "null") {
		return "";
	}
	return JSON.parse(result)?.join("\n");
};

export const readPorts = async (
	resourceName: string,
	serverId?: string,
): Promise<
	{ targetPort: number; publishedPort: number; protocol?: string }[]
> => {
	const resourceType = await getDockerResourceType(resourceName, serverId);
	let command = "";
	if (resourceType === "service") {
		command = `docker service inspect ${resourceName} --format '{{json .Spec.EndpointSpec.Ports}}'`;
	} else if (resourceType === "standalone") {
		command = `docker container inspect ${resourceName} --format '{{json .NetworkSettings.Ports}}'`;
	} else {
		throw new Error("Resource type not found");
	}
	let result = "";
	if (serverId) {
		const { stdout } = await execAsyncRemote(serverId, command);
		result = stdout.trim();
	} else {
		const { stdout } = await execAsync(command);
		result = stdout.trim();
	}

	if (result === "null") {
		return [];
	}

	const parsedResult = JSON.parse(result);

	if (resourceType === "service") {
		return parsedResult
			.map((port: any) => ({
				targetPort: port.TargetPort,
				publishedPort: port.PublishedPort,
				protocol: port.Protocol,
			}))
			.filter((port: any) => port.targetPort !== 80 && port.targetPort !== 443);
	}
	const ports: {
		targetPort: number;
		publishedPort: number;
		protocol?: string;
	}[] = [];
	const seenPorts = new Set<string>();
	for (const key in parsedResult) {
		if (Object.hasOwn(parsedResult, key)) {
			const containerPortMappings = parsedResult[key];
			const protocol = key.split("/")[1];
			const targetPort = Number.parseInt(key.split("/")[0] ?? "0", 10);

			// Take only the first mapping to avoid duplicates (IPv4 and IPv6)
			const firstMapping = containerPortMappings[0];
			if (firstMapping) {
				const publishedPort = Number.parseInt(firstMapping.HostPort, 10);
				const portKey = `${targetPort}-${publishedPort}-${protocol}`;
				if (!seenPorts.has(portKey)) {
					seenPorts.add(portKey);
					ports.push({
						targetPort: targetPort,
						publishedPort: publishedPort,
						protocol: protocol,
					});
				}
			}
		}
	}
	return ports.filter(
		(port: any) => port.targetPort !== 80 && port.targetPort !== 443,
	);
};

export const checkPortInUse = async (
	port: number,
	serverId?: string,
): Promise<{ isInUse: boolean; conflictingContainer?: string }> => {
	try {
		// Check if port is in use by a Docker container
		const dockerCommand = `docker ps -a --format '{{.Names}}' | grep -v '^notploy-traefik$' | while read name; do docker port "$name" 2>/dev/null | grep -q ':${port}' && echo "$name" && break; done || true`;
		const { stdout: dockerOut } = serverId
			? await execAsyncRemote(serverId, dockerCommand)
			: await execAsync(dockerCommand);

		const container = dockerOut.trim();

		if (container) {
			return {
				isInUse: true,
				conflictingContainer: `container "${container}"`,
			};
		}

		// Check if port is in use by a host-level service (non-Docker)
		// Notploy runs inside a container, so we spawn an ephemeral container
		// with --net=host to share the host's network stack and use nc -z to
		// check if something is listening on the port
		const hostCommand = `docker run --rm --net=host busybox sh -c 'nc -z 0.0.0.0 ${port} 2>/dev/null && echo in_use || echo free'`;
		const { stdout: hostOut } = serverId
			? await execAsyncRemote(serverId, hostCommand)
			: await execAsync(hostCommand);

		if (hostOut.includes("in_use")) {
			return {
				isInUse: true,
				conflictingContainer: "a host-level service",
			};
		}

		return { isInUse: false };
	} catch (error) {
		console.error("Error checking port availability:", error);
		return { isInUse: false };
	}
};

export const writeTraefikSetup = async (input: TraefikOptions) => {
	const resourceType = await getDockerResourceType(
		"notploy-traefik",
		input.serverId,
	);

	if (resourceType === "service") {
		await initializeTraefikService({
			env: input.env,
			additionalPorts: input.additionalPorts,
			serverId: input.serverId,
		});
		await reconnectServicesToTraefik(input.serverId);
	} else if (resourceType === "standalone") {
		await initializeStandaloneTraefik({
			env: input.env,
			additionalPorts: input.additionalPorts,
			serverId: input.serverId,
		});

		await reconnectServicesToTraefik(input.serverId);
	} else {
		throw new Error("Traefik resource type not found");
	}
};

export const reconnectServicesToTraefik = async (serverId?: string) => {
	const composeResult = await db.query.compose.findMany({
		where: and(
			...(serverId ? [eq(compose.serverId, serverId)] : []),
			eq(compose.isolatedDeployment, true),
		),
	});

	if (composeResult.length === 0) {
		return;
	}
	let commands = "";

	for (const compose of composeResult) {
		commands += `docker network connect ${compose.appName} $(docker ps --filter "name=notploy-traefik" -q) >/dev/null 2>&1\n`;
	}

	if (serverId) {
		await execAsyncRemote(serverId, commands);
	} else {
		await execAsync(commands);
	}
};
