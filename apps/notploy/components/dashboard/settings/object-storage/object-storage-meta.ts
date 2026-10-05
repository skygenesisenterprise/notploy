import type { ObjectStorageProviderIconKey } from "@/components/icons/object-storage-provider-icons";

export const objectStorageCategoryOrder = [
	"external",
	"self-hosted",
	"internal",
] as const;

export type ObjectStorageCategoryKey =
	(typeof objectStorageCategoryOrder)[number];

export const objectStorageCategoryLabels: Record<string, string> = {
	external: "External providers",
	"self-hosted": "Self-hosted / user-operated",
	internal: "Internal",
};

export const objectStorageCategoryDescriptions: Record<string, string> = {
	external:
		"Managed S3-compatible services such as AWS S3, Cloudflare R2 or Scaleway.",
	"self-hosted":
		"S3-compatible storage you run yourself, like MinIO, RustFS or Ceph.",
	internal:
		"Notploy's own object storage, with no external dependency or credentials.",
};

export const objectStorageHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
};

/**
 * Fallback labels used before `objectStorage.descriptors` loads. The server is
 * the source of truth for provider metadata.
 */
export const objectStorageProviderLabels: Record<string, string> = {
	aws: "Amazon Web Services (S3)",
	"cloudflare-r2": "Cloudflare R2",
	scaleway: "Scaleway Object Storage",
	wasabi: "Wasabi Object Storage",
	digitalocean: "DigitalOcean Spaces",
	backblaze: "Backblaze B2",
	ovh: "OVHcloud Object Storage",
	linode: "Akamai / Linode Object Storage",
	storj: "Storj",
	idrive: "IDrive e2",
	minio: "MinIO",
	rustfs: "RustFS",
	ceph: "Ceph",
	seaweedfs: "SeaweedFS",
	garage: "Garage",
	"s3-compatible": "Any S3-compatible endpoint",
	"notploy-internal": "Notploy Internal Storage",
};

export const objectStorageProviderLabel = (providerType: string) =>
	objectStorageProviderLabels[providerType] ?? providerType;

export const objectStorageProviderIconKey = (
	providerType: string,
): ObjectStorageProviderIconKey =>
	(providerType in objectStorageProviderLabels
		? providerType
		: "s3-compatible") as ObjectStorageProviderIconKey;
