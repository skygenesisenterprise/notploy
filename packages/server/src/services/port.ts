import { db } from "@notploy/server/db";
import { type apiCreatePort, ports } from "@notploy/server/db/schema";
import { findPortConflict } from "@notploy/server/utils/network/ports";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";

export type Port = typeof ports.$inferSelect;

export const findPortsByApplicationId = async (
	applicationId: string,
): Promise<Port[]> => {
	return db.query.ports.findMany({
		where: eq(ports.applicationId, applicationId),
	});
};

export const createPort = async (input: z.infer<typeof apiCreatePort>) => {
	const newPort = await db
		.insert(ports)
		.values({
			...input,
		})
		.returning()
		.then((value) => value[0]);

	if (!newPort) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting port",
		});
	}

	return newPort;
};

/**
 * Serializes port writes for one application with a transaction-scoped
 * advisory lock. Application-level validation alone is check-then-write: two
 * concurrent requests can both read the same mappings and both insert a
 * mapping Docker/Swarm will collapse, which is the lost-mapping bug #5509.
 * A unique index would be stronger but cannot be added safely on installations
 * that already contain duplicates, so the lock keeps existing data untouched.
 */
export const createPortChecked = async (
	input: z.infer<typeof apiCreatePort>,
) => {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${input.applicationId}))`,
		);
		const existingPorts = await tx.query.ports.findMany({
			where: eq(ports.applicationId, input.applicationId),
		});
		const conflict = findPortConflict(input, existingPorts);
		if (conflict) {
			throw new TRPCError({ code: "BAD_REQUEST", message: conflict.message });
		}
		const created = await tx.insert(ports).values(input).returning();
		const port = created[0];
		if (!port) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error input: Inserting port",
			});
		}
		return port;
	});
};

export const updatePortChecked = async (
	portId: string,
	applicationId: string,
	input: Pick<
		Port,
		"publishedPort" | "targetPort" | "protocol" | "publishMode"
	>,
) => {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${applicationId}))`,
		);
		const existingPorts = await tx.query.ports.findMany({
			where: eq(ports.applicationId, applicationId),
		});
		const conflict = findPortConflict(
			input,
			existingPorts.filter((entry) => entry.portId !== portId),
		);
		if (conflict) {
			throw new TRPCError({ code: "BAD_REQUEST", message: conflict.message });
		}
		const result = await tx
			.update(ports)
			.set(input)
			.where(eq(ports.portId, portId))
			.returning();
		return result[0];
	});
};

export const finPortById = async (portId: string) => {
	const result = await db.query.ports.findFirst({
		where: eq(ports.portId, portId),
		with: {
			application: {
				columns: {
					applicationId: true,
				},
			},
		},
	});
	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Port not found",
		});
	}
	return result;
};

export const removePortById = async (portId: string) => {
	const result = await db
		.delete(ports)
		.where(eq(ports.portId, portId))
		.returning();

	return result[0];
};

export const updatePortById = async (
	portId: string,
	portData: Partial<Port>,
) => {
	const result = await db
		.update(ports)
		.set({
			...portData,
		})
		.where(eq(ports.portId, portId))
		.returning();

	return result[0];
};
