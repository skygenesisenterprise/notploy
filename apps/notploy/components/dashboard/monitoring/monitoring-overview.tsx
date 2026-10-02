import {
	Check,
	ChevronDown,
	Cpu,
	HardDrive,
	LoaderCircle,
	MemoryStick,
	Network,
	Server as ServerIcon,
} from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { ContainerFreeMonitoring } from "@/components/dashboard/monitoring/free/container/show-free-container-monitoring";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/utils/api";
import { CPUChart } from "./paid/servers/cpu-chart";
import { DiskChart } from "./paid/servers/disk-chart";
import { MemoryChart } from "./paid/servers/memory-chart";
import { NetworkChart } from "./paid/servers/network-chart";

interface RawMetric {
	cpu: string;
	cpuModel: string;
	cpuCores: number;
	cpuPhysicalCores: number;
	cpuSpeed: number;
	os: string;
	distro: string;
	kernel: string;
	arch: string;
	memUsed: string;
	memUsedGB: string;
	memTotal: string;
	uptime: number;
	diskUsed: string;
	totalDisk: string;
	networkIn: string;
	networkOut: string;
	timestamp: string;
}

interface WorkspaceDataset {
	serverId: string;
	name: string;
	data: RawMetric[] | null;
	error: string | null;
}

interface SystemMetric {
	cpu: number;
	cpuModel: string;
	cpuCores: number;
	cpuPhysicalCores: number;
	cpuSpeed: number;
	os: string;
	distro: string;
	kernel: string;
	arch: string;
	memUsed: number;
	memUsedGB: number;
	memTotal: number;
	uptime: number;
	diskUsed: number;
	totalDisk: number;
	networkIn: number;
	networkOut: number;
	timestamp: string;
}

function numeric(value: string | number | undefined) {
	const parsed = Number.parseFloat(String(value ?? ""));
	return Number.isFinite(parsed) ? parsed : 0;
}

function combineMetrics(metrics: RawMetric[], timestamp: string): SystemMetric {
	const cpuCoreCount = metrics.reduce(
		(sum, metric) => sum + metric.cpuCores,
		0,
	);
	const cpu = cpuCoreCount
		? metrics.reduce(
				(sum, metric) => sum + numeric(metric.cpu) * metric.cpuCores,
				0,
			) / cpuCoreCount
		: metrics.reduce((sum, metric) => sum + numeric(metric.cpu), 0) /
			metrics.length;
	const memUsedGB = metrics.reduce(
		(sum, metric) => sum + numeric(metric.memUsedGB),
		0,
	);
	const memTotal = metrics.reduce(
		(sum, metric) => sum + numeric(metric.memTotal),
		0,
	);
	const totalDisk = metrics.reduce(
		(sum, metric) => sum + numeric(metric.totalDisk),
		0,
	);
	const usedDisk = metrics.reduce(
		(sum, metric) =>
			sum + (numeric(metric.totalDisk) * numeric(metric.diskUsed)) / 100,
		0,
	);

	return {
		cpu,
		cpuModel:
			metrics.length === 1 ? (metrics[0]?.cpuModel ?? "") : "Multiple CPUs",
		cpuCores: cpuCoreCount,
		cpuPhysicalCores: metrics.reduce(
			(sum, metric) => sum + metric.cpuPhysicalCores,
			0,
		),
		cpuSpeed:
			metrics.reduce(
				(sum, metric) => sum + metric.cpuSpeed * metric.cpuCores,
				0,
			) / (cpuCoreCount || 1),
		os: metrics.length === 1 ? (metrics[0]?.os ?? "") : "Multiple systems",
		distro:
			metrics.length === 1 ? (metrics[0]?.distro ?? "") : "Multiple systems",
		kernel: metrics.length === 1 ? (metrics[0]?.kernel ?? "") : "",
		arch: metrics.length === 1 ? (metrics[0]?.arch ?? "") : "",
		memUsed: memTotal ? (memUsedGB / memTotal) * 100 : 0,
		memUsedGB,
		memTotal,
		uptime: metrics.length === 1 ? (metrics[0]?.uptime ?? 0) : 0,
		diskUsed: totalDisk ? (usedDisk / totalDisk) * 100 : 0,
		totalDisk,
		networkIn: metrics.reduce(
			(sum, metric) => sum + numeric(metric.networkIn),
			0,
		),
		networkOut: metrics.reduce(
			(sum, metric) => sum + numeric(metric.networkOut),
			0,
		),
		timestamp,
	};
}

