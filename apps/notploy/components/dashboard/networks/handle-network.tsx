"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Network, PenBoxIcon, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { networkProviderIcons } from "@/components/icons/network-provider-icons";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { NetworkProviderCapabilityMatrix } from "./network-provider-capability-matrix";
import {
	networkProviderCategoryLabels,
	networkProviderCategoryOrder,
	networkProviderIconKey,
	networkProviderLabel,
} from "./network-provider-meta";

/**
 * The dialog is provider-first, mirroring the DNS provider dialog: pick the
 * connectivity layer, then describe the network it owns. Docker keeps the
 * original immutable network form; VPN providers create a Network Provider
 * (with peers) through the abstraction from issue #73.
 */
const PROVIDER_TYPES = [
	"docker",
	"wireguard",
	"tailscale",
	"openvpn",
	"custom",
] as const;

type ProviderType = (typeof PROVIDER_TYPES)[number];

const CATEGORY_BY_TYPE: Record<ProviderType, string> = {
	docker: "native",
	wireguard: "vpn",
	tailscale: "vpn",
	openvpn: "vpn",
	custom: "byo",
};

const networkDriverEnum = ["bridge", "overlay"] as const;

const ipamConfigEntrySchema = z.object({
	subnet: z.string().optional(),
	ipRange: z.string().optional(),
	gateway: z.string().optional(),
});

const peerFormSchema = z.object({
	name: z.string(),
	address: z.string(),
	endpoint: z.string(),
	publicKey: z.string(),
	// Comma or newline separated list of allowed CIDRs.
	allowedIps: z.string(),
});

const networkFormSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		providerType: z.enum(PROVIDER_TYPES),
		// Docker
		driver: z.enum(networkDriverEnum),
		internal: z.boolean(),
		attachable: z.boolean(),
		enableIPv4: z.boolean(),
		enableIPv6: z.boolean(),
		mtu: z
			.string()
			.refine(
				(value) =>
					value === "" ||
					(/^\d+$/.test(value) && +value >= 68 && +value <= 65535),
				{ message: "MTU must be a number between 68 and 65535" },
			),
		ipamDriver: z.string(),
		ipamConfig: z.array(ipamConfigEntrySchema),
		// WireGuard
		interfaceName: z.string(),
		cidr: z.string(),
		listenPort: z.string(),
		wgEndpoint: z.string(),
		publicKey: z.string(),
		privateKeySecretRef: z.string(),
		dns: z.string(),
		persistentKeepalive: z.string(),
		// Tailscale
		tailnet: z.string(),
		authKeySecretRef: z.string(),
		acceptRoutes: z.boolean(),
		advertiseExitNode: z.boolean(),
		// OpenVPN
		remote: z.string(),
		port: z.string(),
		protocol: z.enum(["udp", "tcp"]),
		caSecretRef: z.string(),
		certSecretRef: z.string(),
		keySecretRef: z.string(),
		cipher: z.string(),
		// Custom
		baseUrl: z.string(),
		apiTokenSecretRef: z.string(),
		allowInsecureTls: z.boolean(),
		// Shared peer editor
		peers: z.array(peerFormSchema),
	})
	.superRefine((input, ctx) => {
		if (input.providerType === "docker") {
			if (!input.enableIPv4 && !input.enableIPv6) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["enableIPv4"],
					message: "IPv4 or IPv6 must be enabled",
				});
			}
			for (const [index, entry] of input.ipamConfig.entries()) {
				if (!entry.subnet && (entry.gateway || entry.ipRange)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["ipamConfig", index, "subnet"],
						message: "Gateway and IP range require a subnet",
					});
				}
			}
		}

		// Provider names are persisted, so they follow the provider naming rules.
		if (
			input.providerType !== "docker" &&
			!/^[a-zA-Z0-9_-]+$/.test(input.name)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["name"],
				message: "Only letters, numbers, dashes and underscores",
			});
		}

		if (input.providerType === "wireguard" && !input.cidr.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["cidr"],
				message: "A tunnel CIDR is required, e.g. 10.80.0.0/16",
			});
		}
	});

type NetworkForm = z.infer<typeof networkFormSchema>;

