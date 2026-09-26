export var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (LogLevel = {}));
class Logger {
    context;
    constructor(context = "MCP-Server") {
        this.context = context;
    }
    log(level, message, meta) {
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context: { service: this.context, ...meta },
        };
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(entry));
    }
    error(message, meta) {
        this.log(LogLevel.ERROR, message, meta);
    }
    warn(message, meta) {
        this.log(LogLevel.WARN, message, meta);
    }
    info(message, meta) {
        this.log(LogLevel.INFO, message, meta);
    }
    debug(message, meta) {
        this.log(LogLevel.DEBUG, message, meta);
    }
}
export function createLogger(context) {
    return new Logger(context);
}
