import { CliError, ExitCode, usageError } from "../errors.js";

/**
 * Cloud release resolution.
 *
 * Notploy Cloud is published by `.github/workflows/docker-publish.yml` under
 * the tag suffix `-cloud` (for example `v1.2.3-cloud` publishes
 * `ghcr.io/skygenesisenterprise/notploy-cloud:v1.2.3-cloud`). The CLI resolves
 * target versions from those releases only; self-hosted (`-app`) releases are
 * never offered to a Cloud installation.
 */

export const NOTPLOY_GITHUB_REPOSITORY = "skygenesisenterprise/notploy";
export const CLOUD_RELEASE_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)-cloud$/;
export const CLOUD_TAG_SUFFIX = "-cloud";

/** The first Cloud release this CLI knows how to manage. */
export const MIN_SUPPORTED_CLOUD_VERSION = "1.0.0";

/** Major versions this CLI has been exercised against. */
export const MAX_TESTED_CLOUD_MAJOR = 1;

export interface VersionParts {
	major: number;
	minor: number;
	patch: number;
}

export interface CloudRelease {
	/** Release tag, also the image tag: `v1.2.3-cloud`. */
	tag: string;
	/** Normalized `1.2.3`. */
	version: string;
	parts: VersionParts;
	releaseUrl: string | null;
	publishedAt: string | null;
	assets: string[];
}

export interface ResolvedTarget {
	release: CloudRelease;
	source: "github-releases" | "explicit";
}

export interface CompatibilityReport {
	compatible: boolean;
	blockers: string[];
	warnings: string[];
}

