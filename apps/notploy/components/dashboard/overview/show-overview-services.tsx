"use client";

import type { OverviewServiceType } from "@notploy/server/services/overview-shared";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDown,
	Ban,
	CircuitBoard,
	GlobeIcon,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	Search,
	Server as ServerIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DB_ENGINE_ICONS } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { api, type RouterOutputs } from "@/utils/api";

type ServiceRow = RouterOutputs["overview"]["services"][number];
type ServiceStatus = "running" | "deploying" | "idle" | "error" | "unknown";

const TYPE_LABELS: Record<OverviewServiceType, string> = {
	application: "Application",
	postgres: "PostgreSQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	mysql: "MySQL",
	redis: "Redis",
	compose: "Compose",
	libsql: "Libsql",
};

const ID_KEY_BY_TYPE: Partial<Record<OverviewServiceType, string>> = {
	application: "applicationId",
	compose: "composeId",
	postgres: "postgresId",
	mysql: "mysqlId",
	mariadb: "mariadbId",
	redis: "redisId",
	mongo: "mongoId",
};

const normalizeStatus = (status: string | null): ServiceStatus => {
	switch (status) {
		case "done":
			return "running";
		case "running":
			return "deploying";
		case "idle":
			return "idle";
		case "error":
			return "error";
		default:
			return "unknown";
	}
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
	running: "Running",
	deploying: "Deploying",
	idle: "Idle",
	error: "Error",
	unknown: "Unknown",
};

const STATUS_VARIANTS: Record<
	ServiceStatus,
	"green" | "secondary" | "red" | "outline"
> = {
	running: "green",
	deploying: "secondary",
	idle: "outline",
	error: "red",
	unknown: "outline",
};

const SortableHeader = ({
	column,
	title,
}: {
	column: {
		getIsSorted: () => false | "asc" | "desc";
		toggleSorting: (asc: boolean) => void;
	};
	title: string;
}) => (
	<Button
		variant="ghost"
		className="-ml-3 h-8"
		onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
	>
		{title}
		<ArrowUpDown className="ml-2 size-4" aria-hidden />
	</Button>
);

const ServiceIcon = ({ service }: { service: ServiceRow }) => {
	if (service.type in DB_ENGINE_ICONS) {
		const Icon = DB_ENGINE_ICONS[service.type as keyof typeof DB_ENGINE_ICONS];
		return <Icon className="size-5 shrink-0" aria-hidden />;
	}
	if (service.icon) {
		return (
			<Image
				src={service.icon}
				alt=""
				width={20}
				height={20}
				unoptimized
				className="size-5 shrink-0 rounded-sm object-contain"
			/>
		);
	}
	return service.type === "compose" ? (
		<CircuitBoard
			className="size-5 shrink-0 text-muted-foreground"
			aria-hidden
		/>
	) : (
		<GlobeIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
	);
};

const ServiceStatusBadge = ({ status }: { status: string | null }) => {
	const state = normalizeStatus(status);
	return <Badge variant={STATUS_VARIANTS[state]}>{STATUS_LABELS[state]}</Badge>;
};

const SummaryMetric = ({ label, value }: { label: string; value: number }) => (
	<div className="rounded-md border px-4 py-3">
		<p className="text-sm text-muted-foreground">{label}</p>
		<p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
	</div>
);

