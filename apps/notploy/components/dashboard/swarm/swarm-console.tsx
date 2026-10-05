"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	Boxes,
	CircleAlert,
	Container,
	Network,
	Server,
	Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	ConsoleBody,
	ConsoleDetailValue,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleRefresh,
	ConsoleSearch,
	ConsoleShell,
	ConsoleSummary,
	ConsoleTable,
	ConsoleToolbar,
	SortableHeader,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type RouterOutputs } from "@/utils/api";

type SwarmData = RouterOutputs["swarm"]["getConsole"];
type SwarmNode = SwarmData["nodes"][number];
type SwarmService = SwarmData["services"][number];
type SwarmTask = SwarmData["tasks"][number];

interface Props {
	serverId?: string;
}

const valueOrUnavailable = (value: string | number | null | undefined) =>
	value === null || value === undefined || value === ""
		? "Not available"
		: value;

const formatBytes = (bytes: number | null | undefined) =>
	bytes === null || bytes === undefined
		? "Not available"
		: `${(bytes / 1024 ** 3).toFixed(2)} GB`;

const formatCpu = (nanoCpus: number | null | undefined) =>
	nanoCpus === null || nanoCpus === undefined
		? "Not available"
		: `${(nanoCpus / 1e9).toFixed(2)} cores`;

const StatusBadge = ({ state }: { state: string }) => {
	const variant =
		state === "ready" || state === "running" || state === "active"
			? "green"
			: ["failed", "rejected", "shutdown", "down", "unknown"].includes(
						state.toLowerCase(),
					)
				? "red"
				: "secondary";
	return <Badge variant={variant}>{state}</Badge>;
};

const DetailValue = ({
	label,
	value,
}: {
	label: string;
	value: string | number | null | undefined;
}) => (
	<ConsoleDetailValue label={label}>
		{valueOrUnavailable(value)}
	</ConsoleDetailValue>
);

const NodeDetails = ({ node }: { node: SwarmNode | null }) => {
	if (!node) return null;
	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Server className="size-5 text-muted-foreground" aria-hidden />
					{node.hostname ?? node.id}
				</DialogTitle>
				<DialogDescription>
					Docker Swarm node details reported by the manager.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-5">
				<section className="space-y-3">
					<h3 className="font-medium">Identity and scheduling</h3>
					<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
						<DetailValue label="Node ID" value={node.id} />
						<DetailValue label="Hostname" value={node.hostname} />
						<DetailValue label="Role" value={node.role} />
						<DetailValue label="Status" value={node.state} />
						<DetailValue label="Availability" value={node.availability} />
						<DetailValue label="Address" value={node.address} />
						<DetailValue
							label="Manager reachability"
							value={node.managerStatus?.reachability}
						/>
						<DetailValue
							label="Manager address"
							value={node.managerStatus?.address}
						/>
						<DetailValue
							label="Leader"
							value={
								node.managerStatus
									? node.managerStatus.leader
										? "Yes"
										: "No"
									: null
							}
						/>
					</dl>
				</section>
				<section className="space-y-3">
					<h3 className="font-medium">Runtime and resources</h3>
					<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
						<DetailValue label="Docker Engine" value={node.engineVersion} />
						<DetailValue label="Operating system" value={node.os} />
						<DetailValue label="Architecture" value={node.architecture} />
						<DetailValue label="CPU capacity" value={formatCpu(node.cpuNano)} />
						<DetailValue
							label="Memory capacity"
							value={formatBytes(node.memoryBytes)}
						/>
						<DetailValue
							label="Created"
							value={
								node.createdAt
									? new Date(node.createdAt).toLocaleString()
									: null
							}
						/>
						<DetailValue
							label="Updated"
							value={
								node.updatedAt
									? new Date(node.updatedAt).toLocaleString()
									: null
							}
						/>
					</dl>
				</section>
				<p className="text-xs text-muted-foreground">
					Node labels are omitted because Docker labels may contain sensitive
					metadata.
				</p>
			</div>
		</DialogContent>
	);
};

