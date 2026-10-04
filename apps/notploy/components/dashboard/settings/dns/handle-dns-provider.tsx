import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { dnsProviderIcons } from "@/components/icons/dns-provider-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import {
	dnsProviderCategoryLabels,
	dnsProviderCategoryOrder,
	dnsProviderIconKey,
	dnsProviderLabel,
} from "./dns-provider-meta";

const PROVIDER_TYPES = [
	"cloudflare",
	"route53",
	"porkbun",
	"infomaniak",
	"ovh",
	"hetzner",
	"digitalocean",
	"gandi",
	"vultr",
	"linode",
	"desec",
	"bunny",
	"ns1",
	"godaddy",
	"namecheap",
	"cloudns",
	"powerdns",
	"bind",
	"technitium",
	"coredns",
	"unbound",
	"custom",
	"notploy-internal",
] as const;

type ProviderType = (typeof PROVIDER_TYPES)[number];

const CATEGORY_BY_TYPE: Record<ProviderType, string> = {
	cloudflare: "managed",
	route53: "managed",
	porkbun: "managed",
	infomaniak: "managed",
	ovh: "managed",
	hetzner: "managed",
	digitalocean: "managed",
	gandi: "managed",
	vultr: "managed",
	linode: "managed",
	desec: "managed",
	bunny: "managed",
	ns1: "managed",
	godaddy: "managed",
	namecheap: "managed",
	cloudns: "managed",
	powerdns: "self-hosted",
	bind: "self-hosted",
	technitium: "self-hosted",
	coredns: "self-hosted",
	unbound: "self-hosted",
	custom: "managed",
	"notploy-internal": "internal",
};

const ovhEndpointLabels = {
	"ovh-eu": "OVHcloud Europe",
	"ovh-ca": "OVHcloud Canada",
	"ovh-us": "OVHcloud US",
	"kimsufi-eu": "Kimsufi Europe",
	"kimsufi-ca": "Kimsufi Canada",
	"soyoustart-eu": "So you Start Europe",
	"soyoustart-ca": "So you Start Canada",
} as const;

const tsigAlgorithmLabels = {
	"hmac-md5": "HMAC-MD5",
	"hmac-sha1": "HMAC-SHA1",
	"hmac-sha224": "HMAC-SHA224",
	"hmac-sha256": "HMAC-SHA256 (recommended)",
	"hmac-sha384": "HMAC-SHA384",
	"hmac-sha512": "HMAC-SHA512",
} as const;

const DnsProviderSchema = z.object({
	name: z
		.string()
		.min(1, { message: "Name is required" })
		.regex(/^[a-zA-Z0-9_-]+$/, {
			message: "Only letters, numbers, dashes and underscores",
		}),
	providerType: z.enum(PROVIDER_TYPES),
	// Shared credential fields. Only the ones a provider needs are sent.
	apiToken: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(),
	apiKey: z.string(),
	secretApiKey: z.string(),
	endpoint: z.enum(
		Object.keys(ovhEndpointLabels) as [
			keyof typeof ovhEndpointLabels,
			...(keyof typeof ovhEndpointLabels)[],
		],
	),
	applicationKey: z.string(),
	applicationSecret: z.string(),
	consumerKey: z.string(),
	sharingId: z.string(),
	shopperId: z.string(),
	apiUser: z.string(),
	userName: z.string(),
	clientIp: z.string(),
	authId: z.string(),
	authPassword: z.string(),
	subAuthId: z.string(),
	// Self-hosted / internal
	apiUrl: z.string(),
	serverId: z.string(),
	serverAddress: z.string(),
	port: z.string(),
	tsigKeyName: z.string(),
	tsigAlgorithm: z.enum(
		Object.keys(tsigAlgorithmLabels) as [
			keyof typeof tsigAlgorithmLabels,
			...(keyof typeof tsigAlgorithmLabels)[],
		],
	),
	tsigSecret: z.string(),
	etcdEndpoints: z.string(),
	username: z.string(),
	password: z.string(),
	configPath: z.string(),
	baseUrl: z.string(),
	defaultTtl: z.string(),
	zones: z.string(),
	allowInsecureTls: z.boolean(),
	tlsSkipVerify: z.boolean(),
});

