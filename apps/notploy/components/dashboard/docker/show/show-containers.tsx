import { formatDistanceToNow } from "date-fns";
import {
	Boxes,
	CircleAlert,
	Clock3,
	Container as ContainerIcon,
	Copy,
	Ellipsis,
	Loader2,
	Play,
	RefreshCw,
	Search,
	Server as ServerIcon,
	Square,
} from "lucide-react";
import copy from "copy-to-clipboard";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, type RouterOutputs } from "@/utils/api";
import { RemoveContainerDialog } from "../remove/remove-container";

const DockerLogsId = dynamic(
	() =>
		import("@/components/dashboard/docker/logs/docker-logs-id").then(
			(module) => module.DockerLogsId,
		),
	{ ssr: false },
);

type Fleet = RouterOutputs["docker"]["getFleetContainers"];
type FleetServer = Fleet[number];
type Container = FleetServer["containers"][number];
type StatusFilter =
	| "all"
	| "running"
	| "exited"
	| "paused"
	| "restarting"
	| "created"
	| "dead"
	| "removing";
type HealthFilter = "all" | "healthy" | "unhealthy" | "starting" | "none";

interface Props {
	serverId?: string;
}

const CONTAINER_STATES: StatusFilter[] = [
	"running",
	"exited",
	"paused",
	"restarting",
	"created",
	"dead",
	"removing",
];

