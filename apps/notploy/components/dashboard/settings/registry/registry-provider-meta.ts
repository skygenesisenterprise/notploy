import {
	type RegistryProviderIconKey,
	registryProviderIcons,
} from "@/components/icons/registry-provider-icons";

/**
 * Presentation-only helpers for Container Registries.
 *
 * The catalogue itself (endpoints, accepted authentication, capabilities)
 * travels from the server through `api.registry.descriptors`, so the Console
 * never hardcodes a vendor list; only icon keys and human labels live here.
 */
export const registryHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
};

export const registryCapabilityLabels: Record<string, string> = {
	repositoryListing: "Repository listing",
	repositoryCreation: "Repository creation",
	repositoryDeletion: "Repository deletion",
	tagListing: "Tag listing",
	manifestInspection: "Manifest inspection",
	digestInspection: "Digest inspection",
	imageDeletion: "Image deletion",
	artifactSupport: "OCI artifacts",
	vulnerabilityScanning: "Vulnerability scanning",
	signatures: "Signatures",
	sbom: "SBOM",
	provenance: "Provenance / attestations",
	retentionPolicies: "Retention policies",
	replication: "Replication",
	registryMirroring: "Registry mirroring",
};

export const registryCapabilityOrder = [
	"repositoryListing",
	"repositoryCreation",
	"repositoryDeletion",
	"tagListing",
	"manifestInspection",
	"digestInspection",
	"imageDeletion",
	"artifactSupport",
	"vulnerabilityScanning",
	"signatures",
	"sbom",
	"provenance",
	"retentionPolicies",
	"replication",
	"registryMirroring",
] as const;

export const registryCategoryLabels: Record<string, string> = {
	managed: "Managed / external",
	selfHosted: "Self-hosted",
	generic: "Generic",
};

export const registryCategoryDescriptions: Record<string, string> = {
	managed: "Registries operated by a vendor and reached over the network.",
	selfHosted: "Registries you run yourself, on a private network or not.",
	generic: "Any endpoint that implements the OCI Distribution API.",
};

export const registryCategoryOrder = [
	"managed",
	"selfHosted",
	"generic",
] as const;

export const registryAuthMethodLabels: Record<string, string> = {
	none: "Anonymous",
	basic: "Username and password",
	token: "Access token",
};

export const registryCredentialSourceLabels: Record<string, string> = {
	secret: "Secrets Manager reference",
	inline: "Stored on the registry",
};

export const registryProviderIconKey = (
	providerType: string | null | undefined,
): RegistryProviderIconKey =>
	providerType && providerType in registryProviderIcons
		? (providerType as RegistryProviderIconKey)
		: "generic-oci";
