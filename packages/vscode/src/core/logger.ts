import * as vscode from "vscode";
import { redact } from "./errors";

/**
 * Logging for the extension.
 *
 * - `Notploy` is a `LogOutputChannel`, so VS Code gives the user a level
 *   picker and a timestamped log without us writing any of that.
 * - `Notploy (Debug)` receives full diagnostics — stack traces, request
 *   metadata — for troubleshooting, and is never shown automatically.
 *
 * Secrets never reach either channel: everything goes through {@link redact}.
 */
export class Logger implements vscode.Disposable {
	private readonly logChannel: vscode.LogOutputChannel;
	private readonly debugChannel: vscode.OutputChannel;

	constructor() {
		this.logChannel = vscode.window.createOutputChannel("Notploy", {
			log: true,
		});
		this.debugChannel = vscode.window.createOutputChannel("Notploy (Debug)");
	}

	get outputChannel(): vscode.LogOutputChannel {
		return this.logChannel;
	}

	trace(message: string, ...args: unknown[]): void {
		this.logChannel.trace(interpolate(message, args));
	}

	debug(message: string, ...args: unknown[]): void {
		this.logChannel.debug(interpolate(message, args));
	}

	info(message: string, ...args: unknown[]): void {
		this.logChannel.info(interpolate(message, args));
	}

	warn(message: string, ...args: unknown[]): void {
		this.logChannel.warn(interpolate(message, args));
	}

	error(message: string, error?: unknown, ...args: unknown[]): void {
		this.logChannel.error(interpolate(message, args));
		if (error !== undefined) {
			this.debugChannel.appendLine(
				`[${new Date().toISOString()}] ${redact(message)}`,
			);
			this.debugChannel.appendLine(describeError(error));
			this.debugChannel.appendLine("");
		}
	}

	show(): void {
		this.logChannel.show(true);
	}

	showDebug(): void {
		this.debugChannel.show(true);
	}

	dispose(): void {
		this.logChannel.dispose();
		this.debugChannel.dispose();
	}
}

function interpolate(message: string, args: unknown[]): string {
	if (args.length === 0) return redact(message);
	const rendered = args.map((arg) =>
		typeof arg === "string" ? arg : safeStringify(arg),
	);
	return redact(`${message} ${rendered.join(" ")}`);
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

function describeError(error: unknown): string {
	if (error instanceof Error) {
		const lines = [`${error.name}: ${redact(error.message)}`];
		if (error.stack) {
			lines.push(redact(error.stack));
		}
		const cause = (error as { cause?: unknown }).cause;
		if (cause !== undefined) {
			lines.push(`caused by: ${describeError(cause)}`);
		}
		return lines.join("\n");
	}
	return safeStringify(error);
}
