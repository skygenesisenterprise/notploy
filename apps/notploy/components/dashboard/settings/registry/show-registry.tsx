import { Activity, HeartPulse, Loader2, PlugZap, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	RegistryIcons,
	registryProviderIcons,
} from "@/components/icons/registry-provider-icons";
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
import { HandleRegistry } from "./handle-registry";
import { RegistryCapabilityMatrix } from "./registry-capability-matrix";
import { RegistryInspectDialog } from "./registry-inspect-dialog";
import {
	registryCategoryLabels,
	registryHealthLabels,
	registryProviderIconKey,
} from "./registry-provider-meta";

interface HealthBadgeProps {
	registryId: string;
}

/**
 * Structured registry status: connection, authentication, latency and how many
 * repositories the credentials can read, all from the adapter's diagnostics.
 */
const HealthBadge = ({ registryId }: HealthBadgeProps) => {
	const { data, isPending, isError, refetch, isFetching } =
		api.registry.health.useQuery(
			{ registryId },
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
		status === "checking" ? "Checking" : registryHealthLabels[status];

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
				<div className="flex max-w-xs flex-col gap-1">
					<span>{data?.message ?? label}</span>
					{data?.remediation && (
						<span className="text-xs opacity-80">{data.remediation}</span>
					)}
					<div className="flex flex-wrap gap-2 text-xs opacity-80">
						{data?.latencyMs != null && <span>{data.latencyMs} ms</span>}
						{data?.repositoryCount != null && (
							<span>
								{data.repositoryCount} repositor
								{data.repositoryCount === 1 ? "y" : "ies"}
							</span>
						)}
						{data?.identity?.apiVersion && (
							<span>OCI API {data.identity.apiVersion}</span>
						)}
					</div>
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

export const ShowRegistry = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [testingId, setTestingId] = useState<string | null>(null);
	const { mutateAsync } = api.registry.remove.useMutation();
	const { mutateAsync: testConnection } =
		api.registry.testConnection.useMutation();
	const { data, isPending, refetch } = api.registry.all.useQuery();
	const { data: descriptors } = api.registry.descriptors.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const descriptorOf = (providerType: string) =>
		descriptors?.find((descriptor) => descriptor.providerType === providerType);

	const count = data?.length ?? 0;

	const runTest = async (registryId: string, name: string) => {
		setTestingId(registryId);
		await testConnection({ registryId })
			.then((result) => {
				if (result.connected) {
					toast.success(`${name}: ${result.message}`, {
						description: result.identity?.authService
							? `Authenticated through ${result.identity.authService}`
							: undefined,
					});
				} else {
					toast.error(`${name}: ${result.message}`);
				}
			})
			.catch((error) => {
				toast.error(
					error instanceof Error ? error.message : "Registry test failed",
				);
			})
			.finally(() => setTestingId(null));
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<RegistryIcons.registry className="size-6 text-muted-foreground self-center" />
								Container Registries
							</CardTitle>
							<CardDescription>
								Connect the OCI registries you already operate — managed,
								self-hosted or completely custom — so Notploy can deploy,
								inspect and verify the images they hold.
							</CardDescription>
						</CardHeader>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="tabular-nums">
								{count} {count === 1 ? "registry" : "registries"}
							</Badge>
							{permissions?.registry.create && <HandleRegistry />}
						</div>
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : count === 0 ? (
							<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
								<Activity className="size-8 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									No container registries configured
								</span>
								<span className="max-w-md text-center text-sm text-muted-foreground">
									Use <span className="font-medium">Add registry</span> to
									connect Docker Hub, GHCR, GitLab, Harbor, a self-hosted
									Distribution registry or any other OCI-compatible endpoint.
								</span>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{data?.map((registry) => {
									const descriptor = descriptorOf(registry.providerType);
									const ProviderIcon =
										registryProviderIcons[
											registryProviderIconKey(registry.providerType)
										];
									return (
										<li
											key={registry.registryId}
											className="group flex flex-col gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50"
										>
											<div className="flex items-center gap-3">
												<ProviderIcon className="size-7 shrink-0" />
												<div className="flex min-w-0 flex-col gap-0.5">
													<span className="truncate text-sm font-medium">
														{registry.registryName}
													</span>
													<span className="truncate text-xs text-muted-foreground">
														{descriptor?.label ?? registry.providerType}
														{descriptor
															? ` · ${registryCategoryLabels[descriptor.category]}`
															: ""}
														{registry.registryUrl
															? ` · ${registry.registryUrl}`
															: ""}
													</span>
												</div>

												<div className="ml-auto flex flex-row items-center gap-1">
													<HealthBadge registryId={registry.registryId} />

													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className="text-muted-foreground"
																isLoading={testingId === registry.registryId}
																onClick={() =>
																	void runTest(
																		registry.registryId,
																		registry.registryName,
																	)
																}
															>
																<PlugZap className="size-4" />
																<span className="sr-only">Test connection</span>
															</Button>
														</TooltipTrigger>
														<TooltipContent>Test connection</TooltipContent>
													</Tooltip>

													<RegistryInspectDialog
														registryId={registry.registryId}
														registryName={registry.registryName}
														namespace={registry.namespace}
														canDelete={!!permissions?.registry.delete}
													/>

													{permissions?.registry.create && (
														<HandleRegistry registryId={registry.registryId} />
													)}

													{permissions?.registry.delete && (
														<Tooltip>
															<DialogAction
																title="Delete Container Registry"
																description="Applications that push to or pull from this registry will need another registry configured. Are you sure?"
																type="destructive"
																onClick={async () => {
																	setRemovingId(registry.registryId);
																	await mutateAsync({
																		registryId: registry.registryId,
																	})
																		.then(() => {
																			toast.success(
																				"Container registry deleted",
																			);
																			refetch();
																		})
																		.catch(() => {
																			toast.error(
																				"Error deleting the container registry",
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
																			removingId === registry.registryId
																		}
																	>
																		<Trash2 className="size-4" />
																		<span className="sr-only">
																			Delete registry
																		</span>
																	</Button>
																</TooltipTrigger>
															</DialogAction>
															<TooltipContent>Delete registry</TooltipContent>
														</Tooltip>
													)}
												</div>
											</div>

											<div className="flex flex-wrap items-center gap-2 pl-10">
												{descriptor && (
													<RegistryCapabilityMatrix
														compact
														capabilities={descriptor.capabilities}
													/>
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
