/**
 * Main-process logging.
 *
 * Two rules, both load-bearing:
 *
 * - Nothing reaches a log line unredacted. Everything passes through
 *   {@link redact}, which is the same function used for UI error messages, so
 *   an API key cannot leak through a debug line or a stack trace.
 * - A failure to log is never a failure of the app. Every filesystem call is
 *   guarded; if the log directory is unwritable the message goes to stderr.
 *
 * This module deliberately has no Electron import: the caller passes the
 * directory, which makes the logger usable from tests.
 */

import fs from "node:fs";
import path from "node:path";
import { redact } from "./client/errors";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
};

export interface Logger {
	trace(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, error?: unknown, ...args: unknown[]): void;
}

export interface FileLoggerOptions {
	/** Directory the log files are written to. Created if missing. */
	directory: string;
	/** Base name, e.g. `main` → `main-2026-09-29.log`. */
	basename?: string;
	/** Messages below this level are dropped. */
	level?: LogLevel;
	/** Also mirror to stdout/stderr. Off by default outside development. */
	mirrorToConsole?: boolean;
}

/** `null` logger, used by tests and by callers that opt out of logging. */
export const noopLogger: Logger = {
	trace: () => {},
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

function formatArgs(args: unknown[]): string {
	if (args.length === 0) return "";
	return ` ${args
		.map((arg) => {
			if (typeof arg === "string") return arg;
			try {
				return JSON.stringify(arg) ?? String(arg);
			} catch {
				return String(arg);
			}
		})
		.join(" ")}`;
}

function describeError(error: unknown): string {
	if (error === undefined) return "";
	if (error instanceof Error) {
		const lines = [`${error.name}: ${error.message}`];
		if (error.stack) lines.push(error.stack);
		const cause = (error as { cause?: unknown }).cause;
		if (cause !== undefined) lines.push(`caused by: ${describeError(cause)}`);
		return `\n${lines.join("\n")}`;
	}
	try {
		return `\n${JSON.stringify(error)}`;
	} catch {
		return `\n${String(error)}`;
	}
}

export function createFileLogger(options: FileLoggerOptions): Logger {
	const {
		directory,
		basename = "main",
		level = "info",
		mirrorToConsole = false,
	} = options;

	let stream: fs.WriteStream | undefined;
	let streamDay = "";
	let disabled = false;

	const fileFor = (day: string) =>
		path.join(directory, `${basename}-${day}.log`);

	const write = (messageLevel: LogLevel, text: string): void => {
		if (LEVEL_ORDER[messageLevel] < LEVEL_ORDER[level]) return;
		const line = `[${new Date().toISOString()}] ${messageLevel.toUpperCase()} ${redact(text)}\n`;
		if (mirrorToConsole) {
			if (messageLevel === "error" || messageLevel === "warn") {
				process.stderr.write(line);
			} else {
				process.stdout.write(line);
			}
		}
		if (disabled) return;
		try {
			const day = new Date().toISOString().slice(0, 10);
			if (!stream || streamDay !== day) {
				stream?.end();
				fs.mkdirSync(directory, { recursive: true });
				stream = fs.createWriteStream(fileFor(day), { flags: "a" });
				// A stream error (disk full, permissions) must not crash the app.
				stream.on("error", () => {
					disabled = true;
				});
				streamDay = day;
			}
			stream.write(line);
		} catch {
			disabled = true;
		}
	};

	const logger: Logger = {
		trace: (message, ...args) =>
			write("trace", `${message}${formatArgs(args)}`),
		debug: (message, ...args) =>
			write("debug", `${message}${formatArgs(args)}`),
		info: (message, ...args) => write("info", `${message}${formatArgs(args)}`),
		warn: (message, ...args) => write("warn", `${message}${formatArgs(args)}`),
		error: (message, error, ...args) =>
			write("error", `${message}${formatArgs(args)}${describeError(error)}`),
	};

	return logger;
}

/** The directory the log files are kept in, given Electron's `userData`. */
export function logDirectoryFor(userDataPath: string): string {
	return path.join(userDataPath, "logs");
}