function getWorkspaceMetrics(datasets: WorkspaceDataset[]) {
	const available = datasets.filter((dataset) => dataset.data?.length);
	const latest = available
		.map((dataset) => dataset.data?.[dataset.data.length - 1])
		.filter((metric): metric is RawMetric => !!metric);
	const sampleTimes = new Set(
		available.flatMap((dataset) =>
			(dataset.data ?? []).map((metric) => {
				const timestamp = Date.parse(metric.timestamp);
				return Number.isFinite(timestamp)
					? Math.floor(timestamp / 60_000) * 60_000
					: null;
			}),
		),
	);
	const history = [...sampleTimes]
		.filter((timestamp): timestamp is number => timestamp !== null)
		.sort((a, b) => a - b)
		.flatMap((timestamp) => {
			const samples = available.map((dataset) => {
				let nearest: RawMetric | undefined;
				let nearestDistance = Number.POSITIVE_INFINITY;
				for (const metric of dataset.data ?? []) {
					const metricTime = Date.parse(metric.timestamp);
					const distance = Math.abs(metricTime - (timestamp + 30_000));
					if (Number.isFinite(metricTime) && distance < nearestDistance) {
						nearest = metric;
						nearestDistance = distance;
					}
				}
				return nearestDistance <= 30_000 ? nearest : undefined;
			});
			const alignedSamples = samples.filter(
				(metric): metric is RawMetric => metric !== undefined,
			);
			if (alignedSamples.length !== available.length) return [];

			return [
				combineMetrics(alignedSamples, new Date(timestamp).toISOString()),
			];
		});

	return {
		available,
		current:
			latest.length > 0
				? combineMetrics(
						latest,
						latest
							.map((metric) => metric.timestamp)
							.sort()
							.at(-1) ?? "",
					)
				: null,
		history,
	};
}

