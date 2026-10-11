/**
 * Notploy Status bridge.
 *
 * Every procedure is a thin pass-through to the status platform over HTTP
 * (`StatusPublisher`): the console never writes to the status database
 * itself. Incidents and maintenances created here are indistinguishable from
 * ones introduced on the status page or by the monitoring agent — they share
 * the same lifecycle, the same timeline and the same publication rules, so
 * both directions of the dialogue stay in sync.
 *
 * Owner/admin only: managing what the platform publicly communicates is a
 * platform-level decision, like the Blog page of the Website section.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { getStatusPublisher, loadStatusOverview, statusErrorMessage } from "@/lib/status";

const severity = z.enum(["minor", "major", "critical"]);
const incidentState = z.enum([
	"investigating",
	"identified",
	"monitoring",
	"resolved",
]);
const maintenanceState = z.enum([
	"scheduled",
	"in_progress",
	"completed",
	"cancelled",
]);
const visibility = z.enum(["public", "private"]);

type StatusClient = NonNullable<ReturnType<typeof getStatusPublisher>>;

/** Run a call against the configured status instance, mapping failures. */
const withStatus = async <T>(
	fn: (client: StatusClient) => Promise<T>,
): Promise<T> => {
	const client = getStatusPublisher();
	if (!client) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"The status integration is not configured. Set STATUS_URL and STATUS_TOKEN on the console server.",
		});
	}
	try {
		return await fn(client);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message: statusErrorMessage(error),
		});
	}
};

export const statusRouter = createTRPCRouter({
	/** Whole dialogue in one call: pages, components, incidents, maintenances. */
	overview: adminProcedure.query(() => loadStatusOverview()),

	/** Full incident timeline, internal entries included. */
	timeline: adminProcedure
		.input(z.object({ incidentId: z.string().min(1) }))
		.query(({ input }) =>
			withStatus((client) => client.getIncidentTimeline(input.incidentId)),
		),

	createIncident: adminProcedure
		.input(
			z.object({
				pageRef: z.string().min(1),
				title: z.string().min(1).max(160),
				description: z.string().max(4000).optional(),
				severity: severity.default("minor"),
				state: incidentState.default("investigating"),
				visibility: visibility.default("private"),
				published: z.boolean().default(false),
				componentIds: z.array(z.string().min(1)).max(50).default([]),
				correlationKey: z.string().min(1).max(200).optional(),
				updateMessage: z.string().min(1).max(4000).optional(),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.createIncident({
					...input,
					updateMessage: input.updateMessage,
				}),
			),
		),

	updateIncident: adminProcedure
		.input(
			z.object({
				incidentId: z.string().min(1),
				title: z.string().min(1).max(160).optional(),
				description: z.string().max(4000).optional(),
				severity: severity.optional(),
				visibility: visibility.optional(),
				componentIds: z.array(z.string().min(1)).max(50).optional(),
			}),
		)
		.mutation(({ input }) => {
			const { incidentId, ...patch } = input;
			return withStatus((client) => client.updateIncident(incidentId, patch));
		}),

	addIncidentUpdate: adminProcedure
		.input(
			z.object({
				incidentId: z.string().min(1),
				message: z.string().min(1).max(4000),
				state: incidentState.optional(),
				visibility: visibility.default("public"),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.addUpdate(input.incidentId, input.message, {
					state: input.state,
					visibility: input.visibility,
				}),
			),
		),

	setIncidentState: adminProcedure
		.input(
			z.object({
				incidentId: z.string().min(1),
				state: incidentState,
				message: z.string().min(1).max(4000).optional(),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.setState(input.incidentId, input.state, input.message),
			),
		),

	publishIncident: adminProcedure
		.input(
			z.object({
				incidentId: z.string().min(1),
				published: z.boolean(),
				visibility: visibility.optional(),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.publish(input.incidentId, input.published, input.visibility),
			),
		),

	deleteIncident: adminProcedure
		.input(z.object({ incidentId: z.string().min(1) }))
		.mutation(({ input }) =>
			withStatus((client) => client.deleteIncident(input.incidentId)),
		),

	createMaintenance: adminProcedure
		.input(
			z.object({
				pageRef: z.string().min(1),
				title: z.string().min(1).max(160),
				description: z.string().max(4000).optional(),
				startAt: z.string().min(1),
				endAt: z.string().min(1),
				timeZone: z.string().min(1).max(64).default("UTC"),
				componentIds: z.array(z.string().min(1)).max(50).default([]),
				visibility: visibility.default("private"),
				published: z.boolean().default(false),
			}),
		)
		.mutation(({ input }) => withStatus((client) => client.scheduleMaintenance(input))),

	setMaintenanceState: adminProcedure
		.input(
			z.object({
				maintenanceId: z.string().min(1),
				state: maintenanceState,
				message: z.string().min(1).max(4000).optional(),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.setMaintenanceState(
					input.maintenanceId,
					input.state,
					input.message,
				),
			),
		),

	publishMaintenance: adminProcedure
		.input(
			z.object({
				maintenanceId: z.string().min(1),
				published: z.boolean(),
				visibility: visibility.optional(),
			}),
		)
		.mutation(({ input }) =>
			withStatus((client) =>
				client.publish(input.maintenanceId, input.published, input.visibility),
			),
		),

	deleteMaintenance: adminProcedure
		.input(z.object({ maintenanceId: z.string().min(1) }))
		.mutation(({ input }) =>
			withStatus((client) => client.deleteMaintenance(input.maintenanceId)),
		),
});
