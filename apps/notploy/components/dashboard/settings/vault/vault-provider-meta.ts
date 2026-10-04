import type { VaultProviderIconKey } from "@/components/icons/vault-provider-icons";

export const vaultProviderLabels: Record<string, string> = {
	hashicorp: "HashiCorp Vault / OpenBao",
	infisical: "Infisical",
	aws: "AWS Secrets Manager",
	"aws-parameter-store": "AWS Parameter Store",
	doppler: "Doppler",
	azure: "Azure Key Vault",
	scaleway: "Scaleway Secret Manager",
	phase: "Phase",
	gcp: "Google Secret Manager",
	oci: "Oracle Cloud Vault",
	onepassword: "1Password Connect",
	vaultwarden: "Vaultwarden / Bitwarden",
	kubernetes: "Kubernetes Secrets",
	docker: "Docker / Swarm Secrets",
	generic: "Generic HTTP provider",
};

export const vaultProviderCategoryLabels: Record<string, string> = {
	"self-hosted": "Self-hosted capable",
	cloud: "Cloud only",
	any: "Any endpoint",
};

export const vaultProviderCategoryDescriptions: Record<string, string> = {
	"self-hosted":
		"Runs against a secrets engine you operate yourself, or a hosted one.",
	cloud: "External service reached through its own API.",
	any: "Plain HTTP endpoint: any JSON or text API can back it.",
};

export const vaultProviderCategoryOrder = [
	"self-hosted",
	"cloud",
	"any",
] as const;

export type VaultProviderCategoryKey =
	(typeof vaultProviderCategoryOrder)[number];

export const vaultCapabilityLabels: Record<string, string> = {
	readSecrets: "Runtime injection",
	listSecrets: "Browse secrets",
	healthChecks: "Health checks",
	jsonFields: "JSON fields",
	rotation: "Rotation",
};

export const vaultProviderIconKey = (
	providerType: string,
): VaultProviderIconKey =>
	(providerType in vaultProviderLabels
		? providerType
		: "hashicorp") as VaultProviderIconKey;

export const vaultProviderLabel = (providerType: string) =>
	vaultProviderLabels[providerType] ?? providerType;

export const vaultHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
};
