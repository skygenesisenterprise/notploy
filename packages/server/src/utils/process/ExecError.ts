import { redactSecrets } from "../security/redact";

export interface ExecErrorDetails {
	command: string;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
	originalError?: Error;
	serverId?: string | null;
}

export class ExecError extends Error {
	public readonly command: string;
	public readonly stdout?: string;
	public readonly stderr?: string;
	public readonly exitCode?: number;
	public readonly originalError?: Error;
	public readonly serverId?: string | null;

	constructor(message: string, details: ExecErrorDetails) {
		// A failed command usually embeds the full command line (including
		// rclone S3 keys, registry tokens or database passwords) in both the
		// message and stdout/stderr. Redact at construction so no consumer can
		// accidentally forward the raw error to a log or notification.
		super(redactSecrets(message));
		this.name = "ExecError";
		this.command = redactSecrets(details.command);
		this.stdout = details.stdout
			? redactSecrets(details.stdout)
			: details.stdout;
		this.stderr = details.stderr
			? redactSecrets(details.stderr)
			: details.stderr;
		this.exitCode = details.exitCode;
		// Never keep the raw cause either: console inspectors and error
		// serializers expose its `message`/`cmd`, which still contain the
		// command line with plaintext credentials.
		this.originalError = details.originalError
			? new Error(redactSecrets(details.originalError.message))
			: undefined;
		this.serverId = details.serverId;

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ExecError);
		}
	}

	/**
	 * Get a formatted error message with all details
	 */
	getDetailedMessage(): string {
		const parts = [
			`Command: ${this.command}`,
			this.exitCode !== undefined ? `Exit Code: ${this.exitCode}` : null,
			this.serverId ? `Server ID: ${this.serverId}` : "Location: Local",
			this.stderr ? `Stderr: ${this.stderr}` : null,
			this.stdout ? `Stdout: ${this.stdout}` : null,
		].filter(Boolean);

		return `${this.message}\n${parts.join("\n")}`;
	}

	/**
	 * Check if this error is from a remote execution
	 */
	isRemote(): boolean {
		return !!this.serverId;
	}
}