type DnsProviderForm = z.infer<typeof DnsProviderSchema>;

const defaultValues: DnsProviderForm = {
	name: "",
	providerType: "cloudflare",
	apiToken: "",
	accessKeyId: "",
	secretAccessKey: "",
	apiKey: "",
	secretApiKey: "",
	endpoint: "ovh-eu",
	applicationKey: "",
	applicationSecret: "",
	consumerKey: "",
	sharingId: "",
	shopperId: "",
	apiUser: "",
	userName: "",
	clientIp: "",
	authId: "",
	authPassword: "",
	subAuthId: "",
	apiUrl: "",
	serverId: "",
	serverAddress: "",
	port: "53",
	tsigKeyName: "",
	tsigAlgorithm: "hmac-sha256",
	tsigSecret: "",
	etcdEndpoints: "http://127.0.0.1:2379",
	username: "",
	password: "",
	configPath: "/etc/unbound/unbound.conf",
	baseUrl: "",
	defaultTtl: "300",
	zones: "",
	allowInsecureTls: false,
	tlsSkipVerify: false,
};

const parseZones = (value: string) =>
	value
		.split(/[\n,]/)
		.map((zone) => zone.trim())
		.filter(Boolean);

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

const buildConfig = (data: DnsProviderForm) => {
	const zones = parseZones(data.zones);
	switch (data.providerType) {
		case "cloudflare":
			return { providerType: "cloudflare" as const, apiToken: data.apiToken };
		case "route53":
			return {
				providerType: "route53" as const,
				accessKeyId: data.accessKeyId,
				secretAccessKey: data.secretAccessKey,
			};
		case "porkbun":
			return {
				providerType: "porkbun" as const,
				apiKey: data.apiKey,
				secretApiKey: data.secretApiKey,
			};
		case "infomaniak":
			return { providerType: "infomaniak" as const, apiToken: data.apiToken };
		case "ovh":
			return {
				providerType: "ovh" as const,
				endpoint: data.endpoint,
				applicationKey: data.applicationKey,
				applicationSecret: data.applicationSecret,
				consumerKey: data.consumerKey,
			};
		case "hetzner":
			return { providerType: "hetzner" as const, apiToken: data.apiToken };
		case "digitalocean":
			return { providerType: "digitalocean" as const, apiToken: data.apiToken };
		case "gandi":
			return {
				providerType: "gandi" as const,
				apiKey: data.apiKey,
				sharingId: optional(data.sharingId),
			};
		case "vultr":
			return { providerType: "vultr" as const, apiKey: data.apiKey };
		case "linode":
			return { providerType: "linode" as const, apiToken: data.apiToken };
		case "desec":
			return { providerType: "desec" as const, apiToken: data.apiToken };
		case "bunny":
			return { providerType: "bunny" as const, apiKey: data.apiKey };
		case "ns1":
			return { providerType: "ns1" as const, apiKey: data.apiKey };
		case "godaddy":
			return {
				providerType: "godaddy" as const,
				apiKey: data.apiKey,
				apiSecret: data.secretApiKey,
				shopperId: optional(data.shopperId),
			};
		case "namecheap":
			return {
				providerType: "namecheap" as const,
				apiUser: data.apiUser,
				apiKey: data.apiKey,
				userName: data.userName,
				clientIp: data.clientIp,
			};
		case "cloudns":
			return {
				providerType: "cloudns" as const,
				authId: data.authId,
				authPassword: data.authPassword,
				subAuthId: optional(data.subAuthId),
			};
		case "powerdns":
			return {
				providerType: "powerdns" as const,
				apiUrl: data.apiUrl,
				apiKey: data.apiKey,
				serverId: data.serverId || "localhost",
				allowInsecureTls: data.allowInsecureTls,
			};
		case "bind":
			return {
				providerType: "bind" as const,
				serverId: data.serverId,
				serverAddress: data.serverAddress,
				port: Number(data.port || 53),
				tsigKeyName: data.tsigKeyName,
				tsigAlgorithm: data.tsigAlgorithm,
				tsigSecret: data.tsigSecret,
				zones,
			};
		case "technitium":
			return {
				providerType: "technitium" as const,
				apiUrl: data.apiUrl,
				apiToken: data.apiToken,
				allowInsecureTls: data.allowInsecureTls,
			};
		case "coredns":
			return {
				providerType: "coredns" as const,
				etcdEndpoints: data.etcdEndpoints,
				username: optional(data.username),
				password: optional(data.password),
				zones,
				tlsSkipVerify: data.tlsSkipVerify,
			};
		case "unbound":
			return {
				providerType: "unbound" as const,
				serverId: data.serverId,
				configPath: data.configPath || "/etc/unbound/unbound.conf",
				zones,
			};
		case "custom":
			return {
				providerType: "custom" as const,
				baseUrl: data.baseUrl,
				apiToken: data.apiToken,
				zones,
				allowInsecureTls: data.allowInsecureTls,
			};
		case "notploy-internal":
			return {
				providerType: "notploy-internal" as const,
				defaultTtl: Number(data.defaultTtl || 300),
			};
	}
};

