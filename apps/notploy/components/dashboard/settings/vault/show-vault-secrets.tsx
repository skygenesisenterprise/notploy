import type { VaultSecretRecord } from "@notploy/server";
import {
	ArrowLeft,
	Check,
	Copy,
	KeyRound,
	Loader2,
	PenBoxIcon,
	PlusIcon,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import copy from "copy-to-clipboard";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { vaultProviderIcons } from "@/components/icons/vault-provider-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { HandleVaultSecret } from "./handle-vault-secret";
import { VaultCapabilityMatrix } from "./vault-capability-matrix";
import {
	vaultHealthLabels,
	vaultProviderCategoryLabels,
	vaultProviderIconKey,
	vaultProviderLabel,
} from "./vault-provider-meta";

interface Props {
	vaultProviderId: string;
}

const reference = (providerName: string, secretName: string) =>
	`\${{vault.${providerName}.${secretName}}}`;

const sourceStyles: Record<string, string> = {
	"Mounted file":
		"border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	"Swarm secret":
		"border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
	"Swarm config":
		"border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const healthStyles: Record<string, string> = {
	connected:
		"border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	degraded:
		"border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	unreachable:
		"border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
	misconfigured:
		"border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
	checking: "border-border bg-muted/40 text-muted-foreground",
};

const CopyReference = ({ value }: { value: string }) => {
	const [copied, setCopied] = useState(false);

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="text-muted-foreground"
			onClick={() => {
				copy(value);
				setCopied(true);
				toast.success("Reference copied");
				window.setTimeout(() => setCopied(false), 1500);
			}}
		>
			{copied ? (
				<Check className="size-3.5 text-emerald-500" />
			) : (
				<Copy className="size-3.5" />
			)}
			<span className="sr-only">Copy reference</span>
		</Button>
	);
};

const ResolvabilityBadge = ({ record }: { record: VaultSecretRecord }) => {
	const resolvable = record.resolvable !== false;
	const badge = (
		<Badge variant={resolvable ? "secondary" : "outline"}>
			{resolvable ? "Resolvable" : "Metadata only"}
		</Badge>
	);

	if (resolvable || !record.detail) {
		return badge;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{badge}</TooltipTrigger>
			<TooltipContent>{record.detail}</TooltipContent>
		</Tooltip>
	);
};