const defaultValues: NetworkForm = {
	name: "",
	providerType: "docker",
	driver: "bridge",
	internal: false,
	attachable: false,
	enableIPv4: true,
	enableIPv6: false,
	mtu: "",
	ipamDriver: "",
	ipamConfig: [],
	interfaceName: "wg0",
	cidr: "",
	listenPort: "51820",
	wgEndpoint: "",
	publicKey: "",
	privateKeySecretRef: "",
	dns: "",
	persistentKeepalive: "25",
	tailnet: "",
	authKeySecretRef: "",
	acceptRoutes: false,
	advertiseExitNode: false,
	remote: "",
	port: "1194",
	protocol: "udp",
	caSecretRef: "",
	certSecretRef: "",
	keySecretRef: "",
	cipher: "",
	baseUrl: "",
	apiTokenSecretRef: "",
	allowInsecureTls: false,
	peers: [],
};

const dockerToggleOptions = [
	{
		name: "internal",
		label: "Internal",
		description: "Containers on this network cannot reach external networks.",
	},
	{
		name: "attachable",
		label: "Attachable",
		description:
			"Allow standalone containers to attach (overlay networks only).",
	},
	{
		name: "enableIPv4",
		label: "Enable IPv4",
		description: "Enable IPv4 addressing on the network.",
	},
	{
		name: "enableIPv6",
		label: "Enable IPv6",
		description: "Enable IPv6 addressing on the network.",
	},
] as const;

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

const parsePeers = (peers: NetworkForm["peers"]) =>
	peers
		.filter((peer) => peer.name.trim() && peer.address.trim())
		.map((peer) => ({
			name: peer.name.trim(),
			address: peer.address.trim(),
			endpoint: optional(peer.endpoint),
			publicKey: optional(peer.publicKey),
			allowedIps: peer.allowedIps
				.split(/[\n,]/)
				.map((entry) => entry.trim())
				.filter(Boolean),
		}));

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

const buildConfig = (data: NetworkForm, serverId?: string) => {
	switch (data.providerType) {
		case "docker":
			return {
				providerType: "docker" as const,
				defaultDriver: data.driver,
				...(serverId ? { serverId } : {}),
			};
		case "wireguard":
			return {
				providerType: "wireguard" as const,
				interfaceName: data.interfaceName || "wg0",
				cidr: data.cidr,
				listenPort: Number(data.listenPort || 51820),
				endpoint: optional(data.wgEndpoint),
				publicKey: optional(data.publicKey),
				privateKeySecretRef: optional(data.privateKeySecretRef),
				dns: optional(data.dns),
				mtu: data.mtu ? Number(data.mtu) : undefined,
				persistentKeepalive: Number(data.persistentKeepalive || 0),
			};
		case "tailscale":
			return {
				providerType: "tailscale" as const,
				tailnet: optional(data.tailnet),
				authKeySecretRef: optional(data.authKeySecretRef),
				acceptRoutes: data.acceptRoutes,
				advertiseExitNode: data.advertiseExitNode,
			};
		case "openvpn":
			return {
				providerType: "openvpn" as const,
				remote: data.remote,
				port: Number(data.port || 1194),
				protocol: data.protocol,
				caSecretRef: optional(data.caSecretRef),
				certSecretRef: optional(data.certSecretRef),
				keySecretRef: optional(data.keySecretRef),
				cipher: optional(data.cipher),
			};
		case "custom":
			return {
				providerType: "custom" as const,
				baseUrl: data.baseUrl,
				apiTokenSecretRef: optional(data.apiTokenSecretRef),
				cidr: optional(data.cidr),
				allowInsecureTls: data.allowInsecureTls,
			};
	}
};

interface HandleNetworkProps {
	/** Target server; undefined creates on the local Notploy server */
	serverId?: string;
	/** When set, edits an existing network provider instead of creating one */
	providerId?: string;
	defaultProviderType?: ProviderType;
	children?: ReactNode;
}