const extractErrorMessage = (err: unknown) => {
	if (!(err instanceof Error)) return undefined;
	try {
		const issues = JSON.parse(err.message) as { message?: string }[];
		if (Array.isArray(issues)) {
			return issues
				.map((issue) => issue.message)
				.filter(Boolean)
				.join(", ");
		}
	} catch {}
	return err.message;
};

interface Props {
	dnsProviderId?: string;
	defaultProviderType?: ProviderType;
	trigger?: ReactNode;
}

export const HandleDnsProvider = ({
	dnsProviderId,
	defaultProviderType,
	trigger,
}: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: provider } = api.dnsProvider.one.useQuery(
		{ dnsProviderId: dnsProviderId || "" },
		{ enabled: !!dnsProviderId && isOpen },
	);

	const { mutateAsync, isPending, error, isError } = dnsProviderId
		? api.dnsProvider.update.useMutation()
		: api.dnsProvider.create.useMutation();

	const { mutateAsync: testConnection, isPending: isTesting } =
		api.dnsProvider.testConnection.useMutation();

	const form = useForm<DnsProviderForm>({
		defaultValues: {
			...defaultValues,
			...(defaultProviderType
				? { providerType: defaultProviderType }
				: {}),
		},
		resolver: zodResolver(DnsProviderSchema),
	});

	const providerType = form.watch("providerType");
	const allowInsecureTls = form.watch("allowInsecureTls");
	const tlsSkipVerify = form.watch("tlsSkipVerify");

	const providerGroups = useMemo(
		() =>
			dnsProviderCategoryOrder
				.map((category) => ({
					category,
					types: PROVIDER_TYPES.filter(
						(type) => CATEGORY_BY_TYPE[type] === category,
					),
				}))
				.filter((group) => group.types.length > 0),
		[],
	);

	useEffect(() => {
		if (provider) {
			const config = provider.config as Record<string, unknown>;
			form.reset({
				...defaultValues,
				name: provider.name,
				providerType: provider.providerType as ProviderType,
				apiToken: String(config.apiToken ?? ""),
				accessKeyId: String(config.accessKeyId ?? ""),
				secretAccessKey: String(config.secretAccessKey ?? ""),
				apiKey: String(config.apiKey ?? ""),
				secretApiKey: String(config.secretApiKey ?? ""),
				endpoint: (config.endpoint as DnsProviderForm["endpoint"]) ?? "ovh-eu",
				applicationKey: String(config.applicationKey ?? ""),
				applicationSecret: String(config.applicationSecret ?? ""),
				consumerKey: String(config.consumerKey ?? ""),
				sharingId: String(config.sharingId ?? ""),
				shopperId: String(config.shopperId ?? ""),
				apiUser: String(config.apiUser ?? ""),
				userName: String(config.userName ?? ""),
				clientIp: String(config.clientIp ?? ""),
				authId: String(config.authId ?? ""),
				authPassword: String(config.authPassword ?? ""),
				subAuthId: String(config.subAuthId ?? ""),
				apiUrl: String(config.apiUrl ?? ""),
				serverId: String(config.serverId ?? ""),
				serverAddress: String(config.serverAddress ?? ""),
				port: String(config.port ?? "53"),
				tsigKeyName: String(config.tsigKeyName ?? ""),
				tsigAlgorithm:
					(config.tsigAlgorithm as DnsProviderForm["tsigAlgorithm"]) ??
					"hmac-sha256",
				tsigSecret: String(config.tsigSecret ?? ""),
				etcdEndpoints: String(config.etcdEndpoints ?? "http://127.0.0.1:2379"),
				username: String(config.username ?? ""),
				password: String(config.password ?? ""),
				configPath: String(config.configPath ?? "/etc/unbound/unbound.conf"),
				baseUrl: String(config.baseUrl ?? ""),
				defaultTtl: String(config.defaultTtl ?? "300"),
				zones: Array.isArray(config.zones)
					? (config.zones as string[]).join("\n")
					: "",
				allowInsecureTls: Boolean(config.allowInsecureTls),
				tlsSkipVerify: Boolean(config.tlsSkipVerify),
			});
		} else if (!dnsProviderId) {
			form.reset({
				...defaultValues,
				...(defaultProviderType
					? { providerType: defaultProviderType }
					: {}),
			});
		}
	}, [provider, dnsProviderId, form, defaultProviderType]);

	const onSubmit = async (data: DnsProviderForm) => {
		const payload: any = {
			name: data.name,
			config: buildConfig(data),
			...(dnsProviderId && { dnsProviderId }),
		};
		await mutateAsync(payload)
			.then(() => {
				toast.success(
					dnsProviderId ? "DNS provider updated" : "DNS provider created",
				);
				utils.dnsProvider.all.invalidate();
				utils.dnsProvider.descriptors.invalidate();
				setIsOpen(false);
			})
			.catch(() => {});
	};

	const onTestConnection = async () => {
		const isValid = await form.trigger();
		if (!isValid) {
			return;
		}
		const data = form.getValues();
		await testConnection({
			config: buildConfig(data),
			...(dnsProviderId && { dnsProviderId }),
		})
			.then(() => {
				toast.success("Connection successful");
			})
			.catch((err) => {
				toast.error("Connection failed", {
					description: extractErrorMessage(err),
				});
			});
	};

	type TextFieldName =
		| "apiToken"
		| "accessKeyId"
		| "secretAccessKey"
		| "apiKey"
		| "secretApiKey"
		| "sharingId"
		| "shopperId"
		| "apiUser"
		| "userName"
		| "clientIp"
		| "authId"
		| "authPassword"
		| "subAuthId"
		| "apiUrl"
		| "serverId"
		| "serverAddress"
		| "port"
		| "tsigKeyName"
		| "tsigSecret"
		| "etcdEndpoints"
		| "username"
		| "password"
		| "configPath"
		| "baseUrl"
		| "defaultTtl"
		| "applicationKey"
		| "applicationSecret"
		| "consumerKey";

	const textField = (
		name: TextFieldName,
		label: string,
		options?: { type?: string; description?: ReactNode; placeholder?: string },
	) => (
		<FormField
			key={name}
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<Input
							type={options?.type}
							placeholder={options?.placeholder}
							{...field}
							value={String(field.value ?? "")}
						/>
					</FormControl>
					{options?.description && (
						<FormDescription>{options.description}</FormDescription>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	);

	const switchField = (
		name: "allowInsecureTls" | "tlsSkipVerify",
		label: string,
		description: string,
	) => (
		<FormField
			key={name}
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
					<div className="flex flex-col gap-0.5">
						<FormLabel className="text-sm">{label}</FormLabel>
						<FormDescription>{description}</FormDescription>
					</div>
					<FormControl>
						<Switch checked={field.value} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	);

	const zonesField = (description: string, placeholder = "example.com\nsge.lan") => (
		<FormField
			control={form.control}
			name="zones"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Zones (optional)</FormLabel>
					<FormControl>
						<Textarea
							className="min-h-[70px] font-mono text-xs"
							placeholder={placeholder}
							{...field}
						/>
					</FormControl>
					<FormDescription>{description}</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);

	const credentialFields = () => {
		switch (providerType) {
			case "cloudflare":
			case "infomaniak":
			case "hetzner":
			case "digitalocean":
			case "linode":
			case "desec":
				return textField("apiToken", "API Token", {
					type: "password",
					description:
						"Create a scoped token for the zones Notploy should manage.",
				});
			case "route53":
				return (
					<>
						{textField("accessKeyId", "Access Key ID")}
						{textField("secretAccessKey", "Secret Access Key", {
							type: "password",
							description: (
								<>
									Use an IAM user/role scoped to{" "}
									<code>route53:ListHostedZones</code>,{" "}
									<code>route53:ListResourceRecordSets</code> and{" "}
									<code>route53:ChangeResourceRecordSets</code>.
								</>
							),
						})}
					</>
				);
			case "porkbun":
				return (
					<>
						{textField("apiKey", "API Key")}
						{textField("secretApiKey", "Secret API Key", { type: "password" })}
					</>
				);
			case "ovh":
				return (
					<>
						<FormField
							control={form.control}
							name="endpoint"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API Endpoint</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select an endpoint" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{Object.entries(ovhEndpointLabels).map(
												([value, label]) => (
													<SelectItem key={value} value={value}>
														{label}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						{textField("applicationKey", "Application Key")}
						{textField("applicationSecret", "Application Secret", {
							type: "password",
						})}
						{textField("consumerKey", "Consumer Key", { type: "password" })}
					</>
				);
			case "gandi":
				return (
					<>
						{textField("apiKey", "API Key", { type: "password" })}
						{textField("sharingId", "Sharing ID (optional)")}
					</>
				);
			case "vultr":
			case "bunny":
			case "ns1":
				return textField("apiKey", "API Key", { type: "password" });
			case "godaddy":
				return (
					<>
						{textField("apiKey", "API Key")}
						{textField("secretApiKey", "API Secret", { type: "password" })}
						{textField("shopperId", "Shopper ID (optional)")}
					</>
				);
			case "namecheap":
				return (
					<>
						{textField("apiUser", "API User")}
						{textField("apiKey", "API Key", { type: "password" })}
						{textField("userName", "Username")}
						{textField("clientIp", "Client IP", {
							description:
								"Whitelisted IP for the Namecheap API. It must match the address requests originate from.",
						})}
					</>
				);
			case "cloudns":
				return (
					<>
						{textField("authId", "Auth ID")}
						{textField("authPassword", "Auth Password", { type: "password" })}
						{textField("subAuthId", "Sub Auth ID (optional)")}
					</>
				);
			case "powerdns":
				return (
					<>
						{textField("apiUrl", "API URL", {
							placeholder: "https://dns01.sge.internal:8081",
						})}
						{textField("apiKey", "API Key", { type: "password" })}
						{textField("serverId", "Server ID", {
							placeholder: "localhost",
							description: "PowerDNS server id, usually localhost.",
						})}
						{switchField(
							"allowInsecureTls",
							"Allow self-signed TLS",
							"Skip certificate verification for an internal PowerDNS API.",
						)}
					</>
				);
			case "technitium":
				return (
					<>
						{textField("apiUrl", "API URL", {
							placeholder: "http://dns01.sge.internal:5380",
						})}
						{textField("apiToken", "API Token", { type: "password" })}
						{switchField(
							"allowInsecureTls",
							"Allow self-signed TLS",
							"Skip certificate verification for an internal Technitium API.",
						)}
					</>
				);
			case "bind":
				return (
					<>
						{textField("serverId", "Notploy server", {
							description:
								"Registered server Notploy connects to over SSH to run nsupdate.",
						})}
						{textField("serverAddress", "Nameserver address", {
							placeholder: "dns01.sge.internal",
						})}
						{textField("port", "Port", { type: "number", placeholder: "53" })}
						{textField("tsigKeyName", "TSIG key name")}
						<FormField
							control={form.control}
							name="tsigAlgorithm"
							render={({ field }) => (
								<FormItem>
									<FormLabel>TSIG algorithm</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{Object.entries(tsigAlgorithmLabels).map(
												([value, label]) => (
													<SelectItem key={value} value={value}>
														{label}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						{textField("tsigSecret", "TSIG secret", { type: "password" })}
						{zonesField(
							"BIND exposes no zone discovery, so list the zones Notploy may update.",
						)}
					</>
				);
			case "coredns":
				return (
					<>
						{textField("etcdEndpoints", "etcd endpoints", {
							description:
								"Comma-separated etcd v3 endpoints backing the CoreDNS etcd plugin.",
						})}
						{textField("username", "etcd username (optional)")}
						{textField("password", "etcd password (optional)", {
							type: "password",
						})}
						{zonesField("Zones CoreDNS serves from this etcd cluster.")}
						{switchField(
							"tlsSkipVerify",
							"Skip TLS verification",
							"Allow a self-signed certificate on the etcd endpoint.",
						)}
					</>
				);
			case "unbound":
				return (
					<>
						{textField("serverId", "Notploy server", {
							description:
								"Registered server Notploy connects to over SSH to run unbound-control.",
						})}
						{textField("configPath", "unbound.conf path", {
							placeholder: "/etc/unbound/unbound.conf",
						})}
						{zonesField(
							"Local zones served by this resolver (e.g. sge.lan).",
						)}
					</>
				);
			case "custom":
				return (
					<>
						{textField("baseUrl", "Base URL", {
							placeholder: "https://dns.example.com/api",
							description:
								"Endpoint implementing Notploy's documented DNS adapter contract.",
						})}
						{textField("apiToken", "API Token", { type: "password" })}
						{zonesField("Optional zones to expose before discovery.")}
						{switchField(
							"allowInsecureTls",
							"Allow self-signed TLS",
							"Skip certificate verification for this endpoint.",
						)}
					</>
				);
			case "notploy-internal":
				return (
					<>
						<AlertBlock type="info">
							Notploy stores these zones and records itself, so no external
							DNS dependency is required. Ideal for private networks and
							internal domains such as <code>sge.lan</code>.
						</AlertBlock>
						{textField("defaultTtl", "Default TTL", {
							type: "number",
							placeholder: "300",
						})}
					</>
				);
			default:
				return null;
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : dnsProviderId ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit provider</span>
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Edit provider</TooltipContent>
				</Tooltip>
			) : (
				<DialogTrigger asChild>
					<Button>
						<PlusIcon className="size-4" />
						Add Provider
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{dnsProviderId ? "Update DNS Provider" : "Add DNS Provider"}
					</DialogTitle>
					<DialogDescription>
						Connect a DNS provider so Notploy can create records for your
						domains automatically instead of setting them up by hand.
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="prod-cloudflare" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="providerType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Provider</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
										disabled={!!dnsProviderId}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a provider" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{providerGroups.map((group) => (
												<SelectGroup key={group.category}>
													<SelectLabel>
														{dnsProviderCategoryLabels[group.category] ??
															group.category}
													</SelectLabel>
													{group.types.map((value) => {
														const ProviderIcon =
															dnsProviderIcons[dnsProviderIconKey(value)];
														return (
															<SelectItem key={value} value={value}>
																<div className="flex flex-row items-center gap-2">
																	<ProviderIcon className="size-4 shrink-0" />
																	{dnsProviderLabel(value)}
																</div>
															</SelectItem>
														);
													})}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										{dnsProviderCategoryLabels[CATEGORY_BY_TYPE[providerType]]}
										{" · "}
										{providerType === "notploy-internal"
											? "No external dependency."
											: providerType === "custom"
												? "Your own DNS platform."
												: "Notploy manages records through its API."}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{credentialFields()}

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							<Button
								type="button"
								variant="secondary"
								isLoading={isTesting}
								onClick={onTestConnection}
							>
								Test Connection
							</Button>
							<Button type="submit" isLoading={isPending}>
								{dnsProviderId ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};