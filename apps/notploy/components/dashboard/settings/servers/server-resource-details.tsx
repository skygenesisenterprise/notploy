import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Boxes,
	Cpu,
	HardDrive,
	MemoryStick,
	Network,
	ServerIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { api, type RouterOutputs } from "@/utils/api";

type Server = RouterOutputs["server"]["all"][number];

const workloadLabels: Record<string, string> = {
	application: "Application",
	compose: "Compose",
	libsql: "LibSQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	mysql: "MySQL",
	postgres: "PostgreSQL",
	redis: "Redis",
};

export function ServerResourceDetails({ server }: { server: Server }) {
	const [open, setOpen] = useState(false);
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canReadDocker = !!permissions?.docker.read;
	const canReadServer = !!permissions?.server.read;
	const canReadMonitoring = !!permissions?.monitoring.read;
	const canReadServices = !!permissions?.service.read;
	const {
		data: workloads,
		isLoading: workloadsLoading,
		isError: workloadsError,
		error: workloadsQueryError,
	} = api.server.getServices.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadServices },
	);
	const health = api.docker.getServerHealth.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadDocker && canReadServer },
	);
	const validation = api.server.validate.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadServer, retry: false },
	);
	const metrics = api.server.getWorkspaceMetrics.useQuery(
		{
			workspace: { type: "server", serverId: server.serverId },
			dataPoints: "1",
		},
		{ enabled: open && canReadMonitoring, retry: false },
	);
	const images = api.dockerImage.getImages.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadDocker },
	);
	const volumes = api.dockerVolume.getVolumes.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadDocker },
	);
	const latestMetric = metrics.data?.find((dataset) => dataset.data?.length)
		?.data?.at(-1);
	const metricError = metrics.data?.find((dataset) => dataset.error)?.error;
	const healthData = health.data?.error ? undefined : health.data;
	const canCheckConnection = canReadDocker && canReadServer;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					Open details
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<ServerIcon className="size-5 text-muted-foreground" aria-hidden />
						{server.name}
					</DialogTitle>
					<DialogDescription>
						Connection, host capacity, Docker resources, and assigned workloads.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<section aria-label="Server overview" className="space-y-3">
						<div className="flex flex-wrap gap-2">
							<Badge
								variant={
									health.isError || health.data?.error
										? "destructive"
										: healthData
											? "default"
											: "secondary"
								}
							>
								{								!canCheckConnection
									? "Connection status unavailable"
									: health.isPending
								? "Checking connection"
								: health.isError || health.data?.error
										? "Unreachable"
										: healthData
											? "Online"
											: server.serverStatus === "active"
												? "Connection unknown"
												: "Inactive"}
							</Badge>
							<Badge variant="outline">
								{server.serverType === "build"
									? "Build server"
									: "Deployment server"}
							</Badge>
						</div>
						{server.description && (
							<p className="text-sm text-muted-foreground">
								{server.description}
							</p>
						)}
						<div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
							<InfoValue label="Address">
								{server.ipAddress}:{server.port}
							</InfoValue>
							<InfoValue label="SSH user">{server.username}</InfoValue>
							<InfoValue label="OS">
								{latestMetric?.distro || latestMetric?.os || "Not reported"}
							</InfoValue>
							<InfoValue label="Architecture">
								{latestMetric?.arch || "Not reported"}
							</InfoValue>
							<InfoValue label="Kernel">
								{latestMetric?.kernel || "Not reported"}
							</InfoValue>
							<InfoValue label="Uptime">
								{latestMetric?.uptime
									? formatDuration(latestMetric.uptime)
									: "Not reported"}
							</InfoValue>
							<InfoValue label="Last successful health check">
								{healthData?.checkedAt
									? formatDistanceToNow(new Date(healthData.checkedAt), {
											addSuffix: true,
										})
									: "Not available"}
							</InfoValue>
						</div>
						{health.isError && (
							<AlertBlock type="error">{health.error.message}</AlertBlock>
						)}
						{health.data?.error && (
							<AlertBlock type="error">{health.data.error}</AlertBlock>
						)}
						{(metrics.isError || metricError) && (
							<p className="text-xs text-muted-foreground">
								System identity and monitoring metrics are unavailable:{" "}
								{metrics.error?.message ?? metricError}
							</p>
						)}
					</section>

					<section aria-label="Server resources" className="space-y-3">
						<h3 className="flex items-center gap-2 font-semibold">
							<Activity className="size-4 text-muted-foreground" aria-hidden />
							Resources
						</h3>
						<div className="grid gap-3 sm:grid-cols-3">
							<ResourceCard
								icon={Cpu}
								label="CPU"
								value={
									latestMetric?.cpu
										? `${formatMetricNumber(latestMetric.cpu)}%`
										: healthData?.resources.cpuCount !== undefined
											? `${healthData.resources.cpuCount} cores`
											: undefined
								}
								detail={
									latestMetric?.cpuModel ||
									(healthData
										? "Capacity reported by the host"
										: "No recent host data")
								}
							/>
							<ResourceCard
								icon={MemoryStick}
								label="Memory"
								value={
									latestMetric?.memUsedGB && latestMetric.memTotal
										? `${formatMetricNumber(latestMetric.memUsedGB)} / ${formatMetricNumber(latestMetric.memTotal)} GB`
										: healthData?.resources.memTotalBytes
											? `${formatBytes(healthData.resources.memUsedBytes)} / ${formatBytes(healthData.resources.memTotalBytes)}`
											: undefined
								}
								detail={
									latestMetric?.memUsed && latestMetric.memTotal
										? `${formatMetricNumber(latestMetric.memUsed)}% used`
										: "Used / total"
								}
							/>
							<ResourceCard
								icon={HardDrive}
								label="Disk"
								value={
									latestMetric?.diskUsed
										? `${formatMetricNumber(latestMetric.diskUsed)}% used`
										: healthData?.disk.totalBytes
											? `${formatBytes(healthData.disk.usedBytes)} / ${formatBytes(healthData.disk.totalBytes)}`
											: undefined
								}
								detail={
									latestMetric?.totalDisk
										? `${formatMetricNumber(latestMetric.totalDisk)} GB total`
										: "Disk usage"
								}
							/>
						</div>
					</section>

					<section aria-label="Docker resources" className="space-y-3">
						<div className="flex items-center gap-2">
							<Boxes className="size-4 text-muted-foreground" aria-hidden />
							<h3 className="font-semibold">Docker</h3>
						</div>
						<div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
							<InfoValue label="Docker Engine">
								{validation.data?.docker.enabled
									? validation.data.docker.version
									: validation.isPending
										? "Checking…"
										: validation.isError
											? "Unavailable"
											: "Not installed"}
							</InfoValue>
							<InfoValue label="Containers">
								{health.isPending
									? "Checking…"
									: healthData
										? healthData.containers.containerCount
										: "Unavailable"}
							</InfoValue>
							<InfoValue label="Images">
								{images.isPending
									? "Loading…"
									: images.isError
										? "Unavailable"
										: (images.data?.length ?? "—")}
							</InfoValue>
							<InfoValue label="Networks">
								{health.isPending
									? "Checking…"
									: healthData
										? healthData.dockerNetworks.count
										: "Unavailable"}
							</InfoValue>
							<InfoValue label="Volumes">
								{volumes.isPending
									? "Loading…"
									: volumes.isError
										? "Unavailable"
										: (volumes.data?.length ?? "—")}
							</InfoValue>
						</div>
						{validation.isError && (
							<p className="text-sm text-muted-foreground">
								Docker/SSH validation failed: {validation.error.message}
							</p>
						)}
					</section>

					<section aria-label="Assigned workloads" className="space-y-3">
						<div className="flex items-center gap-2">
							<Network className="size-4 text-muted-foreground" aria-hidden />
							<h3 className="font-semibold">Workloads</h3>
						</div>
						{!canReadServices ? (
							<p className="text-sm text-muted-foreground">
								You do not have permission to view assigned workloads.
							</p>
						) : workloadsLoading ? (
							<p className="text-sm text-muted-foreground">
								Loading assigned workloads…
							</p>
						) : workloadsError ? (
							<AlertBlock type="error">
								{workloadsQueryError.message}
							</AlertBlock>
						) : workloads?.length ? (
							<ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
								{workloads.map((workload) => (
									<li key={`${workload.type}-${workload.id}`}>
										<Link
											href={workload.url}
											onClick={() => setOpen(false)}
											className="flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-muted/40"
										>
											<span className="flex min-w-0 flex-col">
												<span className="truncate text-sm font-medium">
													{workload.name}
												</span>
												<span className="truncate text-xs text-muted-foreground">
													{workload.projectName} · {workload.environmentName}
												</span>
											</span>
											<Badge variant="outline">
												{workloadLabels[workload.type] ?? workload.type}
											</Badge>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<div className="rounded-lg border p-4 text-sm text-muted-foreground">
								No workloads are currently assigned to this server.
							</div>
						)}
					</section>

					<nav aria-label="Server infrastructure" className="space-y-2">
						<h3 className="font-semibold">Infrastructure</h3>
						<div className="flex flex-wrap gap-2">
							{canReadDocker && (
								<>
									<ResourceLink
										href={`/dashboard/docker?serverId=${server.serverId}`}
										onClick={() => setOpen(false)}
									>
										Containers
									</ResourceLink>
									<ResourceLink
										href={`/dashboard/docker?tab=images&serverId=${server.serverId}`}
										onClick={() => setOpen(false)}
									>
										Images
									</ResourceLink>
									<ResourceLink
										href={`/dashboard/networks?serverId=${server.serverId}`}
										onClick={() => setOpen(false)}
									>
										Networks
									</ResourceLink>
									<ResourceLink
										href={`/dashboard/docker?tab=volumes&serverId=${server.serverId}`}
										onClick={() => setOpen(false)}
									>
										Volumes
									</ResourceLink>
									<ResourceLink
										href={`/dashboard/docker?tab=events&serverId=${server.serverId}`}
										onClick={() => setOpen(false)}
									>
										Events
									</ResourceLink>
								</>
							)}
							{canReadDocker && canReadServer && (
								<ResourceLink
									href={`/dashboard/docker?tab=health&serverId=${server.serverId}`}
									onClick={() => setOpen(false)}
								>
									Health
								</ResourceLink>
							)}
							{canReadMonitoring && (
								<ResourceLink
									href={`/dashboard/monitoring?workspace=server:${server.serverId}`}
									onClick={() => setOpen(false)}
								>
									Monitoring
								</ResourceLink>
							)}
						</div>
					</nav>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function InfoValue({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0">
			<p className="text-muted-foreground">{label}</p>
			<p className="mt-1 truncate font-medium">{children}</p>
		</div>
	);
}

function ResourceCard({
	icon: Icon,
	label,
	value,
	detail,
}: {
	icon: typeof Cpu;
	label: string;
	value?: string;
	detail: string;
}) {
	return (
		<div className="rounded-lg border p-3">
			<p className="flex items-center gap-2 text-xs text-muted-foreground">
				<Icon className="size-4" aria-hidden />
				{label}
			</p>
			<p className="mt-2 font-semibold">{value ?? "Unavailable"}</p>
			<p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}

function ResourceLink({
	href,
	onClick,
	children,
}: {
	href: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button asChild variant="outline" size="sm">
			<Link href={href} onClick={onClick}>
				{children}
			</Link>
		</Button>
	);
}

function formatMetricNumber(value: string | number) {
	const number = Number(value);
	return Number.isFinite(number) ? number.toFixed(1) : "—";
}

function formatBytes(bytes: number) {
	if (!Number.isFinite(bytes) || bytes < 0) return "—";
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB", "PB"];
	let value = bytes / 1024;
	let unit = units[0];
	for (let index = 0; value >= 1024 && index < units.length - 1; index += 1) {
		value /= 1024;
		unit = units[index + 1] ?? unit;
	}
	return `${value.toFixed(1)} ${unit}`;
}

function formatDuration(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0) return "Not reported";
	const days = Math.floor(seconds / 86_400);
	const hours = Math.floor((seconds % 86_400) / 3_600);
	const minutes = Math.floor((seconds % 3_600) / 60);
	return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
		.filter(Boolean)
		.join(" ") || "Less than a minute";
}
