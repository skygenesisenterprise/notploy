import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Clock3,
	Cpu,
	HardDrive,
	MemoryStick,
	RefreshCw,
	Server as ServerIcon,
	Terminal,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleNoMatch,
	ConsoleRefresh,
	ConsoleSearch,
	ConsoleShell,
	ConsoleSummary,
	ConsoleToolbar,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, type RouterOutputs } from "@/utils/api";
import { TerminalModal } from "../web-server/terminal-modal";
import { ShowServerActions } from "./actions/show-server-actions";
import { DeleteServerModal } from "./delete-server-modal";
import { HandleServers } from "./handle-servers";
import { ServerResourceDetails } from "./server-resource-details";
import { SetupServer } from "./setup-server";
import { WelcomeSubscription } from "./welcome-stripe/welcome-subscription";

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "deploy" | "build";
type Server = RouterOutputs["server"]["all"][number];

export const ShowServers = () => {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
	const serversQuery = api.server.all.useQuery();
	const cloudQuery = api.settings.isCloud.useQuery();
	const permissionsQuery = api.user.getPermissions.useQuery();
	const permissions = permissionsQuery.data;
	const canReadServices = !!permissions?.service.read;
	const servicesQuery = api.overview.services.useQuery(undefined, {
		enabled: canReadServices && cloudQuery.data === false,
		refetchInterval: 30_000,
	});

	const servers = serversQuery.data ?? [];
	const showLocalInstance = cloudQuery.data === false;
	const localServices =
		servicesQuery.data?.filter((service) => service.serverId === null) ?? [];
	const enabledCount = servers.filter(
		(server) => server.serverStatus === "active",
	).length;
	const disabledCount = servers.length - enabledCount;
	const normalizedSearch = search.trim().toLocaleLowerCase();
	const localMatches =
		!normalizedSearch ||
		"local notploy localhost control plane".includes(normalizedSearch);
	const showFilteredLocal =
		showLocalInstance &&
		localMatches &&
		(statusFilter === "all" || statusFilter === "active") &&
		(roleFilter === "all" || roleFilter === "deploy");
	const filteredServers = useMemo(
		() =>
			servers.filter((server) => {
				const matchesSearch =
					!normalizedSearch ||
					`${server.name} ${server.description ?? ""} ${server.ipAddress}`
						.toLocaleLowerCase()
						.includes(normalizedSearch);
				const matchesStatus =
					statusFilter === "all" || server.serverStatus === statusFilter;
				const matchesRole =
					roleFilter === "all" || server.serverType === roleFilter;
				return matchesSearch && matchesStatus && matchesRole;
			}),
		[normalizedSearch, roleFilter, servers, statusFilter],
	);
	const isLoading =
		serversQuery.isPending ||
		cloudQuery.isPending ||
		permissionsQuery.isPending;
	const isError =
		serversQuery.isError || cloudQuery.isError || permissionsQuery.isError;
	const errorMessage =
		serversQuery.error?.message ??
		cloudQuery.error?.message ??
		permissionsQuery.error?.message;

	return (
		<div className="w-full space-y-4">
			{router.query?.success && cloudQuery.data && <WelcomeSubscription />}
			<ConsoleShell>
				<ConsoleHeader
					icon={ServerIcon}
					title="Servers"
					description="Manage the execution servers Notploy can use to run workloads."
					actions={
						<>
							<ConsoleRefresh
								onClick={() => {
									void serversQuery.refetch();
									void cloudQuery.refetch();
								}}
								isRefetching={serversQuery.isRefetching}
								disabled={isLoading}
							/>
							{cloudQuery.data && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										window.location.assign(
											"/dashboard/settings/servers?success=true",
										)
									}
								>
									Reset onboarding
								</Button>
							)}
							{permissions?.server.create && <HandleServers />}
						</>
					}
				/>

				<ConsoleBody>
					{!isLoading &&
						!isError &&
						(servers.length > 0 || showLocalInstance) && (
							<>
								<ConsoleSummary>
									<SummaryMetric
										label="Execution targets"
										value={servers.length + Number(showLocalInstance)}
									/>
									<SummaryMetric
										label="Enabled"
										value={enabledCount + Number(showLocalInstance)}
									/>
									<SummaryMetric label="Disabled" value={disabledCount} />
								</ConsoleSummary>
								<ConsoleToolbar className="md:grid-cols-[minmax(12rem,1fr)_10rem_10rem]">
									<ConsoleSearch
										value={search}
										onChange={setSearch}
										placeholder="Search by name or address"
										ariaLabel="Search servers by name or address"
									/>
									<Select
										value={statusFilter}
										onValueChange={(value: StatusFilter) =>
											setStatusFilter(value)
										}
									>
										<SelectTrigger aria-label="Filter by server status">
											<SelectValue placeholder="All statuses" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All statuses</SelectItem>
											<SelectItem value="active">Enabled</SelectItem>
											<SelectItem value="inactive">Disabled</SelectItem>
										</SelectContent>
									</Select>
									<Select
										value={roleFilter}
										onValueChange={(value: RoleFilter) => setRoleFilter(value)}
									>
										<SelectTrigger aria-label="Filter by server role">
											<SelectValue placeholder="All roles" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All roles</SelectItem>
											<SelectItem value="deploy">Deployment</SelectItem>
											<SelectItem value="build">Build</SelectItem>
										</SelectContent>
									</Select>
								</ConsoleToolbar>
							</>
						)}

					{isLoading ? (
						<ConsoleLoading label="Loading execution servers\u2026" />
					) : isError ? (
						<ConsoleError
							message={errorMessage ?? "Could not load execution servers."}
							onRetry={() => {
								void serversQuery.refetch();
								void cloudQuery.refetch();
								void permissionsQuery.refetch();
							}}
						/>
					) : servers.length === 0 && !showLocalInstance ? (
						<ConsoleEmpty
							icon={ServerIcon}
							title="No execution servers configured"
							description="Servers are the machines Notploy connects to run and manage your workloads. Add a server to start managing your infrastructure."
						>
							{permissions?.server.create && <HandleServers />}
						</ConsoleEmpty>
					) : filteredServers.length === 0 && !showFilteredLocal ? (
						<ConsoleNoMatch
							message="No servers match these search and filter settings."
							onClear={() => {
								setSearch("");
								setStatusFilter("all");
								setRoleFilter("all");
							}}
						/>
					) : (
						<div className="space-y-3">
							{showFilteredLocal && (
								<LocalExecutionTarget
									canReadDocker={!!permissions?.docker.read}
									canReadServices={canReadServices}
									services={localServices}
								/>
							)}
							{filteredServers.map((server) => (
								<ServerFleetCard
									key={server.serverId}
									server={server}
									canReadDocker={!!permissions?.docker.read}
									canReadServer={!!permissions?.server.read}
									canReadMonitoring={!!permissions?.monitoring.read}
									canReadServices={canReadServices}
									canCreateServer={!!permissions?.server.create}
									canDeleteServer={!!permissions?.server.delete}
									canUseTerminal={!!permissions?.server.terminal}
									isCloud={!!cloudQuery.data}
								/>
							))}
						</div>
					)}
				</ConsoleBody>
			</ConsoleShell>
		</div>
	);
};

