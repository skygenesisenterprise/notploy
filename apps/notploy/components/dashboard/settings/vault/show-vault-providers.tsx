import { EyeIcon, KeyRound, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { vaultProviderIcons } from "@/components/icons/vault-provider-icons";
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
import { HandleVaultProvider } from "./handle-vault-provider";
import {
	vaultHealthLabels,
	vaultProviderIconKey,
	vaultProviderLabel,
} from "./vault-provider-meta";

interface HealthBadgeProps {
	vaultProviderId: string;
}

const HealthBadge = ({ vaultProviderId }: HealthBadgeProps) => {
	const { data, isPending, isError, refetch, isFetching } =
		api.vaultProvider.health.useQuery(
			{ vaultProviderId },
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

	const label = status === "checking" ? "Checking" : vaultHealthLabels[status];

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
						<KeyRound className="size-3" aria-hidden="true" />
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
							{data.secretCount != null
								? ` · ${data.secretCount} secret${data.secretCount === 1 ? "" : "s"}`
								: ""}
						</span>
					)}
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

export const ShowVaultProviders = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const { mutateAsync } = api.vaultProvider.remove.useMutation();
	const { data, isPending, refetch } = api.vaultProvider.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const connectedCount = data?.length ?? 0;

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<KeyRound className="size-6 text-muted-foreground self-center" />
								Secrets Manager
							</CardTitle>
							<CardDescription>
								Connect a secrets manager and reference its secrets in
								environment variables in Notploy
							</CardDescription>
						</CardHeader>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="tabular-nums">
								{connectedCount} connected
							</Badge>
							{permissions?.vaultProvider.create && <HandleVaultProvider />}
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
								<KeyRound className="size-8 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									No secrets providers connected
								</span>
								<span className="max-w-sm text-center text-sm text-muted-foreground">
									Use <span className="font-medium">Add Provider</span> in the
									header to connect HashiCorp Vault, Infisical, AWS, Azure, GCP,
									1Password, Kubernetes, Docker and more, then reference their
									secrets without leaving the Console.
								</span>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{data?.map((provider) => {
									const ProviderIcon =
										vaultProviderIcons[vaultProviderIconKey(provider.providerType)];
									const href = `/dashboard/settings/secrets/${provider.vaultProviderId}`;
									const assignmentCount = provider.assignments.length;
									return (
										<li
											key={provider.vaultProviderId}
											className="group relative flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring"
										>
											<Link
												href={href}
												aria-label={`View secrets for ${provider.name}`}
												className="absolute inset-0 rounded-lg outline-none"
											/>
											<ProviderIcon className="size-7 shrink-0" />
											<div className="flex min-w-0 flex-col gap-0.5">
												<span className="truncate text-sm font-medium">
													{provider.name}
												</span>
												<div className="flex flex-row flex-wrap items-center gap-2 text-xs text-muted-foreground">
													<span>
														{vaultProviderLabel(provider.providerType)}
													</span>
													{assignmentCount === 0 ? (
														<Badge variant="destructive">Not assigned</Badge>
													) : (
														<Badge variant="secondary">
															{assignmentCount}{" "}
															{assignmentCount === 1 ? "project" : "projects"}
														</Badge>
													)}
													<span className="font-mono">
														{"${{vault." + provider.name + ".…}}"}
													</span>
												</div>
											</div>

											<div className="relative z-10 ml-auto flex flex-row items-center gap-1">
												<HealthBadge vaultProviderId={provider.vaultProviderId} />
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
																<span className="sr-only">View secrets</span>
															</Link>
														</Button>
													</TooltipTrigger>
													<TooltipContent>View secrets</TooltipContent>
												</Tooltip>
												{permissions?.vaultProvider.update && (
													<HandleVaultProvider
														vaultProviderId={provider.vaultProviderId}
													/>
												)}
												{permissions?.vaultProvider.delete && (
													<Tooltip>
														<DialogAction
															title="Delete Secrets Provider"
															description="Deployments referencing this provider will fail to resolve their secrets. Are you sure?"
															type="destructive"
															onClick={async () => {
																setRemovingId(provider.vaultProviderId);
																await mutateAsync({
																	vaultProviderId: provider.vaultProviderId,
																})
																	.then(() => {
																		toast.success("Secrets provider deleted");
																		refetch();
																	})
																	.catch(() => {
																		toast.error(
																			"Error deleting the secrets provider",
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
																		removingId === provider.vaultProviderId
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
