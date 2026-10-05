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
import { Network, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandleNetwork } from "@/components/dashboard/networks/handle-network";
import { SyncNetworks } from "@/components/dashboard/networks/sync-networks";
import {
	ConsoleBody,
	ConsoleDetailValue,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleNoMatch,
	ConsoleRefresh,
	ConsoleSearch,
	ConsoleShell,
	ConsoleSummary,
	ConsoleTable,
	ConsoleToolbar,
	SortableHeader,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { DialogAction } from "@/components/shared/dialog-action";
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

type NetworkInfo = RouterOutputs["network"]["inventory"][number];

interface Props {
	serverId?: string;
}

const displayValue = (value: string | null | undefined) =>
	value || "Not available";

const NetworkDetails = ({
	network,
	serverId,
	onRemove,
	isRemoving,
}: {
	network: NetworkInfo | null;
	serverId?: string;
	onRemove: (networkRecordId: string) => Promise<void>;
	isRemoving: boolean;
}) => {
	if (!network) return null;
	const isAvailable = network.status === "available";
	const isProtected =
		network.ingress ||
		network.configOnly ||
		[
			"bridge",
			"host",
			"none",
			"ingress",
			"docker_gwbridge",
			"notploy-network",
		].includes(network.name);
	const networkRecordId = network.networkRecordId;
	const canDelete =
		isAvailable &&
		Boolean(networkRecordId) &&
		!isProtected &&
		network.containers.length === 0;

	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Network className="size-5 text-muted-foreground" aria-hidden />
					{network.name}
				</DialogTitle>
				<DialogDescription>
					Live Docker network details. Docker labels are intentionally not
					shown.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-5">
				<section className="space-y-3">
					<h3 className="font-medium">Overview</h3>
					<dl className="grid gap-x-6 gap-y-3 rounded-md border p-4 text-sm sm:grid-cols-2">
						<ConsoleDetailValue label="Status">
							<NetworkStatus status={network.status} />
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Driver">
							{network.driver}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Scope">
							{displayValue(network.scope)}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Created">
							{isAvailable
								? new Date(network.createdAt).toLocaleString()
								: "Not available — record is missing from Docker"}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Network ID">
							<code className="break-all text-xs">{network.id}</code>
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Configuration">
							{network.ingress
								? "Swarm ingress"
								: network.configOnly
									? "Configuration-only"
									: network.networkRecordId
										? "Managed by Notploy"
										: "Docker network"}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Internal">
							{isAvailable
								? network.internal
									? "Yes"
									: "No"
								: "Not available"}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="Attachable">
							{isAvailable
								? network.attachable
									? "Yes"
									: "No"
								: "Not available"}
						</ConsoleDetailValue>
						<ConsoleDetailValue label="IPv6">
							{isAvailable
								? network.enableIPv6
									? "Enabled"
									: "Disabled"
								: "Not available"}
						</ConsoleDetailValue>
					</dl>
				</section>

				<section className="space-y-3">
					<div className="flex items-center justify-between gap-2">
						<div>
							<h3 className="font-medium">IPAM configuration</h3>
							<p className="text-sm text-muted-foreground">
								Subnets, gateways and address ranges reported by Docker.
							</p>
						</div>
						{network.ipam?.driver && (
							<Badge variant="outline">{network.ipam.driver}</Badge>
						)}
					</div>
					{!isAvailable ? (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							Configuration is not available because this network no longer
							exists in Docker.
						</p>
					) : network.ipam?.config.length ? (
						<div className="overflow-x-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Subnet</TableHead>
										<TableHead>Gateway</TableHead>
										<TableHead>IP range</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{network.ipam.config.map((entry, index) => (
										<TableRow key={`${network.id}-ipam-${index}`}>
											<TableCell>{displayValue(entry.subnet)}</TableCell>
											<TableCell>{displayValue(entry.gateway)}</TableCell>
											<TableCell>{displayValue(entry.ipRange)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							Docker reports no explicit IPAM ranges for this network.
						</p>
					)}
				</section>

				<section className="space-y-3">
					<div>
						<h3 className="font-medium">Connected containers</h3>
						<p className="text-sm text-muted-foreground">
							{isAvailable
								? `${network.containers.length} endpoint${network.containers.length === 1 ? "" : "s"} reported by Docker.`
								: "Container connections cannot be checked while the network is missing."}
						</p>
					</div>
					{network.containers.length > 0 ? (
						<div className="overflow-x-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Container</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>IP address</TableHead>
										<TableHead>Service / Project</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{network.containers.map((container) => (
										<TableRow key={container.containerId}>
											<TableCell>
												<Link
													className="font-medium hover:underline"
													href={`/dashboard/containers${serverId ? `?serverId=${encodeURIComponent(serverId)}` : ""}`}
												>
													{container.name}
												</Link>
												<div className="font-mono text-xs text-muted-foreground">
													{container.containerId.slice(0, 12)}
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="outline">{container.state}</Badge>
											</TableCell>
											<TableCell>
												{container.ipv4Address ||
													container.ipv6Address ||
													"Not available"}
											</TableCell>
											<TableCell>
												{[container.service, container.project]
													.filter(Boolean)
													.join(" · ") || "Not available"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							{isAvailable
								? "No containers are currently connected to this network."
								: "Not available"}
						</p>
					)}
				</section>

				{network.networkRecordId && (
					<section className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
						<div className="space-y-1">
							<h3 className="font-medium">Notploy record</h3>
							<p className="text-sm text-muted-foreground">
								{isAvailable
									? "This network is registered with Notploy."
									: "This record is stale because its Docker network is missing."}
							</p>
						</div>
						{canDelete ? (
							<DialogAction
								title="Delete network"
								description={`Remove "${network.name}" from Docker and Notploy? This action cannot be undone.`}
								onClick={async () => {
									if (networkRecordId) await onRemove(networkRecordId);
								}}
							>
								<Button variant="destructive" size="sm" isLoading={isRemoving}>
									<Trash2 className="size-4" aria-hidden />
									Remove network
								</Button>
							</DialogAction>
						) : (
							<p className="text-sm text-muted-foreground">
								{!isAvailable
									? "Use Sync to remove the stale Notploy record."
									: isProtected
										? "System networks cannot be removed here."
										: "Disconnect all containers before removing this network."}
							</p>
						)}
					</section>
				)}
			</div>
		</DialogContent>
	);
};

const NetworkStatus = ({ status }: { status: NetworkInfo["status"] }) => (
	<Badge variant={status === "available" ? "green" : "red"}>
		{status === "available" ? "Available in Docker" : "Missing in Docker"}
	</Badge>
);

export const NetworkConsole = ({ serverId }: Props) => {
	const apiUtils = api.useUtils();
	const [search, setSearch] = useState("");
	const [driverFilter, setDriverFilter] = useState("all");
	const [scopeFilter, setScopeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selectedNetwork, setSelectedNetwork] = useState<NetworkInfo | null>(
		null,
	);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "name", desc: false },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const {
		data: networks,
		isPending,
		isError,
		error,
		refetch,
		isRefetching,
	} = api.network.inventory.useQuery(
		{ serverId },
		{ refetchOnWindowFocus: false },
	);
	const removeMutation = api.network.remove.useMutation();

	const drivers = useMemo(
		() =>
			[...new Set((networks ?? []).map((network) => network.driver))].sort(),
		[networks],
	);
	const scopes = useMemo(
		() =>
			[
				...new Set(
					(networks ?? [])
						.map((network) => network.scope)
						.filter((scope): scope is string => Boolean(scope)),
				),
			].sort(),
		[networks],
	);
	const connectedContainers = useMemo(
		() =>
			new Set(
				(networks ?? []).flatMap((network) =>
					network.containers.map((container) => container.containerId),
				),
			).size,
		[networks],
	);
	const missingCount = (networks ?? []).filter(
		(network) => network.status === "missing",
	).length;

	const filteredNetworks = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		return (networks ?? []).filter((network) => {
			const matchesSearch =
				!query ||
				[
					network.name,
					network.driver,
					network.scope,
					...(network.ipam?.config.flatMap((entry) => [
						entry.subnet,
						entry.gateway,
						entry.ipRange,
					]) ?? []),
					...network.containers.flatMap((container) => [
						container.name,
						container.project,
						container.service,
						container.ipv4Address,
						container.ipv6Address,
					]),
				]
					.filter(Boolean)
					.join(" ")
					.toLocaleLowerCase()
					.includes(query);
			return (
				matchesSearch &&
				(driverFilter === "all" || network.driver === driverFilter) &&
				(scopeFilter === "all" || network.scope === scopeFilter) &&
				(statusFilter === "all" || network.status === statusFilter)
			);
		});
	}, [networks, search, driverFilter, scopeFilter, statusFilter]);

	const removeNetwork = async (networkRecordId: string) => {
		try {
			await removeMutation.mutateAsync({ networkId: networkRecordId });
			toast.success("Network removed");
			setSelectedNetwork(null);
			await apiUtils.network.inventory.invalidate({ serverId });
			await apiUtils.network.all.invalidate({ serverId });
		} catch (error) {
			toast.error("Could not remove network", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const columns = useMemo<ColumnDef<NetworkInfo>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <SortableHeader column={column} title="Name" />,
				cell: ({ row }) => (
					<div className="space-y-1">
						<button
							type="button"
							className="text-left font-medium hover:underline"
							onClick={() => setSelectedNetwork(row.original)}
						>
							{row.original.name}
						</button>
						{row.original.ingress && (
							<Badge variant="secondary">Swarm ingress</Badge>
						)}
					</div>
				),
			},
			{
				accessorKey: "driver",
				header: ({ column }) => (
					<SortableHeader column={column} title="Driver" />
				),
				cell: ({ row }) => (
					<Badge variant="outline">{row.original.driver}</Badge>
				),
			},
			{
				accessorFn: (row) => row.scope ?? "",
				id: "scope",
				header: ({ column }) => (
					<SortableHeader column={column} title="Scope" />
				),
				cell: ({ row }) =>
					row.original.scope ?? (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				id: "subnets",
				accessorFn: (row) =>
					row.ipam?.config
						.map((entry) => entry.subnet)
						.filter(Boolean)
						.join(", ") ?? "",
				header: "Subnets",
				enableSorting: false,
				cell: ({ row }) => {
					const subnets =
						row.original.ipam?.config
							.map((entry) => entry.subnet)
							.filter(Boolean) ?? [];
					return subnets.length ? (
						<div className="flex flex-col gap-1">
							{subnets.map((subnet) => (
								<span key={subnet}>{subnet}</span>
							))}
						</div>
					) : (
						<span className="text-muted-foreground">
							{row.original.status === "available"
								? "Automatic / not reported"
								: "Not available"}
						</span>
					);
				},
			},
			{
				id: "containers",
				accessorFn: (row) => row.containers.length,
				header: ({ column }) => (
					<SortableHeader column={column} title="Containers" />
				),
				cell: ({ row }) =>
					row.original.status === "available" ? (
						row.original.containers.length
					) : (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				accessorKey: "status",
				header: ({ column }) => (
					<SortableHeader column={column} title="Status" />
				),
				cell: ({ row }) => <NetworkStatus status={row.original.status} />,
			},
			{
				id: "actions",
				enableSorting: false,
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setSelectedNetwork(row.original)}
					>
						Inspect
					</Button>
				),
			},
		],
		[],
	);
	const table = useReactTable({
		data: filteredNetworks,
		columns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={Network}
				title="Networks"
				description="Manage Docker networks and connectivity across your Notploy infrastructure."
				actions={
					<>
						<ConsoleRefresh
							onClick={() => void refetch()}
							isRefetching={isRefetching}
							disabled={isPending}
						/>
						<HandleNetwork serverId={serverId} />
					</>
				}
			/>

			<ConsoleBody>
				{!isPending && !isError && (
					<>
						<ConsoleSummary>
							<SummaryMetric
								label="Docker networks"
								value={networks?.length ?? 0}
							/>
							<SummaryMetric
								label="Connected containers"
								value={connectedContainers}
							/>
							<SummaryMetric label="Drivers" value={drivers.length} />
							<SummaryMetric label="Missing in Docker" value={missingCount} />
						</ConsoleSummary>
						<ConsoleToolbar className="sm:grid-cols-[minmax(14rem,1fr)_10rem_10rem_12rem]">
							<ConsoleSearch
								value={search}
								onChange={setSearch}
								placeholder="Search networks, subnets, containers\u2026"
								ariaLabel="Search networks"
							/>
							<Select value={driverFilter} onValueChange={setDriverFilter}>
								<SelectTrigger aria-label="Filter by driver">
									<SelectValue placeholder="All drivers" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All drivers</SelectItem>
									{drivers.map((driver) => (
										<SelectItem key={driver} value={driver}>
											{driver}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={scopeFilter} onValueChange={setScopeFilter}>
								<SelectTrigger aria-label="Filter by scope">
									<SelectValue placeholder="All scopes" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All scopes</SelectItem>
									{scopes.map((scope) => (
										<SelectItem key={scope} value={scope}>
											{scope}
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
									<SelectItem value="available">Available in Docker</SelectItem>
									<SelectItem value="missing">Missing in Docker</SelectItem>
								</SelectContent>
							</Select>
						</ConsoleToolbar>
					</>
				)}

				{isPending ? (
					<ConsoleLoading label="Loading Docker network inventory\u2026" />
				) : isError ? (
					<ConsoleError
						message={`Could not load live Docker network data: ${error.message}`}
						onRetry={() => void refetch()}
					/>
				) : networks?.length === 0 ? (
					<ConsoleEmpty
						icon={Network}
						title="No Docker networks found"
						description="Docker returned no networks for this server. Create a network or synchronize existing Docker networks to register them with Notploy."
					>
						<HandleNetwork serverId={serverId} />
						<SyncNetworks serverId={serverId} />
					</ConsoleEmpty>
				) : filteredNetworks.length === 0 ? (
					<ConsoleNoMatch message="No networks match these search and filter settings." />
				) : (
					<ConsoleTable
						table={table}
						empty="No networks match these search and filter settings."
					/>
				)}
			</ConsoleBody>
			<Dialog
				open={Boolean(selectedNetwork)}
				onOpenChange={(open) => {
					if (!open) setSelectedNetwork(null);
				}}
			>
				<NetworkDetails
					network={selectedNetwork}
					serverId={serverId}
					onRemove={removeNetwork}
					isRemoving={removeMutation.isPending}
				/>
			</Dialog>
		</ConsoleShell>
	);
};