function ServerFleetCard({
	server,
	canReadDocker,
	canReadServer,
	canReadMonitoring,
	canReadServices,
	canCreateServer,
	canDeleteServer,
	canUseTerminal,
	isCloud,
}: {
	server: Server;
	canReadDocker: boolean;
	canReadServer: boolean;
	canReadMonitoring: boolean;
	canReadServices: boolean;
	canCreateServer: boolean;
	canDeleteServer: boolean;
	canUseTerminal: boolean;
	isCloud: boolean;
}) {
	const isActive = server.serverStatus === "active";
	const health = api.docker.getServerHealth.useQuery(
		{ serverId: server.serverId },
		{
			enabled: canReadDocker && canReadServer && isActive,
			refetchInterval: 60_000,
			refetchOnWindowFocus: false,
		},
	);
	const images = api.dockerImage.getImages.useQuery(
		{ serverId: server.serverId },
		{ enabled: canReadDocker && isActive, refetchOnWindowFocus: false },
	);
	const status = getConnectionStatus({
		isActive,
		canCheck: canReadDocker && canReadServer,
		isPending: health.isPending,
		isError: health.isError,
		error: health.data?.error,
	});
	const checkedAt = health.data?.error ? undefined : health.data?.checkedAt;

	return (
		<Card className="overflow-hidden">
			<CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(15rem,1.2fr)_minmax(17rem,1fr)_auto] lg:items-center">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<ServerIcon
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						<h2 className="truncate font-semibold" title={server.name}>
							{server.name}
						</h2>
						<ConnectionBadge status={status} />
						<Badge variant={isActive ? "secondary" : "outline"}>
							{isActive ? "Enabled" : "Disabled"}
						</Badge>
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
						<span>
							{server.ipAddress}:{server.port}
						</span>
						<span>
							{server.serverType === "build" ? "Build server" : "Deployment"}
						</span>
						{server.description && (
							<span className="basis-full truncate">{server.description}</span>
						)}
					</div>
					{checkedAt && (
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Clock3 className="size-3.5" aria-hidden />
							Checked{" "}
							{formatDistanceToNow(new Date(checkedAt), { addSuffix: true })}
						</p>
					)}
				</div>

				<div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
					<ResourceValue
						icon={Cpu}
						label="CPU"
						value={
							health.data?.error ? undefined : health.data?.resources.cpuCount
						}
						format={(value) => `${value} cores`}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={MemoryStick}
						label="Memory"
						value={
							health.data?.error
								? undefined
								: health.data?.resources.memTotalBytes
						}
						format={(total) => {
							const used = health.data?.resources.memUsedBytes;
							return used === undefined
								? formatBytes(total)
								: `${formatBytes(used)} / ${formatBytes(total)}`;
						}}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={HardDrive}
						label="Disk"
						value={
							health.data?.error ? undefined : health.data?.disk.totalBytes
						}
						format={(total) => {
							const used = health.data?.disk.usedBytes;
							return used === undefined
								? formatBytes(total)
								: `${formatBytes(used)} / ${formatBytes(total)}`;
						}}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={Activity}
						label="Docker"
						value={
							health.data?.error
								? undefined
								: health.data?.containers.containerCount
						}
						format={(count) => `${count} containers`}
						loading={health.isPending}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2 border-t pt-3 lg:border-t-0 lg:pt-0">
					{canReadDocker && (
						<span className="mr-1 text-xs text-muted-foreground">
							{images.isPending
								? "Images loading…"
								: images.isError
									? "Images unavailable"
									: `${images.data?.length ?? "—"} images`}
							{" · "}
							{health.data?.error
								? "Networks unavailable"
								: health.data
									? `${health.data.dockerNetworks.count} networks`
									: "Networks loading…"}
							{" · "}
							{canReadServices ? `${server.totalSum} workloads` : ""}
						</span>
					)}
					<ServerResourceDetails server={server} />
					{canReadDocker && canReadServer && (
						<Button
							variant="outline"
							size="icon"
							onClick={() => void health.refetch()}
							disabled={health.isFetching || !isActive}
							aria-label={`Refresh connection status for ${server.name}`}
							title="Test connection / refresh"
						>
							<RefreshCw
								className={`size-4 ${health.isFetching ? "animate-spin" : ""}`}
								aria-hidden
							/>
						</Button>
					)}
					{isActive && canCreateServer && (
						<>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div>
											<SetupServer serverId={server.serverId} asButton />
										</div>
									</TooltipTrigger>
									<TooltipContent>Setup and validate server</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							{server.sshKeyId && server.serverType !== "build" && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div>
												<ShowServerActions
													serverId={server.serverId}
													asButton
												/>
											</div>
										</TooltipTrigger>
										<TooltipContent>Server operations</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</>
					)}
					{isActive && canUseTerminal && server.sshKeyId && (
						<TerminalModal serverId={server.serverId} asButton>
							<Button
								variant="outline"
								size="icon"
								aria-label={`Open terminal for ${server.name}`}
							>
								<Terminal className="size-4" aria-hidden />
							</Button>
						</TerminalModal>
					)}
					{isActive && canCreateServer && (
						<HandleServers serverId={server.serverId} asButton />
					)}
					{canDeleteServer && (
						<DeleteServerModal
							serverId={server.serverId}
							serverName={server.name}
						>
							<Button
								variant="ghost"
								size="icon"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								aria-label={`Remove ${server.name}`}
							>
								<Trash2 className="size-4" aria-hidden />
							</Button>
						</DeleteServerModal>
					)}
					{canReadMonitoring && isCloud && isActive && (
						<Button asChild variant="outline" size="sm">
							<Link
								href={`/dashboard/monitoring?workspace=server:${server.serverId}`}
							>
								Monitoring
							</Link>
						</Button>
					)}
				</div>
			</CardContent>
			{health.data?.error && (
				<div className="border-t px-4 py-3">
					<p className="text-sm text-destructive">
						Server health check failed: {health.data.error}
					</p>
				</div>
			)}
			{health.isError && (
				<div className="border-t px-4 py-3">
					<p className="text-sm text-destructive">
						Unable to check server connection: {health.error.message}
					</p>
				</div>
			)}
		</Card>
	);
}

