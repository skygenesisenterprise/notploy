import { existsSync, readFileSync } from "node:fs";
import { IS_CLOUD, NOTPLOY_TOR_IMAGE } from "@notploy/server/constants";
import { db } from "@notploy/server/db";
import {
	type apiCreateOnionService,
	type apiDeleteOnionService,
	type apiUpdateOnionService,
	ONION_VIRTUAL_PORT_DEFAULT,
	onionServices,
} from "@notploy/server/db/schema";
import { loadDockerCompose, loadDockerComposeRemote } from "@notploy/server/utils/docker/domain";
import { toDockerHostPath } from "@notploy/server/utils/docker/host-path";
import { getComposeContainer } from "@notploy/server/utils/docker/utils";
import {
	generateOnionIdentity,
	isOnionHostname,
	onionIdentityFiles,
} from "@notploy/server/utils/onion/address";
import {
	assertDockerNetworkName,
	assertOnionRuntimeInputs,
	type OnionServiceBindSources,
	getInspectOnionNetworkCommand,
	getInspectOnionServiceStatusCommand,
	getProvisionOnionServiceCommand,
	getReadOnionHostnameCommand,
	getRemoveOnionContainerCommand,
	getRemoveOnionStorageCommand,
	getRestartOnionServiceCommand,
	getStartOnionServiceCommand,
	getStopOnionServiceCommand,
} from "@notploy/server/utils/onion/commands";
import {
	assertOnionPort,
	assertOnionServiceName,
	getOnionServicePaths,
	type OnionServicePaths,
	onionStatusFromDockerState,
	renderTorrc,
	sanitizeOnionError,
} from "@notploy/server/utils/onion/config";
import { execAsync, execAsyncRemote } from "@notploy/server/utils/process/execAsync";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parse } from "yaml";
import type { z } from "zod";
import { findComposeById } from "./compose";

/**
 * Lifecycle of a managed Tor Onion Service.
 *
 * The service owns one Tor container per Onion Service, attached to the network
 * of the Compose project it publishes, and it never asks the Tor container for
 * anything but Tor: no Docker socket, no host access. Provisioning is split so
 * each step fails on its own — creating an Onion Service only writes the
 * protected configuration and the identity (so the address exists immediately),
 * while starting it launches the runtime. The Tor container therefore runs with
 * exactly the rights of a normal Compose service, and the target service is
 * never published on a host port.
 *
 * Managed Onion Services stay opt-in on hosted Cloud: `IS_CLOUD` refuses them
 * unless the operator deliberately sets `NOTPLOY_ALLOW_CLOUD_ONION_SERVICES`.
 */

export type OnionService = typeof onionServices.$inferSelect;
export type OnionServiceWithCompose = Awaited<
	ReturnType<typeof findOnionServiceById>
>;
export type OnionCompose = OnionServiceWithCompose["compose"];

const cloudOnionServicesOptIn = () =>
	["1", "true", "yes"].includes(
		(process.env.NOTPLOY_ALLOW_CLOUD_ONION_SERVICES ?? "").toLowerCase(),
	);

/**
 * Managed Onion Services are a self-hosted capability. Hosted Cloud tenants
 * need a separate security, abuse-prevention and operational review, so the
 * feature fails closed there instead of shipping by default.
 */
export const assertManagedOnionServicesEnabled = () => {
	if (IS_CLOUD && !cloudOnionServicesOptIn()) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Managed Tor Onion Services are disabled on Notploy Cloud. Enable them deliberately with NOTPLOY_ALLOW_CLOUD_ONION_SERVICES after a security review.",
		});
	}
};

const assertComposeSupportsOnionServices = (compose: OnionCompose) => {
	if (compose.composeType === "stack") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Managed Tor Onion Services are only supported for Docker Compose projects, not Swarm stacks",
		});
	}

	if (compose.randomize || compose.isolatedDeployment) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Managed Tor Onion Services are not supported on Compose projects using randomized or isolated deployments, because the deployed service names differ from the Compose file",
		});
	}
};