export const HandleNetwork = ({
	serverId,
	providerId,
	defaultProviderType,
	children,
}: HandleNetworkProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();

	const createNetwork = api.network.create.useMutation();
	const createProvider = api.networkProvider.create.useMutation();
	const updateProvider = api.networkProvider.update.useMutation();
	const { mutateAsync: testConnection, isPending: isTesting } =
		api.networkProvider.testConnection.useMutation();

	const { data: provider } = api.networkProvider.one.useQuery(
		{ networkProviderId: providerId || "" },
		{ enabled: !!providerId && isOpen },
	);
	const { data: descriptors } = api.networkProvider.descriptors.useQuery(
		undefined,
		{ enabled: isOpen },
	);

	const form = useForm<NetworkForm>({
		resolver: zodResolver(networkFormSchema),
		defaultValues: {
			...defaultValues,
			...(defaultProviderType ? { providerType: defaultProviderType } : {}),
		},
	});

	const providerType = form.watch("providerType");
	const ipamConfigFieldArray = useFieldArray({
		control: form.control,
		name: "ipamConfig",
	});
	const peerFieldArray = useFieldArray({
		control: form.control,
		name: "peers",
	});

	const providerGroups = useMemo(
		() =>
			networkProviderCategoryOrder
				.map((category) => ({
					category,
					types: PROVIDER_TYPES.filter(
						(type) => CATEGORY_BY_TYPE[type] === category,
					),
				}))
				.filter((group) => group.types.length > 0),
		[],
	);

	const activeDescriptor = descriptors?.find(
		(descriptor) => descriptor.providerType === providerType,
	);

	useEffect(() => {
		if (provider) {
			const config = provider.config as Record<string, unknown>;
			const peers = provider.peers ?? [];
			form.reset({
				...defaultValues,
				name: provider.name,
				providerType: provider.providerType as ProviderType,
				interfaceName: String(config.interfaceName ?? "wg0"),
				cidr: String(config.cidr ?? ""),
				listenPort: String(config.listenPort ?? "51820"),
				wgEndpoint: String(config.endpoint ?? ""),
				publicKey: String(config.publicKey ?? ""),
				privateKeySecretRef: String(config.privateKeySecretRef ?? ""),
				dns: String(config.dns ?? ""),
				persistentKeepalive: String(config.persistentKeepalive ?? "25"),
				tailnet: String(config.tailnet ?? ""),
				authKeySecretRef: String(config.authKeySecretRef ?? ""),
				acceptRoutes: Boolean(config.acceptRoutes),
				advertiseExitNode: Boolean(config.advertiseExitNode),
				remote: String(config.remote ?? ""),
				port: String(config.port ?? "1194"),
				protocol: (config.protocol as NetworkForm["protocol"]) ?? "udp",
				caSecretRef: String(config.caSecretRef ?? ""),
				certSecretRef: String(config.certSecretRef ?? ""),
				keySecretRef: String(config.keySecretRef ?? ""),
				cipher: String(config.cipher ?? ""),
				baseUrl: String(config.baseUrl ?? ""),
				apiTokenSecretRef: String(config.apiTokenSecretRef ?? ""),
				allowInsecureTls: Boolean(config.allowInsecureTls),
				peers: peers.map((peer) => ({
					name: peer.name,
					address: peer.address,
					endpoint: peer.endpoint ?? "",
					publicKey: peer.publicKey ?? "",
					allowedIps: peer.allowedIps.join(", "),
				})),
			});
		} else if (!providerId) {
			form.reset({
				...defaultValues,
				...(defaultProviderType ? { providerType: defaultProviderType } : {}),
			});
		}
	}, [provider, providerId, form, defaultProviderType]);

	const onSubmit = async (data: NetworkForm) => {
		try {
			if (data.providerType === "docker") {
				await createNetwork.mutateAsync({
					name: data.name,
					driver: data.driver,
					serverId,
					internal: data.internal,
					attachable: data.attachable,
					enableIPv4: data.enableIPv4,
					enableIPv6: data.enableIPv6,
					mtu: data.mtu ? Number(data.mtu) : undefined,
					ipam: {
						driver: data.ipamDriver || undefined,
						config: data.ipamConfig,
					},
				});
				toast.success("Network created");
				await utils.network.all.invalidate({ serverId });
			} else {
				const payload: any = {
					name: data.name,
					config: buildConfig(data, serverId),
					peers: parsePeers(data.peers),
				};
				if (providerId) {
					await updateProvider.mutateAsync({
						...payload,
						networkProviderId: providerId,
					});
					toast.success("Network provider updated");
				} else {
					await createProvider.mutateAsync(payload);
					toast.success("Network provider created");
				}
				utils.networkProvider.all.invalidate();
				utils.networkProvider.descriptors.invalidate();
			}
			setIsOpen(false);
			form.reset(defaultValues);
		} catch (error) {
			toast.error("Error saving network", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const onTestConnection = async () => {
		const isValid = await form.trigger();
		if (!isValid) return;
		const data = form.getValues();
		await testConnection({
			config: buildConfig(data, serverId),
			...(providerId && { networkProviderId: providerId }),
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
		| "interfaceName"
		| "cidr"
		| "listenPort"
		| "wgEndpoint"
		| "publicKey"
		| "privateKeySecretRef"
		| "dns"
		| "persistentKeepalive"
		| "tailnet"
		| "authKeySecretRef"
		| "remote"
		| "port"
		| "caSecretRef"
		| "certSecretRef"
		| "keySecretRef"
		| "cipher"
		| "baseUrl"
		| "apiTokenSecretRef";

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
		name: "allowInsecureTls" | "acceptRoutes" | "advertiseExitNode",
		label: string,
		description: string,
	) => (
		<FormField
			key={name}
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-4">
					<div className="space-y-1 pr-1">
						<FormLabel>{label}</FormLabel>
						<FormDescription>{description}</FormDescription>
					</div>
					<FormControl>
						<Switch checked={field.value} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	);

	const peersSection = () => (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="space-y-1">
					<FormLabel className="flex items-center gap-2">
						<ShieldCheck className="size-4 text-muted-foreground" />
						Peers
					</FormLabel>
					<p className="text-sm text-muted-foreground">
						Servers and devices that join this network. Each peer needs a unique
						tunnel address.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						peerFieldArray.append({
							name: "",
							address: "",
							endpoint: "",
							publicKey: "",
							allowedIps: "",
						})
					}
				>
					<Plus className="size-4" />
					Add peer
				</Button>
			</div>
			{peerFieldArray.fields.length === 0 ? (
				<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
					No peers yet. Add a peer per server so they can reach each other over
					the tunnel.
				</p>
			) : (
				<div className="space-y-3">
					{peerFieldArray.fields.map((field, index) => (
						<div
							key={field.id}
							className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2"
						>
							<FormField
								control={form.control}
								name={`peers.${index}.name`}
								render={({ field: f }) => (
									<FormItem>
										<FormLabel className="text-muted-foreground">
											Peer name
										</FormLabel>
										<FormControl>
											<Input {...f} placeholder="server-fr" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`peers.${index}.address`}
								render={({ field: f }) => (
									<FormItem>
										<FormLabel className="text-muted-foreground">
											Tunnel address
										</FormLabel>
										<FormControl>
											<Input {...f} placeholder="10.80.0.2" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`peers.${index}.endpoint`}
								render={({ field: f }) => (
									<FormItem>
										<FormLabel className="text-muted-foreground">
											Endpoint (optional)
										</FormLabel>
										<FormControl>
											<Input {...f} placeholder="vpn.example.com:51820" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`peers.${index}.publicKey`}
								render={({ field: f }) => (
									<FormItem>
										<FormLabel className="text-muted-foreground">
											Public key (optional)
										</FormLabel>
										<FormControl>
											<Input {...f} placeholder="base64 public key" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`peers.${index}.allowedIps`}
								render={({ field: f }) => (
									<FormItem className="sm:col-span-2">
										<FormLabel className="text-muted-foreground">
											Allowed IPs (optional)
										</FormLabel>
										<FormControl>
											<Input {...f} placeholder="10.80.1.0/24, 10.80.2.0/24" />
										</FormControl>
										<FormDescription>
											Comma-separated CIDRs routed through this peer.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="sm:col-span-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => peerFieldArray.remove(index)}
								>
									<Trash2 className="size-4" />
									Remove peer
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);

	const dockerFields = () => (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<FormField
					control={form.control}
					name="driver"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Driver</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select driver" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{networkDriverEnum.map((driver) => (
										<SelectItem key={driver} value={driver}>
											{driver}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormDescription className="text-muted-foreground">
								bridge for single-server containers; overlay for Swarm services.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="mtu"
					render={({ field }) => (
						<FormItem>
							<FormLabel>MTU (optional)</FormLabel>
							<FormControl>
								<Input placeholder="1500" inputMode="numeric" {...field} />
							</FormControl>
							<FormDescription className="text-muted-foreground">
								Maximum transmission unit. Leave empty to use Docker's default.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{dockerToggleOptions.map((option) => (
					<FormField
						key={option.name}
						control={form.control}
						name={option.name}
						render={({ field }) => (
							<FormItem className="flex flex-row items-start justify-between gap-3 space-y-0 rounded-lg border p-4">
								<div className="space-y-1 pr-1">
									<FormLabel>{option.label}</FormLabel>
									<FormDescription className="text-muted-foreground">
										{option.description}
									</FormDescription>
								</div>
								<FormControl>
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
							</FormItem>
						)}
					/>
				))}
			</div>
			<div className="space-y-4 rounded-lg border p-4">
				<div className="space-y-1">
					<FormLabel>IPAM</FormLabel>
					<p className="text-sm text-muted-foreground">
						IP address management settings for this network.
					</p>
				</div>
				<FormField
					control={form.control}
					name="ipamDriver"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-muted-foreground">
								Driver (optional)
							</FormLabel>
							<FormControl>
								<Input {...field} placeholder="default" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="space-y-2">
					<FormLabel className="text-muted-foreground">
						Config (subnet / gateway / IP range)
					</FormLabel>
					{ipamConfigFieldArray.fields.map((field, index) => (
						<div key={field.id} className="flex flex-wrap gap-2">
							<FormField
								control={form.control}
								name={`ipamConfig.${index}.subnet`}
								render={({ field: f }) => (
									<FormItem className="min-w-[140px] flex-1">
										<FormControl>
											<Input {...f} placeholder="Subnet (e.g. 172.20.0.0/16)" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`ipamConfig.${index}.ipRange`}
								render={({ field: f }) => (
									<FormItem className="min-w-[120px] flex-1">
										<FormControl>
											<Input {...f} placeholder="IP range" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`ipamConfig.${index}.gateway`}
								render={({ field: f }) => (
									<FormItem className="min-w-[120px] flex-1">
										<FormControl>
											<Input {...f} placeholder="Gateway" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label="Remove IPAM config"
								onClick={() => ipamConfigFieldArray.remove(index)}
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							ipamConfigFieldArray.append({
								subnet: "",
								ipRange: "",
								gateway: "",
							})
						}
					>
						<Plus className="size-4" />
						Add IPAM config
					</Button>
				</div>
			</div>
		</>
	);

	const credentialFields = () => {
		switch (providerType) {
			case "docker":
				return dockerFields();
			case "wireguard":
				return (
					<>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{textField("interfaceName", "Interface name", {
								placeholder: "wg0",
							})}
							{textField("cidr", "Tunnel CIDR", {
								placeholder: "10.80.0.0/16",
								description:
									"The private range shared by every peer in this network.",
							})}
							{textField("listenPort", "Listen port", {
								type: "number",
								placeholder: "51820",
							})}
							{textField("wgEndpoint", "Public endpoint (optional)", {
								placeholder: "vpn.example.com:51820",
								description: "Host and port peers dial to reach this network.",
							})}
							{textField("publicKey", "Public key (optional)", {
								placeholder: "base64 public key",
							})}
							{textField(
								"privateKeySecretRef",
								"Private key secret ref (optional)",
								{
									placeholder: "prod-wireguard-private-key",
									description:
										"Reference to a vault secret. The private key itself is never stored.",
								},
							)}
							{textField("dns", "DNS (optional)", {
								placeholder: "10.80.0.1",
							})}
							{textField("persistentKeepalive", "Persistent keepalive", {
								type: "number",
								placeholder: "25",
							})}
						</div>
						{peersSection()}
					</>
				);
			case "tailscale":
				return (
					<>
						<AlertBlock type="info">
							Tailscale manages peers through your tailnet, so Notploy only
							stores the network definition and an auth key reference.
						</AlertBlock>
						{textField("tailnet", "Tailnet (optional)", {
							placeholder: "example.com",
						})}
						{textField("authKeySecretRef", "Auth key secret ref (optional)", {
							placeholder: "prod-tailscale-auth-key",
							description:
								"Reference to a vault secret. The auth key itself is never stored.",
						})}
						{switchField(
							"acceptRoutes",
							"Accept routes",
							"Accept subnet routes advertised by other nodes in the tailnet.",
						)}
						{switchField(
							"advertiseExitNode",
							"Advertise exit node",
							"Offer this server as an exit node for the tailnet.",
						)}
					</>
				);
			case "openvpn":
				return (
					<>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{textField("remote", "Remote host", {
								placeholder: "vpn.example.com",
							})}
							{textField("port", "Port", {
								type: "number",
								placeholder: "1194",
							})}
							<FormField
								control={form.control}
								name="protocol"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Protocol</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="udp">UDP</SelectItem>
												<SelectItem value="tcp">TCP</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							{textField("cipher", "Cipher (optional)", {
								placeholder: "AES-256-GCM",
							})}
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							{textField("caSecretRef", "CA secret ref (optional)", {
								placeholder: "prod-openvpn-ca",
							})}
							{textField("certSecretRef", "Certificate secret ref (optional)", {
								placeholder: "prod-openvpn-cert",
							})}
							{textField("keySecretRef", "Key secret ref (optional)", {
								placeholder: "prod-openvpn-key",
								description: "Vault references — keys are never stored inline.",
							})}
						</div>
						{peersSection()}
					</>
				);
			case "custom":
				return (
					<>
						{textField("baseUrl", "Base URL", {
							placeholder: "https://network.example.com/api",
							description:
								"Endpoint implementing Notploy's documented network adapter contract.",
						})}
						{textField("apiTokenSecretRef", "API token secret ref (optional)", {
							placeholder: "prod-custom-network-token",
							description:
								"Reference to a vault secret. The token itself is never stored.",
						})}
						{textField("cidr", "CIDR (optional)", {
							placeholder: "10.90.0.0/16",
						})}
						{switchField(
							"allowInsecureTls",
							"Allow self-signed TLS",
							"Skip certificate verification for this endpoint.",
						)}
					</>
				);
			default:
				return null;
		}
	};

	const isEditingProvider = Boolean(providerId);
	const submitLabel = isEditingProvider
		? "Update provider"
		: providerType === "docker"
			? "Create network"
			: "Create provider";

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{children ? (
				<DialogTrigger asChild>{children}</DialogTrigger>
			) : isEditingProvider ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit network provider</span>
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Edit network provider</TooltipContent>
				</Tooltip>
			) : (
				<DialogTrigger asChild>
					<Button>
						<Plus className="size-4" />
						Add network
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Network className="size-5 text-muted-foreground" />
						{isEditingProvider ? "Update network provider" : "Add network"}
					</DialogTitle>
					<DialogDescription>
						{isEditingProvider
							? "Update the provider configuration and its peers. Networks keep referencing this provider by its stable id."
							: providerType === "docker"
								? "Create a new Docker network for your organization. Networks are immutable: to change one, delete it and create it again."
								: "Declare a VPN network and the peers that join it. Notploy stores references to secrets, never the keys themselves."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex w-full flex-col gap-6"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{providerType === "docker"
											? "Network name"
											: "Provider name"}
									</FormLabel>
									<FormControl>
										<Input
											placeholder={
												providerType === "docker" ? "my-network" : "sge-private"
											}
											{...field}
										/>
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
										disabled={isEditingProvider}
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
														{networkProviderCategoryLabels[group.category] ??
															group.category}
													</SelectLabel>
													{group.types.map((value) => {
														const ProviderIcon =
															networkProviderIcons[
																networkProviderIconKey(value)
															];
														return (
															<SelectItem key={value} value={value}>
																<div className="flex flex-row items-center gap-2">
																	<ProviderIcon className="size-4 shrink-0" />
																	{networkProviderLabel(value)}
																</div>
															</SelectItem>
														);
													})}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
									{activeDescriptor && (
										<NetworkProviderCapabilityMatrix
											capabilities={activeDescriptor.capabilities}
											compact
											className="pt-1"
										/>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>

						{credentialFields()}

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							{providerType === "docker" ? (
								<span className="text-sm text-muted-foreground">
									Docker networks are immutable.
								</span>
							) : (
								<Button
									type="button"
									variant="secondary"
									isLoading={isTesting}
									onClick={onTestConnection}
								>
									Test connection
								</Button>
							)}
							<div className="flex flex-row gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									isLoading={
										createNetwork.isPending ||
										createProvider.isPending ||
										updateProvider.isPending
									}
								>
									{submitLabel}
								</Button>
							</div>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
