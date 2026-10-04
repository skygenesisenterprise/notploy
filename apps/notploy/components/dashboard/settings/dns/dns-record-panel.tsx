import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Cloud, CloudOff, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";

export const DNS_RECORD_TYPES = [
	"A",
	"AAAA",
	"CNAME",
	"MX",
	"TXT",
	"NS",
	"SRV",
	"CAA",
	"PTR",
] as const;

type RecordType = (typeof DNS_RECORD_TYPES)[number];

export const PROXIABLE_TYPES: readonly string[] = ["A", "AAAA", "CNAME"];

const valueFields: Record<
	RecordType,
	{ label: string; placeholder: string; hint?: string }
> = {
	A: { label: "IPv4 address", placeholder: "203.0.113.10" },
	AAAA: { label: "IPv6 address", placeholder: "2001:db8::1" },
	CNAME: { label: "Target", placeholder: "app.example.com" },
	MX: {
		label: "Mail server",
		placeholder: "10 mail.example.com",
		hint: "Start with the priority, then the mail server.",
	},
	TXT: { label: "Value", placeholder: "v=spf1 include:_spf.example.com ~all" },
	NS: { label: "Nameserver", placeholder: "ns1.example.com" },
	SRV: {
		label: "Target",
		placeholder: "1 10 5269 talk.example.com",
		hint: "Priority, weight, port, then target.",
	},
	CAA: {
		label: "Value",
		placeholder: '0 issue "letsencrypt.org"',
		hint: "Flags, tag, then the quoted value.",
	},
	PTR: { label: "Target", placeholder: "host.example.com" },
};

const structuredValuePatterns: Partial<Record<RecordType, RegExp>> = {
	SRV: /^\d+\s+\d+\s+\d+\s+\S+$/,
	CAA: /^\d+\s+\S+\s+.+$/,
};

const DnsRecordSchema = z
	.object({
		type: z.enum(DNS_RECORD_TYPES),
		name: z.string().min(1, { message: "Name is required" }),
		content: z.string().min(1, { message: "Content is required" }),
		ttl: z.string(),
		proxied: z.boolean(),
		comment: z.string().max(500).optional(),
		tags: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		const values = data.content
			.split("\n")
			.map((value) => value.trim())
			.filter(Boolean);
		if (!values.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["content"],
				message: "Content is required",
			});
			return;
		}
		const pattern = structuredValuePatterns[data.type];
		if (pattern && !values.every((value) => pattern.test(value))) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["content"],
				message: `Expected ${valueFields[data.type].placeholder}`,
			});
		}
	});

type DnsRecordFormValues = z.infer<typeof DnsRecordSchema>;

export interface DnsRecordValue {
	id: string;
	type: string;
	name: string;
	content: string;
	ttl: number;
	proxied?: boolean;
	comment?: string;
	tags?: string[];
}

interface DnsRecordFormProps {
	dnsProviderId: string;
	zoneId: string;
	zoneName: string;
	record: DnsRecordValue | null;
	onClose: () => void;
}

/**
 * The record form shared by the side panel (editing) and the create dialog, so
 * both stay in sync.
 */
