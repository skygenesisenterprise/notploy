"use client";

import type { inferRouterOutputs } from "@trpc/server";
import {
	ArrowDown,
	ArrowUp,
	Loader2,
	RefreshCw,
	Rocket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/utils/api";
import { DeploymentDetailDialog } from "./deployment-detail-dialog";

type DeploymentRow =
	inferRouterOutputs<AppRouter>["deployment"]["centralizedPage"]["items"][number];
type DeploymentStatus = NonNullable<DeploymentRow["status"]>;

const statuses: DeploymentStatus[] = ["running", "done", "error", "cancelled"];
const statusVariants: Record<
	DeploymentStatus,
	"yellow" | "green" | "red" | "outline"
> = {
	running: "yellow",
	done: "green",
	error: "red",
	cancelled: "outline",
};

function getServiceInfo(deployment: DeploymentRow) {
	const app = deployment.application;
	if (app?.environment?.project && app.environment) {
		return {
			type: "Application",
			name: app.name,
			icon: app.icon,
			projectId: app.environment.project.projectId,
			projectName: app.environment.project.name,
			environmentId: app.environment.environmentId,
			environmentName: app.environment.name,
			serviceId: app.applicationId,
		};
	}
	const compose = deployment.compose;
	if (compose?.environment?.project && compose.environment) {
		return {
			type: "Compose",
			name: compose.name,
			icon: compose.icon,
			projectId: compose.environment.project.projectId,
			projectName: compose.environment.project.name,
			environmentId: compose.environment.environmentId,
			environmentName: compose.environment.name,
			serviceId: compose.composeId,
		};
	}
	return null;
}

function formatDate(value: string | null | undefined) {
	if (!value) return "Not available";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function getDuration(deployment: DeploymentRow, now: number) {
	if (!deployment.startedAt) return "Not available";
	const start = new Date(deployment.startedAt).getTime();
	const finish = deployment.finishedAt
		? new Date(deployment.finishedAt).getTime()
		: deployment.status === "running"
			? now
			: Number.NaN;
	if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) {
		return "Not available";
	}
	const seconds = Math.floor((finish - start) / 1000);
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function ShowDeploymentsTable() {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | DeploymentStatus>(
		"all",
	);
	const [typeFilter, setTypeFilter] = useState<
		"all" | "application" | "compose"
	>("all");
	const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(25);
	const [selectedDeployment, setSelectedDeployment] =
		useState<DeploymentRow | null>(null);
	const { data, isLoading, isError, error, refetch, isFetching } =
		api.deployment.centralizedPage.useQuery(
			{
				offset: page * pageSize,
				limit: pageSize,
				status: statusFilter === "all" ? undefined : statusFilter,
				type: typeFilter === "all" ? undefined : typeFilter,
				search: debouncedSearch.trim() || undefined,
				sortOrder,
			},
			{ refetchInterval: 5000 },
		);
	const now = Date.now();
	const pageItems = data?.items ?? [];
	const counts = data?.counts ?? {
		total: 0,
		running: 0,
		done: 0,
		error: 0,
		cancelled: 0,
	};
	const pageCount = Math.ceil((data?.total ?? 0) / pageSize);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setDebouncedSearch(search);
			setPage(0);
		}, 250);
		return () => window.clearTimeout(timeout);
	}, [search]);

	const updateSearch = (value: string) => {
		setSearch(value);
	};

	return (
		<div className="space-y-5">
			<section
				aria-label="Deployment status summary"
				className="grid grid-cols-2 gap-3 lg:grid-cols-5"
			>
				{[
					{ label: "Deployments", value: counts.total },
					{ label: "Running", value: counts.running },
					{ label: "Done", value: counts.done },
					{ label: "Error", value: counts.error },
					{ label: "Cancelled", value: counts.cancelled },
				].map((item) => (
					<div key={item.label} className="rounded-lg border bg-background p-4">
						<p className="text-sm text-muted-foreground">{item.label}</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums">
							{item.value}
						</p>
					</div>
				))}
			</section>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto">
					<Input
						aria-label="Search deployments"
						placeholder="Search deployments, services, projects..."
						value={search}
						onChange={(event) => updateSearch(event.target.value)}
						className="min-w-[220px] flex-1 sm:w-[320px]"
					/>
					<Select
						value={statusFilter}
						onValueChange={(value) => {
							setStatusFilter(value);
							setPage(0);
						}}
					>
						<SelectTrigger className="w-[145px]" aria-label="Filter by status">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All statuses</SelectItem>
							{statuses.map((status) => (
								<SelectItem key={status} value={status}>
									{status}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={typeFilter}
						onValueChange={(value) => {
							setTypeFilter(value as "all" | "application" | "compose");
							setPage(0);
						}}
					>
						<SelectTrigger className="w-[145px]" aria-label="Filter by service type">
							<SelectValue placeholder="Service type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All service types</SelectItem>
							<SelectItem value="application">Application</SelectItem>
							<SelectItem value="compose">Compose</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void refetch()}
					disabled={isFetching}
				>
					<RefreshCw className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			{isLoading ? (
				<div className="flex min-h-[30vh] items-center justify-center gap-3 text-muted-foreground">
					<Loader2 className="size-5 animate-spin" />
					<span>Loading deployments...</span>
				</div>
			) : isError ? (
				<div className="rounded-lg border border-destructive/40 p-6 text-sm">
					<p className="font-medium text-destructive">
						Unable to load deployments
					</p>
					<p className="mt-1 text-muted-foreground">{error.message}</p>
					<Button className="mt-4" variant="outline" onClick={() => void refetch()}>
						Retry
					</Button>
				</div>
			) : counts.total === 0 ? (
				<div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 rounded-lg border text-center text-muted-foreground">
					<Rocket className="size-8" />
					<p className="font-medium text-foreground">No deployments yet</p>
					<p className="text-sm">
						Deployments will appear here when workloads are deployed.
					</p>
				</div>
			) : (
				<>
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Deployment</TableHead>
									<TableHead>Service</TableHead>
									<TableHead>Project / environment</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Duration</TableHead>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											className="-ml-3"
											onClick={() =>
												setSortOrder((current) =>
													current === "newest" ? "oldest" : "newest",
												)
											}
										>
											Created
											{sortOrder === "newest" ? (
												<ArrowDown className="ml-2 size-4" />
											) : (
												<ArrowUp className="ml-2 size-4" />
											)}
										</Button>
									</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{pageItems.length > 0 ? (
									pageItems.map((deployment) => {
										const service = getServiceInfo(deployment);
										const status = deployment.status ?? "running";
										return (
											<TableRow key={deployment.deploymentId}>
												<TableCell className="min-w-[190px]">
													<p className="max-w-[280px] truncate font-medium">
														{deployment.title || "Deployment"}
													</p>
													<p
														className="font-mono text-xs text-muted-foreground"
														title={deployment.deploymentId}
													>
														#{deployment.deploymentId.slice(0, 8)}
													</p>
												</TableCell>
												<TableCell>
													{service ? (
														<div className="flex items-center gap-2">
															{service.icon ? (
																<img
																	src={service.icon}
																	alt=""
																	className="size-4 shrink-0 object-contain"
																/>
															) : null}
															<span>{service.name}</span>
															<Badge variant="outline" className="text-[10px]">
																{service.type}
															</Badge>
														</div>
													) : (
														<span className="text-muted-foreground">
															Not available
														</span>
													)}
												</TableCell>
												<TableCell>
													<p>{service?.projectName ?? "Not available"}</p>
													<p className="text-xs text-muted-foreground">
														{service?.environmentName ?? "Not available"}
													</p>
												</TableCell>
												<TableCell>
													<Badge variant={statusVariants[status]}>
														{status}
													</Badge>
												</TableCell>
												<TableCell className="tabular-nums">
													{getDuration(deployment, now)}
												</TableCell>
												<TableCell className="whitespace-nowrap text-sm text-muted-foreground">
													{formatDate(deployment.startedAt ?? deployment.createdAt)}
												</TableCell>
												<TableCell>
													<Button
														variant="outline"
														size="sm"
														onClick={() => setSelectedDeployment(deployment)}
													>
														Details
													</Button>
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell colSpan={7} className="py-12 text-center">
											<p className="font-medium">No matching deployments</p>
											<p className="mt-1 text-sm text-muted-foreground">
												Adjust the search or filters to see more results.
											</p>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
						<div className="flex items-center gap-2">
							<span>Rows per page</span>
							<Select
								value={String(pageSize)}
								onValueChange={(value) => {
									setPageSize(Number(value));
									setPage(0);
								}}
							>
								<SelectTrigger className="h-8 w-[75px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[10, 25, 50, 100].map((size) => (
										<SelectItem key={size} value={String(size)}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span>
								{(data?.total ?? 0) === 0
									? 0
									: page * pageSize + 1}
								–{Math.min((page + 1) * pageSize, data?.total ?? 0)} of{" "}
								{data?.total ?? 0}
							</span>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 0}
								onClick={() => setPage((current) => current - 1)}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={page + 1 >= pageCount}
								onClick={() => setPage((current) => current + 1)}
							>
								Next
							</Button>
						</div>
					</div>
				</>
			)}

			<DeploymentDetailDialog
				deployment={selectedDeployment}
				onOpenChange={(open) => {
					if (!open) setSelectedDeployment(null);
				}}
			/>
		</div>
	);
}