/**
 * Service names of a Compose project. Raw projects keep their file in the
 * database; every other source is read from disk (or over SSH) because Notploy
 * never parses the file it deployed from memory.
 */
export const listComposeServiceNames = async (
	compose: OnionCompose,
): Promise<string[]> => {
	if (compose.sourceType === "raw" && compose.composeFile?.trim()) {
		const parsed = parse(compose.composeFile) as {
			services?: Record<string, unknown>;
		} | null;

		return Object.keys(parsed?.services ?? {});
	}

	const spec = compose.serverId
		? await loadDockerComposeRemote(compose)
		: await loadDockerCompose(compose);

	return Object.keys(spec?.services ?? {});
};

const ensureTargetServiceExists = async (
	compose: OnionCompose,
	serviceName: string,
) => {
	const services = await listComposeServiceNames(compose);

	if (services.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"The Compose file of this project could not be read. Deploy the project once so Notploy can inspect its services, then try again",
		});
	}

	if (!services.includes(serviceName)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `The Compose project does not define a service named "${serviceName}"`,
		});
	}
};

/**
 * Pick the network the Tor container joins. The target service's own network is
 * preferred over the Compose default one, and `host`/`none` are refused: the
 * onion address must not turn into host network access.
 */
export const pickOnionNetwork = (
	networks: readonly (string | null | undefined)[],
): string | null => {
	const cleaned = [
		...new Set(
			networks
				.filter((network): network is string => typeof network === "string")
				.map((network) => network.trim())
				.filter((network) => network.length > 0),
		),
	];

	const usable = cleaned.filter(
		(network) => !["host", "none"].includes(network.toLowerCase()),
	);
	const preferred = usable.find((network) =>
		network.toLowerCase().includes("default"),
	);

	// `host` and `none` are never a fallback: publishing an onion address must
	// not silently imply host networking.
	return preferred ?? usable[0] ?? null;
};

const resolveOnionNetwork = async (
	compose: OnionCompose,
	serviceName: string,
) => {
	// A stopped project has no container to inspect, and the Compose default
	// network name is deterministic, so it is an acceptable fallback.
	const container = await getComposeContainer(compose, serviceName).catch(
		() => null,
	);
	const networks = Object.keys(
		(
			container as
				| { NetworkSettings?: { Networks?: Record<string, unknown> } }
				| null
				| undefined
		)?.NetworkSettings?.Networks ?? {},
	);

	const network =
		pickOnionNetwork(networks) ??
		(compose.appName ? `${compose.appName}_default` : null);

	if (!network) {
		throw new Error(
			"No Docker network could be resolved for this Compose project",
		);
	}

	return assertDockerNetworkName(network);
};

const runOnionCommand = async (
	serverId: string | null | undefined,
	command: string,
) => {
	if (serverId) {
		return await execAsyncRemote(serverId, command);
	}

	return await execAsync(command);
};

/**
 * Address Tor actually published. Used to verify a freshly generated identity
 * (and to recover the address when only the identity directory survived), so it
 * falls back to the mounted file when the container cannot be queried.
 */
const readPublishedOnionAddress = async (
	serverId: string | null | undefined,
	paths: OnionServicePaths,
): Promise<string | null> => {
	try {
		const { stdout } = await runOnionCommand(
			serverId,
			getReadOnionHostnameCommand(paths),
		);
		const candidate = stdout
			.trim()
			.split(/\s+/)
			.pop()
			?.toLowerCase();

		if (isOnionHostname(candidate)) {
			return candidate;
		}
	} catch {
		// The runtime is unreachable; the mounted identity is still authoritative.
	}

	if (!serverId && existsSync(paths.hostnamePath)) {
		try {
			const candidate = readFileSync(paths.hostnamePath, "utf8")
				.trim()
				.toLowerCase();

			if (isOnionHostname(candidate)) {
				return candidate;
			}
		} catch {
			// Unreadable identity file: report no address rather than a guess.
		}
	}

	return null;
};

