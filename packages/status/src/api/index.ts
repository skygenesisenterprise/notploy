/**
 * `@notploy/status/api` — HTTP surface of the platform, importable by any
 * host. The status application mounts `createStatusApi(ctx).fetch` in a
 * catch-all Next.js route handler.
 */
export { createStatusApi } from "./app";
export { createSnapshotApi } from "./snapshot-api";
export { buildOpenApiDocument, type OpenApiDocument } from "./openapi";
export { healthzHandler, readyzHandler } from "./health";
export { buildRssFeed } from "./rss";
export {
	corsPolicy,
	rateLimit,
	errorResponse,
	notFoundResponse,
	readJson,
	withIdempotency,
	clientIp,
	type Variables,
} from "./middleware";
