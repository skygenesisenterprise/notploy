import chalk from "chalk";
import { type CliError, errorType } from "./errors.js";

let jsonMode = false;
let colorEnabled =
	process.env.NO_COLOR === undefined &&
	Boolean(process.stdout.isTTY || process.env.FORCE_COLOR);

export interface OutputOptions {
	json?: boolean;
	color?: boolean;
}

/**
 * Selects the output contract for the current invocation.
 *
 * In JSON mode stdout contains exactly one JSON document; every diagnostic
 * goes to stderr so shell pipelines can parse stdout safely.
 */
export function configureOutput(options: OutputOptions = {}): void {
	if (options.json !== undefined) {
		jsonMode = options.json;
	}
	if (options.color !== undefined) {
		colorEnabled = options.color;
	}
}

export function isJsonMode(): boolean {
	return jsonMode;
}

export function isColorEnabled(): boolean {
	return colorEnabled;
}

export function writeStdout(text: string): void {
	process.stdout.write(text);
}

export function writeStderr(text: string): void {
	process.stderr.write(text);
}

export function printLine(text = ""): void {
	writeStdout(`${text}\n`);
}

export function printDiagnostic(text: string): void {
	writeStderr(`${text}\n`);
}

export function printInfo(text: string): void {
	printDiagnostic(colorEnabled ? chalk.cyan(text) : text);
}

export function printWarning(text: string): void {
	printDiagnostic(
		colorEnabled ? chalk.yellow(`warning: ${text}`) : `warning: ${text}`,
	);
}

export function printSuccess(text: string): void {
	printDiagnostic(colorEnabled ? chalk.green(text) : text);
}

function stringify(value: unknown): string {
	try {
		return JSON.stringify(value ?? null, null, 2);
	} catch (error) {
		return JSON.stringify({
			error: {
				message: error instanceof Error ? error.message : String(error),
			},
		});
	}
}

/**
 * Prints a command result. Human output is stable enough for terminals, but
 * automation should use JSON mode.
 */
export function printResult(data: unknown): void {
	if (jsonMode) {
		writeStdout(`${stringify(data)}\n`);
		return;
	}

	if (data === null || data === undefined) {
		printLine("OK");
		return;
	}
	if (typeof data === "string") {
		printLine(data.endsWith("\n") ? data.slice(0, -1) : data);
		return;
	}
	printLine(stringify(data));
}

/**
 * Prints a normalized failure. JSON mode emits a machine-readable error object
 * on stdout and nothing else, while human mode writes to stderr.
 */
export function printError(error: CliError): void {
	if (jsonMode) {
		const payload: Record<string, unknown> = {
			code: error.code,
			type: errorType(error),
			message: error.message,
		};
		if (error.hint) payload.hint = error.hint;
		writeStdout(`${stringify({ error: payload })}\n`);
		return;
	}

	const prefix = colorEnabled ? chalk.red("error:") : "error:";
	printDiagnostic(`${prefix} ${error.message}`);
	if (error.hint) {
		printDiagnostic(colorEnabled ? chalk.gray(error.hint) : error.hint);
	}
}

/**
 * True when JSON was requested on the command line. Used for failures raised
 * before Commander has parsed options.
 */
export function wantsJson(argv: string[] = process.argv): boolean {
	return argv.includes("--json") || argv.includes("--output=json");
}