export const findOnionServiceById = async (onionServiceId: string) => {
	const result = await db.query.onionServices.findFirst({
		where: eq(onionServices.onionServiceId, onionServiceId),
		with: {
			// The whole Compose row is loaded because the lifecycle reads the
			// deployed Compose file (and its networks) from disk or over SSH.
			// The API never returns it as-is: the routers map a narrow DTO.
			compose: {
				with: {
					environment: {
						columns: { environmentId: true, projectId: true },
						with: {
							project: {
								columns: { projectId: true, name: true, organizationId: true },
							},
						},
					},
				},
			},
		},
	});

	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Onion Service not found",
		});
	}

	return result;
};

export const findOnionServicesByComposeId = async (composeId: string) =>
	await db.query.onionServices.findMany({
		where: eq(onionServices.composeId, composeId),
		orderBy: [desc(onionServices.createdAt)],
	});

export const updateOnionService = async (
	onionServiceId: string,
	onionServiceData: Partial<OnionService>,
) => {
	const { onionServiceId: _ignoredId, ...rest } = onionServiceData;
	const result = await db
		.update(onionServices)
		.set({
			...rest,
			updatedAt: new Date(),
		})
		.where(eq(onionServices.onionServiceId, onionServiceId))
		.returning();

	return result[0];
};

/**
 * Create the protected configuration and a fresh v3 identity, then persist the
 * resource. Nothing is started here: `startOnionService` owns the runtime, so a
 * failed Tor start never loses the address.
 */