export const ShowVaultSecrets = ({ vaultProviderId }: Props) => {
	const [search, setSearch] = useState("");
	const [removingId, setRemovingId] = useState<string | null>(null);

	const { data: provider } = api.vaultProvider.one.useQuery({ vaultProviderId });
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canRead = !!permissions?.vaultProvider.read;
	const canCreate = !!permissions?.vaultProvider.create;
	const canWrite = !!permissions?.vaultProvider.update;
	const canDelete = !!permissions?.vaultProvider.delete;
	const { mutateAsync: removeSecret } =
		api.vaultProvider.removeSecret.useMutation();
	const { data: descriptors } = api.vaultProvider.descriptors.useQuery(
		undefined,
		{ enabled: canRead },
	);
	const { data: health, isPending: isHealthPending } =
		api.vaultProvider.health.useQuery(
			{ vaultProviderId },
			{ retry: false, refetchOnWindowFocus: false },
		);
	const { data, isPending, isError, error, refetch, isFetching } =
		api.vaultProvider.listSecrets.useQuery(
			{ vaultProviderId },
			{ retry: false, refetchOnWindowFocus: false },
		);

	const providerName = provider?.name ?? "";
	const descriptor = descriptors?.find(
		(item) => item.providerType === provider?.providerType,
	);
	const ProviderIcon = provider
		? vaultProviderIcons[vaultProviderIconKey(provider.providerType)]
		: KeyRound;

	const records = useMemo(() => data?.secrets ?? [], [data]);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return records;
		return records.filter(
			(record) =>
				record.name.toLowerCase().includes(query) ||
				(record.source ?? "").toLowerCase().includes(query),
		);
	}, [records, search]);

	const healthStatus = isHealthPending
		? "checking"
		: (health?.status ?? "unreachable");

	const handleDeleteSecret = async (vaultSecretId: string) => {
		setRemovingId(vaultSecretId);
		await removeSecret({ vaultSecretId })
			.then(() => {
				toast.success("Secret deleted");
				refetch();
			})
			.catch(() => {
				toast.error("Error deleting the secret");
			})
			.finally(() => setRemovingId(null));
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-start justify-between gap-4 p-6">
						<div className="flex flex-1 flex-row items-start gap-3">
							<Button variant="ghost" size="icon" asChild>
								<Link href="/dashboard/settings/secrets">
									<ArrowLeft className="size-4" />
									<span className="sr-only">Back to secrets providers</span>
								</Link>
							</Button>
							<CardHeader className="flex-1 p-0">
								<CardTitle className="flex flex-row items-center gap-2 text-xl">
									<ProviderIcon className="size-6 shrink-0" />
									{providerName || "Secrets records"}
								</CardTitle>
								<CardDescription>
									Secrets this provider exposes. Reference one in an
									environment variable with{" "}
									<code>{"${{vault.<name>.<secret>}}"}</code>. Values are fetched
									at deploy time and never stored in Notploy.
								</CardDescription>
							</CardHeader>
						</div>

						<div className="flex flex-col items-end gap-2">
							<div className="flex flex-row items-center gap-2">
								{descriptor && (
									<Badge variant="secondary">
										{vaultProviderCategoryLabels[descriptor.category] ??
											descriptor.category}
									</Badge>
								)}
								<span
									className={cn(
										"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
										healthStyles[healthStatus],
									)}
								>
									{isHealthPending ? (
										<Loader2 className="size-3 animate-spin" aria-hidden="true" />
									) : (
										<KeyRound className="size-3" aria-hidden="true" />
									)}
									{healthStatus === "checking"
										? "Checking"
										: vaultHealthLabels[healthStatus]}
								</span>
								{canCreate && (
									<HandleVaultSecret
										vaultProviderId={vaultProviderId}
										trigger={
											<Button size="sm">
												<PlusIcon className="size-4" />
												Add Secrets
											</Button>
										}
									/>
								)}
							</div>
							{provider && (
								<span className="text-xs text-muted-foreground">
									{vaultProviderLabel(provider.providerType)}
								</span>
							)}
						</div>
					</div>

					{descriptor && (
						<div className="border-t px-6 py-4">
							<VaultCapabilityMatrix capabilities={descriptor.capabilities} />
						</div>
					)}

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading secrets...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : records.length === 0 ? (
							<div className="flex min-h-[45vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8">
								<div className="rounded-full bg-muted p-4">
									<KeyRound className="size-10 text-muted-foreground" />
								</div>
								<div className="space-y-1 text-center">
									<p className="text-sm font-medium">No secrets found</p>
									<p className="max-w-sm text-sm text-muted-foreground">
										{descriptor?.capabilities.listSecrets === false
											? "This provider cannot be browsed: references are written by path or key."
											: "These credentials can't reach any secret yet. Check that the provider exposes at least one secret."}
									</p>
								</div>
							</div>
						) : (
							<>
								<div className="flex flex-wrap items-center gap-2">
									<div className="relative min-w-52 flex-1">
										<Input
											placeholder="Search secrets"
											value={search}
											onChange={(event) => setSearch(event.target.value)}
											className="pr-10"
										/>
										<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									</div>
									<Button
										variant="outline"
										size="sm"
										isLoading={isFetching}
										onClick={() => void refetch()}
									>
										<RefreshCw className="size-4" />
										Refresh
									</Button>
								</div>

								<div className="flex items-center justify-between">
									<span className="text-xs text-muted-foreground tabular-nums">
										{filtered.length} secret{filtered.length === 1 ? "" : "s"}
										{filtered.length !== records.length &&
											` of ${records.length}`}
									</span>
								</div>

								<div className="overflow-hidden rounded-lg border">
									<Table>
										<TableHeader className="[&_tr]:border-b">
											<TableRow className="bg-muted/40 hover:bg-muted/40">
												<TableHead className="h-9 px-4 text-xs">Name</TableHead>
												<TableHead className="h-9 px-4 text-xs">Source</TableHead>
												<TableHead className="h-9 px-4 text-xs">Status</TableHead>
												<TableHead className="h-9 px-4 text-xs">
													Reference
												</TableHead>
												<TableHead className="h-9 px-4 text-right text-xs">
													<span className="sr-only">Actions</span>
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filtered.length === 0 ? (
												<TableRow className="hover:bg-transparent">
													<TableCell
														colSpan={5}
														className="h-24 text-center text-muted-foreground"
													>
														No secrets match your search.
													</TableCell>
												</TableRow>
											) : (
												filtered.map((record) => (
													<TableRow key={record.name}>
														<TableCell className="px-4 py-2">
															<div className="flex items-center gap-2">
																<KeyRound
																	className="size-3.5 shrink-0 text-muted-foreground"
																	aria-hidden="true"
																/>
																<span
																	className="block max-w-[34ch] truncate font-mono text-sm font-medium"
																	title={record.name}
																>
																	{record.name}
																</span>
															</div>
														</TableCell>
														<TableCell className="px-4 py-2">
															{record.source ? (
																<span
																	className={cn(
																		"inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
																		sourceStyles[record.source] ??
																			"border-border bg-muted/40 text-muted-foreground",
																	)}
																>
																	{record.source}
																</span>
															) : (
																<span className="text-muted-foreground">—</span>
															)}
														</TableCell>
														<TableCell className="px-4 py-2">
															<ResolvabilityBadge record={record} />
														</TableCell>
														<TableCell className="px-4 py-2">
															<span
																className="block max-w-[40ch] truncate font-mono text-xs text-muted-foreground"
																title={reference(providerName, record.name)}
															>
																{reference(providerName, record.name)}
															</span>
														</TableCell>
														<TableCell className="px-4 py-2 text-right">
															<div className="flex items-center justify-end gap-1">
																<CopyReference
																	value={reference(providerName, record.name)}
																/>
																{record.managed && record.id && canWrite && (
																	<HandleVaultSecret
																		vaultProviderId={vaultProviderId}
																		secret={{
																			vaultSecretId: record.id,
																			name: record.name,
																			description: record.detail,
																		}}
																		trigger={
																			<Button
																				variant="ghost"
																				size="icon-sm"
																				className="text-muted-foreground"
																			>
																				<PenBoxIcon className="size-4" />
																				<span className="sr-only">Edit secret</span>
																			</Button>
																		}
																	/>
																)}
																{record.managed && record.id && canDelete && (
																	<DialogAction
																		title="Delete Secret"
																		description={`Delete the secret "${record.name}"? Deployments referencing it will fail to resolve it.`}
																		type="destructive"
																		onClick={() => handleDeleteSecret(record.id as string)}
																	>
																		<Button
																			variant="ghost"
																			size="icon-sm"
																			className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
																			isLoading={removingId === record.id}
																		>
																			<Trash2 className="size-4" />
																			<span className="sr-only">Delete secret</span>
																		</Button>
																	</DialogAction>
																)}
															</div>
														</TableCell>
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</div>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