const ServiceDetails = ({
	service,
	serverId,
}: {
	service: SwarmService | null;
	serverId?: string;
}) => {
	if (!service) return null;
	const serverQuery = serverId
		? `?serverId=${encodeURIComponent(serverId)}`
		: "";
	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Boxes className="size-5 text-muted-foreground" aria-hidden />
					{service.name}
				</DialogTitle>
				<DialogDescription>
					Docker Swarm Service configuration and current task distribution.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-5">
				<section className="space-y-3">
					<h3 className="font-medium">Overview</h3>
					<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
						<DetailValue label="Service ID" value={service.id} />
						<DetailValue label="Mode" value={service.mode} />
						<DetailValue label="Image" value={service.image} />
						<DetailValue
							label="Desired replicas"
							value={service.desiredReplicas}
						/>
						<DetailValue
							label="Running replicas"
							value={service.runningReplicas}
						/>
						<DetailValue label="Update state" value={service.updateStatus} />
					</dl>
				</section>
				<section className="space-y-3">
					<h3 className="font-medium">Scheduling</h3>
					<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
						<div className="space-y-1 sm:col-span-2">
							<dt className="text-xs text-muted-foreground">
								Placement constraints
							</dt>
							<dd>
								{service.placementConstraints.length
									? service.placementConstraints.join(", ")
									: "No placement constraints reported"}
							</dd>
						</div>
						<div className="space-y-1 sm:col-span-2">
							<dt className="text-xs text-muted-foreground">
								Placement preferences
							</dt>
							<dd>
								{service.placementPreferences.length
									? service.placementPreferences.join(", ")
									: "No placement preferences reported"}
							</dd>
						</div>
						<DetailValue
							label="CPU reservation"
							value={formatCpu(service.resources.reservations.cpuNano)}
						/>
						<DetailValue
							label="Memory reservation"
							value={formatBytes(service.resources.reservations.memoryBytes)}
						/>
						<DetailValue
							label="CPU limit"
							value={formatCpu(service.resources.limits.cpuNano)}
						/>
						<DetailValue
							label="Memory limit"
							value={formatBytes(service.resources.limits.memoryBytes)}
						/>
						<DetailValue
							label="Restart condition"
							value={service.restartPolicy?.condition}
						/>
						<DetailValue
							label="Restart max attempts"
							value={service.restartPolicy?.maxAttempts}
						/>
						<DetailValue
							label="Update parallelism"
							value={service.updateConfig?.parallelism}
						/>
						<DetailValue
							label="Update order"
							value={service.updateConfig?.order}
						/>
						<DetailValue
							label="Update failure action"
							value={service.updateConfig?.failureAction}
						/>
					</dl>
				</section>
				<section className="space-y-3">
					<h3 className="font-medium">Published ports</h3>
					{service.ports.length ? (
						<div className="overflow-x-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Published</TableHead>
										<TableHead>Target</TableHead>
										<TableHead>Protocol</TableHead>
										<TableHead>Mode</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{service.ports.map((port, index) => (
										<TableRow key={`${service.id}-port-${index}`}>
											<TableCell>
												{valueOrUnavailable(port.published)}
											</TableCell>
											<TableCell>{valueOrUnavailable(port.target)}</TableCell>
											<TableCell>{valueOrUnavailable(port.protocol)}</TableCell>
											<TableCell>{valueOrUnavailable(port.mode)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							No published ports reported.
						</p>
					)}
				</section>
				<section className="space-y-3">
					<h3 className="font-medium">Networks</h3>
					{service.networks.length ? (
						<div className="flex flex-wrap gap-2">
							{service.networks.map((network) => (
								<Button
									asChild
									key={network.target}
									variant="outline"
									size="sm"
								>
									<Link href={`/dashboard/networks${serverQuery}`}>
										<Network className="size-4" aria-hidden />
										{network.target}
									</Link>
								</Button>
							))}
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							No network attachments reported.
						</p>
					)}
				</section>
				<section className="space-y-3">
					<h3 className="font-medium">Replica distribution</h3>
					{service.runningByNode.length ? (
						<div className="divide-y rounded-md border">
							{service.runningByNode.map(({ node, count }) => (
								<div
									key={node}
									className="flex items-center justify-between px-4 py-2 text-sm"
								>
									<span>{node}</span>
									<span className="font-medium tabular-nums">
										{count} running
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							No running tasks are currently assigned to a node.
						</p>
					)}
				</section>
			</div>
		</DialogContent>
	);
};

export const SwarmConsole = ({ serverId }: Props) => {
	const [tab, setTab] = useState("nodes");
	const [search, setSearch] = useState("");
	const [selectedNode, setSelectedNode] = useState<SwarmNode | null>(null);
	const [selectedService, setSelectedService] = useState<SwarmService | null>(
		null,
	);
	const [nodeSorting, setNodeSorting] = useState<SortingState>([
		{ id: "hostname", desc: false },
	]);
	const [serviceSorting, setServiceSorting] = useState<SortingState>([
		{ id: "name", desc: false },
	]);
	const [taskSorting, setTaskSorting] = useState<SortingState>([
		{ id: "updatedAt", desc: true },
	]);
	const [nodePagination, setNodePagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const [servicePagination, setServicePagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const [taskPagination, setTaskPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const { data, isPending, isError, error, refetch, isRefetching } =
		api.swarm.getConsole.useQuery(
			{ serverId },
			{ refetchInterval: 30_000, refetchOnWindowFocus: false, retry: false },
		);

	const nodes = useMemo(
		() =>
			(data?.nodes ?? []).filter((node) =>
				searchable(search, [
					node.hostname,
					node.id,
					node.role,
					node.state,
					node.availability,
				]),
			),
		[data?.nodes, search],
	);
	const services = useMemo(
		() =>
			(data?.services ?? []).filter((service) =>
				searchable(search, [
					service.name,
					service.image,
					service.mode,
					service.updateStatus,
				]),
			),
		[data?.services, search],
	);
	const tasks = useMemo(
		() =>
			(data?.tasks ?? []).filter((task) =>
				searchable(search, [
					task.id,
					task.serviceName,
					task.nodeName,
					task.state,
					task.error,
					task.message,
					task.containerId,
				]),
			),
		[data?.tasks, search],
	);

	const nodeColumns = useMemo<ColumnDef<SwarmNode>[]>(
		() => [
			{
				accessorKey: "hostname",
				header: ({ column }) => <SortableHeader column={column} title="Node" />,
				cell: ({ row }) => (
					<span className="font-medium">
						{row.original.hostname ?? row.original.id}
					</span>
				),
			},
			{
				accessorKey: "role",
				header: ({ column }) => <SortableHeader column={column} title="Role" />,
				cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge>,
			},
			{
				accessorKey: "state",
				header: ({ column }) => (
					<SortableHeader column={column} title="Status" />
				),
				cell: ({ row }) => <StatusBadge state={row.original.state} />,
			},
			{
				accessorKey: "availability",
				header: ({ column }) => (
					<SortableHeader column={column} title="Availability" />
				),
				cell: ({ row }) => valueOrUnavailable(row.original.availability),
			},
			{
				accessorKey: "engineVersion",
				header: "Engine",
				cell: ({ row }) => valueOrUnavailable(row.original.engineVersion),
			},
			{
				id: "tasks",
				accessorFn: (node) =>
					(data?.tasks ?? []).filter((task) => task.nodeId === node.id).length,
				header: ({ column }) => (
					<SortableHeader column={column} title="Tasks" />
				),
			},
			{
				id: "details",
				enableSorting: false,
				header: "",
				cell: ({ row }) => (
					<Button
						size="sm"
						variant="outline"
						onClick={() => setSelectedNode(row.original)}
					>
						Details
					</Button>
				),
			},
		],
		[data?.tasks],
	);
	const serviceColumns = useMemo<ColumnDef<SwarmService>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => (
					<SortableHeader column={column} title="Swarm Service" />
				),
				cell: ({ row }) => (
					<button
						type="button"
						className="text-left font-medium hover:underline"
						onClick={() => setSelectedService(row.original)}
					>
						{row.original.name}
					</button>
				),
			},
			{
				accessorKey: "mode",
				header: ({ column }) => <SortableHeader column={column} title="Mode" />,
				cell: ({ row }) => <Badge variant="outline">{row.original.mode}</Badge>,
			},
			{
				accessorKey: "desiredReplicas",
				header: ({ column }) => (
					<SortableHeader column={column} title="Desired" />
				),
				cell: ({ row }) => valueOrUnavailable(row.original.desiredReplicas),
			},
			{
				accessorKey: "runningReplicas",
				header: ({ column }) => (
					<SortableHeader column={column} title="Running" />
				),
			},
			{
				accessorKey: "image",
				header: "Image",
				cell: ({ row }) => (
					<span
						className="block max-w-64 truncate"
						title={row.original.image ?? undefined}
					>
						{valueOrUnavailable(row.original.image)}
					</span>
				),
			},
			{
				accessorKey: "updateStatus",
				header: "Update",
				cell: ({ row }) => valueOrUnavailable(row.original.updateStatus),
			},
			{
				id: "details",
				enableSorting: false,
				header: "",
				cell: ({ row }) => (
					<Button
						size="sm"
						variant="outline"
						onClick={() => setSelectedService(row.original)}
					>
						Details
					</Button>
				),
			},
		],
		[],
	);
	const taskColumns = useMemo<ColumnDef<SwarmTask>[]>(
		() => [
			{
				accessorKey: "serviceName",
				header: ({ column }) => (
					<SortableHeader column={column} title="Swarm Service" />
				),
				cell: ({ row }) => valueOrUnavailable(row.original.serviceName),
			},
			{
				accessorKey: "nodeName",
				header: ({ column }) => <SortableHeader column={column} title="Node" />,
				cell: ({ row }) => valueOrUnavailable(row.original.nodeName),
			},
			{
				accessorKey: "state",
				header: ({ column }) => (
					<SortableHeader column={column} title="State" />
				),
				cell: ({ row }) => <StatusBadge state={row.original.state} />,
			},
			{ accessorKey: "desiredState", header: "Desired" },
			{
				accessorKey: "slot",
				header: "Slot",
				cell: ({ row }) => valueOrUnavailable(row.original.slot),
			},
			{
				accessorKey: "containerId",
				header: "Container",
				cell: ({ row }) =>
					row.original.containerId ? (
						<Link
							className="font-mono text-xs hover:underline"
							href={`/dashboard/containers${serverId ? `?serverId=${encodeURIComponent(serverId)}` : ""}`}
						>
							{row.original.containerId.slice(0, 12)}
						</Link>
					) : (
						<span className="text-muted-foreground">Not assigned</span>
					),
			},
			{
				accessorKey: "error",
				header: "Error",
				cell: ({ row }) => row.original.error || row.original.message || "—",
			},
		],
		[serverId],
	);
	const nodeTable = useReactTable({
		data: nodes,
		columns: nodeColumns,
		state: { sorting: nodeSorting, pagination: nodePagination },
		onSortingChange: setNodeSorting,
		onPaginationChange: setNodePagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});
	const serviceTable = useReactTable({
		data: services,
		columns: serviceColumns,
		state: { sorting: serviceSorting, pagination: servicePagination },
		onSortingChange: setServiceSorting,
		onPaginationChange: setServicePagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});
	const taskTable = useReactTable({
		data: tasks,
		columns: taskColumns,
		state: { sorting: taskSorting, pagination: taskPagination },
		onSortingChange: setTaskSorting,
		onPaginationChange: setTaskPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	const readyNodes =
		data?.nodes.filter((node) => node.state.toLowerCase() === "ready").length ??
		0;
	const managers =
		data?.nodes.filter((node) => node.role === "manager").length ?? 0;
	const runningTasks =
		data?.tasks.filter((task) => task.state.toLowerCase() === "running")
			.length ?? 0;
	const degradedServices =
		data?.services.filter(
			(service) =>
				service.desiredReplicas !== null &&
				service.runningReplicas < service.desiredReplicas,
		).length ?? 0;
	const serverQuery = serverId
		? `?serverId=${encodeURIComponent(serverId)}`
		: "";

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={Waypoints}
				title="Swarm"
				description="Manage Docker Swarm clusters, nodes and workload orchestration."
				actions={
					<ConsoleRefresh
						onClick={() => void refetch()}
						isRefetching={isRefetching}
						disabled={isPending}
					/>
				}
			/>

			<ConsoleBody>
				{isPending ? (
					<ConsoleLoading label="Loading Swarm cluster\u2026" />
				) : isError ? (
					<ConsoleError
						message={`Could not retrieve Docker Swarm state: ${error.message}`}
						onRetry={() => void refetch()}
					/>
				) : (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<span
									className={`size-2.5 rounded-full ${data.state === "active" ? "bg-green-500" : "bg-muted-foreground"}`}
									aria-hidden
								/>
								<span className="font-medium">
									{data.state === "active"
										? "Swarm active"
										: data.state === "inactive"
											? "Swarm not initialized"
											: `Swarm ${data.state}`}
								</span>
								<Badge
									variant={data.state === "active" ? "green" : "secondary"}
								>
									{data.isManager
										? "Manager"
										: data.state === "active"
											? "Worker"
											: "No active node"}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								Checked {new Date(data.checkedAt).toLocaleTimeString()}
								{data.engineVersion && ` \u00b7 Docker ${data.engineVersion}`}
								{data.clusterId && ` \u00b7 Cluster ${data.clusterId}`}
							</p>
						</div>

						{data.state !== "active" ? (
							<div className="space-y-3 rounded-md border border-dashed p-6">
								<div className="flex items-center gap-2 font-medium">
									<CircleAlert
										className="size-4 text-muted-foreground"
										aria-hidden
									/>
									Swarm is not initialized on this Docker Engine
								</div>
								<p className="text-sm text-muted-foreground">
									Docker reports the local Swarm state as \u201c{data.state}
									\u201d. Initialize or join a cluster using your existing
									Docker administration process; Notploy does not expose a Swarm
									initialization action.
								</p>
							</div>
						) : !data.controlPlaneAvailable ? (
							<div className="space-y-2 rounded-md border border-dashed p-6">
								<h2 className="font-medium">
									Manager control plane unavailable
								</h2>
								<p className="text-sm text-muted-foreground">
									This Docker Engine is a Swarm worker. Docker reports the node
									as active, but node, service and task inventories must be
									queried from a manager.
								</p>
								<p className="text-xs text-muted-foreground">
									Node ID: {valueOrUnavailable(data.nodeId)}
								</p>
							</div>
						) : (
							<>
								<ConsoleSummary>
									<SummaryMetric
										label="Cluster state"
										value="Active"
										detail={
											data.isManager
												? "Manager control plane available"
												: "Worker node"
										}
									/>
									<SummaryMetric
										label="Nodes"
										value={data.nodes.length}
										detail={`${readyNodes} ready \u00b7 ${data.nodes.length - readyNodes} not ready`}
									/>
									<SummaryMetric
										label="Managers"
										value={managers}
										detail={`${Math.max(data.nodes.length - managers, 0)} workers`}
									/>
									<SummaryMetric
										label="Swarm Services"
										value={data.services.length}
										detail={`${degradedServices} below desired replicas`}
									/>
									<SummaryMetric
										label="Running Tasks"
										value={runningTasks}
										detail={`${data.tasks.length} total tasks`}
									/>
								</ConsoleSummary>

								<ConsoleToolbar className="sm:grid-cols-[minmax(14rem,1fr)_auto]">
									<ConsoleSearch
										value={search}
										onChange={setSearch}
										placeholder="Search nodes, services, tasks\u2026"
										ariaLabel="Search Swarm inventory"
									/>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Server className="size-4" aria-hidden />
										Inventory returned by Docker Swarm manager
									</div>
								</ConsoleToolbar>

								<Tabs value={tab} onValueChange={setTab}>
									<TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
										<TabsTrigger value="nodes">
											<Server className="size-4" aria-hidden />
											Nodes ({data.nodes.length})
										</TabsTrigger>
										<TabsTrigger value="services">
											<Boxes className="size-4" aria-hidden />
											Swarm Services ({data.services.length})
										</TabsTrigger>
										<TabsTrigger value="tasks">
											<Container className="size-4" aria-hidden />
											Tasks ({data.tasks.length})
										</TabsTrigger>
									</TabsList>
									<TabsContent value="nodes" className="space-y-3">
										<ConsoleTable
											table={nodeTable}
											empty="No nodes were returned by the Swarm manager."
										/>
									</TabsContent>
									<TabsContent value="services" className="space-y-3">
										<ConsoleTable
											table={serviceTable}
											empty="No Swarm Services were returned by the manager."
										/>
									</TabsContent>
									<TabsContent value="tasks" className="space-y-3">
										<ConsoleTable
											table={taskTable}
											empty="No Swarm Tasks were returned by the manager."
										/>
									</TabsContent>
								</Tabs>

								{degradedServices > 0 && (
									<div className="space-y-2">
										<h2 className="font-medium">
											Services below desired replicas
										</h2>
										{data.services
											.filter(
												(service) =>
													service.desiredReplicas !== null &&
													service.runningReplicas < service.desiredReplicas,
											)
											.map((service) => (
												<div
													key={service.id}
													className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 p-3 text-sm"
												>
													<button
														type="button"
														className="font-medium hover:underline"
														onClick={() => setSelectedService(service)}
													>
														{service.name}
													</button>
													<span className="text-muted-foreground">
														{service.runningReplicas} running /{" "}
														{service.desiredReplicas} desired
													</span>
												</div>
											))}
									</div>
								)}

								<div className="flex flex-wrap items-center gap-2 border-t pt-4">
									<Button asChild size="sm" variant="outline">
										<Link href={`/dashboard/containers${serverQuery}`}>
											<Container className="size-4" aria-hidden />
											Containers
										</Link>
									</Button>
									<Button asChild size="sm" variant="outline">
										<Link href={`/dashboard/networks${serverQuery}`}>
											<Network className="size-4" aria-hidden />
											Networks
										</Link>
									</Button>
								</div>
							</>
						)}
					</>
				)}
			</ConsoleBody>

			<Dialog
				open={Boolean(selectedNode)}
				onOpenChange={(open) => {
					if (!open) setSelectedNode(null);
				}}
			>
				<NodeDetails node={selectedNode} />
			</Dialog>
			<Dialog
				open={Boolean(selectedService)}
				onOpenChange={(open) => {
					if (!open) setSelectedService(null);
				}}
			>
				<ServiceDetails service={selectedService} serverId={serverId} />
			</Dialog>
		</ConsoleShell>
	);
};

const searchable = (query: string, values: Array<string | null | undefined>) =>
	!query.trim() ||
	values
		.filter(Boolean)
		.join(" ")
		.toLocaleLowerCase()
		.includes(query.trim().toLocaleLowerCase());