export const createOnionService = async (
	input: z.infer<typeof apiCreateOnionService>,
) => {
	assertManagedOnionServicesEnabled();

	const compose = await findComposeById(input.composeId);
	assertComposeSupportsOnionServices(compose);

	const serviceName = assertOnionServiceName(input.serviceName);
	const targetPort = assertOnionPort(input.targetPort, "Target port");
	const virtualPort = assertOnionPort(
		input.virtualPort ?? ONION_VIRTUAL_PORT_DEFAULT,
		"Virtual port",
	);

	await ensureTargetServiceExists(compose, serviceName);

	const existing = await db.query.onionServices.findFirst({
		where: and(
			eq(onionServices.composeId, compose.composeId),
			eq(onionServices.serviceName, serviceName),
			eq(onionServices.virtualPort, virtualPort),
		),
	});

	if (existing) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"This service already has a managed Onion Service for that virtual port",
		});
	}

	const onionServiceId = nanoid();
	const paths = getOnionServicePaths(onionServiceId, !!compose.serverId);
	const identity = generateOnionIdentity();
	const torrc = renderTorrc({
		hiddenServiceDir: paths.containerHiddenServiceDir,
		serviceName,
		targetPort,
		virtualPort,
	});
	const image = NOTPLOY_TOR_IMAGE;

	try {
		assertOnionRuntimeInputs({
			serviceName,
			targetPort,
			virtualPort,
			image,
			network: `${compose.appName}_default`,
		});

		// Provisioning happens before the row exists, so a failure leaves no
		// half-configured resource behind.
		await runOnionCommand(
			compose.serverId,
			getProvisionOnionServiceCommand({
				paths,
				torrc,
				files: onionIdentityFiles(identity),
			}),
		);
	} catch (error) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Could not provision the Tor Onion Service: ${sanitizeOnionError(
				error,
			)}`,
		});
	}

	const newOnionService = await db
		.insert(onionServices)
		.values({
			onionServiceId,
			name: input.name,
			composeId: compose.composeId,
			serviceName,
			targetPort,
			virtualPort,
			onionAddress: identity.onionAddress,
			identityPath: paths.root,
			status: "idle",
		})
		.returning()
		.then((value) => value[0]);

	if (!newOnionService) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Error input: Inserting the Onion Service",
		});
	}

	return newOnionService;
};

/**
 * Update the managed configuration. The identity is never regenerated: the
 * address only changes when the caller deletes the identity on purpose, so an
 * update keeps the same `.onion`.
 */
export const updateOnionServiceDefinition = async (
	input: z.infer<typeof apiUpdateOnionService>,
) => {
	const onionService = await findOnionServiceById(input.onionServiceId);
	const compose = onionService.compose;
	assertComposeSupportsOnionServices(compose);

	const serviceName = assertOnionServiceName(
		input.serviceName ?? onionService.serviceName,
	);
	const targetPort = assertOnionPort(
		input.targetPort ?? onionService.targetPort,
		"Target port",
	);
	const virtualPort = assertOnionPort(
		input.virtualPort ?? onionService.virtualPort,
		"Virtual port",
	);

	if (serviceName !== onionService.serviceName) {
		await ensureTargetServiceExists(compose, serviceName);
	}

	const conflicting = await db.query.onionServices.findFirst({
		where: and(
			eq(onionServices.composeId, compose.composeId),
			eq(onionServices.serviceName, serviceName),
			eq(onionServices.virtualPort, virtualPort),
		),
	});

	if (conflicting && conflicting.onionServiceId !== input.onionServiceId) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"This service already has a managed Onion Service for that virtual port",
		});
	}

	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!compose.serverId,
	);
	const torrc = renderTorrc({
		hiddenServiceDir: paths.containerHiddenServiceDir,
		serviceName,
		targetPort,
		virtualPort,
	});

	try {
		// Only the configuration is rewritten; the identity files stay put.
		await runOnionCommand(
			compose.serverId,
			getProvisionOnionServiceCommand({ paths, torrc }),
		);
	} catch (error) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Could not update the Tor configuration: ${sanitizeOnionError(
				error,
			)}`,
		});
	}

	const updated = await updateOnionService(onionService.onionServiceId, {
		name: input.name ?? onionService.name,
		serviceName,
		targetPort,
		virtualPort,
		identityPath: paths.root,
		lastError: null,
	});

	if (!updated) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Error input: Updating the Onion Service",
		});
	}

	// A running runtime must be restarted to pick up the new torrc; a stopped
	// one simply keeps the new configuration for its next start.
	const runtime = await getOnionServiceStatus(onionService.onionServiceId);
	if (runtime.status === "running") {
		return await startOnionService(onionService.onionServiceId);
	}

	return updated;
};

/**
 * The Tor container mounts the generated configuration from the daemon's
 * filesystem, which is not always the one this process sees: a path only works
 * as a bind source when the configuration tree is mounted at the same path on
 * the host.
 */
const getOnionServiceBindSources = async (
	paths: OnionServicePaths,
	serverId: string | null,
): Promise<OnionServiceBindSources> => ({
	dataDir: await toDockerHostPath(paths.dataDir, serverId),
	torrcPath: await toDockerHostPath(paths.torrcPath, serverId),
});

export const startOnionService = async (onionServiceId: string) => {
	const onionService = await findOnionServiceById(onionServiceId);
	const compose = onionService.compose;
	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!compose.serverId,
	);
	const bindSources = await getOnionServiceBindSources(
		paths,
		compose.serverId ?? null,
	);
	const network = await resolveOnionNetwork(compose, onionService.serviceName);

	try {
		const { stdout: inspectedNetwork } = await runOnionCommand(
			compose.serverId,
			getInspectOnionNetworkCommand(network),
		);

		if (!inspectedNetwork.trim()) {
			throw new Error(
				`The Docker network "${network}" does not exist. Deploy the Compose project first`,
			);
		}

		await updateOnionService(onionServiceId, {
			status: "deploying",
			lastError: null,
		});

		await runOnionCommand(
			compose.serverId,
			getStartOnionServiceCommand({
				paths,
				bindSources,
				image: NOTPLOY_TOR_IMAGE,
				network,
				onionServiceId: onionService.onionServiceId,
				composeId: compose.composeId,
			}),
		);

		const address =
			(await readPublishedOnionAddress(compose.serverId, paths)) ??
			onionService.onionAddress;

		return await updateOnionService(onionServiceId, {
			status: "running",
			onionAddress: address,
			lastError: null,
		});
	} catch (error) {
		const message = sanitizeOnionError(
			error,
			"The Tor container could not be started",
		);
		await updateOnionService(onionServiceId, {
			status: "error",
			lastError: message,
		});

		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message,
		});
	}
};

