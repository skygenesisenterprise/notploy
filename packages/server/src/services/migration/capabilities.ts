import type { CapabilityMatrix } from "./types";

/**
 * Capabilities really present in Notploy.
 * The engine maps to these native concepts only; it never invents a second
 * permanent Dokploy-specific business model.
 */
export const NOTPLOY_DESTINATION_CAPABILITIES: CapabilityMatrix = {
	capabilities: {
		"project.create": true,
		"environment.create": true,
		"application.create": true,
		"compose.create": true,
		"database.create": true,
		"database.restore-from-dump": true,
		"database.direct-internal-copy": false,
		"volume.copy": true,
		"bind-mount.copy": true,
		"network.recreate": true,
		"domain.add": true,
		"certificate.issue": true,
		"routing.traefik": true,
		"routing.middleware": true,
		"secret.transfer-by-reference": true,
		"secret.read-cross-platform": false,
		"health-check.verify": true,
		"deployment-history.import": false,
		"zero-downtime.guarantee": false,
	},
	limits: [
		"Supported Dokploy sources: Docker metadata-attributed resources only.",
		"Unattributed containers are never claimed as migratable.",
		"Stopped attributed containers need manual handling.",
		"Encrypted Dokploy values require the original auth secret by explicit reference; values are never copied blindly.",
		"Deployment history is summarized, not imported.",
		"No zero-downtime guarantee: depends on runtime, storage and network.",
	],
	supportedVersions: ["dokploy: any version observable via Docker metadata"],
};

export const NOTPLOY_SOURCE_CAPABILITIES: CapabilityMatrix = {
	capabilities: {
		"project.export": true,
		"environment.export": true,
		"application.export": true,
		"compose.export-as-file": true,
		"database.dump": true,
		"volume.export": true,
		"domain.export": true,
		"certificate.export": false,
		"secret.export-values": false,
		"secret.export-by-reference": true,
	},
	limits: [
		"Secrets are exported by reference only; values are re-entered on the destination.",
		"ACME certificates are re-issued on the destination, never copied.",
	],
};

/**
 * Notploy -> Dokploy export adapter declares what the target Dokploy
 * version really supports. Unknown versions fail closed as to-verify.
 */
export const DOKPLOY_DESTINATION_CAPABILITIES: CapabilityMatrix = {
	capabilities: {
		"project.create": true,
		"application.create": true,
		"compose.create": true,
		"database.create": true,
		"database.restore-from-dump": true,
		"database.direct-internal-copy": false,
		"volume.copy": true,
		"domain.add": true,
		"certificate.issue": true,
		"secret.transfer-by-reference": true,
		"health-check.verify": true,
		"deployment-history.import": false,
		"zero-downtime.guarantee": false,
	},
	limits: [
		"Target Dokploy version must be declared; undeclared versions are to-verify.",
		"Resources without a faithful Dokploy equivalent are flagged, never silently approximated.",
		"Notploy installation is preserved until explicit end-of-migration confirmation.",
		"Configuration, data transfer and operational cutover are validated separately.",
	],
	supportedVersions: ["dokploy: versions declared by the destination adapter at runtime"],
};

export const DOKPLOY_SOURCE_CAPABILITIES: CapabilityMatrix = {
	capabilities: {
		"detect.docker-metadata": true,
		"inventory.readonly": true,
		"inventory.database-direct-read": false,
		"compose.project-names": true,
		"domain.traefik-labels": true,
		"secret.values": false,
	},
	limits: [
		"Detection is Docker-metadata only (containers, services, networks, volumes, Traefik labels).",
		"Direct PostgreSQL import is not a supported inventory method.",
		"Secrets, git-provider credentials and registry credentials are never collected in inventory.",
	],
};
