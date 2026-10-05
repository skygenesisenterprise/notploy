"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, GalleryVerticalEnd, Server } from "lucide-react";
import Link from "next/link";
import { ShowTraefikSystem } from "@/components/dashboard/file-system/show-traefik-system";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleRefresh,
	ConsoleShell,
	ConsoleSummary,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";

interface Props {
	serverId?: string;
}

export const TraefikConsole = ({ serverId }: Props) => {
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

	const isRunning = overview.data?.status === "running";
	const showRequests = !!requestsEnabled && !serverId;
	const recentRequests = requestsQuery.data?.data ?? [];

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={GalleryVerticalEnd}
				title="Traefik Manager"
				description="Manage ingress, routing and TLS for your Notploy workloads."
				status={
					<div className="flex items-center gap-2 pt-2">
						<span
							className={`size-2 rounded-full ${isRunning ? "bg-green-500" : overview.isError || overview.data ? "bg-destructive" : "bg-muted-foreground"}`}
							aria-hidden
						/>
						<span className="text-sm font-medium">
							{overview.isLoading
								? "Checking status"
								: isRunning
									? "Running"
									: "Unavailable"}
						</span>
						{overview.data?.version && (
							<Badge variant="outline">{overview.data.version}</Badge>
						)}
					</div>
				}
				actions={
					<ConsoleRefresh
						onClick={() => {
							void Promise.all([overview.refetch(), requestsQuery.refetch()]);
						}}
						isRefetching={overview.isFetching}
					/>
				}
			/>

			<ConsoleBody>
				{overview.isError ? (
					<ConsoleError
						message={overview.error.message}
						onRetry={() => void overview.refetch()}
					/>
				) : (
					<>
						{overview.data?.status === "unavailable" && (
							<AlertBlock type="warning">
								Traefik unavailable. Notploy could not find a running Traefik
								container or service on this server. Configured routes below are
								not confirmed as active.
							</AlertBlock>
						)}

						{overview.data?.configFileLimitReached && (
							<AlertBlock type="warning">
								Only the first 200 dynamic configuration files were inspected.
							</AlertBlock>
						)}

						{overview.isLoading ? (
							<ConsoleLoading label="Loading Traefik configuration…" />
						) : overview.data ? (
							<>
								<ConsoleSummary>
									<SummaryMetric
										label="Traefik status"
										value={isRunning ? "Running" : "Unavailable"}
										detail={
											overview.data.version
												? `Version ${overview.data.version}`
												: "Version not reported"
										}
									/>
									<SummaryMetric
										label="Routers"
										value={overview.data.routers.length}
										detail={`${overview.data.entryPoints.length} entry points`}
									/>
									<SummaryMetric
										label="Services"
										value={overview.data.services.length}
									/>
									<SummaryMetric
										label="Dynamic config files"
										value={overview.data.configFileCount}
										detail={`${overview.data.middlewares.length} middlewares`}
									/>
								</ConsoleSummary>

								{showRequests && (
									<section className="space-y-3">
										<div className="flex items-center justify-between gap-2">
											<div>
												<h2 className="font-medium">Recent requests</h2>
												<p className="text-sm text-muted-foreground">
													Last entries of the Traefik access log.
												</p>
											</div>
											<Button variant="outline" size="sm" asChild>
												<Link href="/dashboard/requests">
													View requests <ArrowUpRight className="ml-1 size-4" />
												</Link>
											</Button>
										</div>
										{requestsQuery.isPending ? (
											<ConsoleLoading label="Loading recent requests…" />
										) : recentRequests.length ? (
											<div className="overflow-x-auto rounded-md border">
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
														{recentRequests.map((request, index) => (
															<TableRow key={`${request.StartUTC}-${index}`}>
																<TableCell>{request.RequestMethod}</TableCell>
																<TableCell className="max-w-80 truncate font-mono text-xs">
																	{request.RequestHost}
																	{request.RequestPath}
																</TableCell>
																<TableCell>
																	<Badge
																		variant={
																			Number(request.DownstreamStatus) >= 500
																				? "red"
																				: Number(request.DownstreamStatus) >=
																						400
																					? "secondary"
																					: "green"
																		}
																	>
																		{request.DownstreamStatus}
																	</Badge>
																</TableCell>
																<TableCell>{request.Duration}</TableCell>
																<TableCell className="text-muted-foreground">
																	{formatDistanceToNow(
																		new Date(request.StartUTC),
																		{ addSuffix: true },
																	)}
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										) : (
											<ConsoleEmpty
												icon={Server}
												title="No recent requests"
												description="The Traefik access log did not report any entry yet."
												className="min-h-40"
											/>
										)}
									</section>
								)}

								{serverId && (
									<p className="text-xs text-muted-foreground">
										Request logs are currently available for the local Traefik
										instance only.
									</p>
								)}

								<ShowTraefikSystem serverId={serverId} />
							</>
						) : (
							<ConsoleEmpty
								icon={GalleryVerticalEnd}
								title="No Traefik data available"
								description="Notploy did not receive any Traefik configuration for this server."
							/>
						)}
					</>
				)}
			</ConsoleBody>
		</ConsoleShell>
	);
};