function LocalExecutionTarget({
	canReadDocker,
	canReadServices,
	services,
}: {
	canReadDocker: boolean;
	canReadServices: boolean;
	services: RouterOutputs["overview"]["services"];
}) {
	const health = api.docker.getServerHealth.useQuery(
		{},
		{
			enabled: canReadDocker,
			refetchInterval: 60_000,
			refetchOnWindowFocus: false,
		},
	);
	const images = api.dockerImage.getImages.useQuery(
		{},
		{ enabled: canReadDocker, refetchOnWindowFocus: false },
	);
	const status = getConnectionStatus({
		isActive: true,
		canCheck: canReadDocker,
		isPending: health.isPending,
		isError: health.isError,
		error: health.data?.error,
	});

	return (
		<Card className="border-primary/30">
			<CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(15rem,1.2fr)_minmax(17rem,1fr)_auto] lg:items-center">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<ServerIcon className="size-4 text-muted-foreground" aria-hidden />
						<h2 className="font-semibold">Notploy instance</h2>
						<Badge variant="outline">Local</Badge>
						<ConnectionBadge status={status} />
					</div>
					<p className="text-sm text-muted-foreground">
						Local Docker execution target on this self-hosted instance.
					</p>
					{health.data?.checkedAt && !health.data.error && (
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Clock3 className="size-3.5" aria-hidden />
							Checked{" "}
							{formatDistanceToNow(new Date(health.data.checkedAt), {
								addSuffix: true,
							})}
						</p>
					)}
				</div>
				<div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
					<ResourceValue
						icon={Cpu}
						label="CPU"
						value={
							health.data?.error ? undefined : health.data?.resources.cpuCount
						}
						format={(value) => `${value} cores`}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={MemoryStick}
						label="Memory"
						value={
							health.data?.error
								? undefined
								: health.data?.resources.memTotalBytes
						}
						format={(total) => {
							const used = health.data?.resources.memUsedBytes;
							return used === undefined
								? formatBytes(total)
								: `${formatBytes(used)} / ${formatBytes(total)}`;
						}}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={HardDrive}
						label="Disk"
						value={
							health.data?.error ? undefined : health.data?.disk.totalBytes
						}
						format={(total) => {
							const used = health.data?.disk.usedBytes;
							return used === undefined
								? formatBytes(total)
								: `${formatBytes(used)} / ${formatBytes(total)}`;
						}}
						loading={health.isPending}
					/>
					<ResourceValue
						icon={Activity}
						label="Docker"
						value={
							health.data?.error
								? undefined
								: health.data?.containers.containerCount
						}
						format={(count) => `${count} containers`}
						loading={health.isPending}
					/>
				</div>
				<div className="flex flex-wrap items-center gap-2 border-t pt-3 lg:border-t-0 lg:pt-0">
					{canReadDocker && (
						<span className="text-xs text-muted-foreground">
							{images.isPending
								? "Images loading…"
								: images.isError
									? "Images unavailable"
									: `${images.data?.length ?? "—"} images`}
							{" · "}
							{health.data?.error
								? "Networks unavailable"
								: health.data
									? `${health.data.dockerNetworks.count} networks`
									: "Networks loading…"}
						</span>
					)}
					<Button asChild variant="outline" size="sm">
						<Link href="/dashboard/docker">Open local Docker</Link>
					</Button>
					{canReadServices && services.length > 0 && (
						<ul className="basis-full space-y-1 border-t pt-2">
							{services.slice(0, 4).map((service) => (
								<li key={`${service.type}-${service.id}`}>
									<Link
										href={`/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`}
										className="flex items-center justify-between gap-2 text-sm hover:text-primary"
									>
										<span className="truncate">{service.name}</span>
										<Badge variant="outline">{service.status}</Badge>
									</Link>
								</li>
							))}
							{services.length > 4 && (
								<li className="text-xs text-muted-foreground">
									And {services.length - 4} more workloads
								</li>
							)}
						</ul>
					)}
					{health.isError && (
						<p className="basis-full text-sm text-destructive">
							{health.error.message}
						</p>
					)}
					{health.data?.error && (
						<p className="basis-full text-sm text-destructive">
							{health.data.error}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function ResourceValue<T extends number>({
	icon: Icon,
	label,
	value,
	format,
	loading,
}: {
	icon: typeof Cpu;
	label: string;
	value: T | undefined;
	format: (value: T) => string;
	loading: boolean;
}) {
	return (
		<div className="min-w-0">
			<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Icon className="size-3.5" aria-hidden />
				{label}
			</p>
			<p className="mt-1 truncate font-medium tabular-nums">
				{loading ? "Checking…" : value === undefined ? "—" : format(value)}
			</p>
		</div>
	);
}

type ConnectionStatus =
	| "online"
	| "offline"
	| "inactive"
	| "checking"
	| "unknown";

function getConnectionStatus({
	isActive,
	canCheck,
	isPending,
	isError,
	error,
}: {
	isActive: boolean;
	canCheck: boolean;
	isPending: boolean;
	isError: boolean;
	error?: string;
}): ConnectionStatus {
	if (!isActive) return "inactive";
	if (!canCheck) return "unknown";
	if (isPending) return "checking";
	if (isError || error) return "offline";
	return "online";
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
	const details: Record<
		ConnectionStatus,
		{
			label: string;
			variant: "default" | "destructive" | "secondary" | "outline";
		}
	> = {
		online: { label: "Online", variant: "default" },
		offline: { label: "Unreachable", variant: "destructive" },
		inactive: { label: "Inactive", variant: "secondary" },
		checking: { label: "Connecting", variant: "outline" },
		unknown: { label: "Unknown", variant: "outline" },
	};
	const { label, variant } = details[status];

	return (
		<Badge variant={variant} className="gap-1.5">
			<span
				className={`size-1.5 rounded-full ${
					status === "online"
						? "bg-green-500"
						: status === "offline"
							? "bg-destructive-foreground"
							: "bg-current opacity-60"
				}`}
				aria-hidden
			/>
			{label}
		</Badge>
	);
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
