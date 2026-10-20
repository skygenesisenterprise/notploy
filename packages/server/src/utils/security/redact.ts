/**
 * Central secret-redaction policy.
 *
 * Every log line, error message, notification payload and API response that can
 * carry user-supplied connection data (S3/rclone credentials, database
 * passwords, registry tokens, SSH keys, secret-provider values) must pass
 * through this module. Keeping the patterns here avoids per-provider ad hoc
 * expressions and makes the policy testable in one place.
 *
 * The goal is to preserve diagnostic context: flags, exit codes, container ids,
 * hosts and error reasons stay readable while only the secret *values* are
 * replaced with `[REDACTED]`.
 */

export const REDACTED = "[REDACTED]";

/**
 * Key names whose value is always a secret. Prefixes/suffixes are allowed so
 * `AWS_SECRET_ACCESS_KEY`, `databaseRootPassword` and `--s3-secret-access-key`
 * all match.
 */
const SENSITIVE_KEY =
	"[A-Za-z0-9_.-]*(?:password|passwd|pwd|secret(?:[_-]?access[_-]?key)?|token|api[_-]?key|access[_-]?key(?:[_-]?id)?|private[_-]?key|client[_-]?secret|credential|authorization)[A-Za-z0-9_.-]*";

/** A quoted string, handling backslash escapes, or a bare token. */
const VALUE =
	"(?:\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|[^\\s,;}\\]]+)";

const PRIVATE_KEY_BLOCK =
	/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi;

/**
 * Authorization values are opaque and schemes vary (`Bearer`, `Basic`, `ApiKey`,
 * `SSWS`, …). Redact the whole header value instead of trying to enumerate
 * schemes, otherwise an unknown scheme leaves its credential exposed.
 */
const AUTH_HEADER = /\b((?:proxy-)?authorization\s*[:=]\s*)[^\r\n]+/gi;

/** `--flag=value` (rclone, docker, CLI tools). */
const FLAG_ASSIGNMENT = new RegExp(
	`(--?${SENSITIVE_KEY}\\s*=\\s*)${VALUE}`,
	"gi",
);

/** `--flag value` (most POSIX CLI tools). */
const FLAG_SEPARATED = new RegExp(`(--?${SENSITIVE_KEY}\\s+)${VALUE}`, "gi");

/** `KEY=value`, `KEY: value`, `"KEY": "value"`, `KEY='value'`. */
const KEY_VALUE = new RegExp(
	`((?:^|[\\s,{;])["']?${SENSITIVE_KEY}["']?\\s*[:=]\\s*)${VALUE}`,
	"gi",
);

/**
 * Unquoted YAML-style values may contain spaces (`password: my secret`). The
 * generic key/value pattern stops at the first space, so redact the rest of the
 * line for colon-separated values that are not quoted/JSON/collection syntax.
 * This is intentionally conservative: losing the tail of one diagnostic line is
 * preferable to leaking a multi-word secret.
 */
const YAML_VALUE = new RegExp(
	`((?:^|[\\s,{;])["']?${SENSITIVE_KEY}["']?[ \\t]*:[ \\t]*)(?![\\s"'{[])([^\\r\\n]+)`,
	"gi",
);

/** Provider tokens that are recognisable without a key name. */
const KNOWN_TOKEN_PATTERNS: RegExp[] = [
	/\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[A-Z0-9]{12,20}\b/g,
	/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
	/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
	/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
	/\bsk_(?:live|test)_[A-Za-z0-9]{10,}\b/g,
	/\bglpat-[A-Za-z0-9_-]{16,}\b/g,
];

/**
 * Mask secret values in arbitrary text. Safe to call on user input, command
 * strings, stderr/stdout captured from a process, or serialized payloads.
 */
/** Keep the original quote style so redacted commands remain copy-pasteable. */
const maskValue = (match: string, prefix: string): string => {
	const value = match.slice(prefix.length);
	const quote = value[0];
	if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
		return `${prefix}${quote}${REDACTED}${quote}`;
	}
	return `${prefix}${REDACTED}`;
};