export function parseVersionParts(input: string): VersionParts | null {
	const match = String(input)
		.trim()
		.match(/(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	const parts = {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
	return Object.values(parts).every((value) => Number.isSafeInteger(value))
		? parts
		: null;
}

/**
 * Normalizes a version-ish string. Container tags (`v1.2.3-cloud`), release
 * tags, `RELEASE_TAG` values and bare versions all collapse to `1.2.3`;
 * pre-release suffixes are preserved when they exist.
 */
export function normalizeCloudVersion(
	input: string | null | undefined,
): string | null {
	if (!input) return null;
	const cleaned = String(input)
		.trim()
		.replace(/-cloud$/i, "")
		.replace(/-app$/i, "");
	const match = cleaned.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
	if (!match) return null;
	const parts = parseVersionParts(match[1]);
	if (!parts) return null;
	return `${parts.major}.${parts.minor}.${parts.patch}`;
}

export function compareVersions(a: VersionParts, b: VersionParts): number {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	return a.patch - b.patch;
}

export function parseCloudReleaseTag(tag: string): CloudRelease | null {
	const match = CLOUD_RELEASE_PATTERN.exec(tag.trim());
	if (!match) return null;
	const parts = {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
	const version = `${parts.major}.${parts.minor}.${parts.patch}`;
	return {
		tag: `v${version}${CLOUD_TAG_SUFFIX}`,
		version,
		parts,
		releaseUrl: null,
		publishedAt: null,
		assets: [],
	};
}

export function cloudImageTag(version: string): string {
	const normalized = normalizeCloudVersion(version);
	if (!normalized) {
		throw usageError(`Invalid Cloud version "${version}".`);
	}
	return `v${normalized}${CLOUD_TAG_SUFFIX}`;
}

interface GitHubReleasePayload {
	draft?: boolean;
	prerelease?: boolean;
	tag_name?: string;
	html_url?: string;
	published_at?: string;
	assets?: { name?: string }[];
}

export type FetchLike = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export interface FetchReleasesOptions {
	fetchImpl?: FetchLike;
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
}

const RELEASES_URL = `https://api.github.com/repos/${NOTPLOY_GITHUB_REPOSITORY}/releases?per_page=100`;
const DEFAULT_RELEASES_TIMEOUT_MS = 15_000;

/**
 * Lists published Cloud releases, newest first. Drafts and pre-releases are
 * ignored: a Cloud installation must never be moved to an unreleased tag.
 */
export async function fetchCloudReleases(
	options: FetchReleasesOptions = {},
): Promise<CloudRelease[]> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const env = options.env ?? process.env;
	const timeoutMs = options.timeoutMs ?? DEFAULT_RELEASES_TIMEOUT_MS;

	let response: Response;
	try {
		response = await fetchImpl(RELEASES_URL, {
			method: "GET",
			headers: {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "notploy-cli",
				...(env.GITHUB_TOKEN
					? { Authorization: `Bearer ${env.GITHUB_TOKEN}` }
					: {}),
			},
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		throw new CliError(
			`Cannot reach the Notploy release index: ${
				error instanceof Error ? error.message : String(error)
			}`,
			{
				code: ExitCode.Api,
				hint: "Check outbound HTTPS access to api.github.com. --check/--dry-run require it; an offline diagnosis is still available with 'notploy cloud doctor --offline'.",
			},
		);
	}

	if (!response.ok) {
		const hint =
			response.status === 403 || response.status === 429
				? "The GitHub API rate limit was reached. Set GITHUB_TOKEN to raise it, or retry later."
				: "Check network access and GitHub availability, then retry.";
		throw new CliError(
			`The Notploy release index answered with HTTP ${response.status}.`,
			{ code: ExitCode.Api, hint },
		);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new CliError("The Notploy release index returned invalid JSON.", {
			code: ExitCode.Api,
		});
	}
	if (!Array.isArray(payload)) {
		throw new CliError(
			"The Notploy release index returned an unexpected payload.",
			{
				code: ExitCode.Api,
			},
		);
	}

	const releases = (payload as GitHubReleasePayload[])
		.filter((release) => !release?.draft && !release?.prerelease)
		.map((release) => {
			const parsed = parseCloudReleaseTag(String(release?.tag_name ?? ""));
			if (!parsed) return null;
			return {
				...parsed,
				releaseUrl: release.html_url ?? null,
				publishedAt: release.published_at ?? null,
				assets: (release.assets ?? [])
					.map((asset) => asset?.name)
					.filter((name): name is string => Boolean(name)),
			};
		})
		.filter((release): release is CloudRelease => release !== null)
		.sort((a, b) => compareVersions(b.parts, a.parts));

	if (releases.length === 0) {
		throw new CliError(
			"No published Notploy Cloud release was found in the release index.",
			{
				code: ExitCode.Api,
				hint: "Notploy Cloud releases use the tag suffix '-cloud'. Verify the release workflow completed, or pass an explicit --to <version> whose image you published.",
			},
		);
	}

	return releases;
}

export interface ResolveTargetOptions {
	currentVersion: string | null;
	releases: CloudRelease[];
	requested?: string;
}

/**
 * Selects the release to update to. Without `--to`, the newest Cloud release is
 * used. An explicit `--to` must match a published release: the CLI never pulls
 * an arbitrary tag that the release index does not vouch for.
 */
export function resolveCloudTarget(options: ResolveTargetOptions): {
	release: CloudRelease | null;
	reason: string;
} {
	if (options.requested) {
		const wanted = normalizeCloudVersion(options.requested);
		if (!wanted) {
			throw usageError(
				`Invalid target version "${options.requested}".`,
				"Use a version such as 1.2.3 or a release tag such as v1.2.3-cloud.",
			);
		}
		const release = options.releases.find(
			(candidate) => candidate.version === wanted,
		);
		if (!release) {
			throw usageError(
				`Notploy Cloud ${wanted} is not a published release.`,
				"Run 'notploy cloud update --check' to list the latest published version, or publish the release before targeting it.",
			);
		}
		return { release, reason: "explicit target" };
	}

	const current = normalizeCloudVersion(options.currentVersion);
	const latest = options.releases[0] ?? null;
	if (!latest) return { release: null, reason: "no release available" };
	if (!current) {
		return {
			release: latest,
			reason: "installed version could not be determined",
		};
	}
	const currentParts = parseVersionParts(current);
	if (!currentParts) {
		return {
			release: latest,
			reason: "installed version could not be parsed",
		};
	}
	if (compareVersions(latest.parts, currentParts) <= 0) {
		return { release: null, reason: "already up to date" };
	}
	return { release: latest, reason: "newer Cloud release available" };
}

export interface CompatibilityOptions {
	currentVersion: string | null;
	targetVersion: string;
	allowMajor?: boolean;
}

/**
 * Enforces the version-compatibility contract documented in the runbook:
 * forward updates only, at least the minimum supported version, and the same
 * major version unless `--allow-major` is passed explicitly. A cross-major
 * upgrade is never started by accident.
 */
export function checkCloudCompatibility(
	options: CompatibilityOptions,
): CompatibilityReport {
	const blockers: string[] = [];
	const warnings: string[] = [];
	const target = parseVersionParts(options.targetVersion);

	if (!target) {
		return {
			compatible: false,
			blockers: [
				`Target version "${options.targetVersion}" is not a valid semantic version.`,
			],
			warnings,
		};
	}

	const minimum = parseVersionParts(MIN_SUPPORTED_CLOUD_VERSION);
	if (minimum && compareVersions(target, minimum) < 0) {
		blockers.push(
			`Notploy Cloud ${options.targetVersion} is older than the minimum version this CLI supports (${MIN_SUPPORTED_CLOUD_VERSION}).`,
		);
	}

	const current = normalizeCloudVersion(options.currentVersion);
	if (!current) {
		blockers.push(
			"The installed Cloud version could not be determined, so compatibility cannot be verified.",
		);
	} else {
		const currentParts = parseVersionParts(current);
		if (currentParts) {
			const direction = compareVersions(target, currentParts);
			if (direction === 0) {
				blockers.push(`Notploy Cloud ${current} is already installed.`);
			} else if (direction < 0) {
				blockers.push(
					`Target ${options.targetVersion} is older than the installed version ${current}. Downgrades are not offered as updates; use 'notploy cloud rollback --plan' instead.`,
				);
			}
			if (currentParts.major !== target.major) {
				const message = `Cross-major update ${current} -> ${options.targetVersion} requires an explicit --allow-major and a verified database backup.`;
				if (options.allowMajor) warnings.push(message);
				else blockers.push(message);
			}
		}
	}

	if (target.major > MAX_TESTED_CLOUD_MAJOR) {
		warnings.push(
			`This CLI has been exercised against Cloud major version ${MAX_TESTED_CLOUD_MAJOR}; ${options.targetVersion} is newer and may expose an incompatible service layout.`,
		);
	}

	return { compatible: blockers.length === 0, blockers, warnings };
}
