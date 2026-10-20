import { redactSecrets, redactSecretValues } from "../security/redact";

/**
 * Redacts credentials from rclone command strings.
 *
 * Kept as a named helper for existing call sites; the actual policy lives in
 * the central `security/redact` module so S3 flags, URL credentials, private
 * keys and provider tokens share one implementation.
 */
export const redactRcloneCredentials = (command: string): string => {
	return redactSecrets(command);
};

/**
 * Redacts an error raised while backing up to a specific destination. The
 * destination values are masked literally, in addition to the structural
 * patterns, so a provider that echoes only the secret (without its flag name)
 * cannot leak it into notifications or logs.
 */
export const redactBackupError = (
	error: unknown,
	destination?: { accessKey?: string | null; secretAccessKey?: string | null },
): string =>
	redactSecretValues(error instanceof Error ? error.message : String(error), [
		destination?.accessKey,
		destination?.secretAccessKey,
	]);
