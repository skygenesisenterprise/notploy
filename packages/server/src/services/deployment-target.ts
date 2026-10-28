import { TRPCError } from "@trpc/server";
import { findServerById, getAccessibleServerIds } from "./server";

type Session = {
	userId: string;
	activeOrganizationId: string;
};

export type ValidatedDeploymentTarget = {
	serverId: string;
	name: string;
	serverType: "deploy" | "build";
	serverStatus: "active" | "inactive";
	sshKeyId: string | null;
};

/**
 * Authoritative deployment-target resolution.
 *
 * - `null` means explicit local execution on the Control Plane (allowed only
 *   when the caller opts into it).
 * - A string serverId is validated against organization ownership, the caller's
 *   accessible servers, active status, `deploy` role and SSH-key presence.
 * - Never trusts client input: organization + access checks happen here.
 * - Never returns secrets: only non-sensitive identity fields are exposed.
 */
export const validateDeploymentTarget = async ({
	serverId,
	session,
	allowLocal = true,
}: {
	serverId?: string | null;
	session: Session;
	allowLocal?: boolean;
}): Promise<ValidatedDeploymentTarget | null> => {
	if (!serverId) {
		if (!allowLocal) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"A deployment server must be selected. Local execution is not allowed for this workload.",
			});
		}
		return null;
	}

	const accessibleIds = await getAccessibleServerIds(session);
	if (!accessibleIds.has(serverId)) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this server",
		});
	}

	const server = await findServerById(serverId);
	if (server.organizationId !== session.activeOrganizationId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this server",
		});
	}

	if (server.serverType !== "deploy") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Build-only servers cannot be used as deployment targets. Select a deployment server.",
		});
	}

	if (server.serverStatus !== "active") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"The selected deployment server is disabled. Enable it before deploying.",
		});
	}

	if (!server.sshKeyId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"The selected deployment server is not connected over SSH. Connect it before deploying.",
		});
	}

	return {
		serverId: server.serverId,
		name: server.name,
		serverType: server.serverType,
		serverStatus: server.serverStatus,
		sshKeyId: server.sshKeyId,
	};
};

/**
 * Validates a build server reference (must be `build` role, active, connected).
 * Returns null when no build server is configured, which is the default.
 */
export const validateBuildServer = async ({
	buildServerId,
	session,
}: {
	buildServerId?: string | null;
	session: Session;
}) => {
	if (!buildServerId) return null;
	const accessibleIds = await getAccessibleServerIds(session);
	if (!accessibleIds.has(buildServerId)) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this build server",
		});
	}
	const server = await findServerById(buildServerId);
	if (server.organizationId !== session.activeOrganizationId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You are not authorized to access this build server",
		});
	}
	if (server.serverType !== "build") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Only build servers can be selected as build servers.",
		});
	}
	if (server.serverStatus !== "active") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The selected build server is disabled.",
		});
	}
	if (!server.sshKeyId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The selected build server is not connected over SSH.",
		});
	}
	return server;
};
