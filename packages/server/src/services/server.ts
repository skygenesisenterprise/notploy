import { db } from "@notploy/server/db";
import {
	type apiCreateServer,
	member,
	organization,
	server,
} from "@notploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { Client } from "ssh2";
import type { z } from "zod";

export type Server = typeof server.$inferSelect;

export const createServer = async (
	input: z.infer<typeof apiCreateServer>,
	organizationId: string,
) => {
	const newServer = await db
		.insert(server)
		.values({
			...input,
			organizationId: organizationId,
			createdAt: new Date().toISOString(),
		} as typeof server.$inferInsert)
		.returning()
		.then((value) => value[0]);

	if (!newServer) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the server",
		});
	}

	return newServer;
};

export const findServerById = async (serverId: string) => {
	const currentServer = await db.query.server.findFirst({
		where: eq(server.serverId, serverId),
		with: {
			deployments: true,
			sshKey: true,
		},
	});
	if (!currentServer) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Server not found",
		});
	}
	return currentServer;
};

/**
 * Removes the SSH private key material from a server record before it is sent
 * to a client. `findServerById` eagerly loads the `sshKey` relation (needed for
 * server-side SSH operations), but the private key must never leave the server:
 * no client feature consumes it, and returning it exposed it to any member with
 * only `server:read`. Server-side callers keep using `findServerById` directly.
 */
export const redactServerSshKey = <
	T extends { sshKey?: { privateKey: string } | null },
>(
	serverRecord: T,
): T => {
	if (!serverRecord.sshKey) {
		return serverRecord;
	}
	return {
		...serverRecord,
		sshKey: { ...serverRecord.sshKey, privateKey: "" },
	};
};

export const findServersByUserId = async (userId: string) => {
	const orgs = await db.query.organization.findMany({
		where: eq(organization.ownerId, userId),
		with: {
			servers: true,
		},
	});

	const servers = orgs.flatMap((org) => org.servers);

	return servers;
};

export const deleteServer = async (serverId: string) => {
	const currentServer = await db
		.delete(server)
		.where(eq(server.serverId, serverId))
		.returning()
		.then((value) => value[0]);

	return currentServer;
};

const runSshCommandWithPassword = async ({
	host,
	port,
	username,
	password,
	command,
}: {
	host: string;
	port: number;
	username: string;
	password: string;
	command: string;
}) => {
	return new Promise<void>((resolve, reject) => {
		const client = new Client();
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			client.end();
			if (error) reject(error);
			else resolve();
		};
		const timeout = setTimeout(
			() => finish(new Error("SSH connection timed out")),
			20_000,
		);

		client
			.once("ready", () => {
				client.exec(command, (error, stream) => {
					if (error) {
						finish(new Error(`Could not run SSH key setup: ${error.message}`));
						return;
					}

					let stderr = "";
					stream.stderr.on("data", (data: Buffer | string) => {
						stderr += data.toString();
					});
					stream.once("close", (code: number | null) => {
						if (code === 0) {
							finish();
						} else {
							finish(
								new Error(
									stderr.trim() || `SSH key setup exited with code ${code}`,
								),
							);
						}
					});
				});
			})
			.once("error", (error) => finish(error))
			.connect({
				host,
				port,
				username,
				password,
				readyTimeout: 20_000,
				timeout: 20_000,
			});
	});
};

export const installSshKeyWithPassword = async ({
	host,
	port,
	username,
	password,
	publicKey,
}: {
	host: string;
	port: number;
	username: string;
	password: string;
	publicKey: string;
}) => {
	const encodedPublicKey = Buffer.from(publicKey).toString("base64");
	const keyExpression = `key=$(printf '%s' '${encodedPublicKey}' | base64 -d)`;
	const authorizedKeys = '"$HOME/.ssh/authorized_keys"';
	const prepareSshDirectory =
		'umask 077; mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"; touch "$HOME/.ssh/authorized_keys"; chmod 600 "$HOME/.ssh/authorized_keys"';

	await runSshCommandWithPassword({
		host,
		port,
		username,
		password,
		command: `${prepareSshDirectory}; ${keyExpression}; if ! grep -qxF "$key" ${authorizedKeys}; then printf '%s\\n' "$key" >> ${authorizedKeys}; fi`,
	});
};

export const removeSshKeyWithPassword = async ({
	host,
	port,
	username,
	password,
	publicKey,
}: {
	host: string;
	port: number;
	username: string;
	password: string;
	publicKey: string;
}) => {
	const encodedPublicKey = Buffer.from(publicKey).toString("base64");
	const keyExpression = `key=$(printf '%s' '${encodedPublicKey}' | base64 -d)`;
	const authorizedKeys = '"$HOME/.ssh/authorized_keys"';

	await runSshCommandWithPassword({
		host,
		port,
		username,
		password,
		command: `${keyExpression}; if [ -f ${authorizedKeys} ]; then temp_file=$(mktemp); grep -vxF "$key" ${authorizedKeys} > "$temp_file"; status=$?; if [ "$status" -gt 1 ]; then rm -f "$temp_file"; exit "$status"; fi; cat "$temp_file" > ${authorizedKeys}; rm -f "$temp_file"; chmod 600 ${authorizedKeys}; fi`,
	});
};

