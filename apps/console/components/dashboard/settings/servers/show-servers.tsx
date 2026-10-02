import { format } from "date-fns";
import {
	Clock,
	Loader2,
	Network,
	ServerIcon,
	Terminal,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { TerminalModal } from "../web-server/terminal-modal";
import { ShowServerActions } from "./actions/show-server-actions";
import { DeleteServerModal } from "./delete-server-modal";
import { HandleServers } from "./handle-servers";
import { ServerResourceDetails } from "./server-resource-details";
import { SetupServer } from "./setup-server";
import { ShowMonitoringModal } from "./show-monitoring-modal";
import { WelcomeSubscription } from "./welcome-stripe/welcome-subscription";

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "deploy" | "build";

export const ShowServers = () => {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
	const { query } = useRouter();
	const { data, isPending, isError, error } = api.server.all.useQuery();
	const { data: isCloud, isLoading: isCloudLoading } =
		api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canReadServices = !!permissions?.service.read;
	const { data: allServices = [], isLoading: servicesLoading } =
		api.overview.services.useQuery(undefined, {
			enabled: canReadServices,
			refetchInterval: 30_000,
		});

	const servers = data ?? [];
	const localServices =
		isCloud === false
			? allServices.filter((service) => service.serverId === null)
			: [];
	const localInstanceVisible = isCloud === false;
	const normalizedSearch = search.trim().toLocaleLowerCase();
	const localSearchMatches =
		!normalizedSearch ||
		"local notploy localhost control plane".includes(normalizedSearch);
	const showLocalInstance =
		localInstanceVisible &&
		localSearchMatches &&
		(statusFilter === "all" || statusFilter === "active") &&
		(roleFilter === "all" || roleFilter === "deploy");
	const activeCount = servers.filter(
		(server) => server.serverStatus === "active",
	).length;
	const workloadCount =
		servers.reduce((total, server) => total + server.totalSum, 0) +
		(canReadServices ? localServices.length : 0);
	const filteredServers = useMemo(() => {
		const normalizedSearch = search.trim().toLocaleLowerCase();
		return servers.filter((server) => {
			const matchesSearch =
				!normalizedSearch ||
				`${server.name} ${server.description ?? ""} ${server.ipAddress}`
					.toLocaleLowerCase()
					.includes(normalizedSearch);
			const matchesStatus =
				statusFilter === "all" || server.serverStatus === statusFilter;
			const matchesRole =
				roleFilter === "all" || server.serverType === roleFilter;
			return matchesSearch && matchesStatus && matchesRole;
		});
	}, [roleFilter, search, servers, statusFilter]);

	return (
		<div className="w-full">
			{query?.success && isCloud && <WelcomeSubscription />}
			<Card className="w-full rounded-xl p-2.5">
				<div className="rounded-xl bg-background shadow-md">
					<CardHeader className="gap-4">
						<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
							<div className="space-y-1">
								<CardTitle className="flex items-center gap-2 text-2xl">
									<ServerIcon
										className="size-6 text-muted-foreground"
										aria-hidden
									/>
									Servers
								</CardTitle>
								<CardDescription>
									Execution targets Notploy can use to run and build workloads.
								</CardDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{isCloud && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											window.location.assign(
												"/dashboard/settings/servers?success=true",
											)
										}
									>
										Reset onboarding
									</Button>
								)}
								{permissions?.server.create && <HandleServers />}
							</div>
						</div>

						{!isPending &&
							!isCloudLoading &&
							!isError &&
							(servers.length > 0 || localInstanceVisible) && (
								<>
									<div className="grid gap-3 sm:grid-cols-3">
										<SummaryMetric
											label="Servers"
											value={servers.length + (localInstanceVisible ? 1 : 0)}
										/>
										<SummaryMetric
											label="Active"
											value={activeCount + (localInstanceVisible ? 1 : 0)}
										/>
										<SummaryMetric
											label="Assigned workloads"
											value={workloadCount}
										/>
									</div>
									<div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem]">
										<Input
											value={search}
											onChange={(event) => setSearch(event.target.value)}
											placeholder="Search servers by name or address"
											aria-label="Search servers by name or address"
										/>
										<Select
											value={statusFilter}
											onValueChange={(value: StatusFilter) =>
												setStatusFilter(value)
											}
										>
											<SelectTrigger aria-label="Filter by server status">
												<SelectValue placeholder="All statuses" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All statuses</SelectItem>
												<SelectItem value="active">Active</SelectItem>
												<SelectItem value="inactive">Inactive</SelectItem>
											</SelectContent>
										</Select>
										<Select
											value={roleFilter}
											onValueChange={(value: RoleFilter) =>
												setRoleFilter(value)
											}
										>
											<SelectTrigger aria-label="Filter by server role">
												<SelectValue placeholder="All roles" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All roles</SelectItem>
												<SelectItem value="deploy">Deployment</SelectItem>
												<SelectItem value="build">Build</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</>
							)}
					</CardHeader>

					<CardContent className="space-y-4 border-t py-6">
						{isPending || isCloudLoading ? (
							<div
								className="flex min-h-[25vh] items-center justify-center gap-2 text-sm text-muted-foreground"
								role="status"
							>
								Loading servers…
								<Loader2 className="size-4 animate-spin" aria-hidden />
							</div>
						) : isError ? (
							<AlertBlock type="error">{error.message}</AlertBlock>
						) : servers.length === 0 && !localInstanceVisible ? (
							<div className="flex min-h-[25vh] flex-col items-center justify-center gap-3 text-center">
								<ServerIcon
									className="size-8 text-muted-foreground"
									aria-hidden
								/>
								<p className="max-w-lg text-sm text-muted-foreground">
									No execution servers are connected to this organization.
								</p>
								{permissions?.server.create && <HandleServers />}
							</div>
						) : filteredServers.length === 0 && !showLocalInstance ? (
							<div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
								<p className="text-sm text-muted-foreground">
									No servers match these search and filter settings.
								</p>
								<Button
									variant="outline"
									onClick={() => {
										setSearch("");
										setStatusFilter("all");
										setRoleFilter("all");
									}}
								>
									Clear filters
								</Button>
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								{showLocalInstance && (
									<Card className="flex flex-col border-primary/30 transition-shadow hover:shadow-md">
										<CardHeader className="space-y-3 pb-3">
											<div className="flex items-center justify-between gap-3">
												<div className="flex min-w-0 items-center gap-2">
													<ServerIcon
														className="size-5 shrink-0 text-muted-foreground"
														aria-hidden
													/>
													<CardTitle className="truncate text-lg">
														Main instance
													</CardTitle>
												</div>
												<Badge variant="outline">Local</Badge>
											</div>
											<div className="flex flex-wrap gap-2">
												<Badge variant="secondary">Control plane</Badge>
												<Badge variant="default">Active</Badge>
											</div>
											<CardDescription>
												This Notploy instance can also run workloads locally.
											</CardDescription>
										</CardHeader>
										<CardContent className="flex flex-1 flex-col gap-4">
											<div className="flex items-center gap-2 text-sm">
												<Network
													className="size-4 shrink-0 text-muted-foreground"
													aria-hidden
												/>
												<span className="font-medium">
													Local execution target
												</span>
											</div>
											<div className="text-sm text-muted-foreground">
												{canReadServices
													? `${servicesLoading ? "…" : localServices.length} assigned workload${localServices.length === 1 ? "" : "s"}`
													: "Workload access is not available"}
											</div>
											{canReadServices && localServices.length > 0 && (
												<ul className="space-y-1 border-t pt-3">
													{localServices.slice(0, 4).map((service) => (
														<li key={`${service.type}-${service.id}`}>
															<Link
																href={`/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`}
																className="flex items-center justify-between gap-2 text-sm hover:text-primary"
															>
																<span className="truncate">{service.name}</span>
																<Badge variant="outline">
																	{service.status}
																</Badge>
															</Link>
														</li>
													))}
												</ul>
											)}
											<div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
												{permissions?.monitoring.read && (
													<Button asChild variant="outline" size="sm">
														<Link href="/dashboard/monitoring">Monitoring</Link>
													</Button>
												)}
												{permissions?.docker.read && (
													<Button asChild variant="outline" size="sm">
														<Link href="/dashboard/docker">Docker</Link>
													</Button>
												)}
											</div>
										</CardContent>
									</Card>
								)}
								{filteredServers.map((server) => {
									const isActive = server.serverStatus === "active";
									const isBuildServer = server.serverType === "build";

									return (
										<Card
											key={server.serverId}
											className="flex flex-col transition-shadow hover:shadow-md"
										>
											<CardHeader className="space-y-3 pb-3">
												<div className="flex min-w-0 items-start justify-between gap-3">
													<div className="flex min-w-0 items-center gap-2">
														<ServerIcon
															className="size-5 shrink-0 text-muted-foreground"
															aria-hidden
														/>
														<CardTitle
															className="truncate text-lg"
															title={server.name}
														>
															{server.name}
														</CardTitle>
													</div>
													<TooltipProvider>
														{isCloud && !isActive ? (
															<Tooltip>
																<TooltipTrigger asChild>
																	<span>
																		<Badge
																			variant="destructive"
																			className="cursor-help"
																		>
																			Inactive
																		</Badge>
																	</span>
																</TooltipTrigger>
																<TooltipContent className="max-w-xs">
																	This server is inactive due to a billing
																	issue. Resolve the invoice or contact support
																	to reactivate it.
																</TooltipContent>
															</Tooltip>
														) : (
															<Badge
																variant={isActive ? "default" : "secondary"}
															>
																{isActive ? "Active" : "Inactive"}
															</Badge>
														)}
													</TooltipProvider>
												</div>
												<div className="flex flex-wrap gap-2">
													<Badge variant="outline">
														{isBuildServer
															? "Build server"
															: "Deployment server"}
													</Badge>
													<Badge variant="secondary">
														{server.totalSum} workload
														{server.totalSum === 1 ? "" : "s"}
													</Badge>
												</div>
												{server.description && (
													<CardDescription className="line-clamp-2">
														{server.description}
													</CardDescription>
												)}
											</CardHeader>

											<CardContent className="flex flex-1 flex-col gap-4">
												<div className="space-y-2 text-sm">
													<div className="flex items-center gap-2">
														<Network
															className="size-4 shrink-0 text-muted-foreground"
															aria-hidden
														/>
														<span className="truncate font-medium">
															{server.ipAddress}:{server.port}
														</span>
													</div>
													<div className="flex items-center gap-2 text-muted-foreground">
														<Clock className="size-4 shrink-0" aria-hidden />
														<span className="text-xs">
															Added {format(new Date(server.createdAt), "PP")}
														</span>
													</div>
												</div>

												<div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
													<ServerResourceDetails server={server} />
													{isActive && permissions?.server.create && (
														<>
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<div>
																			<SetupServer
																				serverId={server.serverId}
																				asButton
																			/>
																		</div>
																	</TooltipTrigger>
																	<TooltipContent>
																		Setup and validate server
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
															{server.sshKeyId && !isBuildServer && (
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<div>
																				<ShowServerActions
																					serverId={server.serverId}
																					asButton
																				/>
																			</div>
																		</TooltipTrigger>
																		<TooltipContent>
																			Server operations
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															)}
															{isCloud && server.sshKeyId && !isBuildServer && (
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<div>
																				<ShowMonitoringModal
																					url={`http://${server.ipAddress}:${server.metricsConfig?.server?.port}/metrics`}
																					token={
																						server.metricsConfig?.server?.token
																					}
																				/>
																			</div>
																		</TooltipTrigger>
																		<TooltipContent>Monitoring</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															)}
															{server.sshKeyId &&
																permissions.server.terminal && (
																	<TooltipProvider>
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<div>
																					<TerminalModal
																						serverId={server.serverId}
																						asButton
																					>
																						<Button
																							variant="outline"
																							size="icon"
																							aria-label={`Open terminal for ${server.name}`}
																						>
																							<Terminal
																								className="size-4"
																								aria-hidden
																							/>
																						</Button>
																					</TerminalModal>
																				</div>
																			</TooltipTrigger>
																			<TooltipContent>Terminal</TooltipContent>
																		</Tooltip>
																	</TooltipProvider>
																)}
														</>
													)}
													<div className="flex-1" />
													{isActive && permissions?.server.create && (
														<HandleServers
															serverId={server.serverId}
															asButton
														/>
													)}
													{permissions?.server.delete && (
														<DeleteServerModal
															serverId={server.serverId}
															serverName={server.name}
														>
															<Button
																variant="ghost"
																size="icon"
																className="text-destructive hover:bg-destructive/10 hover:text-destructive"
																aria-label={`Remove ${server.name}`}
															>
																<Trash2 className="size-4" aria-hidden />
															</Button>
														</DeleteServerModal>
													)}
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};

function SummaryMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border bg-background p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
		</div>
	);
}
