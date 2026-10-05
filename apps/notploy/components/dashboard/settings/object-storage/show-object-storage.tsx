import { HardDrive, HeartPulse, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { objectStorageProviderIcons } from "@/components/icons/object-storage-provider-icons";
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
import { HandleObjectStorage } from "./handle-object-storage";
import {
	objectStorageCategoryLabels,
	objectStorageHealthLabels,
	objectStorageProviderIconKey,
	objectStorageProviderLabel,
} from "./object-storage-meta";

interface HealthBadgeProps {
	objectStorageProviderId: string;
}

const HealthBadge = ({ objectStorageProviderId }: HealthBadgeProps) => {
	const { data, isPending, isError, refetch, isFetching } =
		api.objectStorage.providerHealth.useQuery(
			{ objectStorageProviderId },
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

	const label =
		status === "checking" ? "Checking" : objectStorageHealthLabels[status];

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
						<span className="text-xs opacity-80">{data.latencyMs} ms</span>
					)}
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

export const ShowObjectStorage = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const { mutateAsync } = api.objectStorage.removeProvider.useMutation();
	const {
		data: providers,
		isPending,
		refetch,
	} = api.objectStorage.providers.useQuery();
	const { data: buckets } = api.objectStorage.buckets.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const bucketsByProvider = new Map<string, number>();
	for (const bucket of buckets ?? []) {
		bucketsByProvider.set(
			bucket.objectStorageProviderId,
			(bucketsByProvider.get(bucket.objectStorageProviderId) ?? 0) + 1,
		);
	}

	const providerCount = providers?.length ?? 0;

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<HardDrive className="size-6 text-muted-foreground self-center" />
								Object Storage
							</CardTitle>
							<CardDescription>
								Connect managed or self-hosted S3-compatible providers. Buckets
								and backups consume a provider without ever seeing its
								credentials.
							</CardDescription>
						</CardHeader>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="tabular-nums">
								{providerCount} connected
							</Badge>
							{permissions?.objectStorage.create && <HandleObjectStorage />}
						</div>
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : providerCount === 0 ? (
							<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
								<HardDrive className="size-8 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									No object storage connected
								</span>
								<span className="max-w-sm text-center text-sm text-muted-foreground">
									Use <span className="font-medium">Add Storage</span> to
									connect an external provider such as AWS S3 or Cloudflare R2,
									or a self-hosted S3-compatible endpoint.
								</span>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{providers?.map((provider) => {
									const ProviderIcon =
										objectStorageProviderIcons[
											objectStorageProviderIconKey(provider.providerType)
										];
									const bucketCount =
										bucketsByProvider.get(provider.objectStorageProviderId) ??
										0;
									return (
										<li
											key={provider.objectStorageProviderId}
											className="group relative flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring"
										>
											<Link
												href={`/dashboard/settings/destinations/${provider.objectStorageProviderId}`}
												aria-label={`View buckets for ${provider.name}`}
												className="absolute inset-0 rounded-lg outline-none"
											/>
											<ProviderIcon className="size-7 shrink-0" />
											<div className="flex min-w-0 flex-col gap-0.5">
												<span className="truncate text-sm font-medium">
													{provider.name}
												</span>
												<span className="truncate text-xs text-muted-foreground">
													{objectStorageProviderLabel(provider.providerType)}
													{" · "}
													{objectStorageCategoryLabels[provider.category] ??
														provider.category}
												</span>
											</div>

											<div className="relative z-10 ml-auto flex flex-row items-center gap-1">
												{bucketCount > 0 && (
													<Badge variant="outline" className="tabular-nums">
														{bucketCount}{" "}
														{bucketCount === 1 ? "bucket" : "buckets"}
													</Badge>
												)}
												<HealthBadge
													objectStorageProviderId={
														provider.objectStorageProviderId
													}
												/>
												{permissions?.objectStorage.update && (
													<HandleObjectStorage
														objectStorageProviderId={
															provider.objectStorageProviderId
														}
													/>
												)}
												{permissions?.objectStorage.delete && (
													<Tooltip>
														<DialogAction
															title="Delete Storage"
															description="Buckets that use this provider will also be removed. Are you sure?"
															type="destructive"
															onClick={async () => {
																setRemovingId(provider.objectStorageProviderId);
																await mutateAsync({
																	objectStorageProviderId:
																		provider.objectStorageProviderId,
																})
																	.then(() => {
																		toast.success("Storage deleted");
																		refetch();
																	})
																	.catch(() => {
																		toast.error("Error deleting the storage");
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
																		removingId ===
																		provider.objectStorageProviderId
																	}
																>
																	<Trash2 className="size-4" />
																	<span className="sr-only">
																		Delete storage
																	</span>
																</Button>
															</TooltipTrigger>
														</DialogAction>
														<TooltipContent>Delete storage</TooltipContent>
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
