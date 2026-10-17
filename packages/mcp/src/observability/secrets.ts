/**
 * Process-local registry of credential values that must never appear in logs,
 * errors, audit records or tool results.
 *
 * Values are registered once by the configuration loader. They are compared
 * literally, which is what makes this useful against servers that echo a
 * credential back in an error message.
 */

const secrets = new Set<string>();

export function registerSecret(value: string | undefined): void {
  if (value && value.length >= 8) secrets.add(value);
}

export function getRegisteredSecrets(): string[] {
  return [...secrets];
}

/** Test helper. */
export function clearRegisteredSecrets(): void {
  secrets.clear();
}