export const ShowContainers = ({ serverId }: Props) => {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [health, setHealth] = useState<HealthFilter>("all");
	const [selectedServer, setSelectedServer] = useState(serverId ?? "all");
	const {
		data: fleet,
		isPending,
		isError,
		error,
		refetch,
		isRefetching,
	} = api.docker.getFleetContainers.useQuery(undefined, {
		refetchInterval: 20_000,
		refetchOnWindowFocus: false,
	});

	const servers = fleet ?? [];
	const containers = useMemo(
		() =>
			servers.flatMap((host) =>
				host.containers.map((container) => ({
					...container,
					serverName: host.name,
					serverId: host.serverId,
					local: host.local,
				})),
			),
		[servers],
	);
	const query = search.trim().toLocaleLowerCase();
	const filteredContainers = useMemo(
		() =>
			containers.filter((container) => {
				const labels = container.labels ?? {};
				const project =
					labels["com.docker.compose.project"] ??
					labels["com.docker.stack.namespace"] ??
					"";
				const service = labels["com.docker.compose.service"] ?? "";
				const matchesSearch =
					!query ||
					[
						container.name,
						container.containerId,
						container.image,
						container.serverName,
						project,
						service,
					]
						.join(" ")
						.toLocaleLowerCase()
						.includes(query);
				const matchesStatus =
					status === "all" || container.state.toLowerCase() === status;
				const matchesHealth =
					health === "all" ||
					(health === "none" ? !container.health : container.health === health);
				const matchesServer =
					selectedServer === "all" ||
					(selectedServer === "local"
						? container.local
						: container.serverId === selectedServer);
				return matchesSearch && matchesStatus && matchesHealth && matchesServer;
			}),
		[containers, health, query, selectedServer, status],
	);
	const runningCount = containers.filter(
		(container) => container.state === "running",
	).length;
	const pausedCount = containers.filter(
		(container) => container.state === "paused",
	).length;
	const stoppedCount = containers.filter((container) =>
		["exited", "dead"].includes(container.state),
	).length;
	const unhealthyCount = containers.filter(
		(container) => container.health === "unhealthy",
	).length;
	const failedHosts = servers.filter((host) => host.error);

	return (
		<Card className="w-full rounded-xl bg-sidebar p-2.5">
			<div className="rounded-xl bg-background shadow-md">
				<header className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
					<div className="space-y-1">
						<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
							<ContainerIcon
								className="size-6 text-muted-foreground"
								aria-hidden
							/>
							Containers
						</h1>
						<p className="text-sm text-muted-foreground">
							Manage and inspect Docker containers across your infrastructure.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{servers.length > 1 && (
							<Select value={selectedServer} onValueChange={setSelectedServer}>
								<SelectTrigger className="w-full min-w-44 sm:w-auto">
									<ServerIcon
										className="size-4 text-muted-foreground"
										aria-hidden
									/>
									<SelectValue placeholder="All servers" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All servers</SelectItem>
									{servers.map((host) => (
										<SelectItem
											key={host.serverId ?? "local"}
											value={host.serverId ?? "local"}
										>
											{host.name}
											{host.local ? " (Local)" : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						<Button
							variant="outline"
							onClick={() => void refetch()}
							disabled={isRefetching || isPending}
						>
							<RefreshCw
								className={`size-4 ${isRefetching ? "animate-spin" : ""}`}
								aria-hidden
							/>
							Refresh
						</Button>
					</div>
				</header>

				<div className="space-y-5 border-t p-4 sm:p-6">
					{!isPending && !isError && (
						<>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
								<SummaryMetric label="Total" value={containers.length} />
								<SummaryMetric label="Running" value={runningCount} />
								<SummaryMetric label="Paused" value={pausedCount} />
								<SummaryMetric label="Stopped" value={stoppedCount} />
								<SummaryMetric label="Unhealthy" value={unhealthyCount} />
							</div>
							<div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_10rem_11rem]">
								<div className="relative">
									<Search
										className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
										aria-hidden
									/>
									<Input
										className="pl-9"
										placeholder="Search name, image, server, project…"
										value={search}
										onChange={(event) => setSearch(event.target.value)}
										aria-label="Search containers"
									/>
								</div>
								<Select
									value={status}
									onValueChange={(value: StatusFilter) => setStatus(value)}
								>
									<SelectTrigger aria-label="Filter by container status">
										<SelectValue placeholder="All states" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All states</SelectItem>
										{CONTAINER_STATES.map((value) => (
											<SelectItem key={value} value={value}>
												{capitalize(value)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={health}
									onValueChange={(value: HealthFilter) => setHealth(value)}
								>
									<SelectTrigger aria-label="Filter by health status">
										<SelectValue placeholder="All health states" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All health states</SelectItem>
										<SelectItem value="healthy">Healthy</SelectItem>
										<SelectItem value="unhealthy">Unhealthy</SelectItem>
										<SelectItem value="starting">Starting</SelectItem>
										<SelectItem value="none">No healthcheck</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</>
					)}

					{isPending ? (
						<div
							className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
							role="status"
						>
							Loading containers…
							<Loader2 className="size-4 animate-spin" aria-hidden />
						</div>
					) : isError ? (
						<AlertBlock type="error">
							Could not load containers: {error.message}
						</AlertBlock>
					) : (
						<>
							{failedHosts.length > 0 && (
								<div className="space-y-2">
									{failedHosts.map((host) => (
										<AlertBlock
											key={host.serverId ?? "local"}
											type="warning"
										>
											{host.name}: Docker is unavailable. {host.error}
										</AlertBlock>
									))}
								</div>
							)}
							{containers.length === 0 ? (
								<div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
									<Boxes
										className="size-8 text-muted-foreground"
										aria-hidden
									/>
									<div className="space-y-1">
										<p className="font-medium">No containers</p>
										<p className="max-w-md text-sm text-muted-foreground">
											No Docker containers are currently available in your
											infrastructure.
										</p>
									</div>
									<Button asChild variant="outline" size="sm">
										<Link href="/dashboard/deployments">View deployments</Link>
									</Button>
								</div>
							) : filteredContainers.length === 0 ? (
								<div className="py-12 text-center text-sm text-muted-foreground">
									No containers match these search and filter settings.
								</div>
							) : (
								<div className="overflow-x-auto rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Status</TableHead>
												<TableHead>Name / Image</TableHead>
												<TableHead>Server</TableHead>
												<TableHead>Health</TableHead>
												<TableHead>Ports</TableHead>
												<TableHead>Created</TableHead>
												<TableHead className="w-12" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredContainers.map((container) => (
												<ContainerRow
													key={`${container.serverId ?? "local"}-${container.containerId}`}
													container={container}
												/>
											))}
										</TableBody>
									</Table>
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								Showing {filteredContainers.length} of {containers.length}{" "}
								containers. State and counts are reported by Docker on each
								server.
							</p>
						</>
					)}
				</div>
			</div>
		</Card>
	);
};

function ContainerRow({ container }: { container: Container & { serverName: string; local: boolean } }) {
	const utils = api.useUtils();
	const queryInput = { containerId: container.containerId, serverId: container.serverId ?? undefined };
	const start = api.docker.startContainer.useMutation();
	const stop = api.docker.stopContainer.useMutation();
	const restart = api.docker.restartContainer.useMutation();
	const [detailOpen, setDetailOpen] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const labels = container.labels ?? {};
	const project =
		labels["com.docker.compose.project"] ??
		labels["com.docker.stack.namespace"];
	const service = labels["com.docker.compose.service"];

	const runAction = async (
		action: "start" | "stop" | "restart",
		mutation: typeof start,
	) => {
		setIsMutating(true);
		try {
			await mutation.mutateAsync(queryInput);
			toast.success(`Container ${action} requested`);
			await utils.docker.getFleetContainers.invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : `Could not ${action} container`,
			);
		} finally {
			setIsMutating(false);
		}
	};

	return (
		<TableRow>
			<TableCell>
				<StateBadge state={container.state} />
			</TableCell>
			<TableCell className="min-w-48">
				<button
					type="button"
					className="max-w-64 text-left"
					onClick={() => setDetailOpen(true)}
				>
					<span className="block truncate font-medium hover:text-primary">
						{container.name}
					</span>
					<span className="block max-w-64 truncate text-xs text-muted-foreground">
						{container.image}
					</span>
					{project && (
						<span className="block truncate text-xs text-muted-foreground">
							{project}
							{service ? ` / ${service}` : ""}
						</span>
					)}
				</button>
				<ContainerDetails
					container={container}
					open={detailOpen}
					onOpenChange={setDetailOpen}
				/>
			</TableCell>
			<TableCell>
				<span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
					<ServerIcon
						className="size-3.5 text-muted-foreground"
						aria-hidden
					/>
					{container.serverName}
					{container.local && <Badge variant="outline">Local</Badge>}
				</span>
			</TableCell>
			<TableCell>
				<HealthBadge health={container.health} />
			</TableCell>
			<TableCell className="max-w-48 truncate font-mono text-xs" title={formatPorts(container.ports)}>
				{formatPorts(container.ports) || "—"}
			</TableCell>
			<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
				{container.createdAt
					? formatDistanceToNow(new Date(container.createdAt * 1000), {
							addSuffix: true,
						})
					: "—"}
			</TableCell>
			<TableCell>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Actions for ${container.name}`}
							disabled={isMutating}
						>
							{isMutating ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : (
								<Ellipsis className="size-4" aria-hidden />
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onSelect={() => {
								copy(container.containerId);
								toast.success("Container ID copied");
							}}
						>
							<Copy className="size-4" />
							Copy ID
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setDetailOpen(true)}>
							Inspect container
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{container.state === "running" ? (
							<>
								<DropdownMenuItem
									onSelect={() => void runAction("stop", stop)}
								>
									<Square className="size-4" />
									Stop
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => void runAction("restart", restart)}
								>
									<RefreshCw className="size-4" />
									Restart
								</DropdownMenuItem>
							</>
						) : (
							<DropdownMenuItem
								onSelect={() => void runAction("start", start)}
							>
								<Play className="size-4" />
								Start
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<RemoveContainerDialog
							containerId={container.containerId}
							serverId={container.serverId ?? undefined}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</TableCell>
		</TableRow>
	);
}

function ContainerDetails({
	container,
	open,
	onOpenChange,
}: {
	container: Container & { serverName: string; local: boolean };
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const serverId = container.serverId ?? undefined;
	const config = api.docker.getConfig.useQuery(
		{ containerId: container.containerId, serverId },
		{ enabled: open, retry: false },
	);
	const data = config.data as
		| {
				Id?: string;
				Name?: string;
				Created?: string;
				State?: { Status?: string; Health?: { Status?: string }; StartedAt?: string };
				Config?: {
					Image?: string;
					Cmd?: string[] | null;
					Entrypoint?: string[] | null;
					User?: string;
					WorkingDir?: string;
					Env?: string[];
					Labels?: Record<string, string>;
				};
				HostConfig?: { RestartPolicy?: { Name?: string } };
				NetworkSettings?: {
					Ports?: Record<string, Array<{ HostIp?: string; HostPort?: string }> | null>;
					Networks?: Record<
						string,
						{ IPAddress?: string; Gateway?: string; NetworkID?: string }
					>;
				};
				Mounts?: Array<{
					Type?: string;
					Name?: string;
					Source?: string;
					Destination?: string;
					RW?: boolean;
				}>;
		  }
		| undefined;
	const networks = Object.entries(data?.NetworkSettings?.Networks ?? {});
	const mounts = data?.Mounts ?? [];
	const health = data?.State?.Health?.Status ?? container.health;
	const created = data?.Created ? new Date(data.Created) : undefined;
	const started = data?.State?.StartedAt
		? new Date(data.State.StartedAt)
		: undefined;
	const composeProject =
		container.labels?.["com.docker.compose.project"] ??
		container.labels?.["com.docker.stack.namespace"];
	const composeService = container.labels?.["com.docker.compose.service"];
	const environmentNames = (data?.Config?.Env ?? []).map((entry) => {
		const key = entry.split("=", 1)[0] ?? "VARIABLE";
		return `${key}=••••••`;
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<span className="sr-only">Container details</span>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle className="flex flex-wrap items-center gap-2">
						{container.name}
						<StateBadge state={container.state} />
						<HealthBadge health={health} />
					</DialogTitle>
					<DialogDescription className="break-all font-mono text-xs">
						{container.containerId}
					</DialogDescription>
				</DialogHeader>
				{config.isPending ? (
					<div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
						Loading container details…
						<Loader2 className="size-4 animate-spin" aria-hidden />
					</div>
				) : config.isError ? (
					<AlertBlock type="error">
						Container details are unavailable. It may have been removed or the
						Docker Engine may be unreachable: {config.error.message}
					</AlertBlock>
				) : (
					<Tabs defaultValue="overview" className="space-y-4">
						<TabsList className="h-auto flex-wrap">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="networks">Networks</TabsTrigger>
							<TabsTrigger value="volumes">Volumes</TabsTrigger>
							<TabsTrigger value="ports">Ports</TabsTrigger>
							<TabsTrigger value="logs">Logs</TabsTrigger>
						</TabsList>
						<TabsContent value="overview" className="space-y-4">
							<DetailSection title="Container">
								<DetailValue label="Name" value={data?.Name?.replace(/^\//, "")} />
								<DetailValue label="ID" value={data?.Id} mono />
								<DetailValue
									label="State"
									value={data?.State?.Status ?? container.state}
								/>
								<DetailValue label="Health" value={health ?? "No healthcheck"} />
								<DetailValue label="Created" value={created?.toLocaleString()} />
								<DetailValue label="Started" value={started?.toLocaleString()} />
								<DetailValue
									label="Server"
									value={`${container.serverName}${container.local ? " (Local)" : ""}`}
								/>
								<DetailValue label="Image" value={data?.Config?.Image ?? container.image} />
								<DetailValue label="Image ID" value={container.imageId} mono />
							</DetailSection>
							<DetailSection title="Runtime">
								<DetailValue label="Command" value={data?.Config?.Cmd?.join(" ")} mono />
								<DetailValue label="Entrypoint" value={data?.Config?.Entrypoint?.join(" ")} mono />
								<DetailValue label="Restart policy" value={data?.HostConfig?.RestartPolicy?.Name} />
								<DetailValue label="User" value={data?.Config?.User} />
								<DetailValue label="Working directory" value={data?.Config?.WorkingDir} mono />
								<DetailValue label="Environment variables" value={`${environmentNames.length} (values redacted)`} />
							</DetailSection>
							{environmentNames.length > 0 && (
								<DetailSection title="Environment names (values redacted)">
									<div className="max-h-36 overflow-auto font-mono text-xs text-muted-foreground">
										{environmentNames.map((entry) => (
											<p key={entry}>{entry}</p>
										))}
									</div>
								</DetailSection>
							)}
							{(composeProject || composeService) && (
								<DetailSection title="Notploy / Compose relationship">
									<DetailValue label="Project / stack" value={composeProject} />
									<DetailValue label="Service" value={composeService} />
								</DetailSection>
							)}
							<p className="text-xs text-muted-foreground">
								Container runtime resource snapshots are not available from the
								current Docker API. Use{" "}
								<Link
									className="text-primary underline"
									href="/dashboard/monitoring"
									onClick={() => onOpenChange(false)}
								>
									Monitoring
								</Link>{" "}
								for supported time-series metrics.
							</p>
						</TabsContent>
						<TabsContent value="networks" className="space-y-3">
							{networks.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No attached networks reported by Docker.
								</p>
							) : (
								<div className="overflow-x-auto rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Network</TableHead>
												<TableHead>IP address</TableHead>
												<TableHead>Gateway</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{networks.map(([name, network]) => (
												<TableRow key={name}>
													<TableCell>{name}</TableCell>
													<TableCell className="font-mono text-xs">
														{network.IPAddress || "—"}
													</TableCell>
													<TableCell className="font-mono text-xs">
														{network.Gateway || "—"}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
							<Button asChild variant="outline" size="sm">
								<Link
									href={`/dashboard/networks${serverId ? `?serverId=${serverId}` : ""}`}
									onClick={() => onOpenChange(false)}
								>
									View networks
								</Link>
							</Button>
						</TabsContent>
						<TabsContent value="volumes" className="space-y-3">
							{mounts.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No volumes or bind mounts attached.
								</p>
							) : (
								<div className="overflow-x-auto rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Type</TableHead>
												<TableHead>Source</TableHead>
												<TableHead>Destination</TableHead>
												<TableHead>Access</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{mounts.map((mount, index) => (
												<TableRow key={`${mount.Destination}-${index}`}>
													<TableCell>{mount.Type ?? "—"}</TableCell>
													<TableCell className="max-w-48 truncate font-mono text-xs">
														{mount.Name ?? mount.Source ?? "—"}
													</TableCell>
													<TableCell className="max-w-48 truncate font-mono text-xs">
														{mount.Destination ?? "—"}
													</TableCell>
													<TableCell>{mount.RW ? "Read/write" : "Read-only"}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
							<Button asChild variant="outline" size="sm">
								<Link
									href={`/dashboard/volumes${serverId ? `?serverId=${serverId}` : ""}`}
									onClick={() => onOpenChange(false)}
								>
									View volumes
								</Link>
							</Button>
						</TabsContent>
						<TabsContent value="ports" className="space-y-3">
							{Object.entries(data?.NetworkSettings?.Ports ?? {}).length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No published ports.
								</p>
							) : (
								<div className="space-y-2">
									{Object.entries(data?.NetworkSettings?.Ports ?? {}).map(
										([target, bindings]) => (
											<div
												key={target}
												className="flex flex-wrap items-center gap-2 rounded-md border p-3 font-mono text-sm"
											>
												{bindings?.length ? (
													bindings.map((binding) => (
														<p key={`${binding.HostIp}-${binding.HostPort}-${target}`}>
															{binding.HostIp}:{binding.HostPort} → {target}
														</p>
													))
												) : (
													<p>{target} (not published)</p>
												)}
											</div>
										),
									)}
								</div>
							)}
						</TabsContent>
						<TabsContent value="logs" className="min-h-80">
							<DockerLogsId
								containerId={container.containerId}
								serverId={serverId}
								runType="native"
							/>
						</TabsContent>
					</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
}

function DetailSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-2 rounded-lg border p-3">
			<h3 className="text-sm font-semibold">{title}</h3>
			<div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
				{children}
			</div>
		</section>
	);
}

function DetailValue({
	label,
	value,
	mono = false,
}: {
	label: string;
	value?: string;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				className={`mt-1 break-words font-medium ${mono ? "font-mono text-xs" : ""}`}
			>
				{value || "—"}
			</p>
		</div>
	);
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border bg-background p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
		</div>
	);
}

function StateBadge({ state }: { state: string }) {
	const normalized = state.toLowerCase();
	const variant =
		normalized === "running"
			? "default"
			: ["exited", "dead", "removing"].includes(normalized)
				? "destructive"
				: "secondary";
	return (
		<Badge variant={variant} className="capitalize">
			{normalized === "running" && (
				<span className="mr-1.5 size-1.5 rounded-full bg-green-500" aria-hidden />
			)}
			{normalized || "unknown"}
		</Badge>
	);
}

function HealthBadge({ health }: { health: string | null | undefined }) {
	if (!health) {
		return <span className="text-xs text-muted-foreground">No healthcheck</span>;
	}
	return (
		<Badge variant={health === "healthy" ? "outline" : "destructive"}>
			{health === "healthy" ? "Healthy" : capitalize(health)}
		</Badge>
	);
}

function formatPorts(
	ports: Array<{
		ip?: string;
		privatePort: number;
		publicPort?: number;
		type: string;
	}>,
) {
	return ports
		.filter((port) => port.publicPort)
		.map(
			(port) =>
				`${port.ip || "0.0.0.0"}:${port.publicPort} → ${port.privatePort}/${port.type}`,
		)
		.join(", ");
}

function capitalize(value: string) {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
