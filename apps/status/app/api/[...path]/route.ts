/**
 * Catch-all mount point for the status engine HTTP application.
 *
 * The whole API — public, admin, integration, health probes and OpenAPI — is
 * a single Hono app; this handler forwards every `/api/*` (and `/healthz`,
 * `/readyz`) request to it, keeping the engine's routing, validation,
 * authorization and rate limiting testable without a browser.
 */
import { getPlatform } from "@/lib/engine";

export const dynamic = "force-dynamic";

const handle = async (request: Request): Promise<Response> => {
	const platform = getPlatform();
	return platform.api.fetch(request);
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