const ServiceDetails = ({ service }: { service: ServiceRow | null }) => {
	if (!service) return null;
	const detailHref = `/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`;
	const query = service.serverId
		? `?serverId=${encodeURIComponent(service.serverId)}`
		: "";

	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<ServiceIcon service={service} />
					{service.name}
				</DialogTitle>
				<DialogDescription>
					Notploy workload summary. Runtime and deployment controls remain
					available on the service page.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-5">
				<section className="space-y-3">
					<h3 className="font-medium">Workload</h3>
					<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
						<DetailValue label="Type">{TYPE_LABELS[service.type]}</DetailValue>
						<DetailValue label="Status">
							<ServiceStatusBadge status={service.status} />
						</DetailValue>
						<DetailValue label="Project">{service.projectName}</DetailValue>
						<DetailValue label="Environment">
							<Link
								className="hover:underline"
								href={`/dashboard/project/${service.projectId}/environment/${service.environmentId}`}
							>
								{service.environmentName}
							</Link>
						</DetailValue>
						<DetailValue label="Target server">
							{service.serverName ?? "Not available"}
						</DetailValue>
						<DetailValue label="Configured instances">
							{service.configuredReplicas ?? "Not available"}
						</DetailValue>
						<DetailValue label="Created">
							{new Date(service.createdAt).toLocaleString()}
						</DetailValue>
						<DetailValue label="Last deployment">
							{service.lastDeployAt
								? new Date(service.lastDeployAt).toLocaleString()
								: "Not available"}
						</DetailValue>
					</dl>
				</section>
				<div className="flex flex-wrap gap-2 border-t pt-4">
					<Button asChild>
						<Link href={detailHref}>Open service</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href={`/dashboard/deployments${query}`}>Deployments</Link>
					</Button>
					{service.serverId && (
						<Button asChild variant="outline">
							<Link href={`/dashboard/containers${query}`}>Containers</Link>
						</Button>
					)}
				</div>
				<p className="text-xs text-muted-foreground">
					Live instance health, network attachments, domains and logs are not
					aggregated in this service inventory.
				</p>
			</div>
		</DialogContent>
	);
};

