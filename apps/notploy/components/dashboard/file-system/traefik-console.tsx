import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, type RouterOutputs } from "@/utils/api";
import { ShowTraefikSystem } from "./show-traefik-system";

interface Props {
	serverId?: string;
}

export const TraefikConsole = ({ serverId }: Props) => {
	const [search, setSearch] = useState("");
	const [entryPointFilter, setEntryPointFilter] = useState("");
	const [selectedRouter, setSelectedRouter] = useState<
		RouterOutputs["settings"]["getTraefikOverview"]["routers"][number] | null
	>(null);
	const overview = api.settings.getTraefikOverview.useQuery(
		{ serverId },
		{ retry: 1, refetchInterval: 30_000 },
	);
	const { data: requestsEnabled } = api.settings.haveActivateRequests.useQuery(
		undefined,
		{ enabled: !serverId },
	);
	const requestsQuery = api.settings.readStatsLogs.useQuery(
		{ page: { pageIndex: 0, pageSize: 5 } },
		{ enabled: !serverId && !!requestsEnabled },
	);

	const routers = useMemo(() => {
		const query = search.trim().toLowerCase();
		return (overview.data?.routers ?? []).filter((router) => {
			const matchesSearch =
				!query ||
				[
					router.name,
					router.rule,
					router.service,
					router.provider,
					...router.entryPoints,
					...router.middlewares,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase()
					.includes(query);
			return (
				matchesSearch &&
				(!entryPointFilter || router.entryPoints.includes(entryPointFilter))
			);
		});
	}, [entryPointFilter, overview.data?.routers, search]);

	return (
		<Card className="flex min-h-[85vh] w-full flex-col rounded-xl bg-sidebar p-2.5">
			<div className="flex min-h-[calc(85vh-1.25rem)] w-full flex-1 flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold tracking-tight">Traefik</h1>
						<p className="text-sm text-muted-foreground">
							Manage ingress, routing and TLS for your Notploy workloads.
						</p>
						<div className="flex items-center gap-2 pt-2">
							<span
								className={`size-2 rounded-full ${overview.data?.status === "running" ? "bg-green-500" : overview.isError || overview.data ? "bg-destructive" : "bg-muted-foreground"}`}
							/>
							<span className="text-sm font-medium">
								{overview.isLoading
									? "Checking status"
									: overview.data?.status === "running"
										? "Running"
										: "Unavailable"}
							</span>
							{overview.data?.version && (
								<span className="text-xs text-muted-foreground">
									{overview.data.version}
								</span>
							)}
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							void Promise.all([overview.refetch(), requestsQuery.refetch()]);
						}}
						disabled={overview.isFetching}
					>
						<RefreshCw
							className={`mr-2 size-4 ${overview.isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</header>

				{overview.isError && (
					<AlertBlock
						type="error"
						className="flex items-center justify-between gap-4"
					>
						<span>{overview.error.message}</span>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void overview.refetch()}
						>
							Retry
						</Button>
					</AlertBlock>
				)}

				{overview.data?.status === "unavailable" && !overview.isError && (
					<AlertBlock type="warning">
						Traefik unavailable. Notploy could not find a running Traefik
						container or service on this server. Configured routes below are not
						confirmed as active.
					</AlertBlock>
				)}

				{overview.isLoading ? (
					<div className="grid gap-4 md:grid-cols-3">
						{[0, 1, 2].map((item) => (
							<div
								key={item}
								className="h-28 animate-pulse rounded-lg border bg-muted/30"
							/>
						))}
					</div>
				) : overview.data ? (
					<>
						<div className="grid gap-4 md:grid-cols-3">
							<SummaryCard
								title="EntryPoints"
								value={overview.data.entryPoints.length}
							/>
							<SummaryCard
								title="Configured routers"
								value={overview.data.routers.length}
							/>
							<SummaryCard
								title="File-provider services"
								value={overview.data.services.length}
							/>
						</div>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">EntryPoints</CardTitle>
							</CardHeader>
							<CardContent>
								{overview.data.entryPoints.length === 0 ? (
									<EmptyMessage>
										No EntryPoints were found in Traefik configuration.
									</EmptyMessage>
								) : (
									<div className="flex flex-wrap gap-3">
										{overview.data.entryPoints.map((entryPoint) => (
											<div
												key={entryPoint.name}
												className="min-w-48 rounded-md border px-4 py-3"
											>
												<div className="font-medium">{entryPoint.name}</div>
												<div className="mt-1 font-mono text-sm text-muted-foreground">
													{entryPoint.address ?? "Address not configured"}
												</div>
												<div className="mt-2 text-xs text-muted-foreground">
													{overview.data?.routers.filter((router) =>
														router.entryPoints.includes(entryPoint.name),
													).length ?? 0}{" "}
													configured routers
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-3">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<CardTitle className="text-base">
										Configured routers
									</CardTitle>
									<div className="flex flex-wrap gap-2">
										<Input
											aria-label="Search routers"
											placeholder="Search routers..."
											value={search}
											onChange={(event) => setSearch(event.target.value)}
											className="h-9 w-56"
										/>
										<select
											aria-label="Filter by EntryPoint"
											value={entryPointFilter}
											onChange={(event) =>
												setEntryPointFilter(event.target.value)
											}
											className="h-9 rounded-md border bg-background px-3 text-sm"
										>
											<option value="">All EntryPoints</option>
											{overview.data.entryPoints.map((entryPoint) => (
												<option key={entryPoint.name} value={entryPoint.name}>
													{entryPoint.name}
												</option>
											))}
										</select>
									</div>
								</div>
								<p className="text-sm text-muted-foreground">
									Routers are read from Notploy dynamic files and Docker labels.
									They represent configured routes, not a Traefik runtime API
									snapshot.
								</p>
							</CardHeader>
							<CardContent>
								{routers.length === 0 ? (
									<EmptyMessage>
										{overview.data.routers.length === 0
											? "No routers configured. Deploy a service with an exposed domain to create routing configuration."
											: "No routers match these filters."}
									</EmptyMessage>
								) : (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Router</TableHead>
													<TableHead>Rule</TableHead>
													<TableHead>EntryPoints</TableHead>
													<TableHead>Service</TableHead>
													<TableHead>Provider</TableHead>
													<TableHead>TLS</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{routers.map((router, index) => (
													<TableRow
														key={`${router.provider}-${router.name}-${index}`}
														className="cursor-pointer"
														onClick={() => setSelectedRouter(router)}
													>
														<TableCell className="font-medium">
															<button
																type="button"
																className="text-left hover:underline"
																onClick={(event) => {
																	event.stopPropagation();
																	setSelectedRouter(router);
																}}
															>
																{router.name}
															</button>
														</TableCell>
														<TableCell className="max-w-80 truncate font-mono text-xs">
															{router.rule ?? "—"}
														</TableCell>
														<TableCell>
															{router.entryPoints.join(", ") || "—"}
														</TableCell>
														<TableCell>
															{router.service ?? "Automatic"}
														</TableCell>
														<TableCell>
															<Badge variant="secondary">
																{router.provider}
															</Badge>
														</TableCell>
														<TableCell>
															{router.tls ? "Enabled" : "—"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}
							</CardContent>
						</Card>

						<div className="grid gap-6 xl:grid-cols-2">
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base">Traefik Services</CardTitle>
									<p className="text-sm text-muted-foreground">
										Services declared in Notploy dynamic configuration files.
									</p>
								</CardHeader>
								<CardContent>
									{overview.data.services.length === 0 ? (
										<EmptyMessage>
											No file-provider services found.
										</EmptyMessage>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Name</TableHead>
													<TableHead>Provider</TableHead>
													<TableHead>Load balancing</TableHead>
													<TableHead>Servers</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{overview.data.services.map((service, index) => (
													<TableRow key={`${service.name}-${index}`}>
														<TableCell className="font-medium">
															{service.name}
														</TableCell>
														<TableCell>
															<Badge variant="secondary">
																{service.provider}
															</Badge>
														</TableCell>
														<TableCell>{service.type}</TableCell>
														<TableCell>
															{service.serverCount ?? "Not reported"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base">Middlewares</CardTitle>
								</CardHeader>
								<CardContent>
									{overview.data.middlewares.length === 0 ? (
										<EmptyMessage>
											No file-provider middlewares found.
										</EmptyMessage>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Name</TableHead>
													<TableHead>Type</TableHead>
													<TableHead>Routers</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{overview.data.middlewares.map((middleware, index) => (
													<TableRow key={`${middleware.name}-${index}`}>
														<TableCell className="font-medium">
															{middleware.name}
														</TableCell>
														<TableCell>{middleware.type}</TableCell>
														<TableCell>
															{overview.data?.routers.filter((router) =>
																router.middlewares.includes(middleware.name),
															).length ?? 0}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
						</div>

						{requestsEnabled && !serverId && (
							<Card>
								<CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-base">Recent requests</CardTitle>
									<Button variant="ghost" size="sm" asChild>
										<Link href="/dashboard/requests">
											View requests <ArrowUpRight className="ml-1 size-4" />
										</Link>
									</Button>
								</CardHeader>
								<CardContent>
									{requestsQuery.data?.data.length ? (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Method</TableHead>
													<TableHead>Request</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>Duration</TableHead>
													<TableHead>Time</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{requestsQuery.data.data.map((request, index) => (
													<TableRow key={`${request.StartUTC}-${index}`}>
														<TableCell>{request.RequestMethod}</TableCell>
														<TableCell className="max-w-80 truncate font-mono text-xs">
															{request.RequestHost}
															{request.RequestPath}
														</TableCell>
														<TableCell>{request.DownstreamStatus}</TableCell>
														<TableCell>{request.Duration}</TableCell>
														<TableCell className="text-muted-foreground">
															{formatDistanceToNow(new Date(request.StartUTC), {
																addSuffix: true,
															})}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									) : (
										<EmptyMessage>
											{requestsQuery.data?.totalCount === 0
												? "No recent access-log entries are available."
												: "Loading recent requests..."}
										</EmptyMessage>
									)}
									{serverId && (
										<p className="text-xs text-muted-foreground">
											Request logs are currently available for the local Traefik
											instance only.
										</p>
									)}
								</CardContent>
							</Card>
						)}

						{overview.data.configFileLimitReached && (
							<AlertBlock type="warning">
								Only the first 200 dynamic configuration files were inspected.
							</AlertBlock>
						)}

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">Configuration files</CardTitle>
								<p className="text-sm text-muted-foreground">
									Inspect and edit Traefik files. Changes here may affect
									routing; the routing tables above show configured resources
									only.
								</p>
							</CardHeader>
							<CardContent>
								<ShowTraefikSystem serverId={serverId} />
							</CardContent>
						</Card>
					</>
				) : null}

				<Dialog
					open={!!selectedRouter}
					onOpenChange={(open) => {
						if (!open) setSelectedRouter(null);
					}}
				>
					<DialogContent className="max-w-xl">
						<DialogHeader>
							<DialogTitle>
								{selectedRouter?.name ?? "Router details"}
							</DialogTitle>
						</DialogHeader>
						{selectedRouter && (
							<div className="grid gap-4 sm:grid-cols-2">
								<Detail label="Provider" value={selectedRouter.provider} />
								<Detail
									label="Status"
									value="Configured; runtime status unavailable"
								/>
								<Detail
									label="Rule"
									value={selectedRouter.rule ?? "Not configured"}
								/>
								<Detail
									label="EntryPoints"
									value={
										selectedRouter.entryPoints.join(", ") || "Not configured"
									}
								/>
								<Detail
									label="Service"
									value={selectedRouter.service ?? "Automatic provider service"}
								/>
								<Detail
									label="TLS"
									value={selectedRouter.tls ? "Enabled" : "Not configured"}
								/>
								<Detail
									label="Middlewares"
									value={
										selectedRouter.middlewares.join(", ") || "None configured"
									}
								/>
							</div>
						)}
					</DialogContent>
				</Dialog>
			</div>
		</Card>
	);
};

const SummaryCard = ({ title, value }: { title: string; value: number }) => (
	<Card>
		<CardContent className="pt-5">
			<div className="text-sm text-muted-foreground">{title}</div>
			<div className="mt-1 text-2xl font-semibold">{value}</div>
		</CardContent>
	</Card>
);

const EmptyMessage = ({ children }: { children: ReactNode }) => (
	<div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
		{children}
	</div>
);

const Detail = ({ label, value }: { label: string; value: string }) => (
	<div className="min-w-0 space-y-1">
		<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
			{label}
		</div>
		<div className="break-words text-sm">{value}</div>
	</div>
);
