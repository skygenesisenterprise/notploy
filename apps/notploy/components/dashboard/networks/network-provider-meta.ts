import type { NetworkProviderIconKey } from "@/components/icons/network-provider-icons";

export const networkProviderLabels: Record<string, string> = {
	docker: "Docker",
	wireguard: "WireGuard",
	tailscale: "Tailscale",
	openvpn: "OpenVPN",
	custom: "Custom provider",
};

export const networkProviderCategoryLabels: Record<string, string> = {
	native: "Native container networking",
	vpn: "VPN networks",
	byo: "Bring your own",
};

export const networkProviderCategoryDescriptions: Record<string, string> = {
	native: "Docker-managed networks running on a Notploy server.",
	vpn: "Encrypted networks that link servers over the internet.",
	byo: "Your own connectivity platform, reached through a documented contract.",
};

export const networkProviderCategoryOrder = ["native", "vpn", "byo"] as const;

export type NetworkProviderCategoryKey =
	(typeof networkProviderCategoryOrder)[number];

export const networkCapabilityLabels: Record<string, string> = {
	networks: "Networks",
	bridge: "Bridge",
	overlay: "Overlay",
	ipam: "IPAM",
	internal: "Internal",
	attachable: "Attachable",
	peers: "Peers",
	subnets: "Subnets",
	mesh: "Mesh",
	multiServer: "Multi-server",
	encrypted: "Encrypted",
	remoteAccess: "Remote access",
	natTraversal: "NAT traversal",
	healthChecks: "Health checks",
	automaticSync: "Automatic sync",
	connectivityTest: "Connectivity test",
};

export const networkProviderIconKey = (
	providerType: string,
): NetworkProviderIconKey =>
	(providerType in networkProviderLabels
		? providerType
		: "custom") as NetworkProviderIconKey;

export const networkProviderLabel = (providerType: string) =>
	networkProviderLabels[providerType] ?? providerType;

export const networkHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
};

/**
 * A network provider is a VPN only when it exposes peers; the UI uses this to
 * decide whether to show the peers editor.
 */
export const isVpnProviderType = (providerType: string) =>
	providerType === "wireguard" ||
	providerType === "tailscale" ||
	providerType === "openvpn";

export const vpnProviderTypes = ["wireguard", "tailscale", "openvpn"] as const;