function MetricCard({
	label,
	value,
	detail,
	icon: Icon,
}: {
	label: string;
	value: string;
	detail: string;
	icon: typeof Cpu;
}) {
	return (
		<div className="rounded-lg border bg-background p-4">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Icon className="size-4" aria-hidden />
				<p className="text-xs font-medium uppercase tracking-wide">{label}</p>
			</div>
			<p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
			<p className="mt-1 text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}

export function MonitoringOverview() {
	const router = useRouter();
	const serversQuery = api.server.getMonitoringWorkspaces.useQuery();
	const requestedWorkspace =
		typeof router.query.workspace === "string"
			? router.query.workspace
			: "global";
	const requestedServerId = requestedWorkspace.startsWith("server:")
		? requestedWorkspace.slice("server:".length)
		: null;
	const selectedServer = serversQuery.data?.find(
		(server) => server.serverId === requestedServerId,
	);
	const isStaleWorkspace =
		!!requestedServerId && !!serversQuery.data && !selectedServer;
	const workspace =
		requestedServerId && selectedServer
			? ({ type: "server", serverId: selectedServer.serverId } as const)
			: ({ type: "global" } as const);
	const workspaceLabel = selectedServer?.name ?? "Global";

	useEffect(() => {
		if (!router.isReady || !isStaleWorkspace) return;
		const { workspace: _workspace, ...query } = router.query;
		void router.replace({ pathname: router.pathname, query }, undefined, {
			shallow: true,
			scroll: false,
		});
	}, [isStaleWorkspace, router]);

	const metricsQuery = api.server.getWorkspaceMetrics.useQuery(
		{ workspace, dataPoints: "200" },
		{
			enabled:
				!serversQuery.isPending && !serversQuery.isError && !isStaleWorkspace,
			refetchInterval: 30_000,
			refetchOnWindowFocus: false,
		},
	);
	const datasets = metricsQuery.data ?? [];
	const { available, current, history } = useMemo(
		() => getWorkspaceMetrics(datasets),
		[datasets],
	);
	const unavailable = datasets.filter((dataset) => dataset.error);

	const selectWorkspace = (value: string) => {
		const query = { ...router.query };
		if (value === "global") {
			delete query.workspace;
		} else {
			query.workspace = value;
		}
		void router.push({ pathname: router.pathname, query }, undefined, {
			shallow: true,
			scroll: false,
		});
	};

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="space-y-1">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="text-3xl font-semibold tracking-tight">
							Monitoring
						</h1>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									className="h-8 max-w-full min-w-36 justify-between gap-2 text-sm font-normal"
									disabled={serversQuery.isPending || serversQuery.isError}
									aria-label={`Data workspace: ${workspaceLabel}`}
								>
									<span className="flex min-w-0 items-center gap-2">
										<ServerIcon className="size-4 shrink-0 text-muted-foreground" />
										<span className="truncate">{workspaceLabel}</span>
									</span>
									<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-64">
								<DropdownMenuLabel>Data workspace</DropdownMenuLabel>
								<DropdownMenuGroup>
									<DropdownMenuItem
										onSelect={() => selectWorkspace("global")}
										aria-current={
											workspace.type === "global" ? "true" : undefined
										}
									>
										<ServerIcon className="size-4" />
										Global
										{workspace.type === "global" && (
											<Check className="ml-auto size-4" />
										)}
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Servers</DropdownMenuLabel>
								{serversQuery.data?.length ? (
									<DropdownMenuGroup>
										{serversQuery.data.map((server) => (
											<DropdownMenuItem
												key={server.serverId}
												onSelect={() =>
													selectWorkspace(`server:${server.serverId}`)
												}
												aria-current={
													selectedServer?.serverId === server.serverId
														? "true"
														: undefined
												}
											>
												<ServerIcon className="size-4 text-muted-foreground" />
												<span className="truncate">{server.name}</span>
												{selectedServer?.serverId === server.serverId && (
													<Check className="ml-auto size-4" />
												)}
											</DropdownMenuItem>
										))}
									</DropdownMenuGroup>
								) : (
									<p className="px-2 py-1.5 text-sm text-muted-foreground">
										No accessible servers.
									</p>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<p className="text-sm text-muted-foreground">
						Metrics and operational data for your infrastructure.
					</p>
				</header>

				{serversQuery.isError && (
					<Alert variant="destructive">
						<AlertTitle>Unable to load data workspaces</AlertTitle>
						<AlertDescription>{serversQuery.error.message}</AlertDescription>
					</Alert>
				)}

				{workspace.type === "global" && (
					<section aria-label="Default Notploy instance monitoring">
						<ContainerFreeMonitoring appName="notploy" />
					</section>
				)}

				{serversQuery.isPending || metricsQuery.isLoading ? (
					<div className="flex min-h-64 items-center justify-center text-muted-foreground">
						<LoaderCircle className="mr-2 size-5 animate-spin" />
						Loading server monitoring data…
					</div>
				) : metricsQuery.isError ? (
					<Alert variant="destructive">
						<AlertTitle>Unable to load server monitoring data</AlertTitle>
						<AlertDescription>{metricsQuery.error.message}</AlertDescription>
					</Alert>
				) : datasets.length === 0 || available.length === 0 ? (
					workspace.type === "server" ? (
						<Alert>
							<AlertTitle>No server metrics available</AlertTitle>
							<AlertDescription>
								No metrics are available for {workspaceLabel}. Check its
								monitoring configuration and try again.
							</AlertDescription>
						</Alert>
					) : null
				) : (
					<>
						{unavailable.length > 0 && (
							<Alert variant="destructive">
								<AlertTitle>
									Monitoring data is incomplete ({unavailable.length} server
									{unavailable.length === 1 ? "" : "s"})
								</AlertTitle>
								<AlertDescription>
									<ul className="list-inside list-disc space-y-1">
										{unavailable.map((server) => (
											<li key={server.serverId}>
												<strong>{server.name}:</strong> {server.error}
											</li>
										))}
									</ul>
									{workspace.type === "global" &&
										" Global metrics below include only servers reporting data."}
								</AlertDescription>
							</Alert>
						)}

						{current && (
							<>
								<section
									aria-label="Current infrastructure metrics"
									className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
								>
									<MetricCard
										label="CPU"
										value={`${current.cpu.toFixed(1)}%`}
										detail={
											workspace.type === "global"
												? `${available.length} reporting server${available.length === 1 ? "" : "s"}`
												: "Current usage"
										}
										icon={Cpu}
									/>
									<MetricCard
										label="Memory"
										value={`${current.memUsedGB.toFixed(1)} / ${current.memTotal.toFixed(1)} GB`}
										detail={`${current.memUsed.toFixed(1)}% used`}
										icon={MemoryStick}
									/>
									<MetricCard
										label="Storage"
										value={`${current.diskUsed.toFixed(1)}%`}
										detail={`${((current.totalDisk * current.diskUsed) / 100).toFixed(1)} / ${current.totalDisk.toFixed(1)} GB used`}
										icon={HardDrive}
									/>
									<MetricCard
										label="Network"
										value={`${current.networkIn.toFixed(1)} / ${current.networkOut.toFixed(1)} MB`}
										detail="Inbound / outbound since boot"
										icon={Network}
									/>
								</section>

								{history.length > 0 ? (
									<section
										aria-label="Server metrics"
										className="grid gap-4 xl:grid-cols-2"
									>
										<CPUChart data={history} />
										<MemoryChart data={history} />
										<DiskChart data={current} />
										<NetworkChart data={history} />
									</section>
								) : (
									<Alert>
										<AlertTitle>Historical metrics are not aligned</AlertTitle>
										<AlertDescription>
											Current values are available, but the servers do not have
											shared sampling timestamps for an accurate global chart.
										</AlertDescription>
									</Alert>
								)}
							</>
						)}
					</>
				)}
			</div>
		</Card>
	);
}
