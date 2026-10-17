import { getRegisteredSecrets } from "../observability/secrets.js";
import { DEFAULT_REDACTED_FIELDS, redactKnownSecrets, redactSensitive } from "./redactSensitive.js";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

let minimumLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

export function getLogLevel(): LogLevel {
  return minimumLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[minimumLevel];
}

class Logger {
  constructor(private context: string = "MCP-Server") {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return;

    // Field-based redaction catches known secret-bearing keys; the literal pass
    // catches credentials embedded in free-form error text.
    const safeMeta = meta
      ? redactKnownSecrets(redactSensitive(meta, DEFAULT_REDACTED_FIELDS), getRegisteredSecrets())
      : undefined;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { service: this.context, ...safeMeta },
    };

    // MCP stdio reserves stdout for the protocol; all diagnostics go to stderr.
    console.error(JSON.stringify(entry));
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

export function createLogger(context?: string) {
  return new Logger(context);
}
