/**
 * `@notploy/status/api` — HTTP surface of the platform, importable by any
 * host. The status application mounts `createStatusApi(ctx).fetch` in a
 * catch-all Next.js route handler.
 */
export { createStatusApi } from "./app";
export { healthzHandler, readyzHandler } from "./health";
export {
	clientIp,
	corsPolicy,
	errorResponse,
	notFoundResponse,
	rateLimit,
	readJson,
	type Variables,
	withIdempotency,
} from "./middleware";
export { buildOpenApiDocument, type OpenApiDocument } from "./openapi";
export { buildRssFeed } from "./rss";
export { createSnapshotApi } from "./snapshot-api";
