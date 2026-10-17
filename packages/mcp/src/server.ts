/**
 * Backwards-compatible module path.
 *
 * The server implementation now lives in `protocol/server.ts`; existing
 * imports of `./server.js` (tests, embedders) keep working.
 */
export {
  buildMcpServer,
  type CreateRuntimeOptions,
  closeRuntime,
  closeServerParts,
  createRuntime,
  createServer,
  createServerParts,
  type McpRuntime,
  type ServerParts,
} from "./protocol/server.js";