export const haveActiveServices = async (serverId: string) => {
	const currentServer = await db.query.server.findFirst({
		where: eq(server.serverId, serverId),
		columns: { serverId: true },
		with: {
			applications: { columns: { applicationId: true } },
			compose: { columns: { composeId: true } },
			libsql: { columns: { libsqlId: true } },
			mariadb: { columns: { mariadbId: true } },
			mongo: { columns: { mongoId: true } },
			mysql: { columns: { mysqlId: true } },
			postgres: { columns: { postgresId: true } },
			redis: { columns: { redisId: true } },
		},
	});

	if (!currentServer) {
		return false;
	}

	const total =
		currentServer?.applications?.length +
		currentServer?.compose?.length +
		currentServer?.libsql?.length +
		currentServer?.mariadb?.length +
		currentServer?.mongo?.length +
		currentServer?.mysql?.length +
		currentServer?.postgres?.length +
		currentServer?.redis?.length;

	if (total === 0) {
		return false;
	}

	return true;
};

export const SERVICE_TYPES_BY_SERVER = [
	{ type: "application", relation: "applications", idColumn: "applicationId" },
	{ type: "compose", relation: "compose", idColumn: "composeId" },
	{ type: "postgres", relation: "postgres", idColumn: "postgresId" },
	{ type: "mysql", relation: "mysql", idColumn: "mysqlId" },
	{ type: "mariadb", relation: "mariadb", idColumn: "mariadbId" },
	{ type: "mongo", relation: "mongo", idColumn: "mongoId" },
	{ type: "redis", relation: "redis", idColumn: "redisId" },
	{ type: "libsql", relation: "libsql", idColumn: "libsqlId" },
] as const;

export interface ServerService {
	id: string;
	type: (typeof SERVICE_TYPES_BY_SERVER)[number]["type"];
	name: string;
	projectId: string;
	projectName: string;
	environmentId: string;
	environmentName: string;
	url: string;
}

export const getServicesByServerId = async (
	serverId: string,
): Promise<ServerService[]> => {
	const currentServer = await db.query.server.findFirst({
		where: eq(server.serverId, serverId),
		columns: { serverId: true },
		with: {
			applications: {
				columns: { applicationId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			compose: {
				columns: { composeId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			postgres: {
				columns: { postgresId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			mysql: {
				columns: { mysqlId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			mariadb: {
				columns: { mariadbId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			mongo: {
				columns: { mongoId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			redis: {
				columns: { redisId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
			libsql: {
				columns: { libsqlId: true, name: true },
				with: { environment: { with: { project: true } } },
			},
		},
	});

	if (!currentServer) {
		return [];
	}

	const services: ServerService[] = [];

	for (const { type, relation, idColumn } of SERVICE_TYPES_BY_SERVER) {
		const rows = currentServer[relation as keyof typeof currentServer] as Array<
			Record<string, any>
		>;

		for (const row of rows) {
			const projectId = row.environment.project.projectId as string;
			const environmentId = row.environment.environmentId as string;

			services.push({
				id: row[idColumn],
				type,
				name: row.name,
				projectId,
				projectName: row.environment.project.name as string,
				environmentId,
				environmentName: row.environment.name as string,
				url: `/dashboard/project/${projectId}/environment/${environmentId}/services/${type}/${row[idColumn]}`,
			});
		}
	}

	return services;
};

export const updateServerById = async (
	serverId: string,
	serverData: Partial<Server>,
) => {
	const result = await db
		.update(server)
		.set({
			...serverData,
		})
		.where(eq(server.serverId, serverId))
		.returning()
		.then((res) => res[0]);

	return result;
};

export const getAllServers = async () => {
	const servers = await db.query.server.findMany();
	return servers;
};

export const getAccessibleServerIds = async (session: {
	userId: string;
	activeOrganizationId: string;
}): Promise<Set<string>> => {
	const { userId, activeOrganizationId } = session;

	const allOrgServers = await db.query.server.findMany({
		where: eq(server.organizationId, activeOrganizationId),
		columns: {
			serverId: true,
		},
	});

	const memberRecord = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, activeOrganizationId),
		),
		columns: { accessedServers: true, role: true },
	});

	if (memberRecord?.role === "owner" || memberRecord?.role === "admin") {
		return new Set(allOrgServers.map((s) => s.serverId));
	}

	return new Set(memberRecord?.accessedServers ?? []);
};
