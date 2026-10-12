import { NotployBot } from "./bot/lifecycle.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("entry");

async function main(): Promise<void> {
	const config = loadConfig();
	const bot = new NotployBot(config);

	const shutdown = async (signal: string): Promise<void> => {
		logger.info("Received shutdown signal", { signal });
		await bot.stop();
		process.exit(0);
	};

	process.once("SIGINT", () => void shutdown("SIGINT"));
	process.once("SIGTERM", () => void shutdown("SIGTERM"));

	await bot.start();
}

main().catch((error: unknown) => {
	logger.error("Fatal error", {
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	});
	process.exit(1);
});
