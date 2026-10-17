import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, ExitCode, usageError } from "./errors.js";

export interface Profile {
	url: string;
	token: string;
}

export interface ConfigFile {
	version: 1;
	currentProfile?: string;
	profiles: Record<string, Profile>;
}

export interface LoadedConfig {
	config: ConfigFile;
	path: string;
	legacyPath?: string;
}

export interface ResolveAuthOptions {
	profile?: string;
	url?: string;
	token?: string;
	/** Profile selected by an optional notploy.yaml manifest. */
	manifestProfile?: string;
	env?: NodeJS.ProcessEnv;
	cwd?: string;
}

export interface ResolvedAuth {
	url: string;
	token: string;
	profile?: string;
	source: "flags" | "env" | "profile" | "none";
}

const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 600_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Returns the OS-appropriate directory for user-level CLI configuration.
 *
 * `NOTPLOY_CONFIG_DIR` takes precedence and is useful for tests, CI and
 * sandboxed environments.
 */
export function getConfigDir(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
	home: string = os.homedir(),
): string {
	const override = env.NOTPLOY_CONFIG_DIR?.trim();
	if (override) {
		return path.resolve(override);
	}

	const pathImpl = platform === "win32" ? path.win32 : path.posix;

	if (platform === "win32") {
		const appData = env.APPDATA?.trim();
		return pathImpl.join(
			appData && pathImpl.isAbsolute(appData)
				? appData
				: pathImpl.join(home, "AppData", "Roaming"),
			"notploy",
		);
	}

	if (platform === "darwin") {
		return pathImpl.join(home, "Library", "Application Support", "notploy");
	}

	const xdg = env.XDG_CONFIG_HOME?.trim();
	return pathImpl.join(
		xdg && pathImpl.isAbsolute(xdg) ? xdg : pathImpl.join(home, ".config"),
		"notploy",
	);
}

export function getConfigPath(
	env: NodeJS.ProcessEnv = process.env,
	platform: NodeJS.Platform = process.platform,
): string {
	return path.join(getConfigDir(platform, env), "config.json");
}

/**
 * Location used by CLI 1.0.0, which wrote config.json inside the package
 * directory. Read-only migration support; new writes always use the user-level
 * config path.
 */
export function getLegacyConfigPath(): string {
	return fileURLToPath(new URL("../config.json", import.meta.url));
}

/**
 * Loads a .env file from the working directory without overriding variables
 * that are already present in the environment. Set NOTPLOY_NO_DOTENV=1 to
 * disable it.
 */
export function loadEnvFile(
	cwd: string = process.cwd(),
	env: NodeJS.ProcessEnv = process.env,
): void {
	if (env.NOTPLOY_NO_DOTENV === "1") return;

	const envPath = path.resolve(cwd, ".env");
	if (!fs.existsSync(envPath)) return;

	let content: string;
	try {
		content = fs.readFileSync(envPath, "utf8");
	} catch {
		return;
	}

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) continue;
		const key = trimmed.slice(0, eqIndex).trim();
		if (!key) continue;
		let value = trimmed.slice(eqIndex + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (env[key] === undefined) {
			env[key] = value;
		}
	}
}

export function migrateLegacyConfig(raw: unknown): ConfigFile | null {
	if (!isRecord(raw)) return null;
	if (
		typeof raw.url !== "string" ||
		typeof raw.token !== "string" ||
		raw.profiles !== undefined
	) {
		return null;
	}
	return {
		version: 1,
		currentProfile: "default",
		profiles: {
			default: { url: raw.url, token: raw.token },
		},
	};
}

function parseConfig(raw: unknown, source: string): ConfigFile {
	const migrated = migrateLegacyConfig(raw);
	if (migrated) return migrated;

	if (!isRecord(raw)) {
		throw usageError(`Invalid configuration in ${source}: expected an object.`);
	}
	if (raw.version !== 1) {
		throw usageError(
			`Unsupported configuration version in ${source}. Expected version 1.`,
		);
	}
	if (!isRecord(raw.profiles)) {
		throw usageError(
			`Invalid configuration in ${source}: "profiles" must be an object.`,
		);
	}

	const profiles: Record<string, Profile> = {};
	for (const [name, value] of Object.entries(raw.profiles)) {
		if (!PROFILE_NAME_PATTERN.test(name)) {
			throw usageError(`Invalid profile name "${name}" in ${source}.`);
		}
		if (
			!isRecord(value) ||
			typeof value.url !== "string" ||
			typeof value.token !== "string" ||
			!value.url.trim() ||
			!value.token.trim()
		) {
			throw usageError(
				`Invalid profile "${name}" in ${source}: "url" and "token" are required strings.`,
			);
		}
		profiles[name] = { url: value.url, token: value.token };
	}

	const currentProfile =
		typeof raw.currentProfile === "string" && raw.currentProfile.trim()
			? raw.currentProfile
			: undefined;

	return { version: 1, currentProfile, profiles };
}

/**
 * Reads user configuration. Missing files are not an error; malformed files
 * are, with the path included so users can fix them.
 */
