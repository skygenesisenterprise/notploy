export const DEFAULT_REDACTED_FIELDS = [
  "env",
  "buildArgs",
  "composeFile",
  "dockerCompose",
  "buildSecrets",
  "previewBuildSecrets",
  "password",
  "currentPassword",
  "appPassword",
  "databasePassword",
  "databaseRootPassword",
  "redisPassword",
  "mariadbPassword",
  "mongoPassword",
  "mysqlPassword",
  "postgresPassword",
  "registryPassword",
  "token",
  "accessToken",
  "appToken",
  "apiToken",
  "botToken",
  "refreshToken",
  "secret",
  "clientSecret",
  "apiKey",
  "approvalToken",
  "authorization",
  "cookie",
  "headers",
  "secretAccessKey",
  "accessKey",
  "licenseKey",
  "userKey",
  "privateKey",
  "privateKeyPass",
  "encPrivateKey",
  "encPrivateKeyPass",
  "sshKey",
  "sshPrivateKey",
  "customGitSSHKey",
  "dockerAuth",
];

const REDACTED_PLACEHOLDER = "[REDACTED]";

/**
 * Replaces exact secret values inside strings.
 *
 * Field-based redaction cannot catch a credential that a server echoes back in
 * an error message. This second pass removes values the MCP server knows are
 * secret (API key, approval token) wherever they appear.
 */
export function redactKnownSecrets<T>(value: T, secrets: readonly string[]): T {
  const known = secrets.filter((secret) => secret.length >= 8);
  if (known.length === 0) return value;
  return walkStrings(value, (text) => {
    let result = text;
    for (const secret of known) {
      result = result.split(secret).join(REDACTED_PLACEHOLDER);
    }
    return result;
  });
}

function walkStrings<T>(value: T, transform: (text: string) => string): T {
  if (typeof value === "string") return transform(value) as T;
  if (Array.isArray(value)) return value.map((item) => walkStrings(item, transform)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      const isUnsafeKey = key === "__proto__" || key === "constructor" || key === "prototype";
      // A credential can also be used as a map key; redact it there too.
      out[isUnsafeKey ? key : transform(key)] = walkStrings(item, transform);
    }
    return out as T;
  }
  return value;
}

export function redactSensitive<T>(data: T, fields: string[]): T {
  if (fields.length === 0) return data;
  const suffixes = fields.map((f) => f.toLowerCase());
  return walk(data, suffixes, new WeakSet()) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function walk(value: unknown, suffixes: string[], seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return value.map((item) => walk(item, suffixes, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = Object.create(null);
    for (const [key, val] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      const loweredKey = key.toLowerCase();
      if (suffixes.some((suffix) => loweredKey.endsWith(suffix))) {
        out[key] = val === null || val === undefined ? val : REDACTED_PLACEHOLDER;
      } else {
        out[key] = walk(val, suffixes, seen);
      }
    }
    return out;
  }
  return value;
}