export const redactSecrets = (input: string): string => {
	if (!input) {
		return input;
	}

	let output = input;
	output = output.replace(PRIVATE_KEY_BLOCK, REDACTED);
	output = output.replace(URL_CREDENTIALS, `$1$2:${REDACTED}@`);
	output = output.replace(AUTH_HEADER, `$1${REDACTED}`);
	output = output.replace(FLAG_ASSIGNMENT, maskValue);
	output = output.replace(FLAG_SEPARATED, maskValue);
	output = output.replace(YAML_VALUE, maskValue);
	output = output.replace(KEY_VALUE, maskValue);

	for (const pattern of KNOWN_TOKEN_PATTERNS) {
		output = output.replace(pattern, REDACTED);
	}

	return output;
};

/**
 * Mask exact secret values that were collected at runtime (for example the S3
 * keys of a destination). Useful when the value appears outside any `key=value`
 * context, such as a raw CLI error that embeds only the secret.
 */
export const redactSecretValues = (
	input: string,
	values: Iterable<string | null | undefined>,
): string => {
	let output = redactSecrets(input);
	for (const value of values) {
		if (!value || value.length < 4) {
			continue;
		}
		output = output.split(value).join(REDACTED);
	}
	return output;
};

const isSensitiveKeyName = (key: string): boolean => {
	const normalized = key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
	return (
		/(password|passwd|pwd|secret|token|apikey|accesskey|privatekey|clientsecret|credential|authorization)/.test(
			normalized,
		) &&
		!/(count|total|enabled|enabledat|expires|expiry|type|length|name)$/.test(
			normalized,
		)
	);
};

/**
 * Recursively redact a structured value (log context, notification payload,
 * audit metadata). Returns a copy: callers' objects are never mutated.
 */
export const redactObject = <T>(value: T): T => {
	if (typeof value === "string") {
		return redactSecrets(value) as T;
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactObject(item)) as T;
	}
	if (value instanceof Error) {
		return {
			name: value.name,
			message: redactSecrets(value.message),
			stack: value.stack ? redactSecrets(value.stack) : undefined,
		} as T;
	}
	if (value && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			result[key] = isSensitiveKeyName(key) ? REDACTED : redactObject(entry);
		}
		return result as T;
	}
	return value;
};

/**
 * Normalize an unknown thrown value into a redacted message, keeping the
 * original error type/stack available to the caller for non-secret diagnostics.
 */
export const safeErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return redactSecrets(error.message);
	}
	return redactSecrets(String(error));
};

/**
 * Line-buffered redactor for streaming logs.
 *
 * A secret can be split across two chunks (`password=abc` + `def`), so we only
 * redact complete lines and keep the trailing partial line until the next chunk
 * arrives. Call `flush()` when the stream closes to emit the remaining text.
 */
const PRIVATE_KEY_BEGIN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g;
const PRIVATE_KEY_END = /-----END [A-Z0-9 ]*PRIVATE KEY-----/;

/**
 * Returns the index of a private-key block whose END marker has not arrived
 * yet. Emitting complete lines before that point would leak the key material
 * one line at a time, so the buffer holds the block until it is complete.
 */
const findOpenPrivateKey = (text: string): number => {
	let openIndex = -1;
	for (const match of text.matchAll(PRIVATE_KEY_BEGIN)) {
		const rest = text.slice((match.index ?? 0) + match[0].length);
		if (!PRIVATE_KEY_END.test(rest)) {
			openIndex = match.index ?? -1;
		}
	}
	return openIndex;
};

export const createRedactingLineBuffer = () => {
	let pending = "";
	return {
		push(chunk: string): string {
			if (!chunk) {
				return "";
			}
			pending += chunk;

			// A private key can span several lines: hold everything from an
			// unterminated BEGIN marker until its END marker arrives.
			let emit = pending;
			const openPrivateKey = findOpenPrivateKey(pending);
			if (openPrivateKey !== -1) {
				emit = pending.slice(0, openPrivateKey);
				pending = pending.slice(openPrivateKey);
			} else {
				pending = "";
			}

			const lastNewline = emit.lastIndexOf("\n");
			if (lastNewline === -1) {
				pending = emit + pending;
				return "";
			}
			const complete = emit.slice(0, lastNewline + 1);
			pending = emit.slice(lastNewline + 1) + pending;
			return redactSecrets(complete);
		},
		flush(): string {
			const remaining = redactSecrets(pending);
			pending = "";
			return remaining;
		},
	};
};
