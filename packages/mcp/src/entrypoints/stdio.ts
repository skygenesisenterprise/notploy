import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeRuntime, createRuntime } from "../protocol/server.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("MCP-Stdio");

export async function main(): Promise<void> {
  const runtime = await createRuntime();
  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);

  logger.info("MCP Notploy server running via stdio", {
    mode: runtime.catalog.summary.mode,
    tools: runtime.registry.size,
    environment: runtime.config.environment,
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down MCP server", { signal });
    void closeRuntime(runtime).finally(() => process.exit(0));
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