export const stopOnionService = async (onionServiceId: string) => {
	const onionService = await findOnionServiceById(onionServiceId);
	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!onionService.compose.serverId,
	);

	try {
		await runOnionCommand(
			onionService.compose.serverId,
			getStopOnionServiceCommand(paths),
		);
	} catch (error) {
		const message = sanitizeOnionError(
			error,
			"The Tor container could not be stopped",
		);
		await updateOnionService(onionServiceId, {
			status: "error",
			lastError: message,
		});

		throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
	}

	return await updateOnionService(onionServiceId, {
		status: "stopped",
		lastError: null,
	});
};

export const restartOnionService = async (onionServiceId: string) => {
	const onionService = await findOnionServiceById(onionServiceId);
	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!onionService.compose.serverId,
	);

	try {
		await runOnionCommand(
			onionService.compose.serverId,
			getRestartOnionServiceCommand(paths),
		);
	} catch {
		// No container yet (or it was removed): a restart then means a full start.
		return await startOnionService(onionServiceId);
	}

	const address = await readPublishedOnionAddress(
		onionService.compose.serverId,
		paths,
	);

	return await updateOnionService(onionServiceId, {
		status: "running",
		onionAddress: address ?? onionService.onionAddress,
		lastError: null,
	});
};

/**
 * Live runtime state, read from Docker. Read-only: the persisted status is only
 * changed by the lifecycle operations, so a query never rewrites the resource.
 */
export const getOnionServiceStatus = async (onionServiceId: string) => {
	const onionService = await findOnionServiceById(onionServiceId);
	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!onionService.compose.serverId,
	);

	let state: string | null = null;
	try {
		const { stdout } = await runOnionCommand(
			onionService.compose.serverId,
			getInspectOnionServiceStatusCommand(paths),
		);
		state = stdout.trim() || null;
	} catch {
		state = null;
	}

	if (!state || state === "missing") {
		return {
			status: "idle" as const,
			onionAddress: onionService.onionAddress,
			publishedAddress: null,
			containerState: state,
		};
	}

	const status = onionStatusFromDockerState(state);
	const publishedAddress =
		status === "running"
			? await readPublishedOnionAddress(onionService.compose.serverId, paths)
			: null;

	return {
		status,
		onionAddress: publishedAddress ?? onionService.onionAddress,
		publishedAddress,
		containerState: state,
	};
};

/**
 * Delete the managed runtime, the generated configuration and the resource.
 * Identity data (the address itself) is only removed when the caller asked for
 * it, so a delete stays recoverable by default.
 */
export const removeOnionService = async (
	input: z.infer<typeof apiDeleteOnionService>,
) => {
	const onionService = await findOnionServiceById(input.onionServiceId);
	const paths = getOnionServicePaths(
		onionService.onionServiceId,
		!!onionService.compose.serverId,
	);

	for (const command of [
		getRemoveOnionContainerCommand(paths),
		getRemoveOnionStorageCommand(paths, {
			deleteIdentity: input.deleteIdentity,
		}),
	]) {
		try {
			await runOnionCommand(onionService.compose.serverId, command);
		} catch {
			// The runtime or its storage may already be gone; the database row
			// must still be removed so the resource can be recreated.
		}
	}

	const result = await db
		.delete(onionServices)
		.where(eq(onionServices.onionServiceId, input.onionServiceId))
		.returning();

	return result[0] ?? onionService;
};
