/**
 * Runtime configuration.
 *
 * Every variable is documented in `.env.example` and the README. Nothing is
 * invented here: a misconfigured variable fails fast with a clear message
 * instead of silently degrading the platform.
 */
import { isAbsolute, resolve } from "node:path";

export interface StatusConfig {
	/** Directory holding `status.db`, `snapshot.json` and `backups/`. */
	dataDir: string;
	/** Absolute path of the SQLite database file. */
	databaseFile: string;
	/** Absolute path of the last-known-public-state snapshot. */
	snapshotFile: string;
	/** Absolute path of the backup directory. */
	backupDir: string;
	/** Canonical public origin, used for absolute links and the RSS feed. */
	publicUrl: string;
	/** Allowed CORS origins (`*` or an explicit list). */
	corsOrigins: string[];
	rateLimit: {
		windowMs: number;
		publicMax: number;
		adminMax: number;
	};
	/** Maximum accepted request body size, in bytes. */
	maxBodyBytes: number;
	/**
	 * Master key used to derive webhook signing keys. Webhook delivery is
	 * disabled when unset — no secret is ever stored in the database.
	 */
	secretKey: string | null;
	/** Interval of the notification outbox worker; `0` disables the worker. */
	outboxIntervalMs: number;
	/**
	 * Interval of the daily uptime sampler; `0` disables it (buckets then only
	 * advance on mutations).
	 */
	uptimeIntervalMs: number;
	/** Maximum delivery attempts before an outbox entry is parked as `dead`. */
	outboxMaxAttempts: number;
	/** How many backup files to keep. */
	backupRetention: number;
	logLevel: "debug" | "info" | "warn" | "error";
}

const intEnv = (
	env: Record<string, string | undefined>,
	key: string,
	fallback: number,
	min: number,
	max: number,
): number => {
	const raw = env[key];
	if (raw === undefined || raw === "") {
		return fallback;
	}
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) {
		throw new Error(`${key} must be an integer, got "${raw}"`);
	}
	return Math.min(max, Math.max(min, parsed));
};

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export const loadConfig = (
	env: Record<string, string | undefined> = process.env,
): StatusConfig => {
	const dataDir = resolve(env.STATUS_DATA_DIR ?? "./data");
	const port = env.PORT ?? "3000";
	return {
		dataDir,
		databaseFile: resolve(dataDir, "status.db"),
		snapshotFile: resolve(dataDir, "snapshot.json"),
		backupDir: resolve(dataDir, "backups"),
		publicUrl: (env.STATUS_PUBLIC_URL ?? `http://localhost:${port}`).replace(
			/\/+$/,
			"",
		),
		corsOrigins: (env.STATUS_CORS_ORIGINS ?? "*")
			.split(",")
			.map((origin) => origin.trim())
			.filter((origin) => origin.length > 0),
		rateLimit: {
			windowMs: intEnv(
				env,
				"STATUS_RATE_LIMIT_WINDOW_MS",
				60_000,
				1000,
				3_600_000,
			),
			publicMax: intEnv(env, "STATUS_RATE_LIMIT_PUBLIC_MAX", 240, 1, 100_000),
			adminMax: intEnv(env, "STATUS_RATE_LIMIT_ADMIN_MAX", 120, 1, 100_000),
		},
		maxBodyBytes: intEnv(env, "STATUS_MAX_BODY_BYTES", 65_536, 1024, 1_048_576),
		secretKey: env.STATUS_SECRET_KEY?.trim() || null,
		outboxIntervalMs: intEnv(
			env,
			"STATUS_OUTBOX_INTERVAL_MS",
			15_000,
			0,
			3_600_000,
		),
		uptimeIntervalMs: intEnv(
			env,
			"STATUS_UPTIME_INTERVAL_MS",
			300_000,
			0,
			86_400_000,
		),
		outboxMaxAttempts: intEnv(env, "STATUS_OUTBOX_MAX_ATTEMPTS", 6, 1, 100),
		backupRetention: intEnv(env, "STATUS_BACKUP_RETENTION", 14, 1, 365),
		logLevel: LOG_LEVELS.includes(
			(env.STATUS_LOG_LEVEL ?? "info") as (typeof LOG_LEVELS)[number],
		)
			? ((env.STATUS_LOG_LEVEL ?? "info") as StatusConfig["logLevel"])
			: "info",
	};
};

/** Resolve a possibly relative data dir against the current working dir. */
export const resolveDataDir = (value: string): string =>
	isAbsolute(value) ? value : resolve(value);