const DetailValue = ({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) => (
	<div className="min-w-0 space-y-1">
		<dt className="text-xs text-muted-foreground">{label}</dt>
		<dd className="break-words font-medium">{children}</dd>
	</div>
);

export const ShowOverviewServices = () => {
	const utils = api.useUtils();
	const {
		data: services,
		isPending,
		isError,
		error,
		refetch,
		isRefetching,
	} = api.overview.services.useQuery(undefined, {
		refetchOnWindowFocus: false,
	});
	const [search, setSearch] = useState("");
	const [projectFilter, setProjectFilter] = useState("all");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selected, setSelected] = useState<ServiceRow | null>(null);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "lastDeployAt", desc: true },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 25,
	});

	const applicationActions = {
		deploy: api.application.deploy.useMutation(),
		stop: api.application.stop.useMutation(),
	};
	const composeActions = {
		deploy: api.compose.deploy.useMutation(),
		stop: api.compose.stop.useMutation(),
	};
	const postgresActions = {
		deploy: api.postgres.deploy.useMutation(),
		stop: api.postgres.stop.useMutation(),
	};
	const mysqlActions = {
		deploy: api.mysql.deploy.useMutation(),
		stop: api.mysql.stop.useMutation(),
	};
	const mariadbActions = {
		deploy: api.mariadb.deploy.useMutation(),
		stop: api.mariadb.stop.useMutation(),
	};
	const redisActions = {
		deploy: api.redis.deploy.useMutation(),
		stop: api.redis.stop.useMutation(),
	};
	const mongoActions = {
		deploy: api.mongo.deploy.useMutation(),
		stop: api.mongo.stop.useMutation(),
	};
	const actionsByType = {
		application: applicationActions,
		compose: composeActions,
		postgres: postgresActions,
		mysql: mysqlActions,
		mariadb: mariadbActions,
		redis: redisActions,
		mongo: mongoActions,
	};

	const runAction = async (service: ServiceRow, action: "deploy" | "stop") => {
		const actions = actionsByType[service.type as keyof typeof actionsByType];
		const idKey = ID_KEY_BY_TYPE[service.type];
		if (!actions || !idKey) return;
		try {
			await actions[action].mutateAsync({ [idKey]: service.id });
			toast.success(
				action === "deploy"
					? `${service.name} queued for deployment`
					: `${service.name} stopped`,
			);
			await utils.overview.services.invalidate();
		} catch (actionError) {
			toast.error(`Could not ${action} ${service.name}`, {
				description:
					actionError instanceof Error ? actionError.message : "Unknown error",
			});
		}
	};

	const availableTypes = useMemo(
		() => [...new Set((services ?? []).map((service) => service.type))],
		[services],
	);
	const availableProjects = useMemo(
		() =>
			Array.from(
				new Map(
					(services ?? []).map((service) => [
						service.projectId,
						service.projectName,
					]),
				),
				([projectId, name]) => ({ projectId, name }),
			),
		[services],
	);
	const filteredServices = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		return (services ?? []).filter((service) => {
			const matchesSearch =
				!query ||
				[
					service.name,
					service.projectName,
					service.environmentName,
					service.serverName,
				]
					.filter(Boolean)
					.join(" ")
					.toLocaleLowerCase()
					.includes(query);
			return (
				matchesSearch &&
				(projectFilter === "all" || service.projectId === projectFilter) &&
				(typeFilter === "all" || service.type === typeFilter) &&
				(statusFilter === "all" ||
					normalizeStatus(service.status) === statusFilter)
			);
		});
	}, [services, search, projectFilter, typeFilter, statusFilter]);

	const totalServices = services?.length ?? 0;
	const runningCount =
		services?.filter((service) => normalizeStatus(service.status) === "running")
			.length ?? 0;
	const deployingCount =
		services?.filter(
			(service) => normalizeStatus(service.status) === "deploying",
		).length ?? 0;
	const errorCount =
		services?.filter((service) => normalizeStatus(service.status) === "error")
			.length ?? 0;

	const columns = useMemo<ColumnDef<ServiceRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => (
					<SortableHeader column={column} title="Service" />
				),
				cell: ({ row }) => (
					<button
						type="button"
						className="flex min-w-48 items-center gap-2 text-left hover:underline"
						onClick={() => setSelected(row.original)}
					>
						<ServiceIcon service={row.original} />
						<span className="min-w-0">
							<span className="block truncate font-medium">
								{row.original.name}
							</span>
							<span className="block truncate text-xs text-muted-foreground">
								{TYPE_LABELS[row.original.type]}
							</span>
						</span>
					</button>
				),
			},
			{
				accessorKey: "projectName",
				header: ({ column }) => (
					<SortableHeader column={column} title="Project / Environment" />
				),
				cell: ({ row }) => (
					<div className="min-w-36">
						<span className="block truncate font-medium">
							{row.original.projectName}
						</span>
						<Link
							className="block truncate text-xs text-muted-foreground hover:underline"
							href={`/dashboard/project/${row.original.projectId}/environment/${row.original.environmentId}`}
						>
							{row.original.environmentName}
						</Link>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<SortableHeader column={column} title="Status" />
				),
				cell: ({ row }) => <ServiceStatusBadge status={row.original.status} />,
			},
			{
				accessorKey: "serverName",
				header: "Target server",
				cell: ({ row }) => (
					<div className="flex min-w-32 items-center gap-1.5 text-muted-foreground">
						<ServerIcon className="size-3.5 shrink-0" aria-hidden />
						<span className="truncate">
							{row.original.serverName ?? "Not available"}
						</span>
					</div>
				),
			},
			{
				accessorKey: "configuredReplicas",
				header: "Configured instances",
				cell: ({ row }) =>
					row.original.configuredReplicas ?? (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				accessorKey: "lastDeployAt",
				header: ({ column }) => (
					<SortableHeader column={column} title="Last deployment" />
				),
				cell: ({ row }) =>
					row.original.lastDeployAt ? (
						<DateTooltip date={row.original.lastDeployAt} />
					) : (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				id: "actions",
				enableSorting: false,
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => {
					const service = row.original;
					const canOperate =
						service.type in actionsByType && service.type !== "libsql";
					return canOperate ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Actions for ${service.name}`}
								>
									<MoreHorizontal className="size-4" aria-hidden />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>{service.name}</DropdownMenuLabel>
								<DialogAction
									title="Deploy Service"
									description={`Queue a new deployment for "${service.name}"?`}
									type="default"
									onClick={() => runAction(service, "deploy")}
								>
									<DropdownMenuItem
										onSelect={(event) => event.preventDefault()}
									>
										<RefreshCw className="size-4" aria-hidden />
										Deploy
									</DropdownMenuItem>
								</DialogAction>
								<DialogAction
									title="Stop Service"
									description={`Stop "${service.name}"? Its workload will no longer run until it is deployed again.`}
									onClick={() => runAction(service, "stop")}
								>
									<DropdownMenuItem
										className="text-orange-500 focus:text-orange-500"
										onSelect={(event) => event.preventDefault()}
									>
										<Ban className="size-4" aria-hidden />
										Stop
									</DropdownMenuItem>
								</DialogAction>
							</DropdownMenuContent>
						</DropdownMenu>
					) : null;
				},
			},
		],
		[actionsByType],
	);

	const table = useReactTable({
		data: filteredServices,
		columns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold tracking-tight">Services</h1>
						<p className="text-sm text-muted-foreground">
							Manage and operate the workloads deployed through Notploy.
						</p>
					</div>
					<Button
						variant="outline"
						onClick={() => void refetch()}
						disabled={isPending || isRefetching}
					>
						<RefreshCw
							className={`size-4 ${isRefetching ? "animate-spin" : ""}`}
							aria-hidden
						/>
						Refresh
					</Button>
				</header>

				<div className="space-y-5 border-t pt-5">
					{!isPending && !isError && (
						<>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
								<SummaryMetric label="Services" value={totalServices} />
								<SummaryMetric label="Running" value={runningCount} />
								<SummaryMetric label="Deploying" value={deployingCount} />
								<SummaryMetric label="Error" value={errorCount} />
							</div>
							<div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_12rem_12rem_12rem]">
								<div className="relative">
									<Search
										className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
										aria-hidden
									/>
									<Input
										className="pl-9"
										placeholder="Search service, project, environment…"
										value={search}
										onChange={(event) => setSearch(event.target.value)}
										aria-label="Search services"
									/>
								</div>
								<Select value={projectFilter} onValueChange={setProjectFilter}>
									<SelectTrigger aria-label="Filter by project">
										<SelectValue placeholder="All projects" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All projects</SelectItem>
										{availableProjects.map((project) => (
											<SelectItem
												key={project.projectId}
												value={project.projectId}
											>
												{project.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select value={typeFilter} onValueChange={setTypeFilter}>
									<SelectTrigger aria-label="Filter by service type">
										<SelectValue placeholder="All types" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All types</SelectItem>
										{availableTypes.map((type) => (
											<SelectItem key={type} value={type}>
												{TYPE_LABELS[type]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger aria-label="Filter by status">
										<SelectValue placeholder="All statuses" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All statuses</SelectItem>
										{(
											[
												"running",
												"deploying",
												"idle",
												"error",
												"unknown",
											] as const
										).map((status) => (
											<SelectItem key={status} value={status}>
												{STATUS_LABELS[status]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</>
					)}

					{isPending ? (
						<div
							className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"
							role="status"
						>
							Loading Notploy services…
							<Loader2 className="size-4 animate-spin" aria-hidden />
						</div>
					) : isError ? (
						<div className="space-y-3">
							<AlertBlock type="error">
								Could not load services: {error.message}
							</AlertBlock>
							<Button variant="outline" onClick={() => void refetch()}>
								<RefreshCw className="size-4" aria-hidden />
								Retry
							</Button>
						</div>
					) : totalServices === 0 ? (
						<div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
							<p className="font-medium">No services deployed yet</p>
							<p className="max-w-lg text-sm text-muted-foreground">
								Create a project and deploy a workload to manage it from the
								Services control center.
							</p>
							<Button asChild variant="outline">
								<Link href="/dashboard/projects">View projects</Link>
							</Button>
						</div>
					) : filteredServices.length === 0 ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							No services match the current search and filters.
						</div>
					) : (
						<>
							<p className="text-sm text-muted-foreground">
								{filteredServices.length} of {totalServices} workloads
							</p>
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										{table.getHeaderGroups().map((group) => (
											<TableRow key={group.id}>
												{group.headers.map((header) => (
													<TableHead key={header.id}>
														{header.isPlaceholder
															? null
															: flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
													</TableHead>
												))}
											</TableRow>
										))}
									</TableHeader>
									<TableBody>
										{table.getRowModel().rows.map((row) => (
											<TableRow key={`${row.original.type}-${row.original.id}`}>
												{row.getVisibleCells().map((cell) => (
													<TableCell key={cell.id}>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							{table.getPageCount() > 1 && (
								<div className="flex items-center justify-end gap-4">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										Rows
										<Select
											value={String(pagination.pageSize)}
											onValueChange={(value) =>
												setPagination({ pageIndex: 0, pageSize: Number(value) })
											}
										>
											<SelectTrigger className="w-20">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{[25, 50, 100].map((size) => (
													<SelectItem key={size} value={String(size)}>
														{size}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<span className="text-sm text-muted-foreground">
										Page {table.getState().pagination.pageIndex + 1} of{" "}
										{table.getPageCount()}
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={() => table.previousPage()}
										disabled={!table.getCanPreviousPage()}
									>
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => table.nextPage()}
										disabled={!table.getCanNextPage()}
									>
										Next
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
			<Dialog
				open={Boolean(selected)}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
			>
				<ServiceDetails service={selected} />
			</Dialog>
		</Card>
	);
};