export const DnsRecordForm = ({
	dnsProviderId,
	zoneId,
	zoneName,
	record,
	onClose,
}: DnsRecordFormProps) => {
	const utils = api.useUtils();
	const createRecord = api.dnsProvider.createRecord.useMutation();
	const updateRecord = api.dnsProvider.updateRecord.useMutation();
	const { mutateAsync, isPending, error, isError } = record
		? updateRecord
		: createRecord;

	const { data: provider } = api.dnsProvider.one.useQuery({ dnsProviderId });
	const { data: servers } = api.server.all.useQuery();
	const { data: panelPublicIp } = api.server.publicIp.useQuery();
	const { data: panelStoredIp } = api.settings.getIp.useQuery();

	const panelIp = panelPublicIp || panelStoredIp;
	const ipSuggestions = [
		...(panelIp ? [{ ip: panelIp, label: "This Notploy server" }] : []),
		...(servers ?? []).map((server) => ({
			ip: server.ipAddress,
			label: server.name,
		})),
	].filter(
		(suggestion, index, all) =>
			!!suggestion.ip && all.findIndex((s) => s.ip === suggestion.ip) === index,
	);

	const form = useForm<DnsRecordFormValues>({
		defaultValues: record
			? {
					type: (DNS_RECORD_TYPES.includes(record.type as RecordType)
						? record.type
						: "A") as RecordType,
					name: record.name,
					content: record.content,
					ttl: record.ttl && record.ttl !== 1 ? String(record.ttl) : "",
					proxied: record.proxied ?? false,
					comment: record.comment ?? "",
					tags: (record.tags ?? []).join(", "),
				}
			: {
					type: "A",
					name: "",
					content: "",
					ttl: "",
					proxied: false,
					comment: "",
					tags: "",
				},
		resolver: zodResolver(DnsRecordSchema),
	});

	const type = form.watch("type");
	const proxied = form.watch("proxied");
	const canProxy =
		provider?.providerType === "cloudflare" && PROXIABLE_TYPES.includes(type);
	const supportsMultipleValues = provider?.providerType === "route53";
	const usesAutomaticTtl = canProxy && proxied;

	const onSubmit = async (data: DnsRecordFormValues) => {
		const name = data.name.trim() === "@" ? zoneName : data.name;
		const isProxied = canProxy && data.proxied;
		const tags = (data.tags ?? "")
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
		const payload = {
			dnsProviderId,
			zoneId,
			type: data.type,
			name,
			content: data.content,
			ttl: !isProxied && data.ttl ? Number(data.ttl) : undefined,
			comment: data.comment?.trim() || undefined,
			tags: tags.length ? tags : undefined,
			...(canProxy && { proxied: data.proxied }),
			...(record && { recordId: record.id }),
		};
		await mutateAsync(payload as any)
			.then(() => {
				toast.success(record ? "Record updated" : "Record created");
				utils.dnsProvider.listRecords.invalidate({ dnsProviderId, zoneId });
				onClose();
			})
			.catch(() => {});
	};

	return (
		<>
			{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="grid w-full gap-4"
				>
					<FormField
						control={form.control}
						name="type"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Type</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{DNS_RECORD_TYPES.map((recordType) => (
											<SelectItem key={recordType} value={recordType}>
												{recordType}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input placeholder="app.example.com" {...field} />
								</FormControl>
								<FormDescription>
									Use <code>@</code> for the root domain.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					{type === "A" && ipSuggestions.length > 0 && (
						<FormItem>
							<FormLabel>Fill from server (optional)</FormLabel>
							<Select
								onValueChange={(ip) =>
									form.setValue("content", ip, { shouldValidate: true })
								}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a server" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{ipSuggestions.map((suggestion) => (
										<SelectItem key={suggestion.ip} value={suggestion.ip}>
											<div className="flex flex-row items-center gap-2">
												<span>{suggestion.label}</span>
												<span className="text-xs text-muted-foreground">
													{suggestion.ip}
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormItem>
					)}
					<FormField
						control={form.control}
						name="content"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{valueFields[type].label}</FormLabel>
								<FormControl>
									{supportsMultipleValues ? (
										<Textarea
											className="min-h-[60px] font-mono text-xs"
											placeholder={valueFields[type].placeholder}
											{...field}
										/>
									) : (
										<Input
											placeholder={valueFields[type].placeholder}
											{...field}
										/>
									)}
								</FormControl>
								{(supportsMultipleValues || valueFields[type].hint) && (
									<FormDescription>
										{[
											valueFields[type].hint,
											supportsMultipleValues &&
												"One value per line: every line belongs to the same record set.",
										]
											.filter(Boolean)
											.join(" ")}
									</FormDescription>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>
					{canProxy && (
						<FormField
							control={form.control}
							name="proxied"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Proxy status</FormLabel>
									<fieldset className="relative grid min-w-0 grid-cols-2 rounded-lg border bg-muted/40 p-1">
										<legend className="sr-only">Proxy status</legend>
										<span
											aria-hidden="true"
											className={cn(
												"pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-4px)] rounded-md bg-background shadow-sm ring-1 ring-foreground/10 transition-transform duration-[250ms] ease-[var(--ease-smooth-out)] will-change-transform motion-reduce:transition-none",
												field.value && "translate-x-full",
											)}
										/>
										<button
											type="button"
											aria-pressed={!field.value}
											onClick={() => field.onChange(false)}
											className={cn(
												"relative z-10 flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors duration-[250ms] ease-[var(--ease-smooth-out)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
												field.value
													? "text-muted-foreground hover:text-foreground"
													: "text-foreground",
											)}
										>
											<CloudOff className="size-3.5" />
											DNS only
										</button>
										<button
											type="button"
											aria-pressed={field.value}
											onClick={() => field.onChange(true)}
											className={cn(
												"relative z-10 flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors duration-[250ms] ease-[var(--ease-smooth-out)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
												field.value
													? "text-[#f6821f]"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											<Cloud className="size-3.5" />
											Proxied
										</button>
									</fieldset>
									<FormDescription>
										{field.value
											? "Traffic runs through Cloudflare and the origin IP stays hidden."
											: "Cloudflare only answers the DNS query; traffic reaches the origin directly."}
									</FormDescription>
								</FormItem>
							)}
						/>
					)}
					<FormField
						control={form.control}
						name="comment"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Comment (optional)</FormLabel>
								<FormControl>
									<Input
										placeholder="Anything worth remembering about this record"
										{...field}
										value={field.value ?? ""}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="tags"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Tags (optional)</FormLabel>
								<FormControl>
									<Input
										placeholder="production, mail"
										{...field}
										value={field.value ?? ""}
									/>
								</FormControl>
								<FormDescription>Comma-separated labels.</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="ttl"
						render={({ field }) => (
							<FormItem>
								<FormLabel>TTL (optional)</FormLabel>
								<FormControl>
									<Input
										type="number"
										placeholder="Auto"
										className="tabular-nums"
										disabled={usesAutomaticTtl}
										{...field}
									/>
								</FormControl>
								{usesAutomaticTtl && (
									<FormDescription>
										Proxied records always use automatic TTL.
									</FormDescription>
								)}
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className="flex flex-row justify-end gap-2">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" isLoading={isPending}>
							{record ? "Update" : "Create"}
						</Button>
					</div>
				</form>
			</Form>
		</>
	);
};

interface Props {
	dnsProviderId: string;
	zoneId: string;
	zoneName: string;
	record: DnsRecordValue | null;
	onClose: () => void;
}

export const DnsRecordPanel = ({
	dnsProviderId,
	zoneId,
	zoneName,
	record,
	onClose,
}: Props) => {
	return (
		<div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
			<div className="flex items-start justify-between gap-2">
				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-medium">
						{record ? "Edit record" : "New record"}
					</span>
					<span className="text-xs text-muted-foreground">{zoneName}</span>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close panel"
				>
					<XIcon className="size-4" />
				</Button>
			</div>

			<DnsRecordForm
				dnsProviderId={dnsProviderId}
				zoneId={zoneId}
				zoneName={zoneName}
				record={record}
				onClose={onClose}
			/>
		</div>
	);
};

interface AddDnsRecordDialogProps {
	dnsProviderId: string;
	zoneId: string;
	zoneName: string;
	trigger?: ReactNode;
}

/**
 * Create dialog: the "Add record" entry point opens a centered modal instead of
 * the side panel, which stays reserved for editing an existing record.
 */
export const AddDnsRecordDialog = ({
	dnsProviderId,
	zoneId,
	zoneName,
	trigger,
}: AddDnsRecordDialogProps) => {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button>
						<PlusIcon className="size-4" />
						Add record
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add DNS record</DialogTitle>
					<DialogDescription>
						Create a record in {zoneName || "this zone"}. It is written straight
						to the provider.
					</DialogDescription>
				</DialogHeader>
				<DnsRecordForm
					dnsProviderId={dnsProviderId}
					zoneId={zoneId}
					zoneName={zoneName}
					record={null}
					onClose={() => setOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
};
