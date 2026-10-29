/**
 * Health endpoints.
 *
 * `healthz` answers "is the process alive" and works even when storage is
 * broken, so a supervisor can distinguish a dead process from a degraded one.
 * `readyz` answers "can this instance serve correct data" by probing the
 * storage. Neither endpoint discloses paths, versions of dependencies or any
 * infrastructure detail.
 */

import type { StatusContext } from "../services/context";
import { getSchemaVersion, pingDatabase } from "../store/db";

export const healthzHandler = (): Response =>
	Response.json(
		{ status: "ok", time: new Date().toISOString() },
		{ headers: { "cache-control": "no-store" } },
	);

export const readyzHandler = (ctx: StatusContext): Response => {
	const storageOk = pingDatabase(ctx.db);
	if (!storageOk) {
		return Response.json(
			{ status: "unavailable", storage: "error" },
			{ status: 503, headers: { "cache-control": "no-store" } },
		);
	}
	return Response.json(
		{
			status: "ready",
			storage: "ok",
			schemaVersion: getSchemaVersion(ctx.db),
		},
		{ headers: { "cache-control": "no-store" } },
	);
};
