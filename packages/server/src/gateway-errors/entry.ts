import { startGatewayErrorsServer } from "./server";

const server = startGatewayErrorsServer();

const shutdown = (signal: string) => {
	console.log(JSON.stringify({ event: "gateway_errors_shutdown", signal }));
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
