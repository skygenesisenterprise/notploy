import type { DnsProviderIconKey } from "@/components/icons/dns-provider-icons";

export const dnsProviderLabels: Record<string, string> = {
	cloudflare: "Cloudflare",
	route53: "AWS Route53",
	porkbun: "Porkbun",
	infomaniak: "Infomaniak",
	ovh: "OVHcloud",
	hetzner: "Hetzner",
	digitalocean: "DigitalOcean",
	gandi: "Gandi",
	vultr: "Vultr",
	linode: "Akamai Linode",
	desec: "deSEC",
	bunny: "bunny.net",
	ns1: "NS1",
	godaddy: "GoDaddy",
	namecheap: "Namecheap",
	cloudns: "ClouDNS",
	powerdns: "PowerDNS",
	bind: "BIND",
	technitium: "Technitium DNS",
	coredns: "CoreDNS",
	unbound: "Unbound",
	custom: "Custom provider",
	"notploy-internal": "Notploy Internal DNS",
};

export const dnsProviderCategoryLabels: Record<string, string> = {
	managed: "Managed providers",
	"self-hosted": "Self-hosted / user-operated",
	internal: "Internal",
};

export const dnsProviderCategoryDescriptions: Record<string, string> = {
	managed: "Hosted DNS services reached through their own API.",
	"self-hosted":
		"DNS servers you operate yourself, reached through their management interface.",
	internal: "Notploy's own internal DNS, with no external dependency.",
};

export const dnsProviderCategoryOrder = [
	"managed",
	"self-hosted",
	"internal",
] as const;

export type DnsProviderCategoryKey =
	(typeof dnsProviderCategoryOrder)[number];

export const dnsCapabilityLabels: Record<string, string> = {
	zones: "Zones",
	a: "A",
	aaaa: "AAAA",
	cname: "CNAME",
	mx: "MX",
	txt: "TXT",
	ns: "NS",
	srv: "SRV",
	caa: "CAA",
	ptr: "PTR",
	wildcard: "Wildcard",
	recordCrud: "Record CRUD",
	dns01: "DNS-01",
	healthChecks: "Health checks",
	automaticSync: "Automatic sync",
};

export const dnsProviderIconKey = (
	providerType: string,
): DnsProviderIconKey =>
	(providerType in dnsProviderLabels
		? providerType
		: "custom") as DnsProviderIconKey;

export const dnsProviderLabel = (providerType: string) =>
	dnsProviderLabels[providerType] ?? providerType;

export const dnsHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
};