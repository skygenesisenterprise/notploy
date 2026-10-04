export type DomainScope = "public" | "localhost" | "lan" | "custom";

export interface DomainRequirements {
	scope: DomainScope;
	requiresPublicDns: boolean;
	allowsPublicAcme: boolean;
}

const INTERNAL_SUFFIXES = ["home.arpa", "internal"];

const hasSuffix = (hostname: string, suffix: string) =>
	hostname === suffix || hostname.endsWith(`.${suffix}`);

/**
 * Number of trailing labels kept as the internal DNS zone, mirroring how
 * registrable domains work: `gitlab.notploy.lan` belongs to `notploy.lan`.
 */
const INTERNAL_ZONE_LABEL_COUNT = 2;

export const deriveInternalDnsZone = (host: string) => {
	const labels = host.trim().toLowerCase().replace(/\.$/, "").split(".");
	if (labels.length <= INTERNAL_ZONE_LABEL_COUNT) {
		return labels.join(".");
	}
	return labels.slice(-INTERNAL_ZONE_LABEL_COUNT).join(".");
};

export const getDomainRequirements = (host: string): DomainRequirements => {
	const hostname = host.trim().toLowerCase().replace(/\.$/, "");

	if (hasSuffix(hostname, "localhost")) {
		return {
			scope: "localhost",
			requiresPublicDns: false,
			allowsPublicAcme: false,
		};
	}

	if (hasSuffix(hostname, "lan")) {
		return { scope: "lan", requiresPublicDns: false, allowsPublicAcme: false };
	}

	if (
		INTERNAL_SUFFIXES.some((suffix) => hasSuffix(hostname, suffix)) ||
		hostname.split(".").includes("internal")
	) {
		return { scope: "custom", requiresPublicDns: false, allowsPublicAcme: false };
	}

	return { scope: "public", requiresPublicDns: true, allowsPublicAcme: true };
};
