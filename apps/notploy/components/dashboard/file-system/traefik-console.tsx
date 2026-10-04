import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";
import { ShowTraefikSystem } from "./show-traefik-system";

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

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
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
					<div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
				) : overview.data ? (
					<>
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
							<CardContent>
								<ShowTraefikSystem serverId={serverId} />
							</CardContent>
						</Card>
					</>
				) : null}
			</div>
		</Card>
	);
};

const EmptyMessage = ({ children }: { children: ReactNode }) => (
	<div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
		{children}
	</div>
);
