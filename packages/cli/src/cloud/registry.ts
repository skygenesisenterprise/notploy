import { createHash } from "node:crypto";
import { CliError, ExitCode, usageError } from "../errors.js";
import type { FetchLike } from "./release.js";

/**
 * OCI registry client used to pin a Cloud image tag to an immutable digest.
 *
 * The CLI never trusts a tag alone: it resolves the tag to the registry's
 * manifest digest, pulls `image@sha256:...`, and verifies that the pulled image
 * carries the same digest. This makes tag movement detectable even before the
 * signature check runs.
 */

export const DEFAULT_CLOUD_IMAGE = "ghcr.io/skygenesisenterprise/notploy-cloud";

const DEFAULT_REGISTRY_TIMEOUT_MS = 30_000;

const MANIFEST_ACCEPT = [
	"application/vnd.oci.image.index.v1+json",
	"application/vnd.docker.distribution.manifest.list.v2+json",
	"application/vnd.oci.image.manifest.v1+json",
	"application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

export interface ImageReference {
	registry: string;
	repository: string;
	/** `null` when the reference uses a digest. */
	tag: string | null;
	digest: string | null;
}

export interface ResolvedManifest {
	/** Canonical immutable reference: `<registry>/<repository>@sha256:...`. */
	reference: string;
	digest: string;
	mediaType: string;
	/** Total compressed layer size in bytes, when the manifest exposes it. */
	sizeBytes: number | null;
	platform: string | null;
}

const REGISTRY_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/;
const REPOSITORY_PATTERN = /^[a-z0-9]+([._/-][a-z0-9]+)*$/;
const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

/**
 * Parses and validates an image reference. The repository is constrained to
 * the OCI grammar so a value coming from a configuration file can never become
 * a path traversal or an extra CLI argument.
 */
export function parseImageReference(input: string): ImageReference {
	const raw = input.trim();
	if (!raw) throw usageError("Cloud image reference cannot be empty.");

	let digest: string | null = null;
	const atIndex = raw.indexOf("@");
	let rest = raw;
	if (atIndex !== -1) {
		digest = raw.slice(atIndex + 1);
		rest = raw.slice(0, atIndex);
		if (!DIGEST_PATTERN.test(digest)) {
			throw usageError(
				`Invalid image digest "${digest}". Expected sha256:<64 hex characters>.`,
			);
		}
	}

	let tag: string | null = null;
	const lastSlash = rest.lastIndexOf("/");
	const lastColon = rest.lastIndexOf(":");
	if (lastColon > lastSlash) {
		tag = rest.slice(lastColon + 1);
		rest = rest.slice(0, lastColon);
		if (!TAG_PATTERN.test(tag)) {
			throw usageError(`Invalid image tag "${tag}".`);
		}
	}

	const parts = rest.split("/");
	if (parts.length < 2) {
		throw usageError(
			`Invalid image reference "${input}". Expected <registry>/<repository>.`,
		);
	}
	const registry = parts.shift() as string;
	const repository = parts.join("/");

	if (!REGISTRY_PATTERN.test(registry)) {
		throw usageError(`Invalid registry host "${registry}".`);
	}
	if (
		!REPOSITORY_PATTERN.test(repository) ||
		repository.includes("..") ||
		repository.length > 255
	) {
		throw usageError(`Invalid repository path "${repository}".`);
	}
	if (!tag && !digest) {
		throw usageError(
			`Image reference "${input}" has neither a tag nor a digest.`,
		);
	}

	return { registry, repository, tag, digest };
}

export function formatImageReference(
	registry: string,
	repository: string,
	digest: string,
): string {
	return `${registry}/${repository}@${digest}`;
}

export type Platform = string;

export function defaultPlatform(arch: string = process.arch): Platform {
	switch (arch) {
		case "x64":
			return "linux/amd64";
		case "arm64":
			return "linux/arm64";
		case "arm":
			return "linux/arm/v7";
		case "ia32":
			return "linux/386";
		default:
			return `linux/${arch}`;
	}
}

interface RegistryManifestEnvelope {
	schemaVersion?: number;
	mediaType?: string;
	manifests?: Array<{
		digest?: string;
		platform?: { architecture?: string; os?: string; variant?: string };
	}>;
	layers?: Array<{ size?: number }>;
	config?: { size?: number };
}

export interface RegistryOptions {
	fetchImpl?: FetchLike;
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
	platform?: Platform;
}

function registryError(message: string, hint?: string): CliError {
	return new CliError(message, { code: ExitCode.Api, hint });
}

async function fetchWithTimeout(
	fetchImpl: FetchLike,
	url: string,
	init: RequestInit,
	timeoutMs: number,
): Promise<Response> {
	try {
		return await fetchImpl(url, {
			...init,
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		throw registryError(
			`Cannot reach the container registry: ${
				error instanceof Error ? error.message : String(error)
			}`,
			"Check outbound HTTPS access to the registry. No artifact was pulled and the installation was not modified.",
		);
	}
}

/**
 * Obtains a pull token. GHCR issues anonymous tokens for public packages; a
 * token from GITHUB_TOKEN / NOTPLOY_REGISTRY_TOKEN is used when present so
 * private mirrors work too.
 */
async function getRegistryToken(
	registry: string,
	repository: string,
	options: RegistryOptions,
): Promise<string | null> {
	const env = options.env ?? process.env;
	const provided =
		env.NOTPLOY_REGISTRY_TOKEN?.trim() || env.GITHUB_TOKEN?.trim();
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_REGISTRY_TIMEOUT_MS;

	if (
		registry === "ghcr.io" ||
		registry === "docker.io" ||
		registry === "registry-1.docker.io"
	) {
		const host = registry === "docker.io" ? "registry-1.docker.io" : registry;
		const url = new URL(`https://${host}/token`);
		url.searchParams.set("scope", `repository:${repository}:pull`);
		const headers: Record<string, string> = { Accept: "application/json" };
		if (provided) {
			headers.Authorization = env.NOTPLOY_REGISTRY_TOKEN
				? `Bearer ${provided}`
				: `Basic ${Buffer.from(`x:${provided}`).toString("base64")}`;
		}
		const response = await fetchWithTimeout(
			fetchImpl,
			url.toString(),
			{ method: "GET", headers },
			timeoutMs,
		);
		if (!response.ok) {
			throw registryError(
				`The registry token endpoint answered with HTTP ${response.status}.`,
				registry === "ghcr.io"
					? "Set GITHUB_TOKEN (or NOTPLOY_REGISTRY_TOKEN) with package read access."
					: undefined,
			);
		}
		const payload = (await response.json()) as { token?: string };
		return payload.token ?? null;
	}

	return provided ?? null;
}

async function fetchManifest(
	reference: ImageReference,
	descriptor: string,
	options: RegistryOptions,
): Promise<{ body: Buffer; mediaType: string; digest: string }> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_REGISTRY_TIMEOUT_MS;
	const token = await getRegistryToken(
		reference.registry,
		reference.repository,
		options,
	);
	const url = `https://${reference.registry}/v2/${reference.repository}/manifests/${descriptor}`;
	const response = await fetchWithTimeout(
		fetchImpl,
		url,
		{
			method: "GET",
			headers: {
				Accept: MANIFEST_ACCEPT,
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		},
		timeoutMs,
	);

	if (response.status === 401 || response.status === 403) {
		throw registryError(
			(await response.text()).trim() ||
				`The registry refused access to ${reference.repository} (HTTP ${response.status}).`,
			"Provide GITHUB_TOKEN or NOTPLOY_REGISTRY_TOKEN with package read access.",
		);
	}
	if (response.status === 404) {
		throw registryError(
			`The registry has no manifest for ${reference.repository}:${descriptor}.`,
			"The release tag may not be published yet, or the image was removed. Nothing was pulled.",
		);
	}
	if (!response.ok) {
		throw registryError(
			`The registry answered with HTTP ${response.status} for ${reference.repository}:${descriptor}.`,
		);
	}

	const body = Buffer.from(await response.arrayBuffer());
	const computed = `sha256:${createHash("sha256").update(body).digest("hex")}`;
	const headerDigest = response.headers.get("docker-content-digest");
	if (headerDigest && headerDigest.trim() !== computed) {
		throw registryError(
			"The registry manifest digest does not match the bytes it returned.",
			"The response was tampered with or truncated. Do not retry against this registry; verify its trustworthiness first.",
		);
	}
	if (
		descriptor !== reference.tag &&
		DIGEST_PATTERN.test(descriptor) &&
		descriptor !== computed
	) {
		throw registryError(
			`The manifest returned for ${descriptor} hashes to ${computed}.`,
			"The registry served different content than the digest that was requested. Nothing was pulled.",
		);
	}

	return {
		body,
		mediaType:
			response.headers.get("content-type")?.split(";")[0].trim() ||
			"application/vnd.oci.image.manifest.v1+json",
		digest: computed,
	};
}

function platformMatches(
	platform:
		| { architecture?: string; os?: string; variant?: string }
		| undefined,
	wanted: Platform,
): boolean {
	if (!platform) return false;
	const os = platform.os ?? "linux";
	const arch = platform.architecture ?? "";
	const variant = platform.variant;
	const [wantedOs, wantedArch, wantedVariant] = wanted.split("/");
	if (os !== wantedOs || arch !== wantedArch) return false;
	if (wantedVariant) return variant === wantedVariant;
	return true;
}

/**
 * Resolves an image tag (or digest) to its immutable manifest.
 *
 * Multi-architecture indexes are resolved to the manifest for the host
 * platform, so the reported size and the pulled digest describe the image the
 * host will actually run.
 */
export async function resolveImageManifest(
	image: string,
	options: RegistryOptions = {},
): Promise<ResolvedManifest> {
	const reference = parseImageReference(image);
	const descriptor = reference.digest ?? (reference.tag as string);
	const platform = options.platform ?? defaultPlatform();

	let manifest = await fetchManifest(reference, descriptor, options);
	let envelope: RegistryManifestEnvelope;
	try {
		envelope = JSON.parse(
			manifest.body.toString("utf8"),
		) as RegistryManifestEnvelope;
	} catch {
		throw registryError(
			"The registry returned a manifest that is not valid JSON.",
		);
	}

	let selectedPlatform: string | null = null;
	let layerSize: number | null = null;

	if (Array.isArray(envelope.manifests)) {
		const entry = envelope.manifests.find((candidate) =>
			platformMatches(candidate.platform, platform),
		);
		if (!entry?.digest || !DIGEST_PATTERN.test(entry.digest)) {
			throw registryError(
				`The Cloud image ${image} publishes no manifest for ${platform}.`,
				`Run the update from a supported architecture, or build/publish an image for ${platform}. Nothing was pulled.`,
			);
		}
		selectedPlatform = platform;
		const child = await fetchManifest(reference, entry.digest, options);
		manifest = child;
		try {
			envelope = JSON.parse(
				child.body.toString("utf8"),
			) as RegistryManifestEnvelope;
		} catch {
			throw registryError(
				"The registry returned an invalid platform manifest.",
			);
		}
	}

	if (Array.isArray(envelope.layers)) {
		layerSize = envelope.layers.reduce(
			(total, layer) =>
				total + (typeof layer.size === "number" ? layer.size : 0),
			0,
		);
		if (typeof envelope.config?.size === "number") {
			layerSize += envelope.config.size;
		}
	}

	return {
		reference: formatImageReference(
			reference.registry,
			reference.repository,
			manifest.digest,
		),
		digest: manifest.digest,
		mediaType: manifest.mediaType,
		sizeBytes: layerSize,
		platform: selectedPlatform,
	};
}
