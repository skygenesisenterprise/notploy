export type DomainScope = "public" | "localhost" | "lan" | "custom";

export interface DomainRequirements {
	scope: DomainScope;
	requiresPublicDns: boolean;
	allowsPublicAcme: boolean;
}

const INTERNAL_SUFFIXES = ["home.arpa", "internal"];

const hasSuffix = (hostname: string, suffix: string) =>
	hostname === suffix || hostname.endsWith(`.${suffix}`);

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
