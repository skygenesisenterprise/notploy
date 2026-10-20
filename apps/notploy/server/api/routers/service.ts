import {
	MOVE_SERVICE_TYPES,
	previewServiceMove,
} from "@notploy/server/services/service-move";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const movePreviewInput = z.object({
	serviceType: z.enum(MOVE_SERVICE_TYPES),
	serviceId: z.string().min(1),
	targetEnvironmentId: z.string().min(1),
});

export const serviceRouter = createTRPCRouter({
	/**
	 * Read-only preview of a logical move. Returns source/target, what is
	 * preserved without a redeploy, the recalculated permission boundary, and
	 * the target project's quota state. Cross-organization moves and targets
	 * the caller cannot access are refused before this returns.
	 */
	movePreview: protectedProcedure
		.input(movePreviewInput)
		.query(({ input, ctx }) => previewServiceMove({ ctx, ...input })),
});
