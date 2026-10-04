import {
	Activity,
	EyeIcon,
	Globe,
	HeartPulse,
	Loader2,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { dnsProviderIcons } from "@/components/icons/dns-provider-icons";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import {
	dnsHealthLabels,
	dnsProviderIconKey,
	dnsProviderLabel,
} from "./dns-provider-meta";
import { HandleDnsProvider } from "./handle-dns-provider";

interface HealthBadgeProps {
	dnsProviderId: string;
}

const HealthBadge = ({ dnsProviderId }: HealthBadgeProps) => {
	const { data, isPending, isError, refetch, isFetching } =
		api.dnsProvider.health.useQuery(
			{ dnsProviderId },
			{ retry: false, refetchOnWindowFocus: false },
		);

	const status = isPending
		? "checking"
		: isError
			? "unreachable"
			: (data?.status ?? "unreachable");

	const styles: Record<string, string> = {
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

	const label = status === "checking" ? "Checking" : dnsHealthLabels[status];

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void refetch();
					}}
					className={cn(
						"relative z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
						styles[status],
					)}
				>
					{isPending || isFetching ? (
						<Loader2 className="size-3 animate-spin" aria-hidden="true" />
					) : (
						<HeartPulse className="size-3" aria-hidden="true" />
					)}
					{label}
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<div className="flex flex-col gap-1">
					<span>{data?.message ?? label}</span>
					{data?.latencyMs != null && (
						<span className="text-xs opacity-80">
							{data.latencyMs} ms
							{data.zoneCount != null
								? ` · ${data.zoneCount} zone${data.zoneCount === 1 ? "" : "s"}`
								: ""}
						</span>
					)}
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

export const ShowDnsProviders = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const { mutateAsync } = api.dnsProvider.remove.useMutation();
	const { data, isPending, refetch } = api.dnsProvider.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const connectedCount = data?.length ?? 0;

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<Globe className="size-6 text-muted-foreground self-center" />
								DNS Providers
							</CardTitle>
							<CardDescription>
								Connect managed, self-hosted or internal DNS so Notploy can
								create the records a domain needs without leaving the Console.
							</CardDescription>
						</CardHeader>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="tabular-nums">
								{connectedCount} connected
							</Badge>
							{permissions?.dnsProvider.create && <HandleDnsProvider />}
						</div>
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : connectedCount === 0 ? (
							<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
								<Activity className="size-8 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									No DNS providers connected
								</span>
								<span className="max-w-sm text-center text-sm text-muted-foreground">
									Use <span className="font-medium">Add Provider</span> to pick
									a managed, self-hosted or internal provider and connect its
									credentials.
								</span>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{data?.map((provider) => {
									const ProviderIcon =
										dnsProviderIcons[dnsProviderIconKey(provider.providerType)];
									const href = `/dashboard/settings/dns/${provider.dnsProviderId}`;
									return (
										<li
											key={provider.dnsProviderId}
											className="group relative flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring"
										>
											<Link
												href={href}
												aria-label={`View domains for ${provider.name}`}
												className="absolute inset-0 rounded-lg outline-none"
											/>
											<ProviderIcon className="size-7 shrink-0" />
											<div className="flex min-w-0 flex-col gap-0.5">
												<span className="truncate text-sm font-medium">
													{provider.name}
												</span>
												<span className="text-xs text-muted-foreground">
													{dnsProviderLabel(provider.providerType)}
												</span>
											</div>

											<div className="relative z-10 ml-auto flex flex-row items-center gap-1">
												<HealthBadge dnsProviderId={provider.dnsProviderId} />
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="text-muted-foreground"
															asChild
														>
															<Link href={href}>
																<EyeIcon className="size-4" />
																<span className="sr-only">View domains</span>
															</Link>
														</Button>
													</TooltipTrigger>
													<TooltipContent>View domains</TooltipContent>
												</Tooltip>

												{permissions?.dnsProvider.update && (
													<HandleDnsProvider
														dnsProviderId={provider.dnsProviderId}
													/>
												)}
												{permissions?.dnsProvider.delete && (
													<Tooltip>
														<DialogAction
															title="Delete DNS Provider"
															description="Domains that rely on this provider to manage their records will need to be updated manually. Are you sure?"
															type="destructive"
															onClick={async () => {
																setRemovingId(provider.dnsProviderId);
																await mutateAsync({
																	dnsProviderId: provider.dnsProviderId,
																})
																	.then(() => {
																		toast.success("DNS provider deleted");
																		refetch();
																	})
																	.catch(() => {
																		toast.error(
																			"Error deleting the DNS provider",
																		);
																	})
																	.finally(() => setRemovingId(null));
															}}
														>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
																	isLoading={
																		removingId === provider.dnsProviderId
																	}
																>
																	<Trash2 className="size-4" />
																	<span className="sr-only">
																		Delete provider
																	</span>
																</Button>
															</TooltipTrigger>
														</DialogAction>
														<TooltipContent>Delete provider</TooltipContent>
													</Tooltip>
												)}
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