export function readConfigFile(
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): LoadedConfig {
	const env = options.env ?? process.env;
	const configPath = options.path ?? getConfigPath(env);

	if (fs.existsSync(configPath)) {
		let raw: unknown;
		try {
			raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
		} catch (error) {
			throw usageError(
				`Cannot read ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
				"Fix or remove the file, then run 'notploy auth' again.",
			);
		}
		return { config: parseConfig(raw, configPath), path: configPath };
	}

	const legacyPath = getLegacyConfigPath();
	if (legacyPath !== configPath && fs.existsSync(legacyPath)) {
		try {
			const raw = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
			const legacy = migrateLegacyConfig(raw);
			if (legacy) {
				return { config: legacy, path: configPath, legacyPath };
			}
		} catch {
			// A broken legacy file must not prevent the new location from working.
		}
	}

	return {
		config: { version: 1, profiles: {} },
		path: configPath,
	};
}

function ensureConfigDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	try {
		fs.chmodSync(dir, 0o700);
	} catch {
		// Windows and some filesystems do not support POSIX modes.
	}
}

/**
 * Writes configuration atomically with restrictive permissions where the
 * platform supports them.
 */
export function writeConfigFile(
	config: ConfigFile,
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): string {
	const env = options.env ?? process.env;
	const configPath = options.path ?? getConfigPath(env);
	const dir = path.dirname(configPath);
	ensureConfigDir(dir);

	const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
	const payload = `${JSON.stringify(config, null, 2)}\n`;
	fs.writeFileSync(tempPath, payload, { encoding: "utf8", mode: 0o600 });
	try {
		fs.renameSync(tempPath, configPath);
	} catch {
		fs.rmSync(configPath, { force: true });
		fs.renameSync(tempPath, configPath);
	}
	try {
		fs.chmodSync(configPath, 0o600);
	} catch {
		// Best effort on Windows.
	}
	return configPath;
}

export function validateProfileName(name: string): string {
	const trimmed = name.trim();
	if (!PROFILE_NAME_PATTERN.test(trimmed)) {
		throw usageError(
			`Invalid profile name "${name}". Use letters, numbers, dots, dashes or underscores.`,
		);
	}
	return trimmed;
}

export function getProfile(
	name: string,
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): Profile | undefined {
	return readConfigFile(options).config.profiles[name];
}

export function listProfiles(
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): { currentProfile?: string; profiles: Array<{ name: string } & Profile> } {
	const { config } = readConfigFile(options);
	return {
		currentProfile: config.currentProfile,
		profiles: Object.entries(config.profiles)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, profile]) => ({ name, ...profile })),
	};
}

export function saveProfile(
	name: string,
	url: string,
	token: string,
	options: {
		env?: NodeJS.ProcessEnv;
		path?: string;
		makeCurrent?: boolean;
	} = {},
): string {
	const profileName = validateProfileName(name);
	const normalizedUrl = normalizeServerUrl(url);
	const normalizedToken = token.trim();
	if (!normalizedToken) {
		throw usageError("API key cannot be empty.");
	}

	const loaded = readConfigFile(options);
	const config: ConfigFile = {
		...loaded.config,
		profiles: {
			...loaded.config.profiles,
			[profileName]: { url: normalizedUrl, token: normalizedToken },
		},
	};
	if (options.makeCurrent !== false) {
		config.currentProfile = profileName;
	}
	return writeConfigFile(config, options);
}

export function removeProfile(
	name: string,
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): { removed: boolean; currentProfile?: string } {
	const profileName = validateProfileName(name);
	const loaded = readConfigFile(options);
	if (!loaded.config.profiles[profileName]) {
		return { removed: false, currentProfile: loaded.config.currentProfile };
	}

	const profiles = { ...loaded.config.profiles };
	delete profiles[profileName];
	let currentProfile = loaded.config.currentProfile;
	if (currentProfile === profileName) {
		currentProfile = Object.keys(profiles).sort((a, b) =>
			a.localeCompare(b),
		)[0];
	}

	writeConfigFile({ version: 1, currentProfile, profiles }, options);
	return { removed: true, currentProfile };
}

export function setCurrentProfile(
	name: string,
	options: { env?: NodeJS.ProcessEnv; path?: string } = {},
): void {
	const profileName = validateProfileName(name);
	const loaded = readConfigFile(options);
	if (!loaded.config.profiles[profileName]) {
		throw usageError(
			`Profile "${profileName}" does not exist.`,
			`Run 'notploy profile list' to see available profiles.`,
		);
	}
	writeConfigFile({ ...loaded.config, currentProfile: profileName }, options);
}

/**
 * Normalizes a server URL: adds a scheme when missing, removes trailing
 * slashes and a trailing /api, and rejects embedded credentials.
 */
export function normalizeServerUrl(input: string): string {
	let raw = input.trim();
	if (!raw) {
		throw usageError("Server URL cannot be empty.");
	}

	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
		const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(raw);
		raw = `${isLocal ? "http" : "https"}://${raw}`;
	}

	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw usageError(`Invalid server URL: ${input}`);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw usageError(
			`Unsupported server URL protocol "${url.protocol}". Use http or https.`,
		);
	}
	if (url.username || url.password) {
		throw usageError(
			"Server URL must not contain credentials. Use NOTPLOY_API_KEY or 'notploy auth'.",
		);
	}

	url.hash = "";
	url.search = "";
	let pathname = url.pathname.replace(/\/+$/, "");
	pathname = pathname.replace(/\/api$/, "");
	url.pathname = pathname;

	return url.toString().replace(/\/$/, "");
}

/**
 * Resolves credentials using the documented precedence:
 * explicit flags > environment > selected profile > legacy/default config.
 */
export function resolveAuth(options: ResolveAuthOptions = {}): ResolvedAuth {
	const env = options.env ?? process.env;
	const cwd = options.cwd ?? process.cwd();
	loadEnvFile(cwd, env);

	const loaded = readConfigFile({ env });
	const config = loaded.config;

	const explicitProfile = options.profile?.trim();
	const envProfile = env.NOTPLOY_PROFILE?.trim();
	const manifestProfile = options.manifestProfile?.trim();
	const selectedName =
		explicitProfile ??
		envProfile ??
		manifestProfile ??
		config.currentProfile ??
		(config.profiles.default ? "default" : undefined);

	const selected = selectedName ? config.profiles[selectedName] : undefined;
	if (
		selectedName &&
		!selected &&
		(explicitProfile || envProfile || manifestProfile)
	) {
		throw usageError(
			`Profile "${selectedName}" does not exist.`,
			`Run 'notploy profile list' to see available profiles.`,
		);
	}

	const flagUrl = options.url?.trim();
	const flagToken = options.token?.trim();
	const envUrl = env.NOTPLOY_URL?.trim();
	const envToken = (env.NOTPLOY_API_KEY ?? env.NOTPLOY_AUTH_TOKEN)?.trim();

	const url = flagUrl || envUrl || selected?.url;
	const token = flagToken || envToken || selected?.token;

	if (!url && !token) {
		throw usageError(
			"Not authenticated. No server URL or API key was found.",
			`Run 'notploy auth --url <url> --token <key>', set NOTPLOY_URL and NOTPLOY_API_KEY, or create a profile. Config: ${loaded.path}`,
		);
	}
	if (!url) {
		throw usageError(
			"Server URL is not configured.",
			"Set NOTPLOY_URL, pass --server-url, or run 'notploy auth'.",
		);
	}
	if (!token) {
		throw usageError(
			"API key is not configured.",
			"Set NOTPLOY_API_KEY, pass --api-token, or run 'notploy auth'.",
		);
	}

	const source: ResolvedAuth["source"] =
		flagUrl || flagToken
			? "flags"
			: envUrl || envToken
				? "env"
				: selected
					? "profile"
					: "none";

	return {
		url: normalizeServerUrl(url),
		token,
		profile: selectedName,
		source,
	};
}

export function resolveTimeout(
	flagValue?: string | number,
	env: NodeJS.ProcessEnv = process.env,
	fallbackMs: number = DEFAULT_TIMEOUT_MS,
): number {
	const raw = flagValue ?? env.NOTPLOY_TIMEOUT;
	if (raw === undefined || raw === null || raw === "") {
		return fallbackMs;
	}

	const parsed = typeof raw === "number" ? raw : Number(raw);
	if (
		!Number.isInteger(parsed) ||
		parsed < MIN_TIMEOUT_MS ||
		parsed > MAX_TIMEOUT_MS
	) {
		throw usageError(
			`Invalid timeout "${raw}". Use an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`,
		);
	}
	return parsed;
}

/**
 * Collects secret values for last-line redaction of server messages.
 * Best effort: a malformed config must not hide the original error.
 */
export function collectSecretValues(
	env: NodeJS.ProcessEnv = process.env,
): string[] {
	const secrets = new Set<string>();
	for (const key of ["NOTPLOY_API_KEY", "NOTPLOY_AUTH_TOKEN"]) {
		const value = env[key];
		if (value) secrets.add(value);
	}
	try {
		const { config } = readConfigFile({ env });
		for (const profile of Object.values(config.profiles)) {
			if (profile.token) secrets.add(profile.token);
		}
	} catch {
		// Ignore config errors while preparing redaction.
	}
	return [...secrets];
}

export function redactedProfile(profile: Profile): {
	url: string;
	token: string;
} {
	return { url: profile.url, token: "[REDACTED]" };
}

export function configPermissionWarning(
	configPath: string,
): string | undefined {
	if (process.platform === "win32") return undefined;
	try {
		const mode = fs.statSync(configPath).mode & 0o777;
		if ((mode & 0o077) !== 0) {
			return `Configuration file ${configPath} is accessible by other users (mode ${mode.toString(8)}). Run 'chmod 600 ${configPath}'.`;
		}
	} catch {
		// Missing file is handled by the caller.
	}
	return undefined;
}

export { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS };

export function configError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Usage, hint });
}
