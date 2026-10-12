export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

function parseLogLevel(value: string | undefined): LogLevel {
	const normalized = value?.trim().toLowerCase();
	if (normalized && normalized in LEVEL_ORDER) {
		return normalized as LogLevel;
	}
	return "info";
}

export interface Logger {
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Minimal structured JSON logger. Discord.js's own debug output stays on
 * stdout; the bot's own logs are emitted as single-line JSON on stderr so
 * they remain easy to collect in container environments.
 */
export function createLogger(context = "discord", minLevel?: string): Logger {
	const threshold = LEVEL_ORDER[parseLogLevel(minLevel ?? process.env.DISCORD_LOG_LEVEL)];

	const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
		if (LEVEL_ORDER[level] < threshold) return;
		const entry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			context,
			...(meta ? { meta } : {}),
		};
		console.error(JSON.stringify(entry));
	};

	return {
		debug: (message, meta) => write("debug", message, meta),
		info: (message, meta) => write("info", message, meta),
		warn: (message, meta) => write("warn", message, meta),
		error: (message, meta) => write("error", message, meta),
	};
}
